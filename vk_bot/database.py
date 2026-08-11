import pymysql
from pymysql.cursors import DictCursor
import config
import logging
import re
import hashlib
import random
import string
import os
import json
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурация загрузки файлов
UPLOAD_DIR = 'uploads/vk_bot/'
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_EXTENSIONS = {
    'image': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt'],
    'archive': ['zip', 'rar', '7z', 'tar', 'gz'],
    'video': ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
    'audio': ['mp3', 'wav', 'ogg', 'flac', 'aac'],
    'other': ['csv', 'json', 'xml', 'log']
}
ALLOWED_EXTENSIONS_FLAT = []
for ext_list in ALLOWED_EXTENSIONS.values():
    ALLOWED_EXTENSIONS_FLAT.extend(ext_list)
# Запрещенные расширения
FORBIDDEN_EXTENSIONS = ['htaccess', 'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'cgi', 'pl', 'py', 'sh', 'exe', 'bat', 'cmd', 'com', 'scr', 'vbs', 'js', 'jar']


def get_db_connection():
    """Создает подключение к базе данных"""
    return pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        charset='utf8mb4',
        cursorclass=DictCursor,
        autocommit=True
    )


def get_bot_settings():
    """Получает настройки бота из таблицы vk_bot_settings"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT `key`, `value` FROM vk_bot_settings")
            rows = cursor.fetchall()
            return {r['key']: r['value'] for r in rows}
    finally:
        conn.close()


def hash_password(password):
    """Хеширование пароля для совместимости с PHP password_hash"""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_password(length=10):
    """Генерирует случайный пароль"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))


