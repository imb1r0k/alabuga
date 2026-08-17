import pymysql
from pymysql.cursors import DictCursor
import config
import logging
import re
import random
import string
import os
import json
import time
from urllib.parse import urlparse
from datetime import datetime

# Безопасный импорт bcrypt с фоллбеком
try:
    import bcrypt
except ImportError:
    bcrypt = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

UPLOAD_DIR = 'uploads/vk_bot/'
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

_cached_connection = None
_last_conn_time = 0

def get_db_connection():
    """Возвращает живое переиспользуемое соединение с удаленной БД"""
    global _cached_connection, _last_conn_time
    now = time.time()
    
    # Переиспользуем существующее соединение, если оно живо (до 30 сек)
    if _cached_connection is not None and (now - _last_conn_time < 30):
        try:
            _cached_connection.ping(reconnect=True)
            _last_conn_time = now
            return _cached_connection
        except Exception:
            _cached_connection = None

    try:
        conn = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4',
            cursorclass=DictCursor,
            autocommit=True,
            connect_timeout=6,
            read_timeout=10,
            write_timeout=10
        )
        _cached_connection = conn
        _last_conn_time = now
        return conn
    except Exception as e:
        logger.error(f"❌ Ошибка подключения к базе {config.DB_HOST}: {e}")
        # Запасная попытка подключения
        conn = pymysql.connect(
            host='127.0.0.1',
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4',
            cursorclass=DictCursor,
            autocommit=True,
            connect_timeout=3
        )
        _cached_connection = conn
        _last_conn_time = now
        return conn


def get_bot_settings():
    """Получает настройки бота из таблицы vk_bot_settings"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT `key`, `value` FROM vk_bot_settings")
            rows = cursor.fetchall()
            return {r['key']: r['value'] for r in rows}
    except Exception as e:
        logger.error(f"Ошибка получения настроек бота: {e}")
        return {}


def hash_password(password):
    """Хеширование пароля совместимое с PHP password_hash (bcrypt)"""
    if bcrypt:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=8)).decode('utf-8')
    import hashlib
    salt = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    return '$2y$08$' + hashlib.sha256((password + salt).encode('utf-8')).hexdigest()[:53]


def generate_password(length=10):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))


def generate_login(first_name, last_name):
    base_login = re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', f"{last_name.lower()}{first_name.lower()}")
    if len(base_login) < 3:
        base_login = f"user{random.randint(100, 999)}"
    
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) as cnt FROM users WHERE login LIKE %s", (f"{base_login}%",))
        count = cursor.fetchone()['cnt']
        return f"{base_login}{count + 1}" if count > 0 else base_login


def find_or_create_user(vk_id, first_name, last_name, vk_url=''):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        if vk_id:
            cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
            user = cursor.fetchone()
            if user:
                return user

        if vk_url:
            cursor.execute("SELECT * FROM users WHERE vk_url = %s", (vk_url,))
            user = cursor.fetchone()
            if user:
                if user.get('vk_id') != vk_id:
                    cursor.execute("UPDATE users SET vk_id = %s WHERE id = %s", (vk_id, user['id']))
                return user

        login = generate_login(first_name, last_name)
        password = generate_password()
        hashed_password = hash_password(password)
        full_name = f"{last_name} {first_name}".strip()

        cursor.execute("""
            INSERT INTO users
            (vk_id, vk_url, first_name, last_name, name, login, phone, password, role, status, rating, completed_tasks, social_vk, bot_registered)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            vk_id, vk_url, first_name, last_name, full_name,
            login, '', hashed_password, 'user', 'active', 0, 0, vk_url, 1
        ))

        user_id = cursor.lastrowid
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        user['generated_password'] = password
        logger.info(f"Создан новый пользователь: {first_name} {last_name}, логин: {login}")
        return user


def get_user_by_vk_id(vk_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
        return cursor.fetchone()


def find_existing_user(vk_id, vk_url=''):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        if vk_id:
            cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
            user = cursor.fetchone()
            if user:
                return user
        if vk_url:
            cursor.execute("SELECT * FROM users WHERE vk_url = %s", (vk_url,))
            user = cursor.fetchone()
            if user:
                return user
        return None


def get_active_task_group():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT * FROM vk_bot_task_groups 
            WHERE start_date <= CURDATE() AND end_date >= CURDATE()
            ORDER BY start_date ASC LIMIT 1
        """)
        return cursor.fetchone()


def get_tasks_for_group(group_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT * FROM vk_bot_tasks 
            WHERE group_id = %s 
            ORDER BY FIELD(difficulty, 'easy', 'medium', 'hard'), id ASC
        """, (group_id,))
        return cursor.fetchall()


