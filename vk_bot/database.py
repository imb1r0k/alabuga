import pymysql
from pymysql.cursors import DictCursor
import config
import logging
import re
import hashlib
import random
import string

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    """
    Хеширование пароля для совместимости с PHP password_hash
    Использует SHA-256 для простоты
    """
    return hashlib.sha256(password.encode()).hexdigest()


def generate_password(length=10):
    """Генерирует случайный пароль"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))


def generate_login(first_name, last_name):
    """
    Генерирует логин на основе имени и фамилии
    Проверяет уникальность в базе
    """
    # Очищаем от спецсимволов и транслитерации
    base_login = re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', f"{last_name.lower()}{first_name.lower()}")
    
    # Если слишком короткий, добавляем случайные цифры
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
    """
    Находит или создает пользователя в таблице users.
    
    Алгоритм поиска:
    1. По VK URL (самый надежный)
    2. По VK ID
    3. По имени и фамилии (регистронезависимо)
    4. Если не найден - создает нового
    
    Возвращает:
        dict: Данные пользователя с добавленным ключом 'generated_password' если создан новый
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Проверяем по VK URL (самый надежный способ)
            if vk_url:
                cursor.execute("SELECT * FROM users WHERE vk_url = %s", (vk_url,))
                user = cursor.fetchone()
                if user:
                    # Обновляем vk_id если изменился
                    if user.get('vk_id') != vk_id:
                        cursor.execute(
                            "UPDATE users SET vk_id = %s WHERE id = %s",
                            (vk_id, user['id'])
                        )
                        logger.info(f"Обновлен vk_id для пользователя {user['id']}")
                    return user

            # 2. Проверяем по VK ID
            if vk_id:
                cursor.execute("SELECT * FROM users WHERE vk_id = %s", (vk_id,))
                user = cursor.fetchone()
                if user:
                    # Обновляем vk_url если изменился
                    if user.get('vk_url') != vk_url:
                        cursor.execute(
                            "UPDATE users SET vk_url = %s WHERE id = %s",
                            (vk_url, user['id'])
                        )
                        logger.info(f"Обновлен vk_url для пользователя {user['id']}")
                    return user

            # 3. Проверяем по имени и фамилии (регистронезависимо)
            if first_name and last_name:
                cursor.execute("""
                    SELECT * FROM users 
                    WHERE LOWER(first_name) = LOWER(%s) AND LOWER(last_name) = LOWER(%s)
                    LIMIT 1
                """, (first_name, last_name))
                user = cursor.fetchone()

                if user:
                    # Обновляем vk_id и vk_url
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
                vk_id,
                vk_url,
                first_name,
                last_name,
                full_name,
                login,
                '',  # phone - пустой, пользователь заполнит позже
                hashed_password,
                'user',  # role
                'active',  # status
                0,  # rating
                0  # completed_tasks
            ))

            user_id = cursor.lastrowid

            # Получаем созданного пользователя
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()

            logger.info(f"Создан новый пользователь: {first_name} {last_name}, логин: {login}")
            
            # Добавляем сгенерированный пароль для отправки пользователю
            user['generated_password'] = password

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
    """Получает активную группу заданий (текущая дата в диапазоне)"""
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


def create_report(user_id, task_id, submission_text):
    """Создает новый отчет по заданию"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO vk_bot_reports (user_id, task_id, submission_text, status) 
                VALUES (%s, %s, %s, 'pending')
            """, (user_id, task_id, submission_text))
            return cursor.lastrowid
    finally:
        conn.close()


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
    """
    Обновляет статус отчета, начисляет баллы, выдает билеты.
    Возвращает данные для отправки уведомления
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Получаем отчет с данными
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

            # Обновляем статус отчета
            cursor.execute("""
                UPDATE vk_bot_reports 
                SET status = %s, reject_reason = %s 
                WHERE id = %s
            """, (status, reject_reason, report_id))

            user_id = report['user_id']
            message = ''

            if status == 'approved':
                # Начисляем баллы пользователю
                points = report.get('points', 10)
                cursor.execute("""
                    UPDATE users 
                    SET rating = rating + %s, completed_tasks = completed_tasks + 1 
                    WHERE id = %s
                """, (points, user_id))

                # Проверяем, выполнил ли пользователь все задания группы
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

                # Если все задания выполнены — выдаем билет
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

            # Добавляем уведомление
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