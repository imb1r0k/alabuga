import pymysql
from pymysql.cursors import DictCursor
import config

def get_db_connection():
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
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT `key`, `value` FROM vk_bot_settings")
            rows = cursor.fetchall()
            return {r['key']: r['value'] for r in rows}
    finally:
        conn.close()

def get_or_create_user(vk_id, first_name='', last_name=''):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM vk_bot_users WHERE vk_id = %s", (vk_id,))
            user = cursor.fetchone()
            if not user:
                cursor.execute(
                    "INSERT INTO vk_bot_users (vk_id, first_name, last_name) VALUES (%s, %s, %s)",
                    (vk_id, first_name, last_name)
                )
                cursor.execute("SELECT * FROM vk_bot_users WHERE vk_id = %s", (vk_id,))
                user = cursor.fetchone()
            return user
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
            cursor.execute("SELECT * FROM vk_bot_reports WHERE user_id = %s AND task_id = %s ORDER BY id DESC LIMIT 1", (user_id, task_id))
            return cursor.fetchone()
    finally:
        conn.close()

def create_report(user_id, task_id, submission_text):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO vk_bot_reports (user_id, task_id, submission_text, status) VALUES (%s, %s, %s, 'pending')",
                (user_id, task_id, submission_text)
            )
    finally:
        conn.close()

def get_user_tickets(user_id):
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