def get_user_task_report(user_id, task_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT * FROM vk_bot_reports
            WHERE user_id = %s AND task_id = %s
            ORDER BY id DESC LIMIT 1
        """, (user_id, task_id))
        return cursor.fetchone()


def get_user_task_status(user_id, task_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT id FROM vk_bot_reports
            WHERE user_id = %s AND task_id = %s AND status = 'approved'
            LIMIT 1
        """, (user_id, task_id))
        if cursor.fetchone():
            return 'approved'
        cursor.execute("""
            SELECT status FROM vk_bot_reports
            WHERE user_id = %s AND task_id = %s
            ORDER BY id DESC LIMIT 1
        """, (user_id, task_id))
        row = cursor.fetchone()
        return row['status'] if row else None


def create_report(user_id, task_id, submission_text, has_attachments=False):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO vk_bot_reports (user_id, task_id, submission_text, has_attachments, status) 
            VALUES (%s, %s, %s, %s, 'pending')
        """, (user_id, task_id, submission_text, 1 if has_attachments else 0))
        return cursor.lastrowid


def save_report_media(report_id, file_url, file_type, original_name, file_size):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO vk_bot_report_media (report_id, file_url, file_type, original_name, file_size) 
            VALUES (%s, %s, %s, %s, %s)
        """, (report_id, file_url, file_type, original_name, file_size))
        return cursor.lastrowid


