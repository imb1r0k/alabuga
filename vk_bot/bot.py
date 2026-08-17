import time
import threading
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from datetime import datetime, timedelta

import vk_api
from vk_api.longpoll import VkLongPoll, VkEventType
from vk_api.keyboard import VkKeyboard, VkKeyboardColor

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
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Глобальные переменные
user_states = {}
sent_notifications = {}
agreement_sent = set()
executor = ThreadPoolExecutor(max_workers=8)  # Увеличил количество потоков

# Улучшенный кэш с использованием словаря с временем жизни
class TTLCache:
    def __init__(self, ttl=10):
        self._cache = {}
        self._times = {}
        self.ttl = ttl
    
    def get(self, key):
        if key in self._cache and key in self._times:
            if time.time() - self._times[key] < self.ttl:
                return self._cache.get(key)
        return None
    
    def set(self, key, value):
        self._cache[key] = value
        self._times[key] = time.time()
    
    def invalidate(self, key=None):
        if key:
            self._cache.pop(key, None)
            self._times.pop(key, None)
        else:
            self._cache.clear()
            self._times.clear()

# Кэши с разным TTL для разных типов данных
cache_settings = TTLCache(ttl=30)  # Настройки - 30 сек
cache_group = TTLCache(ttl=10)    # Группы - 10 сек
cache_tasks = TTLCache(ttl=10)    # Задания - 10 сек
cache_user = TTLCache(ttl=30)     # Пользователи - 30 сек
cache_agreement = TTLCache(ttl=60) # Согласие - 60 сек
cache_status = TTLCache(ttl=5)    # Статусы - 5 сек (самое частое)

# Упрощенные функции получения кэшированных данных
def get_settings_cached():
    data = cache_settings.get('settings')
    if data is None:
        data = get_bot_settings()
        cache_settings.set('settings', data)
    return data

def get_active_group_cached():
    data = cache_group.get('active_group')
    if data is None:
        data = get_active_task_group()
        cache_group.set('active_group', data)
    return data

def get_tasks_cached(group_id):
    if not group_id:
        return []
    key = f'tasks_{group_id}'
    data = cache_tasks.get(key)
    if data is None:
        data = get_tasks_for_group(group_id)
        cache_tasks.set(key, data)
    return data

def get_user_cached(vk_id):
    key = f'user_{vk_id}'
    data = cache_user.get(key)
    if data is None:
        data = get_user_by_vk_id(vk_id)
        cache_user.set(key, data)
    return data

def get_user_agreement_cached(user_id):
    key = f'agreement_{user_id}'
    data = cache_agreement.get(key)
    if data is None:
        data = check_user_agreement(user_id)
        cache_agreement.set(key, data)
    return data

def get_task_status_cached(user_id, task_id):
    key = f'status_{user_id}_{task_id}'
    data = cache_status.get(key)
    if data is None:
        data = get_user_task_status(user_id, task_id)
        cache_status.set(key, data)
    return data

def invalidate_cache():
    """Сбрасывает все кэши"""
    cache_settings.invalidate()
    cache_group.invalidate()
    cache_tasks.invalidate()
    cache_user.invalidate()
    cache_agreement.invalidate()
    cache_status.invalidate()


# ============ Оптимизированные клавиатуры ============

# Кэш для клавиатур (чтобы не пересобирать каждый раз)
keyboard_cache = {}
KEYBOARD_CACHE_TTL = 30

def get_cached_keyboard(key, build_func, *args):
    """Получает клавиатуру из кэша или создает новую"""
    cache_key = f"{key}_{'_'.join(str(a) for a in args)}"
    now = time.time()
    
    if cache_key in keyboard_cache:
        cached_data, timestamp = keyboard_cache[cache_key]
        if now - timestamp < KEYBOARD_CACHE_TTL:
            return cached_data
    
    keyboard = build_func(*args)
    keyboard_cache[cache_key] = (keyboard, now)
    return keyboard

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

