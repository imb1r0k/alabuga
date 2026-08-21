#!/usr/bin/env python3
"""
Бот ВКонтакте на Callback API
Запуск: python bot_callback.py
"""

import time
import threading
import logging
import re
import pymysql
import json
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import vk_api
from vk_api.keyboard import VkKeyboard, VkKeyboardColor

import config
from database import (
    get_bot_settings,
    find_or_create_user,
    get_active_task_group,
    get_tasks_for_group,
    get_user_task_report,
    get_user_task_status,
    create_report,
    save_report_media,
    process_vk_attachments,
    get_user_tickets,
    get_pending_notifications,
    mark_notification_sent,
    get_user_by_vk_id,
    add_notification,
    create_request,
    get_user_requests,
    get_user_request_by_id,
    get_request_messages,
    add_request_message,
    get_all_requests_for_admin,
    get_last_request_message,
    check_user_agreement,
    set_user_agreement,
    find_existing_user,
    invalidate_user_task_cache,
)

# Настройка логирования в отдельный файл
log_filename = 'bot_callback.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Глобальные переменные
user_states = {}
sent_notifications = {}
agreement_sent = set()
executor = ThreadPoolExecutor(max_workers=20)

# VK Session
vk = None
vk_session = None

# Кэш для данных
_cache = {
    'settings': {},
    'active_group': None,
    'tasks': {},
    'users': {},
    'user_agreement': {},
    'task_by_title': {},
}
_cache_time = {}
CACHE_TTL_LONG = 600
CACHE_TTL_MEDIUM = 120
CACHE_TTL_SHORT = 30


def get_cached(key, fetch_func, ttl=CACHE_TTL_MEDIUM):
    """Универсальная функция получения данных с кэшированием"""
    now = time.time()
    if key in _cache and key in _cache_time and (now - _cache_time[key]) < ttl:
        return _cache[key]
    
    try:
        result = fetch_func()
        _cache[key] = result
        _cache_time[key] = now
        return result
    except Exception as e:
        logger.error(f"Ошибка получения кэша для {key}: {e}")
        return _cache.get(key)


def get_settings_cached():
    return get_cached('settings', get_bot_settings, CACHE_TTL_LONG)


def get_active_group_cached():
    """Получает только активную группу заданий с кэшированием"""
    def fetch():
        conn = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            connect_timeout=5,
            read_timeout=10
        )
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
    return get_cached('active_group', fetch, CACHE_TTL_MEDIUM)


def get_tasks_cached(group_id):
    """Получает задания только для указанной группы с кэшированием"""
    if not group_id:
        return []
    
    def fetch():
        conn = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            connect_timeout=5,
            read_timeout=10
        )
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
    
    key = f'tasks_group_{group_id}'
    return get_cached(key, fetch, CACHE_TTL_MEDIUM)


def get_task_by_title_cached(group_id, text):
    """Быстрый поиск задания по тексту кнопки"""
    if not group_id or not text:
        return None
    
    tasks = get_tasks_cached(group_id)
    if not tasks:
        return None
    
    # Строим кэш для быстрого поиска
    task_by_title_key = f'task_by_title_{group_id}'
    task_by_title = _cache.get(task_by_title_key, {})
    
    if not task_by_title:
        for t in tasks:
            # Ключ - чистый заголовок
            clean_title = t['title'].strip()
            task_by_title[clean_title] = t
            task_by_title[clean_title.lower()] = t
            # Ключ - ID с решеткой
            task_by_title[f"#{t['id']}"] = t
        _cache[task_by_title_key] = task_by_title
        _cache_time[task_by_title_key] = time.time()
    
    # 1. Прямой поиск по тексту как есть
    if text in task_by_title:
        return task_by_title[text]
    
    # 2. Поиск по ID (если текст содержит #число)
    match = re.search(r'#(\d+)', text)
    if match:
        task_id = int(match.group(1))
        for t in tasks:
            if t['id'] == task_id:
                return t
    
    # 3. Очищаем текст от эмодзи и префиксов
    clean_text = text
    
    # Удаляем эмодзи сложности и статуса
    for emoji in ['🟢', '🟡', '🔴', '✅', '⏳', '❌', '📌']:
        clean_text = clean_text.replace(emoji, '').strip()
    
    # Убираем лишние пробелы
    clean_text = ' '.join(clean_text.split())
    
    # 4. Поиск по очищенному тексту
    if clean_text:
        # Точное совпадение
        if clean_text in task_by_title:
            return task_by_title[clean_text]
        if clean_text.lower() in task_by_title:
            return task_by_title[clean_text.lower()]
        
        # Поиск по частичному совпадению
        for t in tasks:
            title = t['title'].strip()
            if clean_text in title or title in clean_text:
                return t
    
    return None


def get_user_cached(vk_id):
    key = f'user_{vk_id}'
    return get_cached(key, lambda: get_user_by_vk_id(vk_id), CACHE_TTL_LONG)


def get_user_agreement_cached(user_id):
    key = f'agreement_{user_id}'
    return get_cached(key, lambda: check_user_agreement(user_id), CACHE_TTL_LONG)


def get_task_status_cached(user_id, task_id):
    key = f'status_{user_id}_{task_id}'
    return get_cached(key, lambda: get_user_task_status(user_id, task_id), CACHE_TTL_SHORT)


def get_all_task_statuses_cached(user_id, task_ids):
    """Получает статусы для всех задач одним запросом с кэшированием"""
    if not task_ids:
        return {}
    
    key = f'all_statuses_{user_id}_{hash(tuple(sorted(task_ids)))}'
    
    def fetch():
        conn = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            connect_timeout=5,
            read_timeout=10
        )
        try:
            with conn.cursor() as cursor:
                placeholders = ','.join(['%s'] * len(task_ids))
                cursor.execute(f"""
                    SELECT task_id, status FROM vk_bot_reports 
                    WHERE user_id = %s AND task_id IN ({placeholders})
                    ORDER BY id DESC
                """, (user_id, *task_ids))
                
                result = {}
                for row in cursor.fetchall():
                    if row['task_id'] not in result:
                        result[row['task_id']] = row['status']
                return result
        finally:
            conn.close()
    
    return get_cached(key, fetch, CACHE_TTL_SHORT)


def cache_cleaner():
    while True:
        time.sleep(60)
        now = time.time()
        old_keys = [k for k, t in _cache_time.items() if (now - t) > 3600]
        for key in old_keys:
            _cache.pop(key, None)
            _cache_time.pop(key, None)


