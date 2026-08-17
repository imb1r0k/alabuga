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
import requests

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
        logger.error(f"Ошибка подключения к базе {config.DB_HOST}: {e}")
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


def download_vk_photo(url, save_path):
    """Скачивает фото по прямой ссылке VK"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, stream=True, timeout=15, headers=headers)
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'image' in content_type:
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                return True
        return False
    except Exception as e:
        logger.error(f"Ошибка скачивания фото: {e}")
        return False


def process_vk_attachments(attachments, vk_session):
    """Обработка вложений от VK с корректным получением ссылок на файлы и скачиванием"""
    if not attachments:
        return [], ""

    saved_files = []
    text_parts = []
    attach_list = []

    # Нормализация вложений в список
    if isinstance(attachments, dict):
        for key, value in attachments.items():
            if key.startswith('attach') and not key.endswith('_type'):
                if isinstance(value, dict):
                    attach_list.append(value)
                else:
                    attach_type = attachments.get(f"{key}_type", 'photo')
                    attach_list.append({'type': attach_type, 'id': value})
    elif isinstance(attachments, list):
        attach_list = attachments
    else:
        attach_list = [attachments]

    # Создаем директорию для загрузок
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    for attach in attach_list:
        file_url = None
        file_name = None
        file_size = 0
        attach_type = 'unknown'
        attach_id = None
        owner_id = None

        if isinstance(attach, dict):
            attach_type = attach.get('type', 'photo')
            
            # Извлекаем вложенные данные
            nested = attach.get(attach_type, {})
            if not nested:
                nested = attach

            attach_id = nested.get('id') or attach.get('id') or ''
            owner_id = nested.get('owner_id') or attach.get('owner_id') or ''

            # Если id пришёл в формате "ownerId_mediaId"
            if isinstance(attach_id, str) and '_' in attach_id:
                parts = attach_id.split('_', 1)
                owner_id = parts[0]
                attach_id = parts[1]

            if attach_type == 'photo':
                # Пытаемся получить ссылку через sizes
                sizes = nested.get('sizes', [])
                if sizes:
                    # Берем изображение с максимальным разрешением
                    best = max(sizes, key=lambda s: s.get('width', 0) * s.get('height', s.get('width', 0)))
                    file_url = best.get('url', '')
                
                # Если sizes нет или URL не получен, используем VK API
                if not file_url and attach_id and vk_session:
                    try:
                        vk = vk_session.get_api()
                        photo_id = f"{owner_id}_{attach_id}" if owner_id else attach_id
                        
                        try:
                            resp = vk.photos.getById(photos=photo_id, extended=0)
                            if resp:
                                photo_data = resp[0]
                                sizes = photo_data.get('sizes', [])
                                if sizes:
                                    best = max(sizes, key=lambda s: s.get('width', 0) * s.get('height', s.get('width', 0)))
                                    file_url = best.get('url', '')
                                else:
                                    for size_key in ['photo_2560', 'photo_1280', 'photo_807', 'photo_604', 'photo_130', 'photo_75']:
                                        if photo_data.get(size_key):
                                            file_url = photo_data[size_key]
                                            break
                        except Exception as e:
                            logger.debug(f"photos.getById не сработал: {e}")
                    except Exception as e:
                        logger.error(f"Ошибка получения фото через VK API: {e}")

                # Если всё ещё нет URL, пробуем скачать через прямую ссылку VK
                if not file_url and attach_id:
                    direct_url = f"https://vk.com/photo{owner_id}_{attach_id}" if owner_id else f"https://vk.com/photo{attach_id}"
                    file_name = f"photo_{attach_id}.jpg"
                    
                    local_path = os.path.join(UPLOAD_DIR, f"photo_{attach_id}_{int(time.time())}.jpg")
                    if download_vk_photo(direct_url, local_path):
                        file_url = f"/{UPLOAD_DIR}{os.path.basename(local_path)}"
                        logger.info(f"Фото скачано: {file_url}")
                    else:
                        file_url = direct_url
                        logger.warning(f"Не удалось скачать фото, сохраняем ссылку: {file_url}")
                
                file_name = f"photo_{attach_id}.jpg" if not file_name else file_name

            elif attach_type == 'doc':
                file_url = nested.get('url', '')
                file_name = nested.get('title', 'document')
                file_size = nested.get('size', 0)
                
                if not file_url and attach_id and vk_session:
                    try:
                        vk = vk_session.get_api()
                        doc_id = f"{owner_id}_{attach_id}" if owner_id else attach_id
                        resp = vk.docs.getById(docs=doc_id)
                        if resp:
                            doc_data = resp[0] if isinstance(resp, list) else resp
                            file_url = doc_data.get('url', '')
                            file_name = doc_data.get('title', file_name)
                            file_size = doc_data.get('size', file_size)
                            
                            if file_url:
                                local_path = os.path.join(UPLOAD_DIR, f"doc_{attach_id}_{int(time.time())}.pdf")
                                try:
                                    response = requests.get(file_url, stream=True, timeout=15)
                                    if response.status_code == 200:
                                        os.makedirs(os.path.dirname(local_path), exist_ok=True)
                                        with open(local_path, 'wb') as f:
                                            for chunk in response.iter_content(1024):
                                                f.write(chunk)
                                        file_url = f"/{UPLOAD_DIR}{os.path.basename(local_path)}"
                                        logger.info(f"Документ скачан: {file_url}")
                                except Exception as e:
                                    logger.error(f"Ошибка скачивания документа: {e}")
                    except Exception as e:
                        logger.error(f"Ошибка получения документа: {e}")

            elif attach_type == 'video':
                file_url = nested.get('player', '')
                file_name = f"video_{attach_id}"
                if not file_url:
                    file_url = f"https://vk.com/video{owner_id}_{attach_id}" if owner_id else f"https://vk.com/video{attach_id}"

            elif attach_type == 'link':
                url = nested.get('url') or nested.get('link', {}).get('url', '')
                if url:
                    text_parts.append(f"🔗 {url}")
                continue

            elif attach_type == 'wall':
                text_parts.append(f"🔗 https://vk.com/wall{owner_id}_{attach_id}")
                continue

            else:
                text_parts.append(f"📎 Вложение ({attach_type})")
                continue

        elif isinstance(attach, str) and '_' in attach:
            parts = attach.split('_')
            if len(parts) >= 2:
                owner_id, media_id = parts[0], parts[1]
                direct_url = f"https://vk.com/photo{owner_id}_{media_id}"
                local_path = os.path.join(UPLOAD_DIR, f"photo_{media_id}_{int(time.time())}.jpg")
                if download_vk_photo(direct_url, local_path):
                    file_url = f"/{UPLOAD_DIR}{os.path.basename(local_path)}"
                else:
                    file_url = direct_url
                file_name = f"photo_{media_id}.jpg"
                attach_type = 'photo'
            else:
                continue

        if file_url:
            saved_files.append({
                'file_type': attach_type,
                'file_url': file_url,
                'original_name': file_name or f"{attach_type}_{attach_id or 'file'}",
                'file_size': file_size
            })
            text_parts.append(f"📎 {file_name or 'файл'}")

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