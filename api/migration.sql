-- SQL-миграция: добавляем поля для hero-блока главной страницы в таблицу settings
-- Запустить в phpMyAdmin или через любой MySQL-клиент

INSERT INTO `settings` (`key`, `value`) VALUES
('hero_badge', 'Форум 2025'),
('hero_title', 'Добро пожаловать в систему проживания <span style="color: #38bdf8">Алабуга</span>'),
('hero_description', 'Интерактивный сервис бронирования жилых помещений, работы с командами и расселения участников форума в реальном времени.'),
('hero_button_text', 'Войти / Зарегистрироваться'),
('hero_button_text_auth', 'Перейти в личный кабинет')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);