def generate_login(first_name, last_name):
    """Генерирует логин на основе имени и фамилии"""
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
    """Находит или создает пользователя в таблице users"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Проверяем по VK URL
            if vk_url:
                cursor.execute("SELECT * FROM users WHERE vk_url = %s", (vk_url,))
                user = cursor.fetchone()
                if user:
                    if user.get('vk_id') != vk_id:
                        cursor.execute("UPDATE users SET vk_id = %s WHERE id = %s", (vk_id, user['id']))
                        logger.info(f"Обновлен vk_id для пользователя {user['id']}")
                    return user

            # 2. Проверяем по VK ID
            if vk_id:
                cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
                user = cursor.fetchone()
                if user:
                    if user.get('vk_url') != vk_url:
                        cursor.execute("UPDATE users SET vk_url = %s WHERE id = %s", (vk_url, user['id']))
                        logger.info(f"Обновлен vk_url для пользователя {user['id']}")
                    return user

            # 3. Проверяем по имени и фамилии
            if first_name and last_name:
                cursor.execute("""
                    SELECT * FROM users 
                    WHERE LOWER(first_name) = LOWER(%s) AND LOWER(last_name) = LOWER(%s)
                    LIMIT 1
                """, (first_name, last_name))
                user = cursor.fetchone()
                if user:
                    cursor.execute(
                        "UPDATE users SET vk_id = %s, vk_url = %s WHERE id = %s",
                        (vk_id, vk_url, user['id'])
                    )
                    logger.info(f"Связан пользователь {first_name} {last_name} с VK ID {vk_id}")
                    return user

            # 4. Создаем нового пользователя
            login = generate_login(first_name, last_name)
            password = generate_password()
            hashed_password = hash_password(password)
            full_name = f"{last_name} {first_name}".strip()

            cursor.execute("""
                INSERT INTO users 
                (vk_id, vk_url, first_name, last_name, name, login, phone, password, role, status, rating, completed_tasks)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                vk_id, vk_url, first_name, last_name, full_name,
                login, '', hashed_password, 'user', 'active', 0, 0
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
    """Получает пользователя по VK ID"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
            return cursor.fetchone()
    finally:
        conn.close()


def get_active_task_group():
    """Получает активную группу заданий"""
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
    """Получает задания для группы"""
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
    """Получает последний отчет пользователя по заданию"""
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


def create_report(user_id, task_id, submission_text, has_attachments=False):
    """Создает новый отчет по заданию"""
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
    """Сохраняет информацию о медиафайле в базу данных"""
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
    """Получает медиафайлы для отчета"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM vk_bot_report_media 
                WHERE report_id = %s 
                ORDER BY id ASC
            """, (report_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def process_vk_attachments(attachments, vk_session):
    """
    Обрабатывает вложения из сообщения VK.
    Возвращает список ссылок на файлы и текстовое описание.
    """
    if not attachments:
        return [], ""
    
    saved_files = []
    text_parts = []
    
    # attachments может быть словарем { 'attach1': 'id', 'attach1_type': 'photo', ... }
    attach_list = []
    
    if isinstance(attachments, dict):
        # Извлекаем все attach1, attach2, ... из словаря
        for key, value in attachments.items():
            if key.startswith('attach') and not key.endswith('_type'):
                attach_type_key = f"{key}_type"
                attach_type = attachments.get(attach_type_key, 'unknown')
                attach_list.append({
                    'type': attach_type,
                    'id': value
                })
    elif isinstance(attachments, list):
        attach_list = attachments
    else:
        attach_list = [attachments]
    
    logger.info(f"Обработка {len(attach_list)} вложений")
    
    for attach in attach_list:
        file_url = None
        file_name = None
        file_size = 0
        attach_type = 'unknown'
        attach_id = None
        
        # Если attach - строка с ID (приходит как "473566088_457255481")
        if isinstance(attach, str):
            attach_id = attach
            attach_type = 'photo'  # По умолчанию считаем фото
            try:
                parts = attach.split('_')
                if len(parts) == 2:
                    owner_id = parts[0]
                    media_id = parts[1]
                    # Сохраняем как ссылку на VK
                    file_url = f"https://vk.com/photo{owner_id}_{media_id}"
                    file_name = f"photo_{media_id}.jpg"
                    text_parts.append(f"🖼️ Фото: {file_url}")
            except:
                text_parts.append(f"📎 {attach}")
                continue
        
        # Если attach - словарь
        elif isinstance(attach, dict):
            attach_type = attach.get('type', 'unknown')
            attach_data = attach.get('data', {})
            if not attach_data:
                attach_data = attach
            
            attach_id = attach_data.get('id', '')
            owner_id = attach_data.get('owner_id', '')
            
            # --- ОБРАБОТКА ФОТО ---
            if attach_type == 'photo':
                # Сначала пробуем получить прямой URL из sizes
                sizes = attach_data.get('sizes', [])
                if sizes:
                    sizes.sort(key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
                    file_url = sizes[0].get('url')
                    file_name = f"photo_{attach_id}.jpg" if attach_id else 'photo.jpg'
                elif owner_id and attach_id:
                    # Создаем ссылку на страницу фото в VK
                    file_url = f"https://vk.com/photo{owner_id}_{attach_id}"
                    file_name = f"photo_{attach_id}.jpg"
                else:
                    # Пробуем другие поля
                    for key in ['photo_2560', 'photo_1280', 'photo_807', 'photo_604', 'photo_130', 'photo_75']:
                        if attach_data.get(key):
                            file_url = attach_data[key]
                            file_name = f"photo_{attach_id}.jpg" if attach_id else 'photo.jpg'
                            break
            
            # --- ОБРАБОТКА ДОКУМЕНТОВ ---
            elif attach_type == 'doc':
                if owner_id and attach_id:
                    file_url = f"https://vk.com/doc{owner_id}_{attach_id}"
                    file_name = attach_data.get('title', f"doc_{attach_id}")
                else:
                    file_url = attach_data.get('url')
                    file_name = attach_data.get('title', 'document')
                file_size = attach_data.get('size', 0)
            
            # --- ОБРАБОТКА ВИДЕО ---
            elif attach_type == 'video':
                if owner_id and attach_id:
                    file_url = f"https://vk.com/video{owner_id}_{attach_id}"
                    file_name = f"video_{attach_id}"
                else:
                    file_url = attach_data.get('player')
                    file_name = f"video_{attach_id}" if attach_id else 'video'
            
            # --- ОБРАБОТКА АУДИО ---
            elif attach_type == 'audio':
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
            
            # Добавляем информацию о файле в текст (если еще не добавлена)
            if not text_parts or not any(file_name in tp for tp in text_parts if file_name):
                file_type_emoji = {
                    'photo': '🖼️',
                    'video': '🎬',
                    'audio': '🎵',
                    'doc': '📄',
                    'file': '📎'
                }
                emoji = file_type_emoji.get(attach_type, '📎')
                text_parts.append(f"{emoji} {file_name}")
        else:
            # Если не удалось получить URL, добавляем ID как ссылку
            if attach_id:
                text_parts.append(f"📎 Вложение: {attach_id}")
    
    logger.info(f"Обработано файлов: {len(saved_files)}")
    
    return saved_files, "\n".join(text_parts)


def get_user_tickets(user_id):
    """Получает все билеты пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT tk.*, g.title as group_title 
                FROM vk_bot_tickets tk
                JOIN vk_bot_task_groups g ON tk.group_id = g.id
                WHERE tk.user_id = %s
                ORDER BY tk.created_at DESC
            """, (user_id,))
            return cursor.fetchall()
    finally:
        conn.close()


def get_pending_notifications(limit=10):
    """Получает ожидающие отправки уведомления"""
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
    """Отмечает уведомление как отправленное"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE vk_bot_notifications 
                SET is_sent = 1, sent_at = NOW() 
                WHERE id = %s
            """, (notification_id,))
    finally:
        conn.close()


def add_notification(user_id, message, report_id=None):
    """Добавляет уведомление в очередь"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_notifications (user_id, report_id, message) 
                VALUES (%s, %s, %s)
            """, (user_id, report_id, message))
    finally:
        conn.close()


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
                        f"{user_id}{report['group_id']}{report_id}".encode()
                    ).hexdigest()[:6].upper()
                    cursor.execute("""
                        INSERT IGNORE INTO vk_bot_tickets (user_id, group_id, ticket_number)
                        VALUES (%s, %s, %s)
                    """, (user_id, report['group_id'], ticket_num))

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
    """Проверка пароля (совместимо с PHP password_hash)"""
    return hash_password(plain_password) == hashed_password