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
    Обрабатывает вложения из сообщения VK.
    Возвращает список ссылок на файлы и текстовое описание.
    """
    if not attachments:
        return [], ""

    saved_files = []
    text_parts = []

    # attachments может быть словарем { 'attach1': {'type': 'photo', 'id': '...'}, 'attach1_type': 'photo' }
    attach_list = []

    if isinstance(attachments, dict):
        # Извлекаем все attach1, attach2, ... из словаря
        for key, value in attachments.items():
            if key.startswith('attach') and not key.endswith('_type'):
                # Значение может быть словарем с type и id
                if isinstance(value, dict):
                    attach_list.append(value)
                else:
                    # Если value - строка, ищем тип в attach1_type
                    attach_type_key = f"{key}_type"
                    attach_type = attachments.get(attach_type_key, 'photo')
                    attach_list.append({
                        'type': attach_type,
                        'id': value
                    })
    elif isinstance(attachments, list):
        attach_list = attachments
    else:
        attach_list = [attachments]

    logger.info(f"Обработка {len(attach_list)} вложений")

    # Получаем API для запросов
    try:
        api = vk_session.get_api()
    except Exception as e:
        logger.error(f"Ошибка получения API: {e}")
        return [], ""

    for attach in attach_list:
        file_url = None
        file_name = None
        file_size = 0
        attach_type = 'unknown'
        attach_id = None
        owner_id = None
        access_key = None

        # Если attach - строка с ID (приходит как "473566088_457255481")
        if isinstance(attach, str):
            attach_id = attach
            attach_type = 'photo'  # По умолчанию считаем фото
            try:
                parts = attach.split('_')
                if len(parts) == 2:
                    owner_id = parts[0]
                    media_id = parts[1]
                    
                    # Пробуем получить прямую ссылку через API
                    try:
                        photo_str = f"{owner_id}_{media_id}"
                        logger.info(f"Получение фото через API: {photo_str}")
                        photo_response = api.photos.getById(
                            photos=photo_str,
                            photo_sizes=1
                        )
                        if photo_response and len(photo_response) > 0:
                            sizes = photo_response[0].get('sizes', [])
                            if sizes:
                                sizes.sort(key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
                                file_url = sizes[0].get('url')
                                file_name = f"photo_{media_id}.jpg"
                                logger.info(f"Получена прямая ссылка на фото через API: {file_url}")
                    except Exception as e:
                        logger.error(f"Ошибка получения фото через API: {e}")
                    
                    # Если не получили URL через API, создаем ссылку на страницу VK
                    if not file_url:
                        file_url = f"https://vk.com/photo{owner_id}_{media_id}"
                        file_name = f"photo_{media_id}.jpg"
                        text_parts.append(f"🖼️ фото_{media_id}")
            except Exception as e:
                logger.error(f"Ошибка парсинга ID: {e}")
                text_parts.append(f"📎 {attach}")
                continue

        # Если attach - словарь
        elif isinstance(attach, dict):
            attach_type = attach.get('type', 'unknown')

            # В VkBotLongPoll данные лежат во вложенном ключе по типу (photo, doc, ...)
            attach_data = attach.get(attach_type) or attach.get('data') or attach

            attach_id = attach_data.get('id', '')
            owner_id = attach_data.get('owner_id', '')
            access_key = attach_data.get('access_key', '')

            # Если owner_id нет, но есть в attach_id с подчеркиванием
            if not owner_id and attach_id and '_' in str(attach_id):
                parts = str(attach_id).split('_')
                if len(parts) == 2:
                    owner_id = parts[0]
                    attach_id = parts[1]

            logger.info(f"Обработка вложения: тип={attach_type}, id={attach_id}, owner={owner_id}")

            # --- ОБРАБОТКА ФОТО ---
            if attach_type == 'photo':
                # Сначала пробуем получить прямой URL из sizes в данных
                sizes = attach_data.get('sizes', [])
                if sizes:
                    sizes.sort(key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
                    file_url = sizes[0].get('url')
                    file_name = f"photo_{attach_id}.jpg" if attach_id else 'photo.jpg'
                    logger.info(f"Получен URL фото из sizes: {file_url}")
                else:
                    # Пробуем получить прямую ссылку через API
                    try:
                        if owner_id and attach_id:
                            # Формируем строку фото с access_key если есть
                            photo_str = f"{owner_id}_{attach_id}"
                            if access_key:
                                photo_str = f"{owner_id}_{attach_id}_{access_key}"

                            logger.info(f"Получение фото через API: {photo_str}")
                            photo_response = api.photos.getById(
                                photos=photo_str,
                                photo_sizes=1
                            )
                            if photo_response and len(photo_response) > 0:
                                sizes = photo_response[0].get('sizes', [])
                                if sizes:
                                    sizes.sort(key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
                                    file_url = sizes[0].get('url')
                                    file_name = f"photo_{attach_id}.jpg"
                                    logger.info(f"Получена прямая ссылка на фото через API: {file_url}")
                    except Exception as e:
                        logger.error(f"Ошибка получения фото через API: {e}")

                # Если все еще нет URL, создаем ссылку на страницу VK
                if not file_url:
                    if owner_id and attach_id:
                        file_url = f"https://vk.com/photo{owner_id}_{attach_id}"
                        file_name = f"photo_{attach_id}.jpg"
                    else:
                        # Пробуем другие поля
                        for key in ['photo_2560', 'photo_1280', 'photo_807', 'photo_604', 'photo_130', 'photo_75']:
                            if attach_data.get(key):
                                file_url = attach_data[key]
                                file_name = f"photo_{attach_id}.jpg" if attach_id else 'photo.jpg'
                                logger.info(f"Получен URL фото из {key}: {file_url}")
                                break

            # --- ОБРАБОТКА ДОКУМЕНТОВ ---
            elif attach_type == 'doc':
                # Пробуем получить прямую ссылку через API
                try:
                    if owner_id and attach_id:
                        doc_str = f"{owner_id}_{attach_id}"
                        if access_key:
                            doc_str = f"{owner_id}_{attach_id}_{access_key}"

                        logger.info(f"Получение документа через API: {doc_str}")
                        doc_response = api.docs.getById(docs=doc_str)
                        if doc_response and len(doc_response) > 0:
                            file_url = doc_response[0].get('url')
                            file_name = doc_response[0].get('title', f"doc_{attach_id}")
                            file_size = doc_response[0].get('size', 0)
                            logger.info(f"Получена прямая ссылка на документ: {file_url}")
                except Exception as e:
                    logger.error(f"Ошибка получения документа через API: {e}")

                if not file_url:
                    if owner_id and attach_id:
                        file_url = f"https://vk.com/doc{owner_id}_{attach_id}"
                        file_name = attach_data.get('title', f"doc_{attach_id}")
                    else:
                        file_url = attach_data.get('url')
                        file_name = attach_data.get('title', 'document')
                    file_size = attach_data.get('size', 0)

            # --- ОБРАБОТКА ВИДЕО ---
            elif attach_type == 'video':
                try:
                    if owner_id and attach_id:
                        video_str = f"{owner_id}_{attach_id}"
                        if access_key:
                            video_str = f"{owner_id}_{attach_id}_{access_key}"

                        logger.info(f"Получение видео через API: {video_str}")
                        video_response = api.video.get(videos=video_str)
                        if video_response and 'items' in video_response and len(video_response['items']) > 0:
                            file_url = video_response['items'][0].get('player')
                            file_name = f"video_{attach_id}"
                            logger.info(f"Получена ссылка на видео: {file_url}")
                except Exception as e:
                    logger.error(f"Ошибка получения видео через API: {e}")

                if not file_url:
                    if owner_id and attach_id:
                        file_url = f"https://vk.com/video{owner_id}_{attach_id}"
                        file_name = f"video_{attach_id}"
                    else:
                        file_url = attach_data.get('player')
                        file_name = f"video_{attach_id}" if attach_id else 'video'

            # --- ОБРАБОТКА АУДИО ---
            elif attach_type == 'audio':
                try:
                    if owner_id and attach_id:
                        audio_str = f"{owner_id}_{attach_id}"
                        if access_key:
                            audio_str = f"{owner_id}_{attach_id}_{access_key}"

                        logger.info(f"Получение аудио через API: {audio_str}")
                        audio_response = api.audio.getById(audios=audio_str)
                        if audio_response and len(audio_response) > 0:
                            file_url = audio_response[0].get('url')
                            file_name = f"audio_{attach_id}.mp3"
                            logger.info(f"Получена ссылка на аудио: {file_url}")
                except Exception as e:
                    logger.error(f"Ошибка получения аудио через API: {e}")

                if not file_url:
                    if owner_id and attach_id:
                        file_url = f"https://vk.com/audio{owner_id}_{attach_id}"
                        file_name = f"audio_{attach_id}.mp3" if attach_id else 'audio.mp3'
                    else:
                        file_url = attach_data.get('url')
                        file_name = f"audio_{attach_id}.mp3" if attach_id else 'audio.mp3'

            # --- ОБРАБОТКА ССЫЛОК ---
            elif attach_type == 'link':
                url = attach_data.get('url', '')
                if not url:
                    url = attach_data.get('link', {}).get('url', '')
                text_parts.append(f"🔗 Ссылка: {url}")
                continue

            # --- ОБРАБОТКА ЗАПИСЕЙ НА СТЕНЕ ---
            elif attach_type == 'wall':
                owner_id = attach_data.get('owner_id', '')
                wall_id = attach_data.get('id', '')
                text_parts.append(f"🔗 Запись на стене: https://vk.com/wall{owner_id}_{wall_id}")
                continue

            else:
                logger.warning(f"Неизвестный тип вложения: {attach_type}")
                continue

        # Если файл найден, сохраняем ссылку
        if file_url:
            saved_files.append({
                'file_type': attach_type,
                'file_url': file_url,
                'original_name': file_name or 'file',
                'file_size': file_size
            })

            file_type_emoji = {
                'photo': '🖼️',
                'video': '🎬',
                'audio': '🎵',
                'doc': '📄',
                'file': '📎'
            }
            emoji = file_type_emoji.get(attach_type, '📎')
            # Проверяем, не добавлен ли уже этот файл в текст
            if file_name and not any(file_name in tp for tp in text_parts if isinstance(tp, str)):
                text_parts.append(f"{emoji} {file_name}")
        else:
            if attach_id:
                text_parts.append(f"📎 Вложение: {attach_id}")
                logger.warning(f"Не удалось получить URL для вложения: {attach}")

    logger.info(f"Обработано файлов: {len(saved_files)}")

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


def update_report_status(report_id, status, reject_reason=''):
    """Обновляет статус отчета, начисляет баллы, выдает билеты"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT r.*, 
                       t.points, t.title, t.group_id,
                       u.id as user_id, u.vk_id, u.vk_url
                FROM vk_bot_reports r
                JOIN vk_bot_tasks t ON r.task_id = t.id
                JOIN users u ON r.user_id = u.id
                WHERE r.id = %s
            """, (report_id,))
            report = cursor.fetchone()

            if not report:
                return None

            cursor.execute("""
                UPDATE vk_bot_reports 
                SET status = %s, reject_reason = %s 
                WHERE id = %s
            """, (status, reject_reason, report_id))

            user_id = report['user_id']
            message = ''

            if status == 'approved':
                points = report.get('points', 10)
                cursor.execute("""
                    UPDATE users 
                    SET rating = rating + %s, completed_tasks = completed_tasks + 1 
                    WHERE id = %s
                """, (points, user_id))

                cursor.execute("""
                    SELECT COUNT(*) as total 
                    FROM vk_bot_tasks 
                    WHERE group_id = %s
                """, (report['group_id'],))
                total_tasks = cursor.fetchone()['total']

                cursor.execute("""
                    SELECT COUNT(DISTINCT r.task_id) as done 
                    FROM vk_bot_reports r
                    WHERE r.user_id = %s 
                    AND r.task_id IN (SELECT id FROM vk_bot_tasks WHERE group_id = %s)
                    AND r.status = 'approved'
                """, (user_id, report['group_id']))
                done_tasks = cursor.fetchone()['done']

                if total_tasks > 0 and done_tasks >= total_tasks:
                    import hashlib
                    ticket_num = 'TKT-' + hashlib.md5(
                        f"{report['group_id']}{report_id}".encode()
                    ).hexdigest()[:6].upper()
                    cursor.execute("""
                        INSERT INTO vk_bot_tickets (group_id, user_id, ticket_number)
                        VALUES (%s, %s, %s)
                    """, (report['group_id'], user_id, ticket_num))
                    if cursor.rowcount > 0:
                        message += f"\n\n🎉 Поздравляем! Вы выполнили все задания волны — вам выдан лотерейный билет!\n🎫 Номер билета: {ticket_num}"

                message = f"✅ Ваше задание \"{report['title']}\" одобрено! Получено +{points} баллов."

            elif status == 'rejected':
                message = f"❌ Ваше задание \"{report['title']}\" отклонено. Причина: {reject_reason or 'Не выполнено учение'}. Отправьте отчет заново."

            if message:
                add_notification(user_id, message, report_id)

            return {
                'user_id': user_id,
                'vk_id': report['vk_id'],
                'message': message
            }

    except Exception as e:
        logger.error(f"Ошибка в update_report_status: {e}")
        raise
    finally:
        conn.close()


def verify_password(plain_password, hashed_password):
    """Проверка пароля (совместимо с PHP password_hash - bcrypt)"""
    try:
        if bcrypt:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        return False
    except Exception:
        return False


def get_user_agreement_status(user_id):
    """Получает статус согласия пользователя с правилами"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT agreement_accepted_at 
                FROM users 
                WHERE id = %s
            """, (user_id,))
            return cursor.fetchone()
    finally:
        conn.close()