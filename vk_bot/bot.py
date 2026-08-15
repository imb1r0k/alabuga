import time
import vk_api
from vk_api.longpoll import VkLongPoll, VkEventType
from vk_api.keyboard import VkKeyboard, VkKeyboardColor
import threading
import logging
import re
import os
from concurrent.futures import ThreadPoolExecutor

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
    get_report_media,
    get_user_tickets,
    get_pending_notifications,
    mark_notification_sent,
    get_user_by_vk_id,
    add_notification,
    create_request,
    get_user_requests,
    get_user_request_by_id,
    get_request_by_id,
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

user_states = {}
UPLOAD_DIR = 'uploads/vk_bot/'
sent_notifications = {}
agreement_sent = set()

# ============ Кэширование ============
_cache_lock = threading.Lock()
_cached_settings = {}
_cached_active_group = None
_cache_updated = 0
CACHE_TTL = 15  # секунд

# Кэш пользователей в памяти по vk_id для мгновенного ответа
_user_cache = {}
_user_cache_lock = threading.Lock()

user_states_lock = threading.Lock()
agreement_sent_lock = threading.Lock()

def get_settings_cached():
    global _cached_settings, _cache_updated
    now = time.time()
    with _cache_lock:
        if now - _cache_updated > CACHE_TTL:
            _cached_settings = get_bot_settings()
            _cache_updated = now
        return _cached_settings

def get_active_group_cached():
    global _cached_active_group, _cache_updated
    now = time.time()
    with _cache_lock:
        if now - _cache_updated > CACHE_TTL:
            _cached_active_group = get_active_task_group()
            _cache_updated = now
        return _cached_active_group

def get_cached_user(vk_id):
    with _user_cache_lock:
        return _user_cache.get(vk_id)

def set_cached_user(vk_id, user):
    with _user_cache_lock:
        _user_cache[vk_id] = user

def invalidate_cached_user(vk_id):
    with _user_cache_lock:
        _user_cache.pop(vk_id, None)

# =====================================================

def send_notification_worker(vk):
    """Фоновый поток для отправки уведомлений"""
    while True:
        try:
            notifications = get_pending_notifications(limit=10)
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
                    except vk_api.exceptions.ApiError as e:
                        logger.error(f"VK API ошибка при отправке уведомления: {e}")
                        if 'message' in str(e) and ('blocked' in str(e) or 'disabled' in str(e)):
                            mark_notification_sent(notif['id'])
                    except Exception as e:
                        logger.error(f"Ошибка отправки уведомления: {e}")
            else:
                time.sleep(4)
        except Exception as e:
            logger.error(f"Ошибка в потоке уведомлений: {e}")
            time.sleep(4)


def check_request_messages_worker(vk):
    """Фоновый поток для проверки новых сообщений в заявках"""
    global sent_notifications
    
    while True:
        try:
            requests = get_all_requests_for_admin('open') + get_all_requests_for_admin('in_progress')
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
                    logger.error(f"Ошибка отправки сообщения в заявке #{request_id}: {e}")
                time.sleep(0.1)
            
            if len(sent_notifications) > 100:
                sent_notifications = dict(list(sent_notifications.items())[-50:])
        except Exception as e:
            logger.error(f"Ошибка в потоке проверки заявок: {e}")
        time.sleep(8)


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
    keyboard = VkKeyboard(one_time=False)
    
    easy_tasks = [t for t in tasks if t['difficulty'] == 'easy']
    medium_tasks = [t for t in tasks if t['difficulty'] == 'medium']
    hard_tasks = [t for t in tasks if t['difficulty'] == 'hard']
    
    def add_task_buttons(task_list, prefix, emoji):
        for t in task_list:
            status = get_user_task_status(user_id, t['id'])
            prefix_part = f" {prefix}: "
            max_title_len = 40 - len(emoji) - len(prefix_part)
            title_display = t['title']
            if len(title_display) > max_title_len:
                title_display = t['title'][:max_title_len].rstrip() + '…'
    
            label = f"{emoji}{prefix_part}{title_display}"
            color = VkKeyboardColor.PRIMARY
    
            if status:
                if status == 'approved':
                    label = f"✅{prefix_part}{title_display}"
                    color = VkKeyboardColor.POSITIVE
                elif status == 'pending':
                    label = f"⏳{prefix_part}{title_display}"
                    color = VkKeyboardColor.SECONDARY
                elif status == 'rejected':
                    label = f"❌{prefix_part}{title_display}"
                    color = VkKeyboardColor.NEGATIVE
    
            keyboard.add_button(label, color=color)
            keyboard.add_line()
    
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


