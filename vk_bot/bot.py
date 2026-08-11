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
    get_user_by_vk_id
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

user_states = {}
UPLOAD_DIR = 'uploads/vk_bot/'


def send_notification_worker(vk, settings):
    """Фоновый поток для отправки уведомлений"""
    while True:
        try:
            notifications = get_pending_notifications(limit=10)
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
                except Exception as e:
                    logger.error(f"Ошибка отправки уведомления: {e}")
        except Exception as e:
            logger.error(f"Ошибка в потоке уведомлений: {e}")
        time.sleep(5)


def create_main_keyboard(active_group, site_url=''):
    """Создает главную клавиатуру"""
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("📋 Задания", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("👤 Мой профиль", color=VkKeyboardColor.SECONDARY)

    if site_url:
        keyboard.add_line()
        keyboard.add_button("🌐 Личный кабинет", color=VkKeyboardColor.POSITIVE)

    return keyboard.get_keyboard()


def build_tasks_keyboard(tasks, user_id):
    """Создает клавиатуру с заданиями"""
    keyboard = VkKeyboard(one_time=False)

    diff_labels = {'easy': '🔵 Простое', 'medium': '🟡 Среднее', 'hard': '🔴 Сложное'}
    counts = {'easy': 1, 'medium': 1, 'hard': 1}

    for idx, t in enumerate(tasks):
        report = get_user_task_report(user_id, t['id'])
        diff_str = diff_labels.get(t['difficulty'], 'Задание')
        c_num = counts[t['difficulty']]
        counts[t['difficulty']] += 1

        label = f"{diff_str} {c_num}"
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
        if idx % 2 == 1 and idx < len(tasks) - 1:
            keyboard.add_line()

    keyboard.add_line()
    keyboard.add_button("⬅ Назад", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()


def get_task_from_button(text, tasks):
    """Определяет задание по тексту кнопки"""
    diff_labels = {'easy': 'Простое', 'medium': 'Среднее', 'hard': 'Сложное'}
    counts = {'easy': 1, 'medium': 1, 'hard': 1}

    clean_text = re.sub(r'[✅⏳❌🔵🟡🔴\s]', '', text).strip()

    for t in tasks:
        c_num = counts[t['difficulty']]
        counts[t['difficulty']] += 1
        label_base = f"{diff_labels.get(t['difficulty'], 'Задание')}{c_num}"
        if label_base in clean_text:
            return t
    return None


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

    notification_thread = threading.Thread(
        target=send_notification_worker,
        args=(vk, settings),
        daemon=True
    )
    notification_thread.start()

    logger.info("✅ Бот успешно подключен к ВКонтакте и ожидает сообщений!")

    for event in longpoll.listen():
        if event.type == VkEventType.MESSAGE_NEW and event.to_me:
            vk_id = event.user_id
            text = event.text.strip()

            # Проверяем наличие вложений
            attachments = []
            if event.attachments:
                attachments = event.attachments
                logger.info(f"=== ВЛОЖЕНИЯ ПОЛУЧЕНЫ ===")
                logger.info(f"Тип attachments: {type(attachments)}")
                if isinstance(attachments, dict):
                    logger.info(f"Ключи: {list(attachments.keys())}")
                    for key, value in attachments.items():
                        if key.startswith('attach') and not key.endswith('_type'):
                            attach_type_key = f"{key}_type"
                            attach_type = attachments.get(attach_type_key, 'unknown')
                            logger.info(f"  {key}: тип={attach_type}, значение={value}")
                            if isinstance(value, dict):
                                logger.info(f"    Ключи value: {value.keys()}")
                elif isinstance(attachments, list):
                    logger.info(f"Количество вложений: {len(attachments)}")
                    for i, attach in enumerate(attachments):
                        logger.info(f"Вложение {i}: {attach}")
                        if isinstance(attach, dict):
                            logger.info(f"  Ключи: {attach.keys()}")
                            if 'type' in attach:
                                logger.info(f"  Тип: {attach['type']}")
                                attach_data = attach.get(attach['type'], {})
                                logger.info(f"  Данные: {attach_data}")

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

            # --- Обработка ввода отчета ---
            if vk_id in user_states:
                task = user_states[vk_id]

                if text == "⬅ Назад":
                    del user_states[vk_id]
                    vk.messages.send(
                        user_id=vk_id,
                        message="🔙 Действие отменено.",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, site_url)
                    )
                    continue

                # Обрабатываем вложения - получаем ссылки на файлы
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

                # Создаем отчет
                has_attachments = len(saved_files) > 0
                report_id = create_report(db_user['id'], task['id'], text, has_attachments)

                # Сохраняем ссылки на файлы в базу
                for file_info in saved_files:
                    save_report_media(
                        report_id,
                        file_info['file_url'],  # Сохраняем ссылку VK
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