# ============ Клавиатуры ============

def create_main_keyboard(active_group, site_url=''):
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("📋 Задания", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("👤 Мой профиль", color=VkKeyboardColor.SECONDARY)
    keyboard.add_button("📋 Заявки", color=VkKeyboardColor.PRIMARY)
    if site_url:
        keyboard.add_line()
        keyboard.add_button("🌐 Личный кабинет", color=VkKeyboardColor.POSITIVE)
    return keyboard.get_keyboard()


def build_tasks_keyboard(tasks, user_id, page=0, items_per_page=8):
    """
    Строит клавиатуру с заданиями с пагинацией.
    page - текущая страница (начиная с 0)
    items_per_page - количество заданий на странице
    """
    keyboard = VkKeyboard(one_time=False)
    
    if not tasks:
        keyboard.add_button("📢 Нет заданий", color=VkKeyboardColor.SECONDARY)
        keyboard.add_line()
        keyboard.add_button("🔙 Назад в меню", color=VkKeyboardColor.SECONDARY)
        return keyboard.get_keyboard()
    
    # Группируем задания по сложности (уже отсортированы в БД)
    easy_tasks = [t for t in tasks if t['difficulty'] == 'easy']
    medium_tasks = [t for t in tasks if t['difficulty'] == 'medium']
    hard_tasks = [t for t in tasks if t['difficulty'] == 'hard']
    
    # Объединяем в порядке: легкие, средние, сложные
    all_tasks = easy_tasks + medium_tasks + hard_tasks
    total_tasks = len(all_tasks)
    total_pages = (total_tasks + items_per_page - 1) // items_per_page
    
    # Получаем задания для текущей страницы
    start_idx = page * items_per_page
    end_idx = min(start_idx + items_per_page, total_tasks)
    page_tasks = all_tasks[start_idx:end_idx]
    
    # Получаем статусы всех задач на странице одним запросом
    task_ids = [t['id'] for t in page_tasks]
    statuses = get_all_task_statuses_cached(user_id, task_ids)
    
    # Добавляем кнопки заданий по 2 в строке
    row_counter = 0
    max_buttons_per_row = 2
    
    for t in page_tasks:
        status = statuses.get(t['id'])
        
        # Используем полное название для кнопки
        title_display = t['title']
        max_title_len = 20
        if len(title_display) > max_title_len:
            title_display = t['title'][:max_title_len].rstrip() + '…'
        
        # Определяем эмодзи сложности
        diff_emoji = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}
        emoji = diff_emoji.get(t['difficulty'], '📌')
        
        # Формируем подпись кнопки
        label = f"{emoji} {title_display}"
        color = VkKeyboardColor.PRIMARY
        
        # Изменяем цвет и подпись в зависимости от статуса
        if status:
            if status == 'approved':
                label = f"✅ {title_display}"
                color = VkKeyboardColor.POSITIVE
            elif status == 'pending':
                label = f"⏳ {title_display}"
                color = VkKeyboardColor.SECONDARY
            elif status == 'rejected':
                label = f"❌ {title_display}"
                color = VkKeyboardColor.NEGATIVE
        
        keyboard.add_button(label, color=color)
        row_counter += 1
        
        # Если набрали 2 кнопки в строке, переходим на следующую
        if row_counter >= max_buttons_per_row:
            keyboard.add_line()
            row_counter = 0
    
    # Если остались незавершенные кнопки, завершаем строку
    if row_counter > 0:
        keyboard.add_line()
    
    # Добавляем пагинацию, если больше одной страницы
    if total_pages > 1:
        # Строка с навигацией
        nav_buttons_added = False
        
        # Кнопка "Предыдущая"
        if page > 0:
            keyboard.add_button("⬅️ Предыдущая", color=VkKeyboardColor.SECONDARY)
            nav_buttons_added = True
        
        # Индикатор страницы
        keyboard.add_button(f"📄 {page + 1}/{total_pages}", color=VkKeyboardColor.SECONDARY)
        nav_buttons_added = True
        
        # Кнопка "Следующая"
        if page < total_pages - 1:
            keyboard.add_button("Следующая ➡️", color=VkKeyboardColor.SECONDARY)
            nav_buttons_added = True
        
        if nav_buttons_added:
            keyboard.add_line()
    
    # Кнопка возврата в меню
    keyboard.add_button("🔙 Назад в меню", color=VkKeyboardColor.SECONDARY)
    
    return keyboard.get_keyboard()


def create_agreement_keyboard():
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("✅ Подтверждаю", color=VkKeyboardColor.POSITIVE)
    return keyboard.get_keyboard()


def create_requests_keyboard(requests):
    keyboard = VkKeyboard(one_time=False)
    status_icons = {'open': '🟡', 'in_progress': '🔵', 'resolved': '✅', 'rejected': '❌'}
    
    for r in requests[:10]:
        icon = status_icons.get(r['status'], '🟡')
        label = f"{icon} Заявка #{r['id']}: {r['subject'][:25]}"
        keyboard.add_button(label, color=VkKeyboardColor.PRIMARY)
        keyboard.add_line()
    
    keyboard.add_button("➕ Создать заявку", color=VkKeyboardColor.POSITIVE)
    keyboard.add_line()
    keyboard.add_button("🔙 Назад в меню", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


def create_request_chat_keyboard(request_id):
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("✏️ Написать сообщение", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🔄 Обновить", color=VkKeyboardColor.SECONDARY)
    keyboard.add_line()
    keyboard.add_button("🔙 Назад к заявкам", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


def create_category_keyboard():
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("🌐 Сайт", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🤖 Бот ВК", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🏠 Жильё", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🔙 Назад", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


# ============ Вспомогательные функции ============

def format_request_message(request, messages):
    status_emoji = {'open': '🟡', 'in_progress': '🔵', 'resolved': '✅', 'rejected': '❌'}
    status_text = {'open': 'Открыта', 'in_progress': 'В работе', 'resolved': 'Решена', 'rejected': 'Отклонена'}
    
    msg = f"📋 Заявка #{request['id']}\n"
    msg += f"📝 {request['subject']}\n"
    msg += f"📊 Статус: {status_emoji.get(request['status'], '🟡')} {status_text.get(request['status'], request['status'])}\n"
    
    created_at = request.get('created_at')
    if created_at:
        if hasattr(created_at, 'strftime'):
            msg += f"📅 Создана: {created_at.strftime('%d.%m.%Y %H:%M')}\n"
    msg += "\n"
    
    if messages:
        msg += "💬 Сообщения:\n"
        for msg_item in messages[-10:]:
            sender = msg_item.get('first_name', 'Пользователь')
            msg_text = msg_item['message']
            msg += f"👤 {sender}: {msg_text}\n"
    else:
        msg += "💬 Сообщений пока нет\n"
    
    return msg


def format_task_message(task, report=None, task_status=None):
    diff_emoji = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}
    diff_text = {'easy': 'Легкое', 'medium': 'Среднее', 'hard': 'Сложное'}
    
    msg = f"📌 {task['title']}\n\n"
    msg += f"📝 {task['description']}\n\n"
    msg += f"⭐ Сложность: {diff_emoji.get(task['difficulty'], '')} {diff_text.get(task['difficulty'], task['difficulty'])}\n"
    msg += f"🎯 Баллы: {task['points']}\n\n"
    
    if task_status == 'approved' or (report and report.get('status') == 'approved'):
        msg += "✅ Статус: Выполнено! Баллы зачислены.\n"
    elif report and report.get('status') == 'pending':
        msg += "⏳ Статус: На рассмотрении администратора.\nПожалуйста, ожидайте проверки.\n"
    elif report and report.get('status') == 'rejected':
        reason = report.get('reject_reason', 'Не выполнено')
        msg += f"❌ Статус: Отклонено\nПричина: {reason}\n\n📝 Отправьте отчет повторно с исправлениями."
    
    msg += "\n📎 Для подтверждения выполнения прикрепите фото, видео или ссылку."
    return msg


def get_category_label(category):
    labels = {'site': '🌐 Сайт', 'bot': '🤖 Бот ВК', 'housing': '🏠 Жильё'}
    return labels.get(category, category)


def send_agreement_rules(vk, user_id):
    rules_text = (
        "📋 ПРАВИЛА ПРЕБЫВАНИЯ НА ФОРУМЕ\n\n"
        "1. Участник обязан соблюдать правила пребывания.\n"
        "2. Постоянно носить именной бейдж.\n"
        "3. Соблюдать требования санитарных норм.\n"
        "4. Быть взаимно вежливым и дисциплинированным.\n"
        "5. Присутствовать на всех мероприятиях согласно программе.\n"
        "6. Выполнять указания Организатора.\n"
        "7. Бережно относиться к имуществу.\n"
        "8. Соблюдать комендантский час с 22:00 до 06:00.\n"
        "9. Сообщать о недомоганиях.\n"
        "10. Соблюдать правила личной гигиены.\n\n"
        "⚠️ ЗА НАРУШЕНИЕ ПРАВИЛ ПРЕДУСМОТРЕНА ДИСКВАЛИФИКАЦИЯ!\n\n"
        "✅ Для продолжения работы в боте нажмите кнопку 'Подтверждаю'."
    )
    vk.messages.send(
        user_id=user_id,
        message=rules_text,
        random_id=0,
        keyboard=create_agreement_keyboard()
    )


def send_credentials_message(vk, user_id, user_data, active_group, site_url=''):
    if user_data.get('generated_password'):
        login_msg = (
            "✅ Аккаунт успешно зарегистрирован на сайте!\n\n"
            "🔐 Данные для входа:\n"
            f"👤 Фамилия: {user_data.get('last_name', '')}\n"
            f"Имя: {user_data.get('first_name', '')}\n"
            f"🔑 Логин: {user_data.get('login', '')}\n"
            f"🔐 Пароль: {user_data.get('generated_password', '')}\n\n"
            "⚠️ СОХРАНИТЕ ЭТИ ДАННЫЕ!\n"
            "Пароль сгенерирован автоматически, вы можете изменить его после входа.\n\n"
            f"🌐 Сайт: {site_url}\n"
            "Рекомендуем сразу войти и сменить пароль."
        )
    else:
        login_msg = (
            "✅ Аккаунт успешно зарегистрирован на сайте!\n"
            "Теперь вам доступны все функции бота.\n\n"
            f"🌐 Сайт: {site_url}"
        )
    
    try:
        vk.messages.send(
            user_id=user_id,
            message=login_msg,
            random_id=0,
            keyboard=create_main_keyboard(active_group, site_url)
        )
        logger.info(f"✅ Данные для входа отправлены пользователю {user_id}")
    except Exception as e:
        logger.error(f"❌ Ошибка отправки данных для входа пользователю {user_id}: {e}")


# ============ Функция автовыдачи билетов ============

def auto_issue_tickets():
    """
    Проверяет все завершенные волны и выдает билеты пользователям,
    которые выполнили все задания, но по какой-то причине не получили билет.
    """
    logger.info("🔄 Запуск автовыдачи билетов...")
    
    conn = pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        connect_timeout=5,
        read_timeout=10
    )
    
    try:
        with conn.cursor() as cursor:
            # Получаем все завершенные группы (end_date < CURDATE())
            cursor.execute("""
                SELECT id, title FROM vk_bot_task_groups 
                WHERE end_date < CURDATE()
                ORDER BY id DESC
            """)
            completed_groups = cursor.fetchall()
            
            if not completed_groups:
                logger.info("📢 Нет завершенных волн для проверки")
                return
            
            logger.info(f"📊 Проверяем {len(completed_groups)} завершенных волн")
            
            tickets_issued = 0
            
            for group in completed_groups:
                group_id = group['id']
                group_title = group['title']
                
                # Получаем все задания в группе
                cursor.execute("""
                    SELECT id FROM vk_bot_tasks WHERE group_id = %s
                """, (group_id,))
                tasks = cursor.fetchall()
                task_ids = [t['id'] for t in tasks]
                total_tasks = len(task_ids)
                
                if total_tasks == 0:
                    continue
                
                # Получаем всех пользователей, у которых есть одобренные отчеты по заданиям этой группы
                placeholders = ','.join(['%s'] * len(task_ids))
                cursor.execute(f"""
                    SELECT DISTINCT r.user_id, u.vk_id, u.first_name, u.last_name
                    FROM vk_bot_reports r
                    JOIN users u ON r.user_id = u.id
                    WHERE r.task_id IN ({placeholders})
                    AND r.status = 'approved'
                """, task_ids)
                users_with_reports = cursor.fetchall()
                
                for user in users_with_reports:
                    user_id = user['user_id']
                    vk_id = user['vk_id']
                    
                    # Проверяем, сколько заданий выполнил пользователь
                    cursor.execute(f"""
                        SELECT COUNT(DISTINCT task_id) as done
                        FROM vk_bot_reports
                        WHERE user_id = %s AND task_id IN ({placeholders}) AND status = 'approved'
                    """, (user_id, *task_ids))
                    done_result = cursor.fetchone()
                    done_tasks = done_result['done'] if done_result else 0
                    
                    # Проверяем, есть ли уже билет
                    cursor.execute("""
                        SELECT id FROM vk_bot_tickets
                        WHERE group_id = %s AND user_id = %s
                    """, (group_id, user_id))
                    existing_ticket = cursor.fetchone()
                    
                    # Если все задания выполнены и билета нет - выдаем
                    if done_tasks >= total_tasks and not existing_ticket:
                        import hashlib
                        ticket_num = 'TKT-' + hashlib.md5(
                            f"{group_id}{user_id}{datetime.now().timestamp()}".encode()
                        ).hexdigest()[:6].upper()
                        
                        cursor.execute("""
                            INSERT INTO vk_bot_tickets (group_id, user_id, ticket_number)
                            VALUES (%s, %s, %s)
                        """, (group_id, user_id, ticket_num))
                        
                        tickets_issued += 1
                        
                        # Отправляем уведомление пользователю
                        if vk_id:
                            try:
                                vk.messages.send(
                                    user_id=vk_id,
                                    message=f"🎉 Поздравляем! Вы выполнили все задания волны \"{group_title}\"!\n🎫 Вам выдан лотерейный билет: {ticket_num}\n\nОжидайте розыгрыша!",
                                    random_id=0
                                )
                                logger.info(f"✅ Билет {ticket_num} выдан пользователю {vk_id} за волну {group_title}")
                            except Exception as e:
                                logger.error(f"❌ Ошибка отправки уведомления пользователю {vk_id}: {e}")
                        
                        # Добавляем уведомление в БД
                        cursor.execute("""
                            INSERT INTO vk_bot_notifications (user_id, message)
                            VALUES (%s, %s)
                        """, (user_id, f"🎉 Поздравляем! Вы выполнили все задания волны \"{group_title}\"! Вам выдан лотерейный билет: {ticket_num}"))
                
                logger.info(f"📊 Волна '{group_title}': выдано {tickets_issued} билетов")
            
            logger.info(f"✅ Автовыдача билетов завершена. Всего выдано: {tickets_issued}")
            
    except Exception as e:
        logger.error(f"❌ Ошибка автовыдачи билетов: {e}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        conn.close()


def auto_ticket_worker():
    """Фоновый поток для автовыдачи билетов каждый день в 2:00"""
    while True:
        try:
            now = datetime.now()
            # Вычисляем время до следующего запуска (2:00)
            next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)
            if now >= next_run:
                next_run += timedelta(days=1)
            
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"⏰ Следующая автовыдача билетов в {next_run.strftime('%Y-%m-%d %H:%M:%S')} (через {wait_seconds/3600:.1f} часов)")
            
            time.sleep(wait_seconds)
            
            # Запускаем автовыдачу
            auto_issue_tickets()
            
        except Exception as e:
            logger.error(f"❌ Ошибка в потоке автовыдачи билетов: {e}")
            time.sleep(60)


# ============ Обработчик сообщений ============

def process_message_callback(vk_id, text, attachments=None):
    """Обработка сообщения для Callback API"""
    t_start = time.time()
    logger.info(f"📩 Получено сообщение от {vk_id}: {text[:50] if text else '(пусто)'}")
    
    try:
        settings = get_settings_cached()
        site_url = settings.get('site_url', '')
        active_group = get_active_group_cached()
        
        db_user = get_user_cached(vk_id)
        if not db_user:
            db_user = find_existing_user(vk_id, f"https://vk.com/id{vk_id}")
            if db_user:
                _cache[f'user_{vk_id}'] = db_user
                _cache_time[f'user_{vk_id}'] = time.time()
        
        if not db_user:
            if vk_id in user_states and user_states.get(vk_id, {}).get('action', '').startswith('registration'):
                handle_registration_state(vk_id, text, active_group, site_url)
                return
            
            if text == "✅ Подтверждаю":
                try:
                    user_info = vk.users.get(user_ids=vk_id)[0]
                    first_name = user_info.get('first_name', '')
                    last_name = user_info.get('last_name', '')
                except:
                    first_name = 'Участник'
                    last_name = 'Форума'
                
                user_states[vk_id] = {
                    'action': 'registration_confirm',
                    'first_name': first_name,
                    'last_name': last_name,
                }
                
                keyboard = VkKeyboard(one_time=False)
                keyboard.add_button("✅ Да", color=VkKeyboardColor.POSITIVE)
                keyboard.add_line()
                keyboard.add_button("❌ Нет", color=VkKeyboardColor.NEGATIVE)
                
                vk.messages.send(
                    user_id=vk_id,
                    message=(
                        "📝 Для регистрации вам необходимо указать настоящие верные Фамилию и Имя.\n"
                        "В противном случае ваши заявки на бронирование и ваш профиль могут быть аннулированы.\n\n"
                        f"Фамилия: {last_name}\n"
                        f"Имя: {first_name}\n\n"
                        "Все данные верны?"
                    ),
                    random_id=0,
                    keyboard=keyboard.get_keyboard()
                )
                return
            
            if vk_id not in agreement_sent:
                send_agreement_rules(vk, vk_id)
                agreement_sent.add(vk_id)
            else:
                vk.messages.send(
                    user_id=vk_id,
                    message="⚠️ Для продолжения нажмите кнопку «Подтверждаю» в сообщении с правилами.",
                    random_id=0,
                    keyboard=create_agreement_keyboard()
                )
            return
        
        user_agreed = get_user_agreement_cached(db_user['id'])
        
        if not user_agreed:
            if text == "✅ Подтверждаю":
                set_user_agreement(db_user['id'])
                _cache[f'agreement_{db_user["id"]}'] = True
                _cache_time[f'agreement_{db_user["id"]}'] = time.time()
                if vk_id in agreement_sent:
                    agreement_sent.remove(vk_id)
                vk.messages.send(
                    user_id=vk_id,
                    message="✅ Спасибо! Вы подтвердили согласие с правилами пребывания на Форуме.\n\nТеперь вам доступны все функции бота.",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )
                return
            
            if vk_id not in agreement_sent:
                send_agreement_rules(vk, vk_id)
                agreement_sent.add(vk_id)
            else:
                vk.messages.send(
                    user_id=vk_id,
                    message="⚠️ Для продолжения нажмите кнопку «Подтверждаю» в сообщении с правилами.",
                    random_id=0,
                    keyboard=create_agreement_keyboard()
                )
            return
        
        if vk_id in agreement_sent:
            agreement_sent.remove(vk_id)
        
        if vk_id in user_states and user_states.get(vk_id, {}).get('action', '').startswith('registration'):
            handle_registration_state(vk_id, text, active_group, site_url, db_user)
            return
        
        state = user_states.get(vk_id)
        
        # Обработка пагинации
        if text in ["⬅️ Предыдущая", "Следующая ➡️"]:
            current_page = user_states.get(vk_id, {}).get('tasks_page', 0)
            if text == "⬅️ Предыдущая":
                current_page = max(0, current_page - 1)
            else:
                current_page += 1
            
            if active_group:
                tasks = get_tasks_cached(active_group['id'])
                if tasks:
                    user_states[vk_id] = {'tasks_page': current_page}
                    vk.messages.send(
                        user_id=vk_id,
                        message="Выберите задание:",
                        random_id=0,
                        keyboard=build_tasks_keyboard(tasks, db_user['id'], current_page)
                    )
            return
        
        if text in ["🔙 Назад в меню", "🔙 Назад", "🔙 Назад к заявкам"]:
            user_states.pop(vk_id, None)
            vk.messages.send(
                user_id=vk_id,
                message="🔙 Возврат в главное меню.",
                random_id=0,
                keyboard=create_main_keyboard(active_group, site_url)
            )
            return
        
        if isinstance(state, dict) and state.get('action') == 'request_chat':
            request_id = state.get('request_id')
            
            if text == "✏️ Написать сообщение":
                vk.messages.send(user_id=vk_id, message="✏️ Напишите ваше сообщение:", random_id=0)
                return
            
            elif text == "🔄 Обновить":
                if request_id:
                    request = get_user_request_by_id(request_id, db_user['id'])
                    if request:
                        messages = get_request_messages(request_id)
                        vk.messages.send(
                            user_id=vk_id,
                            message=format_request_message(request, messages),
                            random_id=0,
                            keyboard=create_request_chat_keyboard(request_id)
                        )
                return
            
            elif request_id and text not in ["✏️ Написать сообщение", "🔄 Обновить", "🔙 Назад к заявкам"]:
                add_request_message(request_id, db_user['id'], text)
                request = get_user_request_by_id(request_id, db_user['id'])
                if request:
                    messages = get_request_messages(request_id)
                    vk.messages.send(
                        user_id=vk_id,
                        message=format_request_message(request, messages),
                        random_id=0,
                        keyboard=create_request_chat_keyboard(request_id)
                    )
                return
        
        if isinstance(state, dict) and state.get('action') == 'create_request':
            step = state.get('step')
            
            if step == 'subject':
                user_states[vk_id]['subject'] = text
                user_states[vk_id]['step'] = 'description'
                vk.messages.send(user_id=vk_id, message="📝 Теперь опишите проблему подробно:", random_id=0)
                return
            
            elif step == 'description':
                category = state.get('category', 'other')
                subject = state.get('subject', text[:50])
                description = text
                request_id = create_request(db_user['id'], category, subject, description)
                user_states.pop(vk_id, None)
                
                vk.messages.send(
                    user_id=vk_id,
                    message=f"✅ Ваша заявка #{request_id} успешно создана!\n📝 Тема: {subject}\n\nАдминистратор рассмотрит её в ближайшее время.",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )
                return
        
        # ============ ПРОВЕРКА НА ВЫБОР ЗАДАНИЯ ============
        # Важно: сначала проверяем, не нажал ли пользователь на кнопку задания
        if active_group:
            matched_task = get_task_by_title_cached(active_group['id'], text)
            
            if matched_task:
                # Пользователь выбрал задание - открываем его
                logger.info(f"🔍 Выбрано задание: ID={matched_task['id']}, Title={matched_task['title']}")
                report = get_user_task_report(db_user['id'], matched_task['id'])
                task_status = get_task_status_cached(db_user['id'], matched_task['id'])
                # Сохраняем выбранное задание в состояние
                current_page = user_states.get(vk_id, {}).get('tasks_page', 0)
                user_states[vk_id] = matched_task
                user_states[vk_id]['tasks_page'] = current_page
                vk.messages.send(
                    user_id=vk_id,
                    message=format_task_message(matched_task, report, task_status),
                    random_id=0
                )
                return
        
        # ============ ОБРАБОТКА ОТЧЕТА ПО ЗАДАНИЮ ============
        if isinstance(state, dict) and 'id' in state:
            task = state
            
            # Проверяем, существует ли задание еще
            if active_group:
                tasks = get_tasks_cached(active_group['id'])
                task_exists = False
                for t in tasks:
                    if t['id'] == task['id']:
                        task_exists = True
                        task = t
                        user_states[vk_id] = task
                        break
                
                if not task_exists:
                    user_states.pop(vk_id, None)
                    vk.messages.send(
                        user_id=vk_id,
                        message="⚠️ Задание больше не доступно. Пожалуйста, выберите задание заново.",
                        random_id=0,
                        keyboard=build_tasks_keyboard(tasks, db_user['id'], user_states.get(vk_id, {}).get('tasks_page', 0)) if tasks else create_main_keyboard(active_group, site_url)
                    )
                    return
            
            task_status = get_task_status_cached(db_user['id'], task['id'])
            
            # Если задание уже выполнено
            if task_status == 'approved':
                user_states.pop(vk_id, None)
                tasks = get_tasks_cached(active_group['id']) if active_group else []
                keyboard = build_tasks_keyboard(tasks, db_user['id'], user_states.get(vk_id, {}).get('tasks_page', 0)) if tasks else create_main_keyboard(active_group, site_url)
                vk.messages.send(
                    user_id=vk_id,
                    message="✅ Это задание уже выполнено! Выберите другое задание.",
                    random_id=0,
                    keyboard=keyboard
                )
                return
            
            # Если пользователь нажал "Назад" или другую системную кнопку
            if text in ["📋 Задания", "👤 Мой профиль", "📋 Заявки", "🔙 Назад в меню", "🔙 Назад"]:
                user_states.pop(vk_id, None)
                vk.messages.send(
                    user_id=vk_id,
                    message="🔙 Отправка отчета отменена.",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )
                return
            
            # Если пользователь отправил отчет (текст или вложения)
            if text.strip() or attachments:
                saved_files = []
                attachment_text = ""
                
                if attachments:
                    try:
                        saved_files, attachment_text = process_vk_attachments(attachments, vk_session)
                        if attachment_text:
                            text = f"{text}\n\n📎 Прикрепленные файлы:\n{attachment_text}" if text else f"📎 Прикрепленные файлы:\n{attachment_text}"
                    except Exception as e:
                        logger.error(f"Ошибка обработки вложений: {e}")
                
                has_attachments = len(saved_files) > 0
                try:
                    report_id = create_report(db_user['id'], task['id'], text, has_attachments)
                except ValueError as e:
                    error_msg = str(e)
                    if error_msg == "TASK_ALREADY_COMPLETED":
                        user_states.pop(vk_id, None)
                        tasks = get_tasks_cached(active_group['id']) if active_group else []
                        keyboard = build_tasks_keyboard(tasks, db_user['id'], user_states.get(vk_id, {}).get('tasks_page', 0)) if tasks else create_main_keyboard(active_group, site_url)
                        vk.messages.send(
                            user_id=vk_id,
                            message="✅ Это задание уже выполнено! Выберите другое задание.",
                            random_id=0,
                            keyboard=keyboard
                        )
                        return
                    elif error_msg == "REPORT_ALREADY_PENDING":
                        vk.messages.send(
                            user_id=vk_id,
                            message="⏳ У вас уже есть отчет на рассмотрении по этому заданию. Пожалуйста, дождитесь проверки администратора.",
                            random_id=0
                        )
                        return
                    else:
                        raise
                
                for file_info in saved_files:
                    save_report_media(
                        report_id,
                        file_info['file_url'],
                        file_info['file_type'],
                        file_info['original_name'],
                        file_info.get('file_size', 0)
                    )
                
                current_page = user_states.get(vk_id, {}).get('tasks_page', 0)
                user_states.pop(vk_id, None)
                
                response_msg = "✅ Ваш отчет принят на рассмотрение!\nСтатус задания обновится после проверки администратором."
                if has_attachments:
                    response_msg += f"\n📎 Прикреплено файлов: {len(saved_files)}"
                
                invalidate_user_task_cache(db_user['id'], task['id'])
                
                if active_group:
                    tasks = get_tasks_cached(active_group['id'])
                    keyboard = build_tasks_keyboard(tasks, db_user['id'], current_page)
                else:
                    keyboard = create_main_keyboard(active_group, site_url)
                
                try:
                    vk.messages.send(
                        user_id=vk_id,
                        message=response_msg,
                        random_id=0,
                        keyboard=keyboard
                    )
                    logger.info(f"✅ Подтверждение отправлено пользователю {vk_id}")
                except Exception as e:
                    logger.error(f"❌ Ошибка отправки подтверждения: {e}")
                
                return
            
            # Если текст пустой и нет вложений
            vk.messages.send(
                user_id=vk_id,
                message="⚠️ Пожалуйста, напишите текст отчета или прикрепите файлы.",
                random_id=0
            )
            return
        
        # ============ ОБРАБОТКА ГЛАВНЫХ КОМАНД ============
        
        if text in ["📋 Задания", "/start", "Начать", "Старт"]:
            if not active_group:
                vk.messages.send(
                    user_id=vk_id,
                    message="📢 В данный момент нет активных заданий.\n\nСледите за обновлениями!",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )
            else:
                tasks = get_tasks_cached(active_group['id'])
                # Сбрасываем страницу при открытии заданий
                user_states[vk_id] = {'tasks_page': 0}
                welcome = settings.get('welcome_text', 'Привет! Выполняй задания и получай билеты! 🎫')
                welcome += f"\n\n⏰ Задания действуют до: {active_group['end_date']}"
                welcome += "\n📎 Для подтверждения прикрепляйте фото, файлы или ссылки!"
                vk.messages.send(
                    user_id=vk_id,
                    message=welcome,
                    random_id=0,
                    keyboard=build_tasks_keyboard(tasks, db_user['id'], 0)
                )
            return
        
        elif text == "👤 Мой профиль":
            tickets = get_user_tickets(db_user['id'])
            fresh_user = get_user_by_vk_id(vk_id) or db_user
            
            msg = f"👤 Ваш профиль\n\n"
            msg += f"⭐ Рейтинг: {fresh_user['rating']} баллов\n"
            msg += f"📊 Выполнено заданий: {fresh_user['completed_tasks']}\n"
            msg += f"🎟 Получено билетов: {len(tickets)} шт.\n\n"
            
            if tickets:
                msg += "🎫 Ваши лотерейные билеты:\n"
                for t in tickets:
                    msg += f"• {t['ticket_number']} ({t['group_title']})\n"
                draw_time = settings.get('draw_time', '18:00')
                msg += f"\n⏰ Ожидайте розыгрыша в {draw_time}!"
            else:
                msg += "Выполните все задания активной волны, чтобы получить лотерейный билет!"
            
            if site_url:
                msg += f"\n\n🌐 {site_url}"
            
            vk.messages.send(user_id=vk_id, message=msg, random_id=0, keyboard=create_main_keyboard(active_group, site_url))
            return
        
        elif text == "📋 Заявки":
            requests = get_user_requests(db_user['id'])
            if not requests:
                vk.messages.send(
                    user_id=vk_id,
                    message="📋 У вас пока нет заявок.\n\n➕ Создайте новую заявку с помощью кнопки ниже.",
                    random_id=0,
                    keyboard=create_requests_keyboard([])
                )
            else:
                vk.messages.send(
                    user_id=vk_id,
                    message="📋 Ваши заявки\n\nНажмите на заявку для просмотра и общения:",
                    random_id=0,
                    keyboard=create_requests_keyboard(requests)
                )
            return
        
        elif text == "➕ Создать заявку":
            user_states[vk_id] = {'action': 'create_request', 'step': 'category'}
            vk.messages.send(
                user_id=vk_id,
                message="📋 Выберите категорию проблемы:",
                random_id=0,
                keyboard=create_category_keyboard()
            )
            return
        
        elif text in ["🌐 Сайт", "🤖 Бот ВК", "🏠 Жильё"]:
            state = user_states.get(vk_id)
            if state and isinstance(state, dict) and state.get('action') == 'create_request':
                category_map = {"🌐 Сайт": "site", "🤖 Бот ВК": "bot", "🏠 Жильё": "housing"}
                user_states[vk_id]['category'] = category_map[text]
                user_states[vk_id]['step'] = 'subject'
                vk.messages.send(user_id=vk_id, message="📝 Опишите суть проблемы кратко (одной строкой):", random_id=0)
            else:
                vk.messages.send(
                    user_id=vk_id,
                    message="🤖 Воспользуйтесь кнопками меню:",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )
            return
        
        elif text == "🌐 Личный кабинет" and site_url:
            vk.messages.send(
                user_id=vk_id,
                message=f"🌐 Перейдите в личный кабинет по ссылке:\n{site_url}",
                random_id=0,
                keyboard=create_main_keyboard(active_group, site_url)
            )
            return
        
        if 'Заявка #' in text or '#' in text:
            match = re.search(r'#(\d+)', text)
            if match:
                request_id = int(match.group(1))
                request = get_user_request_by_id(request_id, db_user['id'])
                if request:
                    messages = get_request_messages(request_id)
                    user_states[vk_id] = {'action': 'request_chat', 'request_id': request_id}
                    vk.messages.send(
                        user_id=vk_id,
                        message=format_request_message(request, messages),
                        random_id=0,
                        keyboard=create_request_chat_keyboard(request_id)
                    )
                    return
        
        vk.messages.send(
            user_id=vk_id,
            message="🤖 Воспользуйтесь кнопками меню:",
            random_id=0,
            keyboard=create_main_keyboard(active_group, site_url)
        )
        
    except pymysql.err.IntegrityError as e:
        logger.error(f"Ошибка целостности БД от {vk_id}: {e}")
        if "foreign key constraint fails" in str(e):
            user_states.pop(vk_id, None)
            try:
                tasks = get_tasks_cached(active_group['id']) if active_group else []
                keyboard = build_tasks_keyboard(tasks, db_user['id'], user_states.get(vk_id, {}).get('tasks_page', 0)) if tasks else create_main_keyboard(active_group, site_url)
                vk.messages.send(
                    user_id=vk_id,
                    message="⚠️ Произошла ошибка при отправке отчета. Пожалуйста, выберите задание заново.",
                    random_id=0,
                    keyboard=keyboard
                )
            except:
                pass
    except Exception as e:
        logger.error(f"Ошибка обработки сообщения от {vk_id}: {e}", exc_info=True)
    
    elapsed = time.time() - t_start
    if elapsed > 0.5:
        logger.warning(f"⚠️ Сообщение от {vk_id} обрабатывалось {elapsed:.2f}с")


def handle_registration_state(vk_id, text, active_group, site_url, db_user=None):
    """Обработка состояния регистрации"""
    state = user_states.get(vk_id, {})
    action = state.get('action', '')
    vk_url = f"https://vk.com/id{vk_id}"
    
    if action == 'registration_confirm':
        if text == "✅ Да":
            user = find_or_create_user(vk_id, state['first_name'], state['last_name'], vk_url)
            set_user_agreement(user['id'])
            _cache[f'user_{vk_id}'] = user
            _cache[f'agreement_{user["id"]}'] = True
            _cache_time[f'user_{vk_id}'] = time.time()
            _cache_time[f'agreement_{user["id"]}'] = time.time()
            agreement_sent.discard(vk_id)
            user_states.pop(vk_id, None)
            
            send_credentials_message(vk, vk_id, user, active_group, site_url)
            return
        
        elif text == "❌ Нет":
            user_states[vk_id]['action'] = 'registration_enter_last_name'
            vk.messages.send(user_id=vk_id, message="Введите вашу настоящую Фамилию:", random_id=0)
            return
    
    elif action == 'registration_enter_last_name':
        name = text.strip()
        if len(name) < 2:
            vk.messages.send(user_id=vk_id, message="⚠️ Фамилия слишком короткая. Введите Фамилию:", random_id=0)
            return
        user_states[vk_id]['last_name'] = name
        user_states[vk_id]['action'] = 'registration_enter_first_name'
        vk.messages.send(user_id=vk_id, message="Введите ваше Имя:", random_id=0)
        return
    
    elif action == 'registration_enter_first_name':
        name = text.strip()
        if len(name) < 2:
            vk.messages.send(user_id=vk_id, message="⚠️ Имя слишком короткое. Введите Имя:", random_id=0)
            return
        user_states[vk_id]['first_name'] = name
        user_states[vk_id]['action'] = 'registration_confirm_custom'
        
        keyboard = VkKeyboard(one_time=False)
        keyboard.add_button("✅ Да", color=VkKeyboardColor.POSITIVE)
        keyboard.add_line()
        keyboard.add_button("❌ Нет", color=VkKeyboardColor.NEGATIVE)
        
        vk.messages.send(
            user_id=vk_id,
            message=(
                "Ваши данные для регистрации:\n"
                f"Фамилия: {user_states[vk_id]['last_name']}\n"
                f"Имя: {user_states[vk_id]['first_name']}\n\n"
                "Все данные верны?"
            ),
            random_id=0,
            keyboard=keyboard.get_keyboard()
        )
        return
    
    elif action == 'registration_confirm_custom':
        if text == "✅ Да":
            user = find_or_create_user(vk_id, state['first_name'], state['last_name'], vk_url)
            set_user_agreement(user['id'])
            _cache[f'user_{vk_id}'] = user
            _cache[f'agreement_{user["id"]}'] = True
            _cache_time[f'user_{vk_id}'] = time.time()
            _cache_time[f'agreement_{user["id"]}'] = time.time()
            agreement_sent.discard(vk_id)
            user_states.pop(vk_id, None)
            
            send_credentials_message(vk, vk_id, user, active_group, site_url)
            return
        
        elif text == "❌ Нет":
            user_states[vk_id]['action'] = 'registration_enter_last_name'
            vk.messages.send(user_id=vk_id, message="Введите Фамилию:", random_id=0)
            return


# ============ Фоновые потоки ============

def send_notification_worker():
    """Фоновый поток для отправки уведомлений"""
    while True:
        try:
            notifications = get_pending_notifications(limit=20)
            if notifications:
                for notif in notifications:
                    try:
                        if notif.get('vk_id'):
                            vk.messages.send(
                                user_id=notif['vk_id'],
                                message=notif['message'],
                                random_id=0
                            )
                            mark_notification_sent(notif['id'])
                        else:
                            mark_notification_sent(notif['id'])
                        time.sleep(0.1)
                    except Exception as e:
                        logger.error(f"Ошибка отправки уведомления: {e}")
                        mark_notification_sent(notif['id'])
            time.sleep(3)
        except Exception as e:
            logger.error(f"Ошибка в потоке уведомлений: {e}")
            time.sleep(5)


def check_request_messages_worker():
    """Фоновый поток для проверки новых сообщений в заявках"""
    global sent_notifications
    
    while True:
        try:
            requests = get_all_requests_for_admin('open')
            requests += get_all_requests_for_admin('in_progress')
            
            for req in requests:
                request_id = req['id']
                user_vk_id = req.get('vk_id')
                
                if not user_vk_id:
                    continue
                
                last_msg = get_last_request_message(request_id)
                if not last_msg or last_msg['user_id'] == req['user_id']:
                    continue
                
                msg_key = f"{request_id}_{last_msg['id']}"
                if sent_notifications.get(msg_key):
                    continue
                
                try:
                    sender_name = last_msg.get('first_name', 'Администратор')
                    msg_text = f"📋 Новое сообщение по заявке #{request_id}\n"
                    msg_text += f"📝 {req['subject']}\n"
                    msg_text += "━" * 30 + "\n\n"
                    msg_text += f"💬 {sender_name}: {last_msg['message']}\n\n"
                    msg_text += "🔗 Чтобы ответить, перейдите в раздел '📋 Заявки' в боте."
                    
                    vk.messages.send(
                        user_id=user_vk_id,
                        message=msg_text,
                        random_id=0
                    )
                    sent_notifications[msg_key] = True
                    
                except Exception as e:
                    logger.error(f"Ошибка отправки уведомления о сообщении в заявке #{request_id}: {e}")
                
                time.sleep(0.1)
            
            if len(sent_notifications) > 100:
                sent_notifications = dict(list(sent_notifications.items())[-50:])
                
        except Exception as e:
            logger.error(f"Ошибка в потоке проверки заявок: {e}")
        
        time.sleep(8)


# ============ Обработчики Flask ============

@app.route('/vk/callback', methods=['POST'])
def vk_callback():
    """Основной обработчик callback от VK"""
    data = request.get_json()
    
    if not data:
        return 'Invalid JSON', 400
    
    if data.get('type') == 'confirmation':
        logger.info(f"Получен запрос на подтверждение сервера для группы {data.get('group_id')}")
        return config.CALLBACK_CONFIRMATION_CODE, 200, {'Content-Type': 'text/plain'}
    
    secret = data.get('secret')
    if secret and secret != config.CALLBACK_API_SECRET:
        logger.warning(f"Неверный секретный ключ: {secret}")
        return 'Invalid secret', 403
    
    if data.get('type') == 'message_new':
        try:
            message = data.get('object', {}).get('message', {})
            
            if message.get('out') == 1:
                return 'ok', 200
            
            vk_id = message.get('from_id')
            text = message.get('text', '').strip()
            
            attachments = message.get('attachments', [])
            if attachments:
                new_attachments = {}
                for i, att in enumerate(attachments):
                    att_type = att.get('type')
                    att_data = att.get(att_type, {})
                    new_attachments[f'attach{i+1}'] = {
                        'type': att_type,
                        'id': att_data.get('id'),
                        'owner_id': att_data.get('owner_id'),
                        'access_key': att_data.get('access_key', ''),
                        'data': att_data
                    }
                    new_attachments[f'attach{i+1}_type'] = att_type
                attachments = new_attachments
            else:
                attachments = None
            
            executor.submit(process_message_callback, vk_id, text, attachments)
            
            return 'ok', 200
            
        except Exception as e:
            logger.error(f"Ошибка обработки message_new: {e}", exc_info=True)
            return 'error', 500
    
    return 'ok', 200


@app.route('/vk/status', methods=['GET'])
def status():
    """Проверка статуса бота"""
    return jsonify({
        'status': 'running',
        'group_id': config.GROUP_ID,
        'callback_url': config.CALLBACK_API_URL,
        'version': '1.0'
    })


@app.route('/vk/setup', methods=['GET'])
def setup_info():
    """Информация для настройки Callback API"""
    return jsonify({
        'group_id': config.GROUP_ID,
        'callback_url': config.CALLBACK_API_URL,
        'confirmation_code': config.CALLBACK_CONFIRMATION_CODE,
        'secret_key': config.CALLBACK_API_SECRET
    })


# ============ Запуск ============

def init_vk_session():
    """Инициализация VK сессии"""
    global vk, vk_session
    
    settings = get_bot_settings()
    token = settings.get('vk_token', '')
    
    if not token:
        logger.error("❌ ОШИБКА: Укажите VK Token в админ-панели!")
        return False
    
    try:
        vk_session = vk_api.VkApi(token=token)
        vk = vk_session.get_api()
        logger.info("✅ VK сессия инициализирована")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации VK сессии: {e}")
        return False


def main():
    """Запуск бота на Callback API"""
    logger.info("🚀 Запуск бота на Callback API...")
    
    if not init_vk_session():
        logger.error("❌ Не удалось инициализировать VK сессию. Бот останавливается.")
        return
    
    # Запускаем фоновые потоки
    threading.Thread(target=send_notification_worker, daemon=True).start()
    threading.Thread(target=check_request_messages_worker, daemon=True).start()
    threading.Thread(target=cache_cleaner, daemon=True).start()
    threading.Thread(target=auto_ticket_worker, daemon=True).start()
    logger.info("✅ Фоновые потоки запущены!")
    
    logger.info(f"✅ Бот запущен на http://{config.CALLBACK_API_HOST}:{config.CALLBACK_API_PORT}")
    logger.info(f"📍 Callback URL: {config.CALLBACK_API_URL}")
    logger.info(f"🔑 Confirmation code: {config.CALLBACK_CONFIRMATION_CODE}")
    logger.info(f"🔐 Secret key: {config.CALLBACK_API_SECRET}")
    logger.info(f"📝 Логи пишутся в файл: {log_filename}")
    
    app.run(
        host=config.CALLBACK_API_HOST,
        port=config.CALLBACK_API_PORT,
        debug=False,
        threaded=True
    )


if __name__ == '__main__':
    main()