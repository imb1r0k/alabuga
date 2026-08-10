import time
import vk_api
from vk_api.longpoll import VkLongPoll, VkEventType
from vk_api.keyboard import VkKeyboard, VkKeyboardColor

from database import (
    get_bot_settings,
    get_or_create_user,
    get_active_task_group,
    get_tasks_for_group,
    get_user_task_report,
    create_report,
    get_user_tickets
)

user_states = {}

def create_main_keyboard(active_group, user_id):
    keyboard = VkKeyboard(one_time=False)
    keyboard.add_button("📋 Список заданий", color=VkKeyboardColor.PRIMARY)
    keyboard.add_line()
    keyboard.add_button("👤 Мой профиль", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()

def build_tasks_keyboard(tasks, user_id):
    keyboard = VkKeyboard(one_time=False)
    
    diff_labels = {'easy': 'Простое', 'medium': 'Среднее', 'hard': 'Сложное'}
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
    keyboard.add_button("⬅ Назад в меню", color=VkKeyboardColor.SECONDARY)
    return keyboard.get_keyboard()

def main():
    print("Запуск бота ВКонтакте...")
    settings = get_bot_settings()
    token = settings.get('vk_token', '')

    if not token:
        print("ОШИБКА: Укажите VK Token на странице 'Бот ВК' в админ-панели сайта!")
        while not token:
            time.sleep(10)
            settings = get_bot_settings()
            token = settings.get('vk_token', '')

    vk_session = vk_api.VkApi(token=token)
    vk = vk_session.get_api()
    longpoll = VkLongPoll(vk_session)

    print("Бот успешно подключен к ВКонтакте и ожидает сообщений!")

    for event in longpoll.listen():
        if event.type == VkEventType.MESSAGE_NEW and event.to_me:
            vk_id = event.user_id
            text = event.text.strip()

            # Информация о пользователе ВК
            try:
                user_info = vk.users.get(user_ids=vk_id)[0]
                db_user = get_or_create_user(vk_id, user_info.get('first_name', ''), user_info.get('last_name', ''))
            except Exception as e:
                print(f"Ошибка получения пользователя: {e}")
                db_user = get_or_create_user(vk_id)

            settings = get_bot_settings()
            active_group = get_active_task_group()

            # Если пользователь находится в процессе отправки отчета по заданию
            if vk_id in user_states:
                task = user_states[vk_id]
                if text == "⬅ Назад в меню" or text == "Назад":
                    del user_states[vk_id]
                    vk.messages.send(
                        user_id=vk_id,
                        message="Действие отменено.",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, db_user['id'])
                    )
                    continue

                create_report(db_user['id'], task['id'], text)
                del user_states[vk_id]

                vk.messages.send(
                    user_id=vk_id,
                    message="Ваш отчет принят на рассмотрение администратором! Статус задания изменился на '⏳ На рассмотрении'.",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, db_user['id'])
                )
                continue

            # Команды меню
            if text == "📋 Список заданий" or text == "/start" or text == "Начать":
                if not active_group:
                    vk.messages.send(
                        user_id=vk_id,
                        message="В данный момент нет активных заданий. Следите за обновлениями!",
                        random_id=0,
                        keyboard=create_main_keyboard(active_group, db_user['id'])
                    )
                else:
                    tasks = get_tasks_for_group(active_group['id'])
                    welcome = settings.get('welcome_text', 'Привет! Выполняй задания и получай билеты!')
                    welcome += f"\n\n⏰ Задания действуют до: {active_group['end_date']}"

                    vk.messages.send(
                        user_id=vk_id,
                        message=welcome,
                        random_id=0,
                        keyboard=build_tasks_keyboard(tasks, db_user['id'])
                    )

            elif text == "👤 Мой профиль":
                tickets = get_user_tickets(db_user['id'])
                msg = f"👤 Ваш профиль:\n"
                msg += f"⭐ Рейтинг: {db_user['points']} баллов\n"
                msg += f"🎟 Выдано билетов: {len(tickets)} шт.\n\n"

                if tickets:
                    msg += "Ваши лотерейные билеты:\n"
                    for t in tickets:
                        msg += f"• {t['ticket_number']} ({t['group_title']})\n"
                    draw_time = settings.get('draw_time', '18:00')
                    msg += f"\nОжидайте розыгрыша в {draw_time} на установочной сессии!"
                else:
                    msg += "Выполните все задания активной волны, чтобы получить лотерейный билет!"

                vk.messages.send(
                    user_id=vk_id,
                    message=msg,
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, db_user['id'])
                )

            elif text == "⬅ Назад в меню":
                vk.messages.send(
                    user_id=vk_id,
                    message="Главное меню:",
                    random_id=0,
                    keyboard=create_main_keyboard(active_group, db_user['id'])
                )

            else:
                # Проверка нажатия на кнопку конкретного задания
                if active_group:
                    tasks = get_tasks_for_group(active_group['id'])
                    matched_task = None

                    diff_labels = {'easy': 'Простое', 'medium': 'Среднее', 'hard': 'Сложное'}
                    counts = {'easy': 1, 'medium': 1, 'hard': 1}

                    for t in tasks:
                        c_num = counts[t['difficulty']]
                        counts[t['difficulty']] += 1
                        label_base = f"{diff_labels.get(t['difficulty'], 'Задание')} {c_num}"

                        if label_base in text:
                            matched_task = t
                            break

                    if matched_task:
                        report = get_user_task_report(db_user['id'], matched_task['id'])
                        status_str = ""
                        if report:
                            if report['status'] == 'approved':
                                status_str = "\n\n Статус: Выполнено (+ " + str(matched_task['points']) + " б.)"
                            elif report['status'] == 'pending':
                                status_str = "\n\n⏳ Статус: На рассмотрении у администратора"
                            elif report['status'] == 'rejected':
                                status_str = "\n\n❌ Статус: Отклонено (" + (report['reject_reason'] or 'Не выполнено учение') + "). Вы можете прислать подтверждение повторно!"

                        msg = f"📌 {matched_task['title']}\n\n{matched_task['description']}{status_str}\n\nПришлите в ответном сообщении ссылку или подтверждающий текст выполнения задания."
                        user_states[vk_id] = matched_task

                        vk.messages.send(
                            user_id=vk_id,
                            message=msg,
                            random_id=0
                        )
                    else:
                        vk.messages.send(
                            user_id=vk_id,
                            message="Воспользуйтесь кнопками меню ниже:",
                            random_id=0,
                            keyboard=create_main_keyboard(active_group, db_user['id'])
                        )

if __name__ == '__main__':
    main()