def create_registration_confirm_keyboard():
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("✅ Да", color=VkKeyboardColor.POSITIVE)
    keyboard.add_line()
    keyboard.add_button("❌ Нет", color=VkKeyboardColor.NEGATIVE)
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


def get_task_from_button(text, tasks):
    status_emoji = ['✅', '⏳', '❌']
    diff_emoji = ['🟢', '🟡', '🔴', '📌']
    prefixes = ['Легкое:', 'Среднее:', 'Сложное:']
    
    clean_text = text
    for emoji in status_emoji + diff_emoji:
        clean_text = clean_text.replace(emoji, '')
    for prefix in prefixes:
        clean_text = clean_text.replace(prefix, '')
    clean_text = clean_text.strip()
    
    for t in tasks:
        full_title = t['title'].strip()
        if full_title == clean_text or clean_text in full_title or full_title in clean_text:
            return t
        clean_part = clean_text.rstrip('…').rstrip()
        if clean_part and full_title.startswith(clean_part):
            return t
    
    match = re.search(r'#(\d+)', text)
    if match:
        task_id = int(match.group(1))
        for t in tasks:
            if t['id'] == task_id:
                return t
    return None


def get_status_label(status):
    labels = {
        'open': '🟡 Открыта',
        'in_progress': '🔵 В работе',
        'resolved': '✅ Решена',
        'rejected': '❌ Отклонена'
    }
    return labels.get(status, status)


def get_category_label(category):
    labels = {
        'site': '🌐 Сайт',
        'bot': '🤖 Бот ВК',
        'housing': '🏠 Жильё'
    }
    return labels.get(category, category)


def format_request_message(request, messages):
    status_emoji = {'open': '🟡', 'in_progress': '🔵', 'resolved': '✅', 'rejected': '❌'}
    status_text = {'open': 'Открыта', 'in_progress': 'В работе', 'resolved': 'Решена', 'rejected': 'Отклонена'}
    
    msg = f"📋 Заявка #{request['id']}\n"
    msg += f"📝 {request['subject']}\n"
    msg += f"📊 Статус: {status_emoji.get(request['status'], '🟡')} {status_text.get(request['status'], request['status'])}\n\n"
    
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
    msg += f"⭐ Сложность: {diff_emoji.get(task['difficulty'], '📌')} {diff_text.get(task['difficulty'], task['difficulty'])}\n"
    msg += f"🎯 Баллы: {task['points']}\n\n"
    
    if task_status == 'approved' or (report and report.get('status') == 'approved'):
        msg += "✅ Статус: Выполнено! Баллы зачислены.\n"
    elif report and report.get('status') == 'pending':
        msg += "⏳ Статус: На рассмотрении администратора.\nПожалуйста, ожидайте проверки.\n"
    elif report and report.get('status') == 'rejected':
        reason = report.get('reject_reason', 'Не выполнено')
        msg += f"❌ Статус: Отклонено\nПричина: {reason}\n\n📝 Отправьте отчет повторно с исправлениями."
    
    msg += "\n📎 Для подтверждения прикрепите фото, видео или ссылку."
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