def get_report_media(report_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM vk_bot_report_media WHERE report_id = %s ORDER BY id ASC", (report_id,))
        return cursor.fetchall()


def process_vk_attachments(attachments, vk_session):
    """
    Обработка вложений от VK.
    Получаем прямые ссылки на фото через photo['sizes'][-1]['url']
    """
    if not attachments:
        return [], ""

    saved_files = []
    text_parts = []

    # attachments может быть списком или dict
    if isinstance(attachments, dict):
        # Преобразуем dict в список
        attach_list = []
        for key, value in attachments.items():
            if key.startswith('attach') and not key.endswith('_type'):
                if isinstance(value, dict):
                    attach_list.append(value)
                else:
                    attach_type = attachments.get(f"{key}_type", 'photo')
                    attach_list.append({'type': attach_type, 'id': value})
        attachments = attach_list
    elif not isinstance(attachments, list):
        attachments = [attachments]

    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue

        # Определяем тип вложения
        attach_type = attachment.get('type', '')
        
        # Если тип не указан, пробуем определить по ключам
        if not attach_type:
            if 'photo' in attachment:
                attach_type = 'photo'
            elif 'doc' in attachment:
                attach_type = 'doc'
            elif 'video' in attachment:
                attach_type = 'video'
            elif 'link' in attachment:
                attach_type = 'link'
            elif 'wall' in attachment:
                attach_type = 'wall'
            elif 'audio' in attachment:
                attach_type = 'audio'
        
        if attach_type == 'photo':
            # Получаем объект photo
            photo = attachment.get('photo', {})
            if not photo:
                # Если photo нет на верхнем уровне, возможно это сам объект photo
                if 'sizes' in attachment:
                    photo = attachment
                else:
                    logger.warning("Пустой объект photo в вложении")
                    continue
            
            # Получаем URL самого качественного фото (последний элемент в sizes)
            sizes = photo.get('sizes', [])
            if sizes:
                # Берем последний элемент - он самый качественный
                best_photo = sizes[-1]
                file_url = best_photo.get('url', '')
                
                if file_url:
                    # Извлекаем ID фото для имени файла
                    photo_id = photo.get('id', '')
                    owner_id = photo.get('owner_id', '')
                    file_name = f"photo_{owner_id}_{photo_id}.jpg" if owner_id and photo_id else f"photo_{int(time.time())}.jpg"
                    
                    saved_files.append({
                        'file_type': 'photo',
                        'file_url': file_url,
                        'original_name': file_name,
                        'file_size': 0
                    })
                    text_parts.append(f"📎 {file_name}")
                    logger.info(f"Получена прямая ссылка на фото: {file_url[:100]}...")
                else:
                    logger.warning("Не удалось получить URL фото из sizes")
            else:
                # Пробуем получить через прямые ключи
                for size_key in ['photo_2560', 'photo_1280', 'photo_807', 'photo_604', 'photo_130', 'photo_75']:
                    if photo.get(size_key):
                        file_url = photo[size_key]
                        if file_url:
                            photo_id = photo.get('id', '')
                            owner_id = photo.get('owner_id', '')
                            file_name = f"photo_{owner_id}_{photo_id}.jpg" if owner_id and photo_id else f"photo_{int(time.time())}.jpg"
                            
                            saved_files.append({
                                'file_type': 'photo',
                                'file_url': file_url,
                                'original_name': file_name,
                                'file_size': 0
                            })
                            text_parts.append(f"📎 {file_name}")
                            logger.info(f"Получена прямая ссылка на фото из {size_key}: {file_url[:100]}...")
                            break
                else:
                    logger.warning("Нет sizes и нет прямых ключей в фото")
                    
        elif attach_type == 'doc':
            # Для документов
            doc = attachment.get('doc', {})
            if doc:
                file_url = doc.get('url', '')
                file_name = doc.get('title', 'document')
                file_size = doc.get('size', 0)
                
                if file_url:
                    saved_files.append({
                        'file_type': 'doc',
                        'file_url': file_url,
                        'original_name': file_name,
                        'file_size': file_size
                    })
                    text_parts.append(f"📎 {file_name}")
                    logger.info(f"Получена ссылка на документ: {file_url[:100]}...")
                    
        elif attach_type == 'video':
            # Для видео
            video = attachment.get('video', {})
            if video:
                file_url = video.get('player', '')
                video_id = video.get('id', '')
                owner_id = video.get('owner_id', '')
                file_name = f"video_{owner_id}_{video_id}.mp4" if owner_id and video_id else f"video_{int(time.time())}.mp4"
                
                if file_url:
                    saved_files.append({
                        'file_type': 'video',
                        'file_url': file_url,
                        'original_name': file_name,
                        'file_size': 0
                    })
                    text_parts.append(f"📎 {file_name}")
                    logger.info(f"Получена ссылка на видео: {file_url[:100]}...")
                    
        elif attach_type == 'link':
            # Для ссылок
            link = attachment.get('link', {})
            if link:
                url = link.get('url', '')
                if url:
                    text_parts.append(f"🔗 {url}")
                    
        elif attach_type == 'wall':
            # Для постов на стене
            wall = attachment.get('wall', {})
            if wall:
                wall_id = wall.get('id', '')
                owner_id = wall.get('owner_id', '')
                if wall_id and owner_id:
                    text_parts.append(f"🔗 https://vk.com/wall{owner_id}_{wall_id}")
                    
        elif attach_type == 'audio':
            # Для аудио
            audio = attachment.get('audio', {})
            if audio:
                artist = audio.get('artist', '')
                title = audio.get('title', '')
                if artist or title:
                    text_parts.append(f"🎵 {artist} - {title}")
                    
        else:
            # Другие типы вложений
            text_parts.append(f"📎 Вложение ({attach_type})")
            logger.debug(f"Неизвестный тип вложения: {attach_type}")

    return saved_files, "\n".join(text_parts)


def get_user_tickets(user_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT tk.*, g.title as group_title
            FROM vk_bot_tickets tk
            JOIN vk_bot_task_groups g ON tk.group_id = g.id
            WHERE tk.user_id = %s
            AND tk.created_at >= NOW() - INTERVAL 30 DAY
            ORDER BY tk.created_at DESC
        """, (user_id,))
        return cursor.fetchall()


def get_pending_notifications(limit=10):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT n.*, u.vk_id, u.vk_url, u.first_name, u.last_name
            FROM vk_bot_notifications n
            JOIN users u ON n.user_id = u.id
            WHERE n.is_sent = 0
            ORDER BY n.created_at ASC
            LIMIT %s
        """, (limit,))
        return cursor.fetchall()


def mark_notification_sent(notification_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("UPDATE vk_bot_notifications SET is_sent = 1, sent_at = NOW() WHERE id = %s", (notification_id,))


def add_notification(user_id, message, report_id=None):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO vk_bot_notifications (user_id, report_id, message)
            VALUES (%s, %s, %s)
        """, (user_id, report_id, message))


def create_request(user_id, category, subject, description):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO vk_bot_requests (user_id, category, subject, description, status)
            VALUES (%s, %s, %s, %s, 'open')
        """, (user_id, category, subject, description))
        return cursor.lastrowid


def get_user_requests(user_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM vk_bot_requests WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        return cursor.fetchall()


def get_user_request_by_id(request_id, user_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM vk_bot_requests WHERE id = %s AND user_id = %s", (request_id, user_id))
        return cursor.fetchone()


def get_request_by_id(request_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM vk_bot_requests WHERE id = %s", (request_id,))
        return cursor.fetchone()


def get_request_messages(request_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT m.*, u.first_name, u.last_name, u.vk_id
            FROM vk_bot_request_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.request_id = %s
            ORDER BY m.created_at ASC
        """, (request_id,))
        return cursor.fetchall()


def add_request_message(request_id, user_id, message):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO vk_bot_request_messages (request_id, user_id, message)
            VALUES (%s, %s, %s)
        """, (request_id, user_id, message))
        return cursor.lastrowid


def get_all_requests_for_admin(status=None):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        sql = "SELECT r.*, u.first_name, u.last_name, u.vk_id FROM vk_bot_requests r JOIN users u ON r.user_id = u.id"
        if status and status != 'all':
            sql += " WHERE r.status = %s"
            cursor.execute(sql, (status,))
        else:
            cursor.execute(sql)
        return cursor.fetchall()


def get_last_request_message(request_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT m.*, u.first_name, u.last_name, u.vk_id
            FROM vk_bot_request_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.request_id = %s
            ORDER BY m.created_at DESC
            LIMIT 1
        """, (request_id,))
        return cursor.fetchone()


def check_user_agreement(user_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT agreement_accepted_at FROM users WHERE id = %s", (user_id,))
        result = cursor.fetchone()
        return bool(result and result.get('agreement_accepted_at'))


def set_user_agreement(user_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("UPDATE users SET agreement_accepted_at = NOW() WHERE id = %s", (user_id,))
        return cursor.rowcount > 0