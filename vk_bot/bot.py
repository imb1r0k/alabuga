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
    get_request_messages,
    add_request_message,
    get_all_requests_for_admin,
    get_last_request_message,
    get_request_by_id,
    check_user_agreement,
    set_user_agreement,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

user_states = {}
UPLOAD_DIR = 'uploads/vk_bot/'
# Хранилище для уже отправленных уведомлений о сообщениях в заявках
sent_notifications = {}
# Множество для отслеживания пользователей, которым уже отправлены правила
agreement_sent = set()


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
    Задания выводятся с указанием уровня сложности.
    """
    keyboard = VkKeyboard(one_time=False)
    
    # Группируем задания по сложности
    easy_tasks = [t for t in tasks if t['difficulty'] == 'easy']
    medium_tasks = [t for t in tasks if t['difficulty'] == 'medium']
    hard_tasks = [t for t in tasks if t['difficulty'] == 'hard']
    
    # Функция для добавления заданий с префиксом сложности
    def add_task_buttons(task_list, prefix, emoji):
        for t in task_list:
            status = get_user_task_status(user_id, t['id'])
    
            # VK ограничение длины кнопки — 40 символов, обрезаем длинные заголовки
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
    
    # Добавляем задания с указанием сложности
    if easy_tasks:
        add_task_buttons(easy_tasks, "Легкое", "🟢")
    
    if medium_tasks:
        add_task_buttons(medium_tasks, "Среднее", "🟡")
    
    if hard_tasks:
        add_task_buttons(hard_tasks, "Сложное", "🔴")
    
    # Если заданий нет
    if not tasks:
        keyboard.add_button("📢 Нет заданий", color=VkKeyboardColor.SECONDARY)
        keyboard.add_line()
    
    keyboard.add_button("🔙 Назад в меню", color=VkKeyboardColor.SECONDARY)
    
    return keyboard.get_keyboard()


def create_agreement_keyboard():
    """Создает клавиатуру для согласия с правилами"""
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("✅ Подтверждаю", color=VkKeyboardColor.POSITIVE)
    return keyboard.get_keyboard()


def create_requests_keyboard(requests):
    """Создает клавиатуру со списком заявок"""
    keyboard = VkKeyboard(one_time=False)
    
    status_icons = {'open': '🟡', 'in_progress': '🔵', 'resolved': '✅', 'rejected': '❌'}
    cat_labels = {'site': '🌐', 'bot': '🤖', 'housing': '🏠'}
    
    for r in requests[:10]:
        icon = status_icons.get(r['status'], '🟡')
        cat = cat_labels.get(r['category'], '📌')
        label = f"{icon} Заявка #{r['id']}: {r['subject'][:25]}"
        keyboard.add_button(label, color=VkKeyboardColor.PRIMARY)
        keyboard.add_line()
    
    keyboard.add_button("➕ Создать заявку", color=VkKeyboardColor.POSITIVE)
    keyboard.add_line()
    keyboard.add_button("🔙 Назад в меню", color=VkKeyboardColor.SECONDARY)
    
    return keyboard.get_keyboard()


def create_request_chat_keyboard(request_id):
    """Создает клавиатуру для чата заявки"""
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("✏️ Написать сообщение", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("🔄 Обновить", color=VkKeyboardColor.SECONDARY)
    keyboard.add_line()
    keyboard.add_button("🔙 Назад к заявкам", color=VkKeyboardColor.SECONDARY)
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
    keyboard.add_button("🔙 Назад", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


def get_task_from_button(text, tasks):
    """Определяет задание по тексту кнопки"""
    # Убираем эмодзи статусов и сложности
    status_emoji = ['✅', '⏳', '❌']
    diff_emoji = ['🟢', '🟡', '🔴', '📌']
    prefixes = ['Легкое:', 'Среднее:', 'Сложное:']
    
    clean_text = text
    for emoji in status_emoji + diff_emoji:
        clean_text = clean_text.replace(emoji, '')
    
    # Убираем префиксы
    for prefix in prefixes:
        clean_text = clean_text.replace(prefix, '')
    
    clean_text = clean_text.strip()
    
    # Ищем задание по названию
    for t in tasks:
        full_title = t['title'].strip()
        if full_title == clean_text:
            return t
        # Частичное совпадение
        if clean_text in full_title or full_title in clean_text:
            return t
        # Кнопка могла быть обрезана VK (лимит 40 символов) — сопоставляем по началу
        clean_part = clean_text.rstrip('…').rstrip()
        if clean_part and full_title.startswith(clean_part):
            return t
    
    # Если не нашли по точному названию, пробуем найти по ID
    match = re.search(r'#(\d+)', text)
    if match:
        task_id = int(match.group(1))
        for t in tasks:
            if t['id'] == task_id:
                return t
    
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


def format_request_message(request, messages):
    """Форматирует сообщение с заявкой для красивого отображения"""
    status_emoji = {
        'open': '🟡',
        'in_progress': '🔵',
        'resolved': '✅',
        'rejected': '❌'
    }
    status_text = {
        'open': 'Открыта',
        'in_progress': 'В работе',
        'resolved': 'Решена',
        'rejected': 'Отклонена'
    }
    
    msg = f"📋 Заявка #{request['id']}\n"
    msg += f"📝 {request['subject']}\n"
    msg += f"📊 Статус: {status_emoji.get(request['status'], '🟡')} {status_text.get(request['status'], request['status'])}\n"
    msg += f"📅 Создана: {request['created_at'].strftime('%d.%m.%Y %H:%M') if request.get('created_at') else 'недавно'}\n\n"
    
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
    """Форматирует сообщение с заданием для красивого отображения"""
    diff_emoji = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}
    diff_text = {'easy': 'Легкое', 'medium': 'Среднее', 'hard': 'Сложное'}
    
    msg = f"📌 {task['title']}\n\n"
    msg += f"📝 {task['description']}\n\n"
    msg += f"⭐ Сложность: {diff_emoji.get(task['difficulty'], '📌')} {diff_text.get(task['difficulty'], task['difficulty'])}\n"
    msg += f"🎯 Баллы: {task['points']}\n\n"
    
    if task_status == 'approved':
        msg += "✅ Статус: Выполнено! Баллы зачислены.\n"
    elif report:
        if report['status'] == 'approved':
            msg += "✅ Статус: Выполнено! Баллы зачислены.\n"
        elif report['status'] == 'pending':
            msg += "⏳ Статус: На рассмотрении администратора.\nПожалуйста, ожидайте проверки.\n"
        elif report['status'] == 'rejected':
            reason = report.get('reject_reason', 'Не выполнено')
            msg += f"❌ Статус: Отклонено\nПричина: {reason}\n\n"
            msg += "📝 Отправьте отчет повторно с исправлениями."
    
    msg += "\n📎 Для подтверждения выполнения прикрепите фото, видео или документы."
    msg += "\n💬 Также можно просто написать текст с ссылкой."
    
    return msg


def send_agreement_rules(vk, user_id):
    """Отправляет правила и просит подтвердить согласие (только текст)"""
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
    logger.info(f"Правила отправлены пользователю {user_id}")


def main():
    global agreement_sent
    
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

    # Базовая инициализация переменных (обновляются внутри цикла ниже)
    settings = {}
    site_url = ''
    active_group = None

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
                logger.info(f"Пользователь найден/создан: ID={db_user['id']}, VK_ID={vk_id}")

                # Проверяем, согласился ли пользователь с правилами (по наличию даты)
                if not check_user_agreement(db_user['id']):
                    logger.info(f"Пользователь {vk_id} еще не согласился с правилами")

                    # Если пользователь нажал кнопку подтверждения — записываем согласие
                    if text == "✅ Подтверждаю":
                        logger.info(f"Пользователь {vk_id} нажал кнопку подтверждения")
                        success = set_user_agreement(db_user['id'])
                        logger.info(f"Сохранение согласия: {'успешно' if success else 'ОШИБКА'}")
                        if vk_id in agreement_sent:
                            agreement_sent.remove(vk_id)
                        vk.messages.send(
                            user_id=vk_id,
                            message="✅ Спасибо! Вы подтвердили согласие с правилами пребывания на Форуме.\n\nТеперь вам доступны все функции бота.",
                            random_id=0,
                            keyboard=create_main_keyboard(active_group, site_url)
                        )
                        logger.info(f"Главное меню отправлено пользователю {vk_id}")
                        continue

                    # Если пользователь только что создан, отправляем логин/пароль
                    if db_user.get('generated_password'):
                        login_msg = (
                            f"👋 Привет, {first_name}!\n\n"
                            f"Для тебя создан аккаунт на сайте:\n"
                            f"🔑 Логин: {db_user['login']}\n"
                            f"🔐 Пароль: {db_user['generated_password']}\n\n"
                            f"🌐 Перейти на сайт: {site_url}\n\n"
                            f"⚠️ Рекомендуем изменить пароль после первого входа!"
                        )
                        vk.messages.send(
                            user_id=vk_id,
                            message=login_msg,
                            random_id=0
                        )
                        logger.info(f"Создан новый пользователь: {first_name} {last_name}, логин: {db_user['login']}")
                    
                    # Отправляем правила только если не отправляли ранее
                    if vk_id not in agreement_sent:
                        logger.info(f"Отправка правил пользователю {vk_id}")
                        send_agreement_rules(vk, vk_id)
                        agreement_sent.add(vk_id)
                    else:
                        logger.info(f"Правила уже отправлены пользователю {vk_id}, ожидаем подтверждения")
                    
                    # Пропускаем дальнейшую обработку
                    continue

                # Если пользователь согласился, удаляем из множества отправленных
                if vk_id in agreement_sent:
                    agreement_sent.remove(vk_id)
                    logger.info(f"Пользователь {vk_id} удален из множества ожидающих")

                # Если пользователь согласился, но у него был generated_password - отправляем логин/пароль
                if db_user.get('generated_password'):
                    login_msg = (
                        f"👋 Привет, {first_name}!\n\n"
                        f"Для тебя создан аккаунт на сайте:\n"
                        f"🔑 Логин: {db_user['login']}\n"
                        f"🔐 Пароль: {db_user['generated_password']}\n\n"
                        f"🌐 Перейти на сайт: {site_url}\n\n"
                        f"⚠️ Рекомендуем изменить пароль после первого входа!"
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
                if text in ["🔙 Назад в меню", "🔙 Назад", "🔙 Назад к заявкам"]:
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
                                chat_text = format_request_message(request, messages)
                                
                                vk.messages.send(
                                    user_id=vk_id,
                                    message=chat_text,
                                    random_id=0,
                                    keyboard=create_request_chat_keyboard(request_id)
                                )
                                continue
                    
                    # Если это текст сообщения (не команда)
                    elif request_id and text not in ["✏️ Написать сообщение", "🔄 Обновить", "🔙 Назад к заявкам"]:
                        # Добавляем сообщение
                        add_request_message(request_id, db_user['id'], text)
                        
                        # Показываем обновленный чат
                        request = get_user_request_by_id(request_id, db_user['id'])
                        if request:
                            messages = get_request_messages(request_id)
                            chat_text = format_request_message(request, messages)
                            
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
                            message=f"✅ Ваша заявка #{request_id} успешно создана!\n"
                                    f"📋 Категория: {get_category_label(category)}\n"
                                    f"📝 Тема: {subject}\n\n"
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

                    response_msg = "✅ Ваш отчет принят на рассмотрение!\n"
                    response_msg += "Статус задания обновится после проверки администратором."
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
                        message="📢 В данный момент нет активных заданий.\n\nСледите за обновлениями!",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )
                else:
                    tasks = get_tasks_for_group(active_group['id'])
                    welcome = settings.get('welcome_text', 'Привет! Выполняй задания и получай билеты! 🎫')
                    welcome += f"\n\n⏰ Задания действуют до: {active_group['end_date']}"
                    welcome += "\n📎 Для подтверждения прикрепляйте фото, файлы или ссылки!"

                    vk.messages.send(
                        user_id=vk_id,
                        message=welcome,
                        random_id=0,
                        keyboard=build_tasks_keyboard(tasks, db_user['id'])
                    )

            elif text == "👤 Мой профиль":
                tickets = get_user_tickets(db_user['id'])
                msg = f"👤 Ваш профиль\n\n"
                msg += f"⭐ Рейтинг: {db_user['rating']} баллов\n"
                msg += f"📊 Выполнено заданий: {db_user['completed_tasks']}\n"
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
                        message="📋 Ваши заявки\n\nНажмите на заявку для просмотра и общения:",
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

            elif text in ["🔙 Назад в меню", "🔙 Назад"]:
                vk.messages.send(
                    user_id=vk_id,
                    message="🔙 Главное меню:",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, site_url)
                )

            else:
                # --- Обработка нажатия на заявку ---
                if 'Заявка #' in text or '#' in text:
                    match = re.search(r'#(\d+)', text)
                    if match:
                        request_id = int(match.group(1))
                        request = get_user_request_by_id(request_id, db_user['id'])
                        if request:
                            messages = get_request_messages(request_id)
                            chat_text = format_request_message(request, messages)
                            
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
                        task_status = get_user_task_status(db_user['id'], matched_task['id'])
                        msg = format_task_message(matched_task, report, task_status)

                        user_states[vk_id] = matched_task

                        vk.messages.send(
                            user_id=vk_id,
                            message=msg,
                            random_id=0
                        )
                        continue
                    else:
                        vk.messages.send(
                            user_id=vk_id,
                            message="🤖 Воспользуйтесь кнопками меню:",
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