def build_tasks_keyboard(tasks, user_id):
    """Оптимизированная сборка клавиатуры заданий"""
    keyboard = VkKeyboard(one_time=False)
    
    # Разделяем задания по сложности
    easy_tasks = [t for t in tasks if t['difficulty'] == 'easy']
    medium_tasks = [t for t in tasks if t['difficulty'] == 'medium']
    hard_tasks = [t for t in tasks if t['difficulty'] == 'hard']
    
    def add_task_buttons(task_list, prefix, emoji):
        for t in task_list:
            # Используем кэшированный статус
            status = get_task_status_cached(user_id, t['id'])
            
            prefix_part = f" {prefix}: "
            max_title_len = 38 - len(emoji) - len(prefix_part)
            title_display = t['title'][:max_title_len].rstrip() + '…' if len(t['title']) > max_title_len else t['title']
            
            if status == 'approved':
                label = f"✅{prefix_part}{title_display}"
                color = VkKeyboardColor.POSITIVE
            elif status == 'pending':
                label = f"⏳{prefix_part}{title_display}"
                color = VkKeyboardColor.SECONDARY
            elif status == 'rejected':
                label = f"❌{prefix_part}{title_display}"
                color = VkKeyboardColor.NEGATIVE
            else:
                label = f"{emoji}{prefix_part}{title_display}"
                color = VkKeyboardColor.PRIMARY
            
            keyboard.add_button(label, color=color)
            keyboard.add_line()
    
    # Добавляем задания
    if easy_tasks:
        add_task_buttons(easy_tasks, "Легкое", "🟢")
    if medium_tasks:
        add_task_buttons(medium_tasks, "Среднее", "🟡")
    if hard_tasks:
        add_task_buttons(hard_tasks, "Сложное", "🔴")
    
    if not tasks:
        keyboard.add_button("📢 Нет заданий", color=VkKeyboardColor.SECONDARY)
        keyboard.add_line()
    
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


# ============ Вспомогательные функции (оптимизированные) ============

def get_task_from_button(text, tasks):
    """Быстрый поиск задания по тексту кнопки"""
    # Удаляем эмодзи и префиксы
    clean_text = re.sub(r'[✅⏳❌🟢🟡🔴📌]', '', text)
    for prefix in ['Легкое:', 'Среднее:', 'Сложное:']:
        clean_text = clean_text.replace(prefix, '')
    clean_text = clean_text.strip()
    
    # Поиск по точному совпадению
    for t in tasks:
        if t['title'].strip() == clean_text:
            return t
    
    # Поиск по началу строки
    for t in tasks:
        if clean_text and t['title'].startswith(clean_text.rstrip('…')):
            return t
    
    # Поиск по ID
    match = re.search(r'#(\d+)', text)
    if match:
        task_id = int(match.group(1))
        for t in tasks:
            if t['id'] == task_id:
                return t
    
    return None

def format_request_message(request, messages):
    """Быстрое форматирование сообщения заявки"""
    status_emoji = {'open': '🟡', 'in_progress': '🔵', 'resolved': '✅', 'rejected': '❌'}
    status_text = {'open': 'Открыта', 'in_progress': 'В работе', 'resolved': 'Решена', 'rejected': 'Отклонена'}
    
    msg = f"📋 Заявка #{request['id']}\n"
    msg += f"📝 {request['subject']}\n"
    msg += f"📊 Статус: {status_emoji.get(request['status'], '🟡')} {status_text.get(request['status'], request['status'])}\n"
    
    if request.get('created_at'):
        msg += f"📅 Создана: {request['created_at'].strftime('%d.%m.%Y %H:%M')}\n"
    msg += "\n"
    
    if messages:
        msg += "💬 Сообщения:\n"
        for msg_item in messages[-10:]:
            sender = msg_item.get('first_name', 'Пользователь')
            msg += f"👤 {sender}: {msg_item['message']}\n"
    else:
        msg += "💬 Сообщений пока нет\n"
    
    return msg

def format_task_message(task, report=None, task_status=None):
    """Быстрое форматирование сообщения задания"""
    diff_emoji = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}
    diff_text = {'easy': 'Легкое', 'medium': 'Среднее', 'hard': 'Сложное'}
    
    msg = f"📌 {task['title']}\n\n"
    msg += f"📝 {task['description']}\n\n"
    msg += f"⭐ Сложность: {diff_emoji.get(task['difficulty'], '📌')} {diff_text.get(task['difficulty'], task['difficulty'])}\n"
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


# ============ Обработчик сообщений (оптимизированный) ============

def process_message(event, vk, vk_session):
    """Обработка одного сообщения (оптимизированная)"""
    t_start = time.time()
    vk_id = event.user_id
    text = event.text.strip()
    
    try:
        # Получаем настройки и группу из кэша
        settings = get_settings_cached()
        site_url = settings.get('site_url', '')
        active_group = get_active_group_cached()
        
        # Быстрый поиск пользователя
        db_user = get_user_cached(vk_id)
        if not db_user:
            db_user = find_existing_user(vk_id, f"https://vk.com/id{vk_id}")
            if db_user:
                cache_user.set(f'user_{vk_id}', db_user)
        
        # Если пользователь новый
        if not db_user:
            if vk_id in user_states and user_states.get(vk_id, {}).get('action', '').startswith('registration'):
                handle_registration_state(vk_id, text, vk, active_group, site_url)
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
        
        # Проверка согласия
        user_agreed = get_user_agreement_cached(db_user['id'])
        
        if not user_agreed:
            if text == "✅ Подтверждаю":
                set_user_agreement(db_user['id'])
                cache_agreement.set(f'agreement_{db_user["id"]}', True)
                agreement_sent.discard(vk_id)
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
        
        # Если пользователь согласился
        agreement_sent.discard(vk_id)
        
        # Проверяем состояние регистрации
        if vk_id in user_states and user_states.get(vk_id, {}).get('action', '').startswith('registration'):
            handle_registration_state(vk_id, text, vk, active_group, site_url, db_user)
            return
        
        # Основная обработка
        state = user_states.get(vk_id)
        
        # Обработка вложений
        attachments = []
        if event.attachments:
            attachments = event.attachments
            try:
                message_data = vk.messages.getById(message_ids=event.message_id)
                if message_data and 'items' in message_data and len(message_data['items']) > 0:
                    msg_attachments = message_data['items'][0].get('attachments', [])
                    if msg_attachments:
                        new_attachments = {}
                        for i, att in enumerate(msg_attachments):
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
            except Exception as e:
                logger.error(f"Ошибка получения вложений: {e}")
        
        # --- Обработка состояний ---
        
        # Назад
        if text in ["🔙 Назад в меню", "🔙 Назад", "🔙 Назад к заявкам"]:
            user_states.pop(vk_id, None)
            vk.messages.send(
                user_id=vk_id,
                message="🔙 Возврат в главное меню.",
                random_id=0,
                keyboard=create_main_keyboard(active_group, site_url)
            )
            return
        
        # Чат заявки
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
        
        # Создание заявки
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
        
        # Отправка отчета
        if isinstance(state, dict) and 'id' in state:
            task = state
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
            report_id = create_report(db_user['id'], task['id'], text, has_attachments)
            
            for file_info in saved_files:
                save_report_media(
                    report_id,
                    file_info['file_url'],
                    file_info['file_type'],
                    file_info['original_name'],
                    file_info.get('file_size', 0)
                )
            
            user_states.pop(vk_id, None)
            
            response_msg = "✅ Ваш отчет принят на рассмотрение!\nСтатус задания обновится после проверки администратором."
            if has_attachments:
                response_msg += f"\n📎 Прикреплено файлов: {len(saved_files)}"
            
            # Инвалидируем кэш статусов
            cache_status.invalidate(f'status_{db_user["id"]}_{task["id"]}')
            
            if active_group:
                tasks = get_tasks_cached(active_group['id'])
                keyboard = build_tasks_keyboard(tasks, db_user['id'])
            else:
                keyboard = create_main_keyboard(active_group, site_url)
            
            vk.messages.send(user_id=vk_id, message=response_msg, random_id=0, keyboard=keyboard)
            return
        
        # --- Основные команды ---
        
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
                welcome = settings.get('welcome_text', 'Привет! Выполняй задания и получай билеты! 🎫')
                welcome += f"\n\n⏰ Задания действуют до: {active_group['end_date']}"
                welcome += "\n📎 Для подтверждения прикрепляйте фото, файлы или ссылки!"
                vk.messages.send(
                    user_id=vk_id,
                    message=welcome,
                    random_id=0,
                    keyboard=build_tasks_keyboard(tasks, db_user['id'])
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
                msg += "🎯 Выполните все задания активной волны, чтобы получить лотерейный билет!"
            
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
        
        # --- Обработка нажатий ---
        
        # Заявка
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
        
        # Задание
        if active_group:
            tasks = get_tasks_cached(active_group['id'])
            matched_task = get_task_from_button(text, tasks)
            
            if matched_task:
                report = get_user_task_report(db_user['id'], matched_task['id'])
                task_status = get_task_status_cached(db_user['id'], matched_task['id'])
                user_states[vk_id] = matched_task
                vk.messages.send(
                    user_id=vk_id,
                    message=format_task_message(matched_task, report, task_status),
                    random_id=0
                )
                return
        
        # Если ничего не подошло
        vk.messages.send(
            user_id=vk_id,
            message="🤖 Воспользуйтесь кнопками меню:",
            random_id=0,
            keyboard=create_main_keyboard(active_group, site_url)
        )
        
    except Exception as e:
        logger.error(f"Ошибка обработки сообщения от {vk_id}: {e}", exc_info=True)
    
    elapsed = time.time() - t_start
    if elapsed > 0.3:
        logger.warning(f"⚠️ Сообщение от {vk_id} обрабатывалось {elapsed:.2f}с")


def handle_registration_state(vk_id, text, vk, active_group, site_url, db_user=None):
    """Обработка состояния регистрации (без изменений)"""
    state = user_states.get(vk_id, {})
    action = state.get('action', '')
    vk_url = f"https://vk.com/id{vk_id}"
    
    if action == 'registration_confirm':
        if text == "✅ Да":
            user = find_or_create_user(vk_id, state['first_name'], state['last_name'], vk_url)
            set_user_agreement(user['id'])
            cache_user.set(f'user_{vk_id}', user)
            cache_agreement.set(f'agreement_{user["id"]}', True)
            agreement_sent.discard(vk_id)
            user_states.pop(vk_id, None)
            
            if user.get('generated_password'):
                login_msg = (
                    "✅ Аккаунт успешно зарегистрирован!\n\n"
                    f"👤 Фамилия: {user['last_name']}\n"
                    f"Имя: {user['first_name']}\n"
                    f"🔑 Логин: {user['login']}\n"
                    f"🔐 Пароль: {user['generated_password']}\n\n"
                    "⚠️ Сохраните эти данные для входа на сайт.\n"
                    f"🌐 Сайт: {site_url}"
                )
            else:
                login_msg = "✅ Аккаунт успешно зарегистрирован!\nТеперь вам доступны все функции бота."
            
            vk.messages.send(user_id=vk_id, message=login_msg, random_id=0, keyboard=create_main_keyboard(active_group, site_url))
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
            cache_user.set(f'user_{vk_id}', user)
            cache_agreement.set(f'agreement_{user["id"]}', True)
            agreement_sent.discard(vk_id)
            user_states.pop(vk_id, None)
            
            if user.get('generated_password'):
                login_msg = (
                    "✅ Аккаунт успешно зарегистрирован!\n\n"
                    f"👤 Фамилия: {user['last_name']}\n"
                    f"Имя: {user['first_name']}\n"
                    f"🔑 Логин: {user['login']}\n"
                    f"🔐 Пароль: {user['generated_password']}\n\n"
                    "⚠️ Сохраните эти данные для входа на сайт.\n"
                    f"🌐 Сайт: {site_url}"
                )
            else:
                login_msg = "✅ Аккаунт успешно зарегистрирован!\nТеперь вам доступны все функции бота."
            
            vk.messages.send(user_id=vk_id, message=login_msg, random_id=0, keyboard=create_main_keyboard(active_group, site_url))
            return
        
        elif text == "❌ Нет":
            user_states[vk_id]['action'] = 'registration_enter_last_name'
            vk.messages.send(user_id=vk_id, message="Введите Фамилию:", random_id=0)
            return


def main():
    global executor
    
    logger.info("🚀 Запуск бота ВКонтакте...")

    settings = get_bot_settings()
    token = settings.get('vk_token', '')
    site_url = settings.get('site_url', '')

    if not token:
        logger.error("❌ ОШИБКА: Укажите VK Token в админ-панели!")
        while not token:
            time.sleep(10)
            settings = get_bot_settings()
            token = settings.get('vk_token', '')
            site_url = settings.get('site_url', '')

    vk_session = vk_api.VkApi(token=token)
    vk = vk_session.get_api()
    longpoll = VkLongPoll(vk_session)

    # Запускаем фоновые потоки
    threading.Thread(target=send_notification_worker, args=(vk,), daemon=True).start()
    threading.Thread(target=check_request_messages_worker, args=(vk,), daemon=True).start()
    logger.info("✅ Фоновые потоки запущены!")

    logger.info("✅ Бот успешно подключен к ВКонтакте и ожидает сообщений!")

    # Увеличиваем количество потоков для обработки сообщений
    executor = ThreadPoolExecutor(max_workers=8)

    for event in longpoll.listen():
        if event.type == VkEventType.MESSAGE_NEW and event.to_me:
            executor.submit(process_message, event, vk, vk_session)


def send_notification_worker(vk):
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


def check_request_messages_worker(vk):
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


if __name__ == '__main__':
    main()