import vk_api
from vk_api.bot_longpoll import VkBotLongPoll, VkBotEventType
from vk_api.utils import get_random_id
import database as db
import logging
import json
import time
import sys
import urllib.parse as urlparse
import os
import re
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Максимум попыток отправки
MAX_RETRIES = 3

def send_message(vk, peer_id, message, keyboard=None, attachment=None):
    """Отправляет сообщение с retry"""
    for attempt in range(MAX_RETRIES):
        try:
            params = {
                'peer_id': peer_id,
                'message': message,
                'random_id': get_random_id()
            }
            if keyboard:
                params['keyboard'] = json.dumps(keyboard, ensure_ascii=False)
            if attachment:
                params['attachment'] = attachment
            vk.messages.send(**params)
            return True
        except vk_api.exceptions.ApiError as e:
            logger.warning(f"Ошибка VK API (попытка {attempt+1}): {e}")
            if attempt == MAX_RETRIES - 1:
                logger.error(f"Не удалось отправить сообщение: {e}")
                return False
            time.sleep(1)
        except Exception as e:
            logger.error(f"Неизвестная ошибка отправки: {e}")
            return False
    return False


def build_main_keyboard(settings):
    """Формирует главную клавиатуру"""
    buttons = [
        [
            {
                "action": {
                    "type": "text",
                    "label": "📋 Задания",
                    "payload": json.dumps({"cmd": "tasks"})
                },
                "color": "primary"
            },
            {
                "action": {
                    "type": "text",
                    "label": "🎟 Мои билеты",
                    "payload": json.dumps({"cmd": "tickets"})
                },
                "color": "secondary"
            }
        ],
        [
            {
                "action": {
                    "type": "text",
                    "label": "⭐ Мой рейтинг",
                    "payload": json.dumps({"cmd": "rating"})
                },
                "color": "secondary"
            },
            {
                "action": {
                    "type": "text",
                    "label": "📩 Заявка",
                    "payload": json.dumps({"cmd": "request"})
                },
                "color": "secondary"
            }
        ],
        [
            {
                "action": {
                    "type": "text",
                    "label": "👤 Личный кабинет",
                    "payload": json.dumps({"cmd": "profile"})
                },
                "color": "secondary"
            },
            {
                "action": {
                    "type": "text",
                    "label": "🔄 Помощь",
                    "payload": json.dumps({"cmd": "help"})
                },
                "color": "secondary"
            }
        ]
    ]
    return {
        "inline": False,
        "buttons": buttons
    }


def handle_agreement(vk, vk_id, settings):
    """Обрабатывает согласие пользователя"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id,
            "❌ Вы не зарегистрированы. Напишите «Старт»", keyboard=build_main_keyboard(settings))
        return True
    
    agreed = db.check_user_agreement(user['id'])
    if agreed:
        return False  # Пользователь уже согласился
    
    send_message(vk, vk_id,
        "📋 *Правила участия в лотерее:*\n\n"
        "1. Выполняйте задания из раздела «Задания».\n"
        "2. Присылайте скриншоты/ссылки на подтверждение.\n"
        "3. После прохождения всех заданий волны вы получаете лотерейный билет.\n"
        "4. Розыгрыш ценных призов проводится ежедневно.\n"
        "5. За нарушения правил бот может заблокировать доступ.\n\n"
        "Напишите «Согласен» или нажмите кнопку ниже, чтобы принять правила.",
        keyboard={
            "inline": False,
            "buttons": [[
                {
                    "action": {
                        "type": "text",
                        "label": "✅ Принимаю правила",
                        "payload": json.dumps({"cmd": "agree"})
                    },
                    "color": "primary"
                }
            ]]
        }
    )
    return True


def handle_start(vk, vk_id, settings, first_name, last_name, vk_url):
    """Обрабатывает команду старт"""
    user = db.find_or_create_user(vk_id, first_name, last_name, vk_url)
    
    send_message(vk, vk_id,
        f"👋 Привет, {first_name}!\n\n{settings.get('welcome_text', 'Добро пожаловать!')}\n\n"
        f"🔑 Ваш логин: *{user['login']}*\n"
        f"🔑 Пароль: *{user.get('generated_password', 'установлен')}*\n\n"
        f"Эти данные нужны для входа на сайт: {settings.get('site_url', '')}",
        keyboard=build_main_keyboard(settings)
    )
    
    # Проверяем согласие
    if user.get('agreement_accepted_at') is None:
        try:
            db.set_user_agreement(user['id'])
        except Exception as e:
            logger.error(f"Не удалось установить согласие: {e}")


def handle_help(vk, vk_id, settings):
    """Отправляет справочную информацию"""
    send_message(vk, vk_id,
        "🤖 *Команды бота:*\n\n"
        "📋 *Задания* — посмотреть список доступных заданий\n"
        "🎟 *Мои билеты* — просмотр ваших лотерейных билетов\n"
        "⭐ *Мой рейтинг* — ваш текущий рейтинг и баллы\n"
        "📩 *Заявка* — создать обращение в поддержку\n"
        "👤 *Личный кабинет* — ссылка на сайт\n"
        "🔄 *Помощь* — это сообщение\n\n"
        "📌 *Как выполнять задания:*\n"
        "1. Выберите «Задания»\n"
        "2. Нажмите на номер задания\n"
        "3. Выполните инструкцию\n"
        "4. Пришлите подтверждение (ссылку или фото)\n\n"
        f"🌐 *Сайт:* {settings.get('site_url', '')}",
        keyboard=build_main_keyboard(settings)
    )


def handle_tasks(vk, vk_id, settings):
    """Показывает список заданий"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы. Напишите «Старт»")
        return
    
    active_groups = db.get_active_task_groups()
    
    if not active_groups:
        send_message(vk, vk_id,
            "📭 Сейчас нет активных заданий.\n"
            "Новые волны заданий появятся позже.\n"
            "Следите за обновлениями!",
            keyboard=build_main_keyboard(settings)
        )
        return
    
    # Показываем каждый активный пакет заданий
    hide_keyboard = False
    
    for group in active_groups:
        tasks = db.get_tasks_for_group(group['id'])
        
        if not tasks:
            continue
        
        # Собираем статусы заданий
        task_buttons = []
        for task in tasks:
            status = db.get_user_task_status(user['id'], task['id'])
            
            if status == 'approved':
                prefix = '✅'
            elif status == 'pending':
                prefix = '⏳'
            elif status == 'rejected':
                prefix = '🔄'
            else:
                prefix = '⬜'
            
            diff_icon = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}.get(task['difficulty'], '⚪')
            
            task_buttons.append([
                {
                    "action": {
                        "type": "text",
                        "label": f"{prefix} {diff_icon} {task['title'][:35]}",
                        "payload": json.dumps({"cmd": "task_detail", "uuid": task['uuid']})
                    },
                    "color": "primary" if status is None else "secondary"
                }
            ])
        
        # Считаем выполненные
        done_count = sum(1 for t in tasks if db.get_user_task_status(user['id'], t['id']) == 'approved')
        total_count = len(tasks)
        
        send_message(vk, vk_id,
            f"📋 *Волна: {group['title']}*\n"
            f"📅 {group['start_date']} — {group['end_date']}\n"
            f"✅ Выполнено: {done_count} из {total_count}\n"
            f"━━━━━━━━━━━━━━━━━",
            keyboard={
                "inline": False,
                "buttons": task_buttons + [[
                    {
                        "action": {
                            "type": "text",
                            "label": "⬅️ Назад",
                            "payload": json.dumps({"cmd": "menu"})
                        },
                        "color": "secondary"
                    }
                ]]
            }
        )


def handle_task_detail(vk, vk_id, settings, uuid):
    """Показывает детальное описание задания"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы")
        return
    
    task = db.get_task_by_uuid(uuid)
    if not task:
        send_message(vk, vk_id, "❌ Задание не найдено")
        return
    
    diff_icon = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}.get(task['difficulty'], '⚪')
    status = db.get_user_task_status(user['id'], task['id'])
    
    status_text = {
        None: '❓ Не выполнено',
        'pending': '⏳ На проверке',
        'approved': '✅ Выполнено',
        'rejected': '🔄 Отклонено'
    }.get(status, '❓ Не выполнено')
    
    report = db.get_user_task_report(user['id'], task['id'])
    reject_reason = ''
    if report and report['status'] == 'rejected' and report.get('reject_reason'):
        reject_reason = f"\n\n❌ *Причина отклонения:* {report['reject_reason']}\nОтправьте отчёт заново!"
    
    send_message(vk, vk_id,
        f"📋 *{diff_icon} {task['title']}*\n"
        f"━━━━━━━━━━━━━━━━━\n"
        f"{task['description']}\n\n"
        f"🎯 Сложность: {diff_icon} {task['difficulty']}\n"
        f"⭐ Баллы: +{task['points']}\n"
        f"📌 Статус: {status_text}{reject_reason}\n"
        f"━━━━━━━━━━━━━━━━━\n"
        f"📝 *Как отправить:*\n"
        f"Просто пришлите ссылку на выполнение или фото в ответ на это сообщение.\n\n"
        f"Или нажмите кнопку ниже для отправки отчёта.",
        keyboard={
            "inline": False,
            "buttons": [[
                {
                    "action": {
                        "type": "text",
                        "label": "📤 Отправить отчёт",
                        "payload": json.dumps({"cmd": "submit_report", "uuid": uuid})
                    },
                    "color": "primary"
                }
            ], [
                {
                    "action": {
                        "type": "text",
                        "label": "⬅️ Назад к заданиям",
                        "payload": json.dumps({"cmd": "tasks"})
                    },
                    "color": "secondary"
                }
            ]]
        }
    )


def handle_submit_report(vk, vk_id, settings, uuid):
    """Запрашивает у пользователя отчёт по заданию"""
    task = db.get_task_by_uuid(uuid)
    if not task:
        send_message(vk, vk_id, "❌ Задание не найдено")
        return
    
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы")
        return
    
    status = db.get_user_task_status(user['id'], task['id'])
    if status == 'approved':
        send_message(vk, vk_id, "✅ Вы уже выполнили это задание!")
        return
    if status == 'pending':
        send_message(vk, vk_id, "⏳ Ваш предыдущий отчёт ещё на проверке. Ожидайте.")
        return
    
    # Устанавливаем сессию ожидания отчёта
    waiting_for_report[vk_id] = {
        'uuid': uuid,
        'task_id': task['id'],
        'step': 'waiting_text'
    }
    
    send_message(vk, vk_id,
        f"📤 *Отправка отчёта для:* {task['title']}\n\n"
        f"Пришлите:\n"
        f"• Ссылку на выполненное действие\n"
        f"• Или фото/скриншот (можно с текстом)\n"
        f"• Или просто опишите, как выполнили задание\n\n"
        f"*Важно:* прикрепите подтверждение напрямую к сообщению!",
        keyboard={
            "inline": False,
            "buttons": [[
                {
                    "action": {
                        "type": "text",
                        "label": "⬅️ Отмена",
                        "payload": json.dumps({"cmd": "cancel_report"})
                    },
                    "color": "secondary"
                }
            ]]
        }
    )


def process_submission(vk, vk_id, settings, text, attachments):
    """Обрабатывает отправленный отчёт"""
    if vk_id not in waiting_for_report:
        return False
    
    session = waiting_for_report[vk_id]
    task_id = session.get('task_id')
    uuid = session.get('uuid')
    
    if not task_id:
        return False
    
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Пользователь не найден")
        return False
    
    task = db.get_task_by_uuid(uuid)
    if not task:
        logger.error(f"Задание {uuid} не найдено")
        del waiting_for_report[vk_id]
        return False
    
    # Обрабатываем текст и вложения
    submission_text = text.strip() if text else "Отчёт отправлен"
    
    has_attachments = False
    
    # Создаём отчёт в базе
    report_id = db.create_report(
        user_id=user['id'],
        task_id=task_id,
        submission_text=submission_text,
        has_attachments=attachments is not None
    )
    
    if not report_id:
        send_message(vk, vk_id, "❌ Ошибка при создании отчёта. Попробуйте позже.")
        del waiting_for_report[vk_id]
        return True
    
    # Обрабатываем вложения, если есть
    if attachments:
        saved_files, attachments_text = db.process_vk_attachments(attachments, None)
        
        if saved_files:
            db.update_report_has_attachments(report_id, len(saved_files))
            
            for file_info in saved_files:
                try:
                    db.save_report_media(
                        report_id=report_id,
                        file_url=file_info['file_url'],
                        file_type=file_info['file_type'],
                        original_name=file_info['original_name'],
                        file_size=file_info.get('file_size', 0)
                    )
                except Exception as e:
                    logger.error(f"Ошибка сохранения медиа: {e}")
            
            if attachments_text:
                db.update_report_text(report_id, submission_text + "\n\n" + attachments_text)
    
    # Очищаем сессию
    del waiting_for_report[vk_id]
    
    send_message(vk, vk_id,
        f"✅ *Отчёт отправлен на проверку!*\n\n"
        f"Задание: {task['title']}\n"
        f"Статус: ⏳ Ожидает проверки\n\n"
        f"Вы получите уведомление, когда администратор проверит отчёт.",
        keyboard=build_main_keyboard(settings)
    )
    
    return True


def handle_rating(vk, vk_id, settings):
    """Показывает рейтинг пользователя"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы. Напишите «Старт»")
        return
    
    send_message(vk, vk_id,
        f"⭐ *Ваш рейтинг:*\n\n"
        f"📊 *Баллы:* {user.get('rating', 0)}\n"
        f"✅ *Выполнено заданий:* {user.get('completed_tasks', 0)}\n"
        f"━━━━━━━━━━━━━━━━━\n\n"
        f"Выполняйте задания и зарабатывайте баллы для получения лотерейных билетов! 🎟️",
        keyboard=build_main_keyboard(settings)
    )


def handle_tickets(vk, vk_id, settings):
    """Показывает лотерейные билеты пользователя"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы")
        return
    
    tickets = db.get_user_tickets(user['id'])
    
    if not tickets:
        # Может быть задание выполнено, но билет ещё не выдан.
        # Проверяем, может ли пользователь получить билет
        active_groups = db.get_active_task_groups()
        if active_groups:
            for group in active_groups:
                tasks = db.get_tasks_for_group(group['id'])
                done_count = sum(1 for t in tasks if db.get_user_task_status(user['id'], t['id']) == 'approved')
                if done_count == len(tasks) and done_count > 0:
                    # Все задания выполнены, но билета нет - выдаём
                    import hashlib
                    ticket_num = 'TKT-' + hashlib.md5(f"{group['id']}{user['id']}".encode()).hexdigest()[:6].upper()
                    try:
                        conn = db.get_db_connection()
                        with conn.cursor() as cursor:
                            cursor.execute("""
                                INSERT INTO vk_bot_tickets (user_id, group_id, ticket_number) 
                                VALUES (%s, %s, %s)
                            """, (user['id'], group['id'], ticket_num))
                        conn.close()
                        tickets = db.get_user_tickets(user['id'])
                    except:
                        pass
        
        if not tickets:
            send_message(vk, vk_id,
                "🎟 *У вас пока нет лотерейных билетов.*\n\n"
                "Выполните все задания из активной волны, чтобы получить билет!\n"
                "→ В разделе «Задания»",
                keyboard=build_main_keyboard(settings)
            )
            return
    
    msg_lines = ["🎟 *Ваши лотерейные билеты:*\n━━━━━━━━━━━━━━━━━"]
    for ticket in tickets:
        msg_lines.append(f"🎫 *{ticket['ticket_number']}*\n📅 {ticket['created_at']}\n📌 {ticket['group_title']}\n━━━━━━━━━━━━━━━━━")
    
    msg_lines.append(f"\n🎲 Розыгрыш призов проводится ежедневно в {settings.get('draw_time', '18:00')}!")
    
    send_message(vk, vk_id, "\n".join(msg_lines), keyboard=build_main_keyboard(settings))


def handle_request(vk, vk_id, settings, text='', step='init'):
    """Обрабатывает создание заявки"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы")
        return
    
    if step == 'init':
        send_message(vk, vk_id,
            "📩 *Создание заявки*\n\n"
            "Выберите категорию:",
            keyboard={
                "inline": False,
                "buttons": [[
                    {
                        "action": {
                            "type": "text",
                            "label": "🌐 Сайт",
                            "payload": json.dumps({"cmd": "request_cat", "cat": "site"})
                        },
                        "color": "primary"
                    }
                ], [
                    {
                        "action": {
                            "type": "text",
                            "label": "🤖 Бот",
                            "payload": json.dumps({"cmd": "request_cat", "cat": "bot"})
                        },
                        "color": "primary"
                    }
                ], [
                    {
                        "action": {
                            "type": "text",
                            "label": "🏠 Жильё",
                            "payload": json.dumps({"cmd": "request_cat", "cat": "housing"})
                        },
                        "color": "primary"
                    }
                ], [
                    {
                        "action": {
                            "type": "text",
                            "label": "⬅️ Назад",
                            "payload": json.dumps({"cmd": "menu"})
                        },
                        "color": "secondary"
                    }
                ]]
            }
        )
    
    elif step == 'cat':
        waiting_for_request[vk_id] = {'step': 'subject', 'category': text}
        cat_names = {'site': '🌐 Сайт', 'bot': '🤖 Бот', 'housing': '🏠 Жильё'}
        send_message(vk, vk_id,
            f"📩 *Категория:* {cat_names.get(text, text)}\n\n"
            f"Напишите кратко тему вашей заявки:",
            keyboard={
                "inline": False,
                "buttons": [[
                    {
                        "action": {
                            "type": "text",
                            "label": "⬅️ Назад",
                            "payload": json.dumps({"cmd": "cancel_request"})
                        },
                        "color": "secondary"
                    }
                ]]
            }
        )
    
    elif step == 'subject':
        if vk_id in waiting_for_request:
            waiting_for_request[vk_id]['subject'] = text
            waiting_for_request[vk_id]['step'] = 'description'
            send_message(vk, vk_id,
                f"📩 *Тема:* {text}\n\n"
                f"Теперь подробно опишите вашу проблему или вопрос:",
                keyboard={
                    "inline": False,
                    "buttons": [[
                        {
                            "action": {
                                "type": "text",
                                "label": "⬅️ Назад",
                                "payload": json.dumps({"cmd": "cancel_request"})
                            },
                            "color": "secondary"
                        }
                    ]]
                }
            )
    
    elif step == 'description':
        if vk_id in waiting_for_request:
            data = waiting_for_request[vk_id]
            data['description'] = text
            data['step'] = 'confirm'
            
            cat_names = {'site': '🌐 Сайт', 'bot': '🤖 Бот', 'housing': '🏠 Жильё'}
            cat_name = cat_names.get(data.get('category', ''), data.get('category', ''))
            
            send_message(vk, vk_id,
                f"📩 *Подтверждение заявки:*\n\n"
                f"🔹 Категория: {cat_name}\n"
                f"🔹 Тема: {data['subject']}\n"
                f"🔹 Описание:\n{data['description']}\n\n"
                f"Всё верно?",
                keyboard={
                    "inline": False,
                    "buttons": [[
                        {
                            "action": {
                                "type": "text",
                                "label": "✅ Отправить",
                                "payload": json.dumps({"cmd": "confirm_request"})
                            },
                            "color": "primary"
                        }
                    ], [
                        {
                            "action": {
                                "type": "text",
                                "label": "🔄 Заполнить заново",
                                "payload": json.dumps({"cmd": "request"})
                            },
                            "color": "secondary"
                        }
                    ]]
                }
            )


def handle_request_list(vk, vk_id, settings):
    """Показывает список заявок пользователя"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        return
    
    requests = db.get_user_requests(user['id'])
    if requests:
        lines = ["📩 *Ваши заявки:*\n"]
        for req in requests:
            status_icon = {
                'open': '🟡',
                'in_progress': '🔵',
                'resolved': '✅',
                'rejected': '❌'
            }.get(req['status'], '⚪')
            lines.append(f"{status_icon} #{req['id']}: {req['subject']} — *{req['status']}*")
            lines.append(f"   📅 {req['created_at']}")
        send_message(vk, vk_id, "\n".join(lines))
    else:
        send_message(vk, vk_id, "📩 У вас пока нет заявок.")


def handle_profile(vk, vk_id, settings):
    """Отправляет ссылку на личный кабинет"""
    user = db.get_user_by_vk_id(vk_id)
    if not user:
        send_message(vk, vk_id, "❌ Вы не зарегистрированы")
        return
    
    site_url = settings.get('site_url', '')
    profile_url = f"{site_url}/public_profile/{user['login']}"
    
    send_message(vk, vk_id,
        f"👤 *Личный кабинет*\n\n"
        f"🔑 Логин: *{user['login']}*\n\n"
        f"🌐 *Ссылка на ваш профиль:*\n{profile_url}\n\n"
        f"💻 *Сайт:* {site_url}",
        keyboard={
            "inline": False,
            "buttons": [[
                {
                    "action": {
                        "type": "open_link",
                        "link": site_url,
                        "label": "🌐 Открыть сайт"
                    }
                }
            ], [
                {
                    "action": {
                        "type": "text",
                        "label": "⬅️ Назад",
                        "payload": json.dumps({"cmd": "menu"})
                    },
                    "color": "secondary"
                }
            ]]
        }
    )


def send_pending_notifications(vk):
    """Отправляет ожидающие уведомления пользователям"""
    try:
        notifications = db.get_pending_notifications(limit=20)
        for notif in notifications:
            if not notif.get('vk_id'):
                db.mark_notification_sent(notif['id'])
                continue
            
            try:
                send_message(vk, notif['vk_id'], notif['message'], keyboard=build_main_keyboard({}))
                db.mark_notification_sent(notif['id'])
                logger.info(f"Уведомление #{notif['id']} отправлено пользователю {notif['vk_id']}")
            except Exception as e:
                logger.error(f"Ошибка отправки уведомления #{notif['id']}: {e}")
    except Exception as e:
        logger.error(f"Ошибка отправки уведомлений: {e}")


# Глобальные словари для хранения сессий
waiting_for_report = {}
waiting_for_request = {}


def main():
    """Основная функция запуска бота"""
    logger.info("=== ЗАПУСК БОТА ВК ===")
    
    # Получаем настройки
    settings = db.get_bot_settings()
    token = settings.get('vk_token', '')
    group_id_str = settings.get('vk_group_id', '')
    
    if not token:
        logger.error("❌ Не указан VK Token в настройках")
        print("Ошибка: VK Token не указан. Заполните настройки в админ-панели.")
        sys.exit(1)
    
    if not group_id_str:
        logger.error("❌ Не указан Group ID в настройках")
        print("Ошибка: Group ID не указан. Заполните настройки в админ-панели.")
        sys.exit(1)
    
    try:
        group_id = int(group_id_str)
    except ValueError:
        logger.error(f"❌ Неверный формат Group ID: {group_id_str}")
        print("Ошибка: Group ID должен быть числом.")
        sys.exit(1)
    
    logger.info(f"✅ Настройки загружены. Group ID: {group_id}")
    
    try:
        vk_session = vk_api.VkApi(token=token)
        vk = vk_session.get_api()
        longpoll = VkBotLongPoll(vk_session, group_id=group_id)
        logger.info("✅ LongPoll подключён")
    except Exception as e:
        logger.error(f"❌ Ошибка подключения VK API: {e}")
        print(f"Ошибка: Не удалось подключиться к VK API: {e}")
        sys.exit(1)
    
    # Таймер для отправки уведомлений (каждые 10 секунд)
    last_notification_time = time.time()
    
    logger.info("🤖 Бот запущен и готов к работе!")
    print("✅ Бот ВК успешно запущен! Ожидаю сообщения...")
    
    try:
        for event in longpoll.listen():
            if event.type == VkBotEventType.MESSAGE_NEW and event.from_user:
                vk_id = event.user_id
                text = event.text.strip()
                payload = None
                attachments = None
                
                # Парсим payload
                try:
                    payload_raw = event.raw.get('payload')
                    if payload_raw and isinstance(payload_raw, str):
                        payload = json.loads(payload_raw)
                    elif payload_raw and isinstance(payload_raw, dict):
                        payload = payload_raw
                except:
                    payload = None
                
                # Получаем вложения
                attachments = event.raw.get('attachments')
                
                # Перезагружаем настройки каждые 100 сообщений
                if hasattr(main, 'settings_counter'):
                    main.settings_counter += 1
                else:
                    main.settings_counter = 0
                if main.settings_counter % 100 == 0:
                    settings = db.get_bot_settings()
                
                logger.info(f"💬 Сообщение от {vk_id}: {text[:50]}... payload={payload}")
                
                # Определяем пользователя
                user_info = None
                user = db.get_user_by_vk_id(vk_id)
                is_start = text.lower() in ['старт', 'start', '/start', 'начать', 'начало']
                
                # Получаем расширенную информацию о пользователе VK
                if user is None or is_start:
                    try:
                        vk_user_info = vk.users.get(
                            user_ids=vk_id,
                            fields='first_name,last_name,screen_name'
                        )
                        if vk_user_info:
                            user_info = vk_user_info[0]
                    except Exception as e:
                        logger.error(f"Ошибка получения информации о пользователе: {e}")
                
                # Команда Старт
                if is_start:
                    if user_info:
                        first_name = user_info.get('first_name', '')
                        last_name = user_info.get('last_name', '')
                        screen_name = user_info.get('screen_name', '')
                        vk_url = f"https://vk.com/{screen_name}" if screen_name else f"https://vk.com/id{vk_id}"
                        handle_start(vk, vk_id, settings, first_name, last_name, vk_url)
                    else:
                        send_message(vk, vk_id, "❌ Не удалось получить данные профиля. Попробуйте позже.")
                    continue
                
                # Проверяем, есть ли пользователь в базе
                if user is None:
                    send_message(vk, vk_id,
                        "❌ Вы не зарегистрированы.\n"
                        "Напишите «Старт», чтобы начать работу с ботом.",
                        keyboard={
                            "inline": False,
                            "buttons": [[
                                {
                                    "action": {
                                        "type": "text",
                                        "label": "🚀 Старт",
                                        "payload": json.dumps({"cmd": "start"})
                                    },
                                    "color": "primary"
                                }
                            ]]
                        }
                    )
                    continue
                
                # Проверяем согласие с правилами
                if not db.check_user_agreement(user['id']):
                    agreed = db.handle_agreement(vk, vk_id, settings)
                    if agreed:
                        continue
                
                # Обработка кнопок (payload)
                if payload and isinstance(payload, dict):
                    cmd = payload.get('cmd', '')
                    
                    if cmd == 'tasks':
                        handle_tasks(vk, vk_id, settings)
                    elif cmd == 'task_detail':
                        uuid = payload.get('uuid', '')
                        handle_task_detail(vk, vk_id, settings, uuid)
                    elif cmd == 'submit_report':
                        uuid = payload.get('uuid', '')
                        handle_submit_report(vk, vk_id, settings, uuid)
                    elif cmd == 'cancel_report':
                        if vk_id in waiting_for_report:
                            del waiting_for_report[vk_id]
                        send_message(vk, vk_id, "❌ Отправка отчёта отменена.",
                            keyboard=build_main_keyboard(settings))
                    elif cmd == 'rating':
                        handle_rating(vk, vk_id, settings)
                    elif cmd == 'tickets':
                        handle_tickets(vk, vk_id, settings)
                    elif cmd == 'request':
                        handle_request(vk, vk_id, settings, step='init')
                    elif cmd == 'request_cat':
                        cat = payload.get('cat', 'site')
                        handle_request(vk, vk_id, settings, text=cat, step='cat')
                    elif cmd == 'confirm_request':
                        if vk_id in waiting_for_request:
                            data = waiting_for_request[vk_id]
                            try:
                                request_id = db.create_request(
                                    user_id=user['id'],
                                    category=data.get('category', 'site'),
                                    subject=data.get('subject', 'Без темы'),
                                    description=data.get('description', 'Без описания')
                                )
                                db.add_request_message(request_id, user['id'],
                                    f"Заявка #{request_id} создана.\n"
                                    f"Категория: {data.get('category', '')}\n"
                                    f"Тема: {data.get('subject', '')}\n"
                                    f"Описание: {data.get('description', '')}")
                                
                                send_message(vk, vk_id,
                                    f"✅ *Заявка #{request_id} успешно создана!*\n\n"
                                    f"Скоро с вами свяжется администратор.\n"
                                    f"Статус заявки можно отследить в личном кабинете на сайте.",
                                    keyboard=build_main_keyboard(settings))
                            except Exception as e:
                                logger.error(f"Ошибка создания заявки: {e}")
                                send_message(vk, vk_id, "❌ Ошибка создания заявки. Попробуйте позже.",
                                    keyboard=build_main_keyboard(settings))
                            finally:
                                del waiting_for_request[vk_id]
                        else:
                            send_message(vk, vk_id, "❌ Сессия истекла. Начните заново.",
                                keyboard=build_main_keyboard(settings))
                    elif cmd == 'cancel_request':
                        if vk_id in waiting_for_request:
                            del waiting_for_request[vk_id]
                        send_message(vk, vk_id, "❌ Создание заявки отменено.",
                            keyboard=build_main_keyboard(settings))
                    elif cmd == 'profile':
                        handle_profile(vk, vk_id, settings)
                    elif cmd == 'help':
                        handle_help(vk, vk_id, settings)
                    elif cmd == 'menu':
                        send_message(vk, vk_id,
                            "🏠 *Главное меню*\n"
                            "Выберите раздел:",
                            keyboard=build_main_keyboard(settings))
                    elif cmd == 'start':
                        try:
                            vk_user_info = vk.users.get(user_ids=vk_id, fields='first_name,last_name,screen_name')
                            if vk_user_info:
                                ui = vk_user_info[0]
                                first_name = ui.get('first_name', '')
                                last_name = ui.get('last_name', '')
                                screen_name = ui.get('screen_name', '')
                                vk_url = f"https://vk.com/{screen_name}" if screen_name else f"https://vk.com/id{vk_id}"
                                handle_start(vk, vk_id, settings, first_name, last_name, vk_url)
                        except Exception as e:
                            logger.error(f"Ошибка: {e}")
                            send_message(vk, vk_id, "❌ Ошибка. Попробуйте позже.")
                    elif cmd == 'agree':
                        try:
                            db.set_user_agreement(user['id'])
                            send_message(vk, vk_id,
                                "✅ *Правила приняты!*\n\n"
                                "Теперь вы можете выполнять задания и участвовать в лотерее!",
                                keyboard=build_main_keyboard(settings))
                        except Exception as e:
                            logger.error(f"Ошибка согласия: {e}")
                            send_message(vk, vk_id, "❌ Ошибка. Попробуйте позже.")
                    else:
                        send_message(vk, vk_id, "❓ Неизвестная команда",
                            keyboard=build_main_keyboard(settings))
                
                # Обработка обычного текста
                elif text:
                    # Проверяем, ожидаем ли мы отчёт
                    if vk_id in waiting_for_report:
                        processed = process_submission(vk, vk_id, settings, text, attachments)
                        if processed:
                            continue
                    
                    # Проверяем, ожидаем ли мы заполнение заявки
                    if vk_id in waiting_for_request:
                        step = waiting_for_request[vk_id].get('step', '')
                        if step == 'subject':
                            handle_request(vk, vk_id, settings, text=text, step='subject')
                            continue
                        elif step == 'description':
                            handle_request(vk, vk_id, settings, text=text, step='description')
                            continue
                    
                    # Другие ключевые слова
                    lower_text = text.lower()
                    if 'задание' in lower_text or 'задачи' in lower_text:
                        handle_tasks(vk, vk_id, settings)
                    elif 'билет' in lower_text:
                        handle_tickets(vk, vk_id, settings)
                    elif 'рейтинг' in lower_text or 'балл' in lower_text:
                        handle_rating(vk, vk_id, settings)
                    elif 'заявк' in lower_text or 'поддержк' in lower_text or 'помощь' in lower_text:
                        handle_request(vk, vk_id, settings, step='init')
                    elif 'профиль' in lower_text or 'кабинет' in lower_text or 'сайт' in lower_text or 'личн' in lower_text:
                        handle_profile(vk, vk_id, settings)
                    elif 'помощ' in lower_text or 'команды' in lower_text or 'инструк' in lower_text or '/help' in lower_text:
                        handle_help(vk, vk_id, settings)
                    else:
                        send_message(vk, vk_id,
                            "❓ Я не совсем понял. Используйте кнопки меню или напишите «Помощь».",
                            keyboard=build_main_keyboard(settings))
                
                # Вложения без текста
                elif attachments:
                    if vk_id in waiting_for_report:
                        process_submission(vk, vk_id, settings, '', attachments)
                    else:
                        send_message(vk, vk_id,
                            "📎 Я получил файл, но не знаю, к какому заданию его прикрепить.\n"
                            "Сначала выберите задание в разделе «Задания».",
                            keyboard=build_main_keyboard(settings))
                
                else:
                    send_message(vk, vk_id, "❓ Используйте кнопки меню.",
                        keyboard=build_main_keyboard(settings))
                
                # Отправка периодических уведомлений (раз в 10 сек)
                current_time = time.time()
                if current_time - last_notification_time > 10:
                    send_pending_notifications(vk)
                    last_notification_time = current_time
            
            elif event.type == VkBotEventType.MESSAGE_EVENT:
                logger.info(f"Событие сообщения: {event.raw}")
    
    except KeyboardInterrupt:
        logger.info("🚫 Бот остановлен пользователем")
        print("\n❌ Бот остановлен.")
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        time.sleep(5)


if __name__ == '__main__':
    main()