import time
import vk_api
from vk_api.longpoll import VkLongPoll, VkEventType
from vk_api.keyboard import VkKeyboard, VkKeyboardColor
import threading
import logging
import re
import os

from database import (
    get_bot_settings,
    find_or_create_user,
    get_active_task_group,
    get_tasks_for_group,
    get_user_task_report,
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
    get_request_messages,
    add_request_message,
    get_all_requests_for_admin,
    get_last_request_message,
    get_request_by_id,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

user_states = {}
UPLOAD_DIR = 'uploads/vk_bot/'
# Хранилище для уже отправленных уведомлений о сообщениях в заявках
sent_notifications = {}


def send_notification_worker(vk, settings):
    """Фоновый поток для отправки уведомлений"""
    while True:
        try:
            notifications = get_pending_notifications(limit=20)
            if notifications:
                logger.info(f"Получено {len(notifications)} уведомлений для отправки")
                for notif in notifications:
                    try:
                        if notif.get('vk_id'):
                            logger.info(f"Отправка уведомления пользователю VK ID {notif['vk_id']}: {notif['message'][:50]}...")
                            vk.messages.send(
                                user_id=notif['vk_id'],
                                message=notif['message'],
                                random_id=0
                            )
                            mark_notification_sent(notif['id'])
                            logger.info(f"Уведомление отправлено пользователю VK ID {notif['vk_id']}")
                        else:
                            logger.warning(f"Уведомление {notif['id']} без VK ID, пропускаем")
                        time.sleep(0.5)
                    except vk_api.exceptions.ApiError as e:
                        logger.error(f"VK API ошибка при отправке уведомления: {e}")
                        if 'message' in str(e) and ('blocked' in str(e) or 'disabled' in str(e)):
                            logger.warning(f"Пользователь {notif['vk_id']} недоступен, отмечаем как отправленное")
                            mark_notification_sent(notif['id'])
                    except Exception as e:
                        logger.error(f"Ошибка отправки уведомления: {e}")
            else:
                time.sleep(5)
        except Exception as e:
            logger.error(f"Ошибка в потоке уведомлений: {e}")
            time.sleep(5)


def check_request_messages_worker(vk, settings):
    """Фоновый поток для проверки новых сообщений в заявках"""
    global sent_notifications
    
    while True:
        try:
            # Получаем все открытые заявки
            requests = get_all_requests_for_admin('open')
            requests += get_all_requests_for_admin('in_progress')
            
            for req in requests:
                request_id = req['id']
                user_vk_id = req.get('vk_id')
                
                if not user_vk_id:
                    continue
                
                # Получаем последнее сообщение
                last_msg = get_last_request_message(request_id)
                if not last_msg:
                    continue
                
                # Проверяем, не отправил ли сообщение сам пользователь
                if last_msg['user_id'] == req['user_id']:
                    continue
                
                # Проверяем, не отправляли ли уже это сообщение
                msg_key = f"{request_id}_{last_msg['id']}"
                if sent_notifications.get(msg_key):
                    continue
                
                # Отправляем уведомление пользователю
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
                    logger.info(f"Уведомление о новом сообщении в заявке #{request_id} отправлено пользователю VK ID {user_vk_id}")
                    
                except Exception as e:
                    logger.error(f"Ошибка отправки уведомления о сообщении в заявке #{request_id}: {e}")
                
                time.sleep(0.5)
            
            # Очищаем старые записи (старше 1 часа)
            if len(sent_notifications) > 100:
                # Оставляем только последние 50 записей
                sent_notifications = dict(list(sent_notifications.items())[-50:])
                
        except Exception as e:
            logger.error(f"Ошибка в потоке проверки заявок: {e}")
        
        time.sleep(10)


def create_main_keyboard(active_group, site_url=''):
    """Создает главную клавиатуру"""
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
    """
    Создает клавиатуру с заданиями, сгруппированными по сложности.
    Каждая кнопка на отдельной строке.
    """
    keyboard = VkKeyboard(one_time=False)
    
    easy_tasks = [t for t in tasks if t['difficulty'] == 'easy']
    medium_tasks = [t for t in tasks if t['difficulty'] == 'medium']
    hard_tasks = [t for t in tasks if t['difficulty'] == 'hard']
    
    diff_labels = {'easy': '🔵 Простое', 'medium': '🟡 Среднее', 'hard': '🔴 Сложное'}
    
    def add_task_buttons(task_list, difficulty):
        for idx, t in enumerate(task_list):
            report = get_user_task_report(user_id, t['id'])
            label = f"{diff_labels.get(difficulty, 'Задание')} {idx + 1}"
            color = VkKeyboardColor.PRIMARY
            
            if report:
                if report['status'] == 'approved':
                    label += " ✅"
                    color = VkKeyboardColor.POSITIVE
                elif report['status'] == 'pending':
                    label += " ⏳"
                    color = VkKeyboardColor.SECONDARY
                elif report['status'] == 'rejected':
                    label += " ❌"
                    color = VkKeyboardColor.NEGATIVE
            
            keyboard.add_button(label, color=color)
            keyboard.add_line()
    
    if easy_tasks:
        add_task_buttons(easy_tasks, 'easy')
    if medium_tasks:
        add_task_buttons(medium_tasks, 'medium')
    if hard_tasks:
        add_task_buttons(hard_tasks, 'hard')
    
    keyboard.add_button("⬅ Назад", color=VkKeyboardColor.SECONDARY)
    
    return keyboard.get_keyboard()


def create_requests_keyboard(requests):
    """Создает клавиатуру со списком заявок"""
    keyboard = VkKeyboard(one_time=False)
    
    status_icons = {'open': '🟡', 'in_progress': '🔵', 'resolved': '✅', 'rejected': '❌'}
    cat_labels = {'site': '🌐', 'bot': '🤖', 'housing': '🏠'}
    
    for r in requests[:10]:
        icon = status_icons.get(r['status'], '🟡')
        cat = cat_labels.get(r['category'], '📌')
        label = f"{icon} #{r['id']} {cat} {r['subject'][:30]}"
        keyboard.add_button(label, color=VkKeyboardColor.PRIMARY)
        keyboard.add_line()
    
    keyboard.add_button("➕ Создать заявку", color=VkKeyboardColor.POSITIVE)
    keyboard.add_line()
    keyboard.add_button("⬅ Назад", color=VkKeyboardColor.SECONDARY)
    
    return keyboard.get_keyboard()


def create_request_chat_keyboard(request_id):
    """Создает клавиатуру для чата заявки"""
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("✏️ Написать сообщение", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🔄 Обновить", color=VkKeyboardColor.SECONDARY)
    keyboard.add_line()
    keyboard.add_button("⬅ Назад к заявкам", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


def create_category_keyboard():
    """Клавиатура выбора категории заявки"""
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("🌐 Сайт", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🤖 Бот ВК", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🏠 Жильё", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("⬅ Назад", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


def get_task_from_button(text, tasks):
    """Определяет задание по тексту кнопки"""
    diff_labels = {'easy': 'Простое', 'medium': 'Среднее', 'hard': 'Сложное'}
    diff_emoji = {'easy': '🔵', 'medium': '🟡', 'hard': '🔴'}
    
    # Убираем эмодзи и статусы
    clean_text = re.sub(r'[✅⏳❌🔵🟡🔴\s]', '', text).strip()
    
    for t in tasks:
        # Проверяем по ID
        if str(t['id']) == clean_text:
            return t
        
        # Проверяем по названию с номером
        diff = t['difficulty']
        label = f"{diff_labels.get(diff, 'Задание')}"
        tasks_by_diff = [x for x in tasks if x['difficulty'] == diff]
        for idx, task in enumerate(tasks_by_diff, 1):
            if task['id'] == t['id']:
                full_label = f"{label} {idx}"
                # Проверяем с эмодзи и без
                if full_label in clean_text or f"{diff_emoji.get(diff, '')}{full_label}" in clean_text:
                    return t
                break
    
    return None


def get_status_label(status):
    """Возвращает метку статуса с эмодзи"""
    labels = {
        'open': '🟡 Открыта',
        'in_progress': '🔵 В работе',
        'resolved': '✅ Решена',
        'rejected': '❌ Отклонена'
    }
    return labels.get(status, status)


def get_category_label(category):
    """Возвращает метку категории с эмодзи"""
    labels = {
        'site': '🌐 Сайт',
        'bot': '🤖 Бот ВК',
        'housing': '🏠 Жильё'
    }
    return labels.get(category, category)


def main():
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

    # Запускаем поток для отправки уведомлений
    notification_thread = threading.Thread(
        target=send_notification_worker,
        args=(vk, settings),
        daemon=True
    )
    notification_thread.start()

    # Запускаем поток для проверки новых сообщений в заявках
    request_thread = threading.Thread(
        target=check_request_messages_worker,
        args=(vk, settings),
        daemon=True
    )
    request_thread.start()
    logger.info("✅ Поток проверки заявок запущен!")

    logger.info("✅ Бот успешно подключен к ВКонтакте и ожидает сообщений!")

    for event in longpoll.listen():
        if event.type == VkEventType.MESSAGE_NEW and event.to_me:
            vk_id = event.user_id
            text = event.text.strip()

            attachments = []
            if event.attachments:
                attachments = event.attachments
                logger.info(f"=== ВЛОЖЕНИЯ ПОЛУЧЕНЫ ===")
                logger.info(f"Тип attachments: {type(attachments)}")
                
                try:
                    message_data = vk.messages.getById(message_ids=event.message_id)
                    logger.info(f"Полная информация о сообщении: {message_data}")
                    if message_data and 'items' in message_data and len(message_data['items']) > 0:
                        msg_attachments = message_data['items'][0].get('attachments', [])
                        logger.info(f"Вложения из messages.getById: {msg_attachments}")
                        
                        if msg_attachments:
                            new_attachments = {}
                            for i, att in enumerate(msg_attachments):
                                att_type = att.get('type')
                                att_data = att.get(att_type, {})
                                att_id = att_data.get('id')
                                att_owner_id = att_data.get('owner_id')
                                att_access_key = att_data.get('access_key', '')
                                
                                new_attachments[f'attach{i+1}'] = {
                                    'type': att_type,
                                    'id': att_id,
                                    'owner_id': att_owner_id,
                                    'access_key': att_access_key,
                                    'data': att_data
                                }
                                new_attachments[f'attach{i+1}_type'] = att_type
                            
                            attachments = new_attachments
                            logger.info(f"Преобразованные вложения: {list(attachments.keys())}")
                except Exception as e:
                    logger.error(f"Ошибка получения полной информации о сообщении: {e}")

            try:
                user_info = vk.users.get(user_ids=vk_id)[0]
                first_name = user_info.get('first_name', '')
                last_name = user_info.get('last_name', '')
                vk_url = f"https://vk.com/id{vk_id}"

                db_user = find_or_create_user(vk_id, first_name, last_name, vk_url)

                if db_user.get('generated_password'):
                    login_msg = (
                        f"👋 Привет, {first_name}!\n\n"
                        f"Для тебя создан аккаунт на сайте форума:\n"
                        f"🔑 Логин: {db_user['login']}\n"
                        f"🔐 Пароль: {db_user['generated_password']}\n\n"
                        f"🌐 {site_url}\n\n"
                        f"⚠️ Измени пароль после первого входа!"
                    )
                    vk.messages.send(
                        user_id=vk_id,
                        message=login_msg,
                        random_id=0
                    )
                    logger.info(f"Создан новый пользователь: {first_name} {last_name}, логин: {db_user['login']}")

            except Exception as e:
                logger.error(f"Ошибка получения пользователя: {e}")
                db_user = get_user_by_vk_id(vk_id)
                if not db_user:
                    vk.messages.send(
                        user_id=vk_id,
                        message="❌ Произошла ошибка при регистрации. Попробуйте позже.",
                        random_id=0
                    )
                    continue

            settings = get_bot_settings()
            site_url = settings.get('site_url', '')
            active_group = get_active_task_group()

            # --- Обработка состояния пользователя ---
            if vk_id in user_states:
                state = user_states[vk_id]

                # Если пользователь нажал "Назад" в любом состоянии
                if text == "⬅ Назад" or text == "⬅ Назад к заявкам":
                    del user_states[vk_id]
                    vk.messages.send(
                        user_id=vk_id,
                        message="🔙 Возврат в главное меню.",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )
                    continue

                # --- Отправка сообщения в чат заявки ---
                if isinstance(state, dict) and state.get('action') == 'request_chat':
                    request_id = state.get('request_id')
                    
                    # Обработка команд в чате заявки
                    if text == "✏️ Написать сообщение":
                        vk.messages.send(
                            user_id=vk_id,
                            message="✏️ Напишите ваше сообщение:",
                            random_id=0
                        )
                        continue
                    
                    elif text == "🔄 Обновить":
                        if request_id:
                            request = get_user_request_by_id(request_id, db_user['id'])
                            if request:
                                messages = get_request_messages(request_id)
                                chat_text = f"📋 Заявка #{request_id}\n"
                                chat_text += f"📝 {request['subject']}\n"
                                chat_text += f"📊 Статус: {get_status_label(request['status'])}\n"
                                chat_text += "━" * 30 + "\n\n"
                                
                                if messages:
                                    for msg in messages[-10:]:
                                        sender = msg['first_name'] or 'Пользователь'
                                        chat_text += f"{sender}: {msg['message']}\n"
                                else:
                                    chat_text += "💬 Сообщений пока нет\n"
                                
                                vk.messages.send(
                                    user_id=vk_id,
                                    message=chat_text,
                                    random_id=0,
                                    keyboard=create_request_chat_keyboard(request_id)
                                )
                                continue
                    
                    # Если это текст сообщения (не команда)
                    elif request_id and text not in ["✏️ Написать сообщение", "🔄 Обновить", "⬅ Назад к заявкам"]:
                        # Добавляем сообщение
                        add_request_message(request_id, db_user['id'], text)
                        
                        # Показываем обновленный чат
                        request = get_user_request_by_id(request_id, db_user['id'])
                        if request:
                            messages = get_request_messages(request_id)
                            chat_text = f"📋 Заявка #{request_id}\n"
                            chat_text += f"📝 {request['subject']}\n"
                            chat_text += f"📊 Статус: {get_status_label(request['status'])}\n"
                            chat_text += "━" * 30 + "\n\n"
                            
                            if messages:
                                for msg in messages[-10:]:
                                    sender = msg['first_name'] or 'Пользователь'
                                    chat_text += f"{sender}: {msg['message']}\n"
                            else:
                                chat_text += "💬 Сообщений пока нет\n"
                            
                            vk.messages.send(
                                user_id=vk_id,
                                message=chat_text,
                                random_id=0,
                                keyboard=create_request_chat_keyboard(request_id)
                            )
                            continue

                # --- Создание заявки ---
                if isinstance(state, dict) and state.get('action') == 'create_request':
                    step = state.get('step')

                    if step == 'subject':
                        state['subject'] = text
                        state['step'] = 'description'
                        vk.messages.send(
                            user_id=vk_id,
                            message="📝 Теперь опишите проблему подробно:",
                            random_id=0
                        )
                        continue

                    elif step == 'description':
                        category = state.get('category', 'other')
                        subject = state.get('subject', text[:50])
                        description = text

                        request_id = create_request(db_user['id'], category, subject, description)
                        del user_states[vk_id]

                        vk.messages.send(
                            user_id=vk_id,
                            message=f"✅ Ваша заявка #{request_id} создана!\n"
                                    f"📋 Категория: {get_category_label(category)}\n"
                                    f"📝 Суть: {subject}\n\n"
                                    f"Администратор рассмотрит её в ближайшее время.",
                            random_id=0,
                            keyboard=create_main_keyboard(active_group, site_url)
                        )
                        continue

                # --- Отправка отчета по заданию ---
                elif isinstance(state, dict) and 'id' in state:
                    task = state
                    
                    saved_files = []
                    attachment_text = ""

                    if attachments:
                        try:
                            saved_files, attachment_text = process_vk_attachments(attachments, vk_session)
                            if attachment_text:
                                text = f"{text}\n\n📎 Прикрепленные файлы:\n{attachment_text}" if text else f"📎 Прикрепленные файлы:\n{attachment_text}"
                            if saved_files:
                                logger.info(f"Сохранено файлов: {len(saved_files)}")
                                for f in saved_files:
                                    logger.info(f"  Файл: {f['original_name']} -> {f['file_url']}")
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

                    del user_states[vk_id]

                    response_msg = "✅ Ваш отчет принят на рассмотрение администратором!\nСтатус задания изменится после проверки."
                    if has_attachments:
                        response_msg += f"\n📎 Прикреплено файлов: {len(saved_files)}"

                    vk.messages.send(
                        user_id=vk_id,
                        message=response_msg,
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )
                    continue

            # --- Обработка команд ---
            if text in ["📋 Задания", "/start", "Начать", "Старт"]:
                if not active_group:
                    vk.messages.send(
                        user_id=vk_id,
                        message="📢 В данный момент нет активных заданий.\nСледите за обновлениями!",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )
                else:
                    tasks = get_tasks_for_group(active_group['id'])
                    welcome = settings.get('welcome_text', 'Привет! Выполняй задания и получай билеты! 🎫')
                    welcome += f"\n\n⏰ Задания действуют до: {active_group['end_date']}"
                    welcome += f"\n📎 Для подтверждения прикрепляйте фото, файлы или ссылки!"

                    vk.messages.send(
                        user_id=vk_id,
                        message=welcome,
                        random_id=0,
                        keyboard=build_tasks_keyboard(tasks, db_user['id'])
                    )

            elif text == "👤 Мой профиль":
                tickets = get_user_tickets(db_user['id'])
                msg = f"👤 Ваш профиль:\n"
                msg += f"⭐ Рейтинг: {db_user['rating']} баллов\n"
                msg += f"📊 Выполнено заданий: {db_user['completed_tasks']}\n"
                msg += f"🎟 Выдано билетов: {len(tickets)} шт.\n\n"

                if tickets:
                    msg += "🎫 Ваши лотерейные билеты:\n"
                    for t in tickets:
                        msg += f"• `{t['ticket_number']}` ({t['group_title']})\n"
                    draw_time = settings.get('draw_time', '18:00')
                    msg += f"\n⏰ Ожидайте розыгрыша в {draw_time}!"
                else:
                    msg += "🎯 Выполните все задания активной волны, чтобы получить лотерейный билет!"

                if site_url:
                    msg += f"\n\n🌐 {site_url}"

                vk.messages.send(
                    user_id=vk_id,
                    message=msg,
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )

            elif text == "📋 Заявки":
                requests = get_user_requests(db_user['id'])
                if not requests:
                    msg_text = "📋 У вас пока нет заявок.\n\n➕ Создайте новую заявку с помощью кнопки ниже."
                    vk.messages.send(
                        user_id=vk_id,
                        message=msg_text,
                        random_id=0,
                        keyboard=create_requests_keyboard([])
                    )
                else:
                    vk.messages.send(
                        user_id=vk_id,
                        message="📋 Ваши заявки (нажмите на заявку для просмотра):",
                        random_id=0,
                        keyboard=create_requests_keyboard(requests)
                    )

            elif text == "➕ Создать заявку":
                user_states[vk_id] = {'action': 'create_request', 'step': 'category'}
                vk.messages.send(
                    user_id=vk_id,
                    message="📋 Выберите категорию проблемы:",
                    random_id=0,
                    keyboard=create_category_keyboard()
                )

            elif text in ["🌐 Сайт", "🤖 Бот ВК", "🏠 Жильё"]:
                if vk_id in user_states and isinstance(user_states[vk_id], dict) and user_states[vk_id].get('action') == 'create_request':
                    category_map = {"🌐 Сайт": "site", "🤖 Бот ВК": "bot", "🏠 Жильё": "housing"}
                    user_states[vk_id]['category'] = category_map[text]
                    user_states[vk_id]['step'] = 'subject'
                    vk.messages.send(
                        user_id=vk_id,
                        message="📝 Опишите суть проблемы кратко (одной строкой):",
                        random_id=0
                    )
                else:
                    vk.messages.send(
                        user_id=vk_id,
                        message="🤖 Воспользуйтесь кнопками меню:",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )

            elif text == "🌐 Личный кабинет" and site_url:
                vk.messages.send(
                    user_id=vk_id,
                    message=f"🌐 Перейдите в личный кабинет по ссылке:\n{site_url}",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )

            elif text == "⬅ Назад":
                vk.messages.send(
                    user_id=vk_id,
                    message="🔙 Главное меню:",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )

            else:
                # --- Обработка нажатия на заявку ---
                # Проверяем, не является ли текст кнопкой заявки
                request_id = None
                match = re.search(r'#(\d+)', text)
                if match:
                    request_id = int(match.group(1))
                
                if request_id:
                    request = get_user_request_by_id(request_id, db_user['id'])
                    if request:
                        messages = get_request_messages(request_id)
                        chat_text = f"📋 Заявка #{request_id}\n"
                        chat_text += f"📝 {request['subject']}\n"
                        chat_text += f"📊 Статус: {get_status_label(request['status'])}\n"
                        chat_text += "━" * 30 + "\n\n"
                        
                        if messages:
                            for msg in messages[-10:]:
                                sender = msg['first_name'] or 'Пользователь'
                                chat_text += f"{sender}: {msg['message']}\n"
                        else:
                            chat_text += "💬 Сообщений пока нет\n"
                        
                        # Сохраняем состояние
                        user_states[vk_id] = {'action': 'request_chat', 'request_id': request_id}
                        
                        vk.messages.send(
                            user_id=vk_id,
                            message=chat_text,
                            random_id=0,
                            keyboard=create_request_chat_keyboard(request_id)
                        )
                        continue

                # --- Обработка нажатия на кнопку задания ---
                if active_group:
                    tasks = get_tasks_for_group(active_group['id'])
                    matched_task = get_task_from_button(text, tasks)

                    if matched_task:
                        report = get_user_task_report(db_user['id'], matched_task['id'])
                        status_str = ""

                        if report:
                            if report['status'] == 'approved':
                                status_str = f"\n\n✅ Статус: Выполнено (+{matched_task['points']} баллов)"
                            elif report['status'] == 'pending':
                                status_str = "\n\n⏳ Статус: На рассмотрении у администратора"
                            elif report['status'] == 'rejected':
                                status_str = f"\n\n❌ Статус: Отклонено ({report['reject_reason'] or 'Не выполнено учение'})\nПришлите подтверждение повторно!"

                        msg = (
                            f"📌 {matched_task['title']}\n\n"
                            f"{matched_task['description']}{status_str}\n\n"
                            f"📝 Пришлите ссылку или текст с подтверждением выполнения задания.\n"
                            f"📎 Вы также можете прикрепить фото, видео или документы."
                        )

                        user_states[vk_id] = matched_task

                        vk.messages.send(
                            user_id=vk_id,
                            message=msg,
                            random_id=0
                        )
                    else:
                        vk.messages.send(
                            user_id=vk_id,
                            message="🤖 Воспользуйтесь кнопками меню ниже:",
                            random_id=0,
                            keyboard=create_main_keyboard(active_group, site_url)
                        )
                else:
                    vk.messages.send(
                        user_id=vk_id,
                        message="📢 Сейчас нет активных заданий. Загляните позже!",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )


if __name__ == '__main__':
    main()