def process_message(event, vk, vk_session):
    """Быстрая обработка сообщения"""
    try:
        vk_id = event.user_id
        text = event.text.strip()

        attachments = {}
        if getattr(event, 'attachments', None):
            try:
                message_data = vk.messages.getById(message_ids=event.message_id)
                if message_data and 'items' in message_data and len(message_data['items']) > 0:
                    msg_attachments = message_data['items'][0].get('attachments', [])
                    for i, att in enumerate(msg_attachments):
                        att_type = att.get('type')
                        att_data = att.get(att_type, {})
                        attachments[f'attach{i+1}'] = {
                            'type': att_type,
                            'id': att_data.get('id'),
                            'owner_id': att_data.get('owner_id'),
                            'access_key': att_data.get('access_key', ''),
                            'data': att_data
                        }
                        attachments[f'attach{i+1}_type'] = att_type
            except Exception as e:
                logger.error(f"Ошибка получения вложений: {e}")

        # Проверяем пользователя в памяти / базе
        db_user = get_cached_user(vk_id)
        if not db_user:
            db_user = find_existing_user(vk_id, f"https://vk.com/id{vk_id}")
            if db_user:
                set_cached_user(vk_id, db_user)

        settings = get_settings_cached()
        site_url = settings.get('site_url', '')
        active_group = get_active_group_cached()

        # Новый пользователь (еще нет в базе)
        if not db_user:
            with user_states_lock:
                state = user_states.get(vk_id)

            in_registration = (isinstance(state, dict) and state.get('action', '').startswith('registration'))

            if not in_registration:
                if text == "✅ Подтверждаю":
                    try:
                        user_info = vk.users.get(user_ids=vk_id)[0]
                        first_name = user_info.get('first_name', '')
                        last_name = user_info.get('last_name', '')
                    except Exception:
                        first_name = 'Участник'
                        last_name = 'Форума'

                    with user_states_lock:
                        user_states[vk_id] = {
                            'action': 'registration_confirm',
                            'first_name': first_name,
                            'last_name': last_name,
                        }
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
                        keyboard=create_registration_confirm_keyboard()
                    )
                    return
                else:
                    with agreement_sent_lock:
                        if vk_id not in agreement_sent:
                            send_agreement_rules(vk, vk_id)
                            agreement_sent.add(vk_id)
                        else:
                            vk.messages.send(
                                user_id=vk_id,
                                message="⚠️ Для продолжения нажмите кнопку «Подтверждаю» в сообщении с правилами.",
                                random_id=0
                            )
                    return
        else:
            # Пользователь найден, проверяем согласие с правилами
            if not check_user_agreement(db_user['id']):
                if text == "✅ Подтверждаю":
                    set_user_agreement(db_user['id'])
                    with agreement_sent_lock:
                        agreement_sent.discard(vk_id)
                    vk.messages.send(
                        user_id=vk_id,
                        message="✅ Спасибо! Вы подтвердили согласие с правилами пребывания на Форуме.\n\nТеперь вам доступны все функции бота.",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )
                    return

                with agreement_sent_lock:
                    if vk_id not in agreement_sent:
                        send_agreement_rules(vk, vk_id)
                        agreement_sent.add(vk_id)
                    else:
                        vk.messages.send(
                            user_id=vk_id,
                            message="⚠️ Для продолжения нажмите кнопку «Подтверждаю» в сообщении с правилами.",
                            random_id=0
                        )
                return

        with user_states_lock:
            state = user_states.get(vk_id)

        # --- Обработка регистрации ---
        if isinstance(state, dict) and state.get('action', '').startswith('registration'):
            action = state['action']
            vk_url_cur = f"https://vk.com/id{vk_id}"

            if action == 'registration_confirm':
                if text == "✅ Да":
                    db_user = find_or_create_user(vk_id, state['first_name'], state['last_name'], vk_url_cur)
                    set_cached_user(vk_id, db_user)
                    set_user_agreement(db_user['id'])
                    with agreement_sent_lock:
                        agreement_sent.discard(vk_id)
                    with user_states_lock:
                        user_states.pop(vk_id, None)

                    if db_user.get('generated_password'):
                        login_msg = (
                            "✅ Аккаунт успешно зарегистрирован!\n\n"
                            f"👤 Фамилия: {db_user['last_name']}\n"
                            f"Имя: {db_user['first_name']}\n"
                            f"🔑 Логин: {db_user['login']}\n"
                            f"🔐 Пароль: {db_user['generated_password']}\n\n"
                            "⚠️ Сохраните эти данные для входа на сайт.\n"
                            f"🌐 Сайт: {site_url}"
                        )
                    else:
                        login_msg = "✅ Аккаунт успешно зарегистрирован!\nТеперь вам доступны все функции бота."

                    vk.messages.send(user_id=vk_id, message=login_msg, random_id=0, keyboard=create_main_keyboard(active_group, site_url))
                    return
                elif text == "❌ Нет":
                    with user_states_lock:
                        user_states[vk_id]['action'] = 'registration_enter_last_name'
                    vk.messages.send(user_id=vk_id, message="Введите вашу настоящую Фамилию:", random_id=0)
                    return

            elif action == 'registration_enter_last_name':
                name = text.strip()
                if len(name) < 2:
                    vk.messages.send(user_id=vk_id, message="⚠️ Фамилия слишком короткая. Введите Фамилию:", random_id=0)
                    return
                with user_states_lock:
                    user_states[vk_id]['last_name'] = name
                    user_states[vk_id]['action'] = 'registration_enter_first_name'
                vk.messages.send(user_id=vk_id, message="Введите ваше Имя:", random_id=0)
                return

            elif action == 'registration_enter_first_name':
                name = text.strip()
                if len(name) < 2:
                    vk.messages.send(user_id=vk_id, message="⚠️ Имя слишком короткое. Введите Имя:", random_id=0)
                    return
                with user_states_lock:
                    user_states[vk_id]['first_name'] = name
                    user_states[vk_id]['action'] = 'registration_confirm_custom'
                keyboard = create_registration_confirm_keyboard()
                vk.messages.send(
                    user_id=vk_id,
                    message=(
                        "Ваши данные для регистрации:\n"
                        f"Фамилия: {user_states[vk_id]['last_name']}\n"
                        f"Имя: {user_states[vk_id]['first_name']}\n\n"
                        "Все данные верны?"
                    ),
                    random_id=0,
                    keyboard=keyboard
                )
                return

            elif action == 'registration_confirm_custom':
                if text == "✅ Да":
                    db_user = find_or_create_user(vk_id, state['first_name'], state['last_name'], vk_url_cur)
                    set_cached_user(vk_id, db_user)
                    set_user_agreement(db_user['id'])
                    with agreement_sent_lock:
                        agreement_sent.discard(vk_id)
                    with user_states_lock:
                        user_states.pop(vk_id, None)

                    if db_user.get('generated_password'):
                        login_msg = (
                            "✅ Аккаунт успешно зарегистрирован!\n\n"
                            f"👤 Фамилия: {db_user['last_name']}\n"
                            f"Имя: {db_user['first_name']}\n"
                            f"🔑 Логин: {db_user['login']}\n"
                            f"🔐 Пароль: {db_user['generated_password']}\n\n"
                            "⚠️ Сохраните эти данные для входа на сайт.\n"
                            f"🌐 Сайт: {site_url}"
                        )
                    else:
                        login_msg = "✅ Аккаунт успешно зарегистрирован!\nТеперь вам доступны все функции бота."

                    vk.messages.send(user_id=vk_id, message=login_msg, random_id=0, keyboard=create_main_keyboard(active_group, site_url))
                    return
                elif text == "❌ Нет":
                    with user_states_lock:
                        user_states[vk_id]['action'] = 'registration_enter_last_name'
                    vk.messages.send(user_id=vk_id, message="Введите Фамилию:", random_id=0)
                    return

        # Кнопка возврата назад
        if text in ["🔙 Назад в меню", "🔙 Назад", "🔙 Назад к заявкам"]:
            with user_states_lock:
                user_states.pop(vk_id, None)
            vk.messages.send(user_id=vk_id, message="🔙 Возврат в главное меню.", random_id=0, keyboard=create_main_keyboard(active_group, site_url))
            return

        # Чат по заявке
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
                        vk.messages.send(user_id=vk_id, message=format_request_message(request, messages), random_id=0, keyboard=create_request_chat_keyboard(request_id))
                return
            elif request_id and text not in ["✏️ Написать сообщение", "🔄 Обновить", "🔙 Назад к заявкам"]:
                add_request_message(request_id, db_user['id'], text)
                request = get_user_request_by_id(request_id, db_user['id'])
                if request:
                    messages = get_request_messages(request_id)
                    vk.messages.send(user_id=vk_id, message=format_request_message(request, messages), random_id=0, keyboard=create_request_chat_keyboard(request_id))
                return

        # Создание заявки
        if isinstance(state, dict) and state.get('action') == 'create_request':
            step = state.get('step')
            if step == 'subject':
                with user_states_lock:
                    user_states[vk_id]['subject'] = text
                    user_states[vk_id]['step'] = 'description'
                vk.messages.send(user_id=vk_id, message="📝 Теперь опишите проблему подробно:", random_id=0)
                return
            elif step == 'description':
                category = state.get('category', 'other')
                subject = state.get('subject', text[:50])
                description = text
                request_id = create_request(db_user['id'], category, subject, description)
                with user_states_lock:
                    user_states.pop(vk_id, None)
                vk.messages.send(
                    user_id=vk_id,
                    message=f"✅ Ваша заявка #{request_id} успешно создана!\n"
                            f"📋 Категория: {get_category_label(category)}\n"
                            f"📝 Тема: {subject}\n\n"
                            f"Администратор рассмотрит её в ближайшее время.",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )
                return

        # Отправка отчета по заданию
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

            with user_states_lock:
                user_states.pop(vk_id, None)

            response_msg = "✅ Ваш отчет принят на рассмотрение!\nСтатус задания обновится после проверки администратором."
            if has_attachments:
                response_msg += f"\n📎 Прикреплено файлов: {len(saved_files)}"

            if active_group:
                tasks = get_tasks_for_group(active_group['id'])
                keyboard = build_tasks_keyboard(tasks, db_user['id'])
            else:
                keyboard = create_main_keyboard(active_group, site_url)

            vk.messages.send(user_id=vk_id, message=response_msg, random_id=0, keyboard=keyboard)
            return

        # --- Обработка команд меню ---
        if text in ["📋 Задания", "/start", "Начать", "Старт"]:
            if not active_group:
                vk.messages.send(user_id=vk_id, message="📢 В данный момент нет активных заданий.\n\nСледите за обновлениями!", random_id=0, keyboard=create_main_keyboard(active_group, site_url))
            else:
                tasks = get_tasks_for_group(active_group['id'])
                welcome = settings.get('welcome_text', 'Привет! Выполняй задания и получай билеты! 🎫')
                welcome += f"\n\n⏰ Задания действуют до: {active_group['end_date']}"
                welcome += "\n📎 Для подтверждения прикрепляйте фото, файлы или ссылки!"
                vk.messages.send(user_id=vk_id, message=welcome, random_id=0, keyboard=build_tasks_keyboard(tasks, db_user['id']))
            return

        elif text == "👤 Мой профиль":
            tickets = get_user_tickets(db_user['id'])
            fresh_user = get_user_by_vk_id(vk_id) or db_user
            set_cached_user(vk_id, fresh_user)

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
                vk.messages.send(user_id=vk_id, message="📋 У вас пока нет заявок.\n\n➕ Создайте новую заявку с помощью кнопки ниже.", random_id=0, keyboard=create_requests_keyboard([]))
            else:
                vk.messages.send(user_id=vk_id, message="📋 Ваши заявки\n\nНажмите на заявку для просмотра и общения:", random_id=0, keyboard=create_requests_keyboard(requests))
            return

        elif text == "➕ Создать заявку":
            with user_states_lock:
                user_states[vk_id] = {'action': 'create_request', 'step': 'category'}
            vk.messages.send(user_id=vk_id, message="📋 Выберите категорию проблемы:", random_id=0, keyboard=create_category_keyboard())
            return

        elif text in ["🌐 Сайт", "🤖 Бот ВК", "🏠 Жильё"]:
            with user_states_lock:
                state = user_states.get(vk_id)
            if state and isinstance(state, dict) and state.get('action') == 'create_request':
                category_map = {"🌐 Сайт": "site", "🤖 Бот ВК": "bot", "🏠 Жильё": "housing"}
                with user_states_lock:
                    user_states[vk_id]['category'] = category_map[text]
                    user_states[vk_id]['step'] = 'subject'
                vk.messages.send(user_id=vk_id, message="📝 Опишите суть проблемы кратко (одной строкой):", random_id=0)
            else:
                vk.messages.send(user_id=vk_id, message="🤖 Воспользуйтесь кнопками меню:", random_id=0, keyboard=create_main_keyboard(active_group, site_url))
            return

        elif text == "🌐 Личный кабинет" and site_url:
            vk.messages.send(user_id=vk_id, message=f"🌐 Перейдите в личный кабинет по ссылке:\n{site_url}", random_id=0, keyboard=create_main_keyboard(active_group, site_url))
            return

        # Нажатие на заявку
        if 'Заявка #' in text or '#' in text:
            match = re.search(r'#(\d+)', text)
            if match:
                request_id = int(match.group(1))
                request = get_user_request_by_id(request_id, db_user['id'])
                if request:
                    messages = get_request_messages(request_id)
                    with user_states_lock:
                        user_states[vk_id] = {'action': 'request_chat', 'request_id': request_id}
                    vk.messages.send(user_id=vk_id, message=format_request_message(request, messages), random_id=0, keyboard=create_request_chat_keyboard(request_id))
                    return

        # Нажатие на задание
        if active_group:
            tasks = get_tasks_for_group(active_group['id'])
            matched_task = get_task_from_button(text, tasks)
            if matched_task:
                report = get_user_task_report(db_user['id'], matched_task['id'])
                task_status = get_user_task_status(db_user['id'], matched_task['id'])
                with user_states_lock:
                    user_states[vk_id] = matched_task
                vk.messages.send(user_id=vk_id, message=format_task_message(matched_task, report, task_status), random_id=0)
                return

        vk.messages.send(user_id=vk_id, message="🤖 Воспользуйтесь кнопками меню:", random_id=0, keyboard=create_main_keyboard(active_group, site_url))

    except Exception as e:
        logger.error(f"Ошибка при обработке сообщения от {event.user_id}: {e}", exc_info=True)


def main():
    logger.info("🚀 Запуск бота ВКонтакте...")

    while True:
        try:
            settings = get_bot_settings()
            token = settings.get('vk_token', '')

            if not token:
                logger.error("❌ Внимание: VK Token не указан в админ-панели. Ожидание 10 сек...")
                time.sleep(10)
                continue

            vk_session = vk_api.VkApi(token=token)
            vk = vk_session.get_api()
            longpoll = VkLongPoll(vk_session)

            # Фоновые потоки
            threading.Thread(target=send_notification_worker, args=(vk,), daemon=True).start()
            threading.Thread(target=check_request_messages_worker, args=(vk,), daemon=True).start()

            # Пул потоков для параллельной обработки событий
            executor = ThreadPoolExecutor(max_workers=10)

            logger.info("✅ Бот успешно подключен к ВКонтакте и ожидает сообщений!")

            for event in longpoll.listen():
                if event.type == VkEventType.MESSAGE_NEW and event.to_me:
                    executor.submit(process_message, event, vk, vk_session)

        except Exception as e:
            logger.error(f"Критическая ошибка в главном цикле бота: {e}", exc_info=True)
            time.sleep(5)


if __name__ == '__main__':
    main()