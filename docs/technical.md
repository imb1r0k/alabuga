# Техническая документация

## 1. Технологический стек

- **Frontend**: React 18, TypeScript, Vite 5, React Router 6, Tailwind CSS (частично используется), shadcn/ui (импортированы, но в коде используются inline-стили), Lucide React для иконок, Axios для HTTP.
- **Backend**: PHP 7.4+ (чистый PHP без фреймворков), MySQL 5.7+ / 8.0.
- **Бот**: Python 3.8+, библиотеки `vk-api`, `pymysql`, `bcrypt`.
- **Сборка**: npm, типажи TypeScript (tsconfig).

## 2. Структура проекта

### 2.1. Frontend (`src/`)
| Папка/файл | Описание |
|------------|----------|
| `src/main.tsx` | Точка входа React. |
| `src/App.tsx` | Основной роутер и провайдеры (ToastProvider, AuthProvider, SettingsProvider). |
| `src/index.css` | Глобальные стили, классы `.btn`, `.card`, `.input-group` и др. |
| `src/contexts/` | `AuthContext.tsx` (управление пользователем), `SettingsContext.tsx` (настройки сайта). |
| `src/services/api.ts` | Axios-инстанс, все API-функции. |
| `src/pages/` | Страницы: `HomePage`, `AuthPage`, `DashboardPage`, `AutoBookingPage`, `PublicProfilePage`, `GlobalNotification`, папка `admin/` (AdminHomePage, AdminUsersPage, AdminBuildingsPage, AdminBookingsPage, AdminTeamsPage, AdminVkBotPage). |
| `src/components/` | Переиспользуемые компоненты: `Header`, `ProtectedRoute`, `Skeleton`, `Toast`, `AdminLayout`, `AdminStatsWidget`, `AdminCleanupPanel`, `PublicFloorMap`, `RoomInfoModal`, `BookingModal`, `GlobalNotification` (в pages). |
| `src/hooks/` | `useOrientation` (определение портретной/ландшафтной ориентации). |
| `src/utils/` | `phone.ts` (форматирование телефона), `gender.ts` (определение пола по фамилии), `resolveUploadUrl.ts` (преобразование путей к файлам). |

### 2.2. Backend (`api/`)
| Файл/папка | Описание |
|------------|----------|
| `api/index.php` | Точка входа. Подключение к БД, общие функции (jsonResponse, jsonError, getBearerToken, getAuthUser, requireAuth, requireAdmin, requireStrictAdmin, getCuratorTeams, detectGenderByLastName, processAutoApproveBookings), маршрутизация (разбор `$uri`), подключение модулей. |
| `api/modules/` | Модули по разделам: |
| - `auth.php` | Регистрация, вход, получение текущего пользователя, выход. |
| - `bookings.php` | Публичные маршруты: корпусы, планировка, бронирование (вручную), моё бронирование, отмена, история. |
| - `auto_book.php` | Автоматическое бронирование по полу. |
| - `profile_teams.php` | Профиль, команда (моя), чат команды, календарь, публичный профиль. |
| - `settings.php` | Настройки сайта, глобальные уведомления. |
| - `admin_stats.php` | Автоодобрение, статистика, экспорт, архивация, очистка чатов. |
| - `admin_users_bookings.php` | Управление пользователями, бронированиями, комнатные заявки. |
| - `admin_buildings.php` | Здания, этажи, комнаты. |
| - `admin_teams.php` | Команды, участники, чат, календарь. |
| - `admin_requests.php` | Заявки пользователей (через бота). |
| `api/vk_bot.php` | Обработка маршрутов админки бота ВК (настройки, группы, задачи, отчёты, медиа, билеты, уведомления, рассылка, статистика, экспорт). |
| `api/cron_auto_approve.php` | Отдельный скрипт для автозаселения через cron. |

### 2.3. Бот ВК (`vk_bot/`)
| Файл | Описание |
|------|----------|
| `vk_bot/bot.py` | Основной скрипт бота (LongPoll, обработка сообщений). |
| `vk_bot/database.py` | Функции работы с БД (подключение, пользователи, задания, отчёты, билеты, заявки, уведомления). |
| `vk_bot/config.py` | Параметры подключения к БД. |
| `vk_bot/requirements.txt` | Зависимости Python. |
| `vk_bot/README.md` | Краткая инструкция по запуску. |

## 3. API – эндпоинты

Все запросы идут через `/api/...` (например, `/api/settings`). Авторизация – через Bearer-токен в заголовке `Authorization`. Ответы – JSON.

### 3.1. Авторизация
- `POST /api/register` — регистрация. Параметры: `first_name`, `last_name`, `patronymic` (необяз.), `phone`, `password` (если пусто – генерируется), `login` (необяз.). Возвращает `token`, `user` (включая сгенерированный пароль).
- `POST /api/login` — вход. Параметры: `login` или `phone` + `password`. Возвращает `token`, `user`.
- `GET /api/user` — текущий пользователь (требуется auth).
- `POST /api/logout` — выход (требуется auth).

### 3.2. Публичные
- `GET /api/public/buildings` — список корпусов с вместимостью и занятостью.
- `GET /api/public/layout?building_id=ID` — планировка корпуса (этажи, комнаты с занятостью).
- `POST /api/book` — бронирование комнаты. Параметры: `mode` = `login` | `register` | `existing`, `room_id`, данные пользователя (в зависимости от mode). Возвращает `token`, `user`, `booking`.
- `POST /api/auto-book` — автозаселение. `mode`, `gender` (`M`/`F`), аналогичные данные.
- `GET /api/my-booking` — текущее бронирование пользователя (auth).
- `POST /api/cancel-booking` — отозвать заявку (auth).
- `GET /api/my-bookings` — история бронирований (auth).

### 3.3. Профиль и команды
- `GET/POST /api/profile` — получить/обновить профиль (auth).
- `GET /api/my-team` — данные моей команды (auth).
- `GET /api/my-team/chat`, `POST /api/my-team/chat` — получить/отправить сообщение в чат команды.
- `GET /api/my-team/calendar` — события команды.
- `GET /api/public/profile?login=...` — публичный профиль (без auth).

### 3.4. Настройки и уведомления
- `GET /api/settings` — все настройки сайта (публично).
- `POST /api/settings` — обновление настроек (только admin).
- `GET /api/get-global-notification` — получить глобальное уведомление (с учётом просмотра).
- `POST /api/save-global-notification` — сохранить уведомление (admin).
- `POST /api/mark-notification-viewed` — отметить уведомление просмотренным (auth).

### 3.5. Админ-модули (требуют requireAdmin или requireStrictAdmin)
- `GET/POST /api/admin/users` — список/редактирование пользователей.
- `GET /api/admin/user-details?id=ID` — история бронирований пользователя.
- `GET/POST /api/admin/bookings` — список/обновление бронирований.
- `GET /api/admin/all-rooms` — все комнаты.
- `GET /api/admin/room-bookings?room_id=ID` — бронирования конкретной комнаты.
- `GET/POST /api/admin/buildings`, `floors`, `rooms` — управление структурой.
- `GET /api/admin/export/bookings`, `layouts`, `users` — экспорт.
- `POST /api/admin/archive-bookings`, `archive-users`, `teams/clear-all-chats` — очистка.
- `POST /api/admin/auto-approve` — запустить автоматическое одобрение (или используется в интервале).

### 3.6. Бот ВК (админ)
Все маршруты начинаются с `/api/admin/vk-bot/`.
- `GET/POST /settings` – настройки бота.
- `GET/POST /groups`, `/tasks`, `/reports`, `/tickets`, `/broadcast`, `/notifications`, `/stats`, `/export`.

### 3.7. Заявки
- `GET /api/admin/requests`, `POST /api/admin/requests`, `GET/POST /api/admin/requests/messages`.

## 4. База данных

### 4.1. Основные таблицы
| Таблица | Описание |
|---------|----------|
| `users` | Пользователи: id, vk_id, vk_url, first_name, last_name, patronymic, name, login, phone, password, role ('user','curator','moderator','admin'), status ('active','archived'), rating, completed_tasks, team_id, team_name, bio, social_* , bot_registered, agreement_accepted_at, created_at |
| `tokens` | Токены авторизации: user_id, token, expires_at. |
| `buildings` | Корпуса: id, name, gender ('M','F','MIXED'). |
| `floors` | Этажи: id, building_id, floor_number, width, start_room_number, room_order_type ('clockwise','column_wise'), gender. |
| `rooms` | Комнаты: id, floor_id, building_id, room_number, name, capacity, is_technical, room_type ('room','elevator','stairs','tech','gen-start','gen-turn','gen-end'), gender, x_pos, y_pos. |
| `bookings` | Бронирования: id, user_id, room_id, status ('pending','approved','approved_bot','rejected','recalled','archived'), comment, created_at, updated_at. |
| `teams` | Команды: id, name, description. |
| `team_members` | Связь пользователей с командами: team_id, user_id, role. |
| `team_chat_messages` | Сообщения команд: id, team_id, user_id, message, created_at. |
| `team_calendar_events` | События команд: id, team_id, title, event_date, description, image_url, created_by, created_at. |
| `curator_teams` | Привязка кураторов к командам: user_id, team_id (0 означает все команды). |
| `settings` | Настройки в формате key-value (site_title, hero_*, auto-accept-bookings, show_rating, auto-book-mode, global_notification и др.) |

### 4.2. Таблицы бота ВК
| Таблица | Описание |
|---------|----------|
| `vk_bot_settings` | Настройки бота: key, value (vk_token, vk_group_id, site_url, welcome_text, success_text, draw_time). |
| `vk_bot_task_groups` | Волны заданий: id, title, start_date, end_date. |
| `vk_bot_tasks` | Задания: id, group_id, title, description, difficulty, points, task_type. |
| `vk_bot_reports` | Отчёты: id, user_id, task_id, submission_text, has_attachments, status, reject_reason, created_at, updated_at. |
| `vk_bot_report_media` | Медиафайлы отчётов: id, report_id, file_url, file_type, original_name, file_size. |
| `vk_bot_tickets` | Билеты: id, user_id, group_id, ticket_number, created_at. |
| `vk_bot_notifications` | Очередь уведомлений для отправки ботом: id, user_id, report_id (nullable), message, is_sent, created_at, sent_at. |
| `vk_bot_requests` | Заявки пользователей: id, user_id, category, subject, description, status, resolved_by, resolution_text, created_at, updated_at. |
| `vk_bot_request_messages` | Сообщения по заявкам: id, request_id, user_id, message, created_at. |

## 5. Логика автозаселения

- Настройка `auto-accept-bookings` (1/0) включает автоматическое одобрение заявок.
- Скрипт `processAutoApproveBookings` (в `api/index.php`) выполняется либо по запросу `/admin/auto-approve` (используется в админке каждые 10 секунд), либо через cron (`cron_auto_approve.php`).
- Режим `auto-book-mode`:
  - `gender` – одобряются заявки, если пол пользователя совпадает с полом комнаты (или комната/этаж/корпус имеют `MIXED`).
  - `gender_and_vk_duplicate` – дополнительно требует, чтобы пользователь был зарегистрирован через бота ВК (`vk_url` заполнен и `bot_registered=1`).
- Проверяется дубликат заявки по ФИО (если существует активная заявка с такими же фамилией и именем, новая не одобряется).

## 6. Логика бота ВК

- Бот использует LongPoll и фоновые потоки для отправки уведомлений (из таблицы `vk_bot_notifications`).
- При первом входящем сообщении создаётся/обновляется пользователь, отправляется приветствие, правила, логин/пароль.
- Пользователь должен подтвердить согласие с правилами (кнопка «Подтверждаю»).
- При одобрении отчёта администратором через API (`/admin/vk-bot/reports`) начисляются баллы, при выполнении всех заданий выдается билет и создаётся уведомление (в том числе отдельное уведомление о билете).
- Бот проверяет открытые заявки каждые 10 секунд и уведомляет пользователя о новых сообщениях от администратора.