# Инструкция по развертыванию

## 1. Требования

- **Сервер**: Linux (Ubuntu 20.04/22.04), Apache или Nginx, PHP 7.4+ (с расширениями `pdo_mysql`, `mbstring`, `json`), MySQL 5.7+.
- **Frontend**: Node.js 18+ и npm.
- **Python**: 3.8+ для бота.
- **Домен** или IP-адрес.

## 2. Развертывание Frontend

1. Скопируйте файлы проекта на сервер (например, в `/var/www/forum`):
   ```bash
   git clone <repo> /var/www/forum
   cd /var/www/forum
   ```
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Соберите production-версию:
   ```bash
   npm run build
   ```
4. Настройте веб-сервер так, чтобы корневая директория указывала на `dist/` (после сборки). Пример для Nginx:
   ```nginx
   server {
       listen 80;
       server_name example.com;
       root /var/www/forum/dist;
       index index.html;

       location / { try_files $uri $uri/ /index.html; }

       location /api/ {
           proxy_pass http://127.0.0.1:8080;  # если PHP работает через php-fpm
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       # статические файлы загрузок
       location /uploads/ {
           proxy_pass http://127.0.0.1:8080;
       }
   }
   ```
   Для Apache используйте `.htaccess` с `RewriteEngine`.

5. Убедитесь, что API доступен по `/api` (прокси или rewrite).

## 3. Развертывание Backend (PHP)

1. Убедитесь, что каталог `api/` доступен через веб-сервер (например, `/api/index.php`).
2. Файл конфигурации БД находится в `api/index.php` (сейчас захардкожены параметры). Рекомендуется вынести их в переменные окружения (`getenv`).
3. Импортируйте структуру базы данных. В проекте есть файл `api/FULL_BD_SCHEMA.sql` (полная схема) или таблицы создаются автоматически некоторыми скриптами (`index.php` создаёт `curator_teams`, `vk_bot_requests`, `vk_bot_request_messages`; `vk_bot.php` создаёт все `vk_bot_*` таблицы).
4. Убедитесь, что папки `api/uploads` и `api/logs` существуют и доступны для записи:
   ```bash
   mkdir -p /var/www/forum/api/uploads
   mkdir -p /var/www/forum/api/logs
   chmod -R 755 /var/www/forum/api/uploads
   chmod -R 755 /var/www/forum/api/logs
   ```
5. Проверьте работу API: откройте `https://example.com/api/settings`. Должен вернуться JSON с настройками.

## 4. Развертывание бота ВКонтакте

### 4.1. Установка Python и зависимостей

1. Перейдите в папку `vk_bot`:
   ```bash
   cd /var/www/forum/vk_bot
   ```
2. Установите зависимости:
   ```bash
   pip3 install -r requirements.txt
   ```
   (или `pip install`)

### 4.2. Настройка подключения к БД

Отредактируйте `vk_bot/config.py`:

```python
DB_HOST = 'localhost'         # обычно localhost
DB_PORT = 3306
DB_NAME = 'имя_бд'
DB_USER = 'пользователь'
DB_PASSWORD = 'пароль'
```

### 4.3. Получение VK Token

1. Создайте сообщество ВК (или используйте существующее).
2. В настройках сообщества включите Long Poll API.
3. Создайте ключ доступа (Token) с правами: `messages`, `photos`, `docs`, `video` (и другие при необходимости).
4. В админ-панели сайта в разделе «Бот ВК» → «Настройки» введите этот токен и ID сообщества.

### 4.4. Запуск бота вручную (тест)

```bash
cd /var/www/forum/vk_bot
python3 bot.py
```

Если всё настроено правильно, бот запустится и будет отвечать на сообщения.

## 5. Автозапуск бота как службы (systemd)

Создайте файл службы `/etc/systemd/system/vkbot.service`:

```ini
[Unit]
Description=VK Bot for Alabuga Forum
After=network.target mysql.service

[Service]
Type=simple
User=www-data   # или ваш пользователь
WorkingDirectory=/var/www/forum/vk_bot
ExecStart=/usr/bin/python3 /var/www/forum/vk_bot/bot.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable vkbot
sudo systemctl start vkbot
```

Проверка статуса: `sudo systemctl status vkbot`.

## 6. Настройка cron для автозаселения

Скрипт `api/cron_auto_approve.php` выполняет автоматическое одобрение заявок. Рекомендуется запускать его каждые 5–10 минут.

Добавьте в crontab (например, `crontab -e` от пользователя с правами на PHP):

```cron
*/5 * * * * php /var/www/forum/api/cron_auto_approve.php >> /var/www/forum/api/logs/cron_auto_approve.log 2>&1
```

Убедитесь, что скрипт имеет права на запись в лог-файл.

## 7. Настройка Nginx для PHP-FPM (пример)

Установите PHP и FPM:
```bash
sudo apt install php-fpm php-mysql
```

Конфигурация Nginx (упрощённая):

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/forum;   # здесь у нас backend и frontend в одной папке?
    # если frontend собран в dist, лучше разделить
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.html;   # для SPA
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
    }

    location ~ ^/api/ {
        rewrite ^/api/(.*)$ /api/index.php?route=$1 last;
    }

    location /uploads/ {
        # отдавать статические файлы из /api/uploads
        alias /var/www/forum/api/uploads/;
    }
}
```

Настройте перезапись маршрутов так, чтобы `/api/...` попадал в `api/index.php`.

---

**Примечание.** Если вы используете Apache, аналогичные правила задаются через `.htaccess` в каталоге `api/` (файл уже есть) и в корне для SPA.