import pymysql
from pymysql.cursors import DictCursor
import config
import logging
import re
import random
import string
import os
import json
from urllib.parse import urlparse
from datetime import datetime

# Безопасный импорт bcrypt с фоллбеком
try:
    import bcrypt
except ImportError:
    bcrypt = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = 'uploads/vk_bot/'
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

_db_initialized = False

def get_db_connection():
    """Создает подключение к базе данных с автореконнектом"""
    global _db_initialized
    conn = pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        charset='utf8mb4',
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=5,
        read_timeout=10,
        write_timeout=10
    )
    
    if not _db_initialized:
        ensure_schema(conn)
        _db_initialized = True
        
    return conn


def ensure_schema(conn):
    """Проверяет и создает необходимые таблицы и колонки при первом подключении"""
    try:
        with conn.cursor() as cursor:
            # Создаем таблицы если их нет
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_settings (
                    `key` VARCHAR(64) PRIMARY KEY,
                    `value` TEXT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_task_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT NOT NULL,
                    difficulty ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'easy',
                    points INT NOT NULL DEFAULT 10,
                    task_type ENUM('repost', 'post', 'other') NOT NULL DEFAULT 'other',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_reports (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    task_id INT NOT NULL,
                    submission_text TEXT NOT NULL,
                    has_attachments TINYINT(1) NOT NULL DEFAULT 0,
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    reject_reason VARCHAR(255) DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_tickets (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    group_id INT NOT NULL,
                    ticket_number VARCHAR(64) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    report_id INT NULL,
                    message TEXT NOT NULL,
                    is_sent TINYINT(1) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sent_at TIMESTAMP NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_report_media (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    report_id INT NOT NULL,
                    file_url VARCHAR(512) NOT NULL,
                    file_type ENUM('image', 'file') NOT NULL DEFAULT 'image',
                    original_name VARCHAR(255) NOT NULL,
                    file_size INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    category ENUM('site', 'bot', 'housing') NOT NULL DEFAULT 'site',
                    subject VARCHAR(255) NOT NULL,
                    description TEXT NOT NULL,
                    status ENUM('open', 'in_progress', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
                    resolved_by INT NULL,
                    resolution_text TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vk_bot_request_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    request_id INT NOT NULL,
                    user_id INT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Добавляем колонки в таблицу users при их отсутствии
            columns_to_add = [
                ("vk_id", "BIGINT NULL"),
                ("vk_url", "VARCHAR(255) NULL"),
                ("rating", "INT NOT NULL DEFAULT 0"),
                ("completed_tasks", "INT NOT NULL DEFAULT 0"),
                ("bot_registered", "TINYINT(1) NOT NULL DEFAULT 0"),
                ("agreement_accepted_at", "DATETIME NULL"),
                ("social_vk", "VARCHAR(255) NULL")
            ]
            for col_name, col_type in columns_to_add:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};")
                except Exception:
                    pass  # Колонка уже существует

    except Exception as e:
        logger.warning(f"Замечание при проверке схемы БД: {e}")


def get_bot_settings():
    """Получает настройки бота из таблицы vk_bot_settings"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT `key`, `value` FROM vk_bot_settings")
            rows = cursor.fetchall()
            return {r['key']: r['value'] for r in rows}
    except Exception as e:
        logger.error(f"Ошибка получения настроек бота: {e}")
        return {}
    finally:
        conn.close()


def hash_password(password):
    """Хеширование пароля совместимое с PHP password_hash (bcrypt)"""
    if bcrypt:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=8)).decode('utf-8')
    import hashlib
    # Резервный вариант, если bcrypt не установлен
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
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as cnt FROM users WHERE login LIKE %s", (f"{base_login}%",))
            count = cursor.fetchone()['cnt']
            return f"{base_login}{count + 1}" if count > 0 else base_login
    finally:
        conn.close()


def find_or_create_user(vk_id, first_name, last_name, vk_url=''):
    conn = get_db_connection()
    try:
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

    except Exception as e:
        logger.error(f"Ошибка в find_or_create_user: {e}")
        raise
    finally:
        conn.close()


def get_user_by_vk_id(vk_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
            return cursor.fetchone()
    finally:
        conn.close()


def find_existing_user(vk_id, vk_url=''):
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()


def get_active_task_group():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM vk_bot_task_groups 
                WHERE start_date <= CURDATE() AND end_date >= CURDATE()
                ORDER BY start_date ASC LIMIT 1
            """)
            return cursor.fetchone()
    finally:
        conn.close()


def get_tasks_for_group(group_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM vk_bot_tasks 
                WHERE group_id = %s 
                ORDER BY FIELD(difficulty, 'easy', 'medium', 'hard'), id ASC
            """, (group_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def get_user_task_report(user_id, task_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM vk_bot_reports
                WHERE user_id = %s AND task_id = %s
                ORDER BY id DESC LIMIT 1
            """, (user_id, task_id))
            return cursor.fetchone()
    finally:
        conn.close()


def get_user_task_status(user_id, task_id):
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()


def create_report(user_id, task_id, submission_text, has_attachments=False):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_reports (user_id, task_id, submission_text, has_attachments, status) 
                VALUES (%s, %s, %s, %s, 'pending')
            """, (user_id, task_id, submission_text, 1 if has_attachments else 0))
            return cursor.lastrowid
    finally:
        conn.close()


def save_report_media(report_id, file_url, file_type, original_name, file_size):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_report_media (report_id, file_url, file_type, original_name, file_size) 
                VALUES (%s, %s, %s, %s, %s)
            """, (report_id, file_url, file_type, original_name, file_size))
            return cursor.lastrowid
    finally:
        conn.close()


def get_report_media(report_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM vk_bot_report_media WHERE report_id = %s ORDER BY id ASC", (report_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def process_vk_attachments(attachments, vk_session):
    if not attachments:
        return [], ""
    
    saved_files = []
    text_parts = []
    attach_list = []
    
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
    
    for attach in attach_list:
        file_url = None
        file_name = None
        file_size = 0
        attach_type = 'unknown'
        attach_id = None
        owner_id = None
        
        if isinstance(attach, dict):
            attach_type = attach.get('type', 'photo')
            attach_data = attach.get('data') or attach
            attach_id = attach_data.get('id', '')
            owner_id = attach_data.get('owner_id', '')

            if attach_type == 'photo':
                sizes = attach_data.get('sizes', [])
                if sizes:
                    sizes.sort(key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
                    file_url = sizes[0].get('url')
                    file_name = f"photo_{attach_id}.jpg"
                else:
                    file_url = f"https://vk.com/photo{owner_id}_{attach_id}"
                    file_name = f"photo_{attach_id}.jpg"
            elif attach_type == 'doc':
                file_url = attach_data.get('url') or f"https://vk.com/doc{owner_id}_{attach_id}"
                file_name = attach_data.get('title', 'document')
            elif attach_type == 'video':
                file_url = attach_data.get('player') or f"https://vk.com/video{owner_id}_{attach_id}"
                file_name = f"video_{attach_id}"
            elif attach_type == 'link':
                url = attach_data.get('url') or attach_data.get('link', {}).get('url', '')
                text_parts.append(f"🔗 {url}")
                continue
            elif attach_type == 'wall':
                text_parts.append(f"🔗 https://vk.com/wall{owner_id}_{attach_id}")
                continue
        elif isinstance(attach, str) and '_' in attach:
            parts = attach.split('_')
            owner_id, media_id = parts[0], parts[1]
            file_url = f"https://vk.com/photo{owner_id}_{media_id}"
            file_name = f"photo_{media_id}.jpg"
            attach_type = 'photo'

        if file_url:
            saved_files.append({
                'file_type': attach_type,
                'file_url': file_url,
                'original_name': file_name or 'file',
                'file_size': file_size
            })
            text_parts.append(f"📎 {file_name or 'файл'}")

    return saved_files, "\n".join(text_parts)


def get_user_tickets(user_id):
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()


def get_pending_notifications(limit=10):
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()


def mark_notification_sent(notification_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE vk_bot_notifications SET is_sent = 1, sent_at = NOW() WHERE id = %s", (notification_id,))
    finally:
        conn.close()


def add_notification(user_id, message, report_id=None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_notifications (user_id, report_id, message)
                VALUES (%s, %s, %s)
            """, (user_id, report_id, message))
    finally:
        conn.close()


def create_request(user_id, category, subject, description):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_requests (user_id, category, subject, description, status)
                VALUES (%s, %s, %s, %s, 'open')
            """, (user_id, category, subject, description))
            return cursor.lastrowid
    finally:
        conn.close()


def get_user_requests(user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM vk_bot_requests WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def get_user_request_by_id(request_id, user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM vk_bot_requests WHERE id = %s AND user_id = %s", (request_id, user_id))
            return cursor.fetchone()
    finally:
        conn.close()


def get_request_messages(request_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT m.*, u.first_name, u.last_name, u.vk_id
                FROM vk_bot_request_messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.request_id = %s
                ORDER BY m.created_at ASC
            """, (request_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def add_request_message(request_id, user_id, message):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_request_messages (request_id, user_id, message)
                VALUES (%s, %s, %s)
            """, (request_id, user_id, message))
            return cursor.lastrowid
    finally:
        conn.close()


def get_all_requests_for_admin(status=None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT r.*, u.first_name, u.last_name, u.vk_id FROM vk_bot_requests r JOIN users u ON r.user_id = u.id"
            if status and status != 'all':
                sql += " WHERE r.status = %s"
                cursor.execute(sql, (status,))
            else:
                cursor.execute(sql)
            return cursor.fetchall()
    finally:
        conn.close()


def get_last_request_message(request_id):
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()


def check_user_agreement(user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT agreement_accepted_at FROM users WHERE id = %s", (user_id,))
            result = cursor.fetchone()
            return bool(result and result.get('agreement_accepted_at'))
    finally:
        conn.close()


def set_user_agreement(user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE users SET agreement_accepted_at = NOW() WHERE id = %s", (user_id,))
            return cursor.rowcount > 0
    finally:
        conn.close()