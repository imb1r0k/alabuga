SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `rooms`;
DROP TABLE IF EXISTS `floors`;
DROP TABLE IF EXISTS `buildings`;
DROP TABLE IF EXISTS `team_calendar_events`;
DROP TABLE IF EXISTS `team_chat_messages`;
DROP TABLE IF EXISTS `team_members`;
DROP TABLE IF EXISTS `tokens`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `teams`;
DROP TABLE IF EXISTS `settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Таблица настроек сайта
CREATE TABLE `settings` (
  `key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `value` TEXT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`key`, `value`) VALUES ('site_title', 'Алабуга - форум 2025');

-- 2. Таблица команд
CREATE TABLE `teams` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Таблица пользователей
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NULL,
  `name` VARCHAR(255) NOT NULL,
  `login` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(50) NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'user',
  `team_name` VARCHAR(100) NULL,
  `team_id` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Таблица авторизационных токенов
CREATE TABLE `tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Таблица участников команд
CREATE TABLE `team_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` ENUM('captain','member') DEFAULT 'member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Сообщения чата команды
CREATE TABLE `team_chat_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Календарь событий команды
CREATE TABLE `team_calendar_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `event_date` DATETIME NOT NULL,
  `description` TEXT NULL,
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Корпуса
CREATE TABLE `buildings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `gender` ENUM('M', 'F', 'MIXED') NOT NULL DEFAULT 'MIXED',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Этажи корпусов
CREATE TABLE `floors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `building_id` INT NOT NULL,
  `floor_number` INT NOT NULL,
  `width` INT NOT NULL DEFAULT 8,
  `start_room_number` INT NULL DEFAULT NULL,
  `room_order_type` VARCHAR(20) NOT NULL DEFAULT 'clockwise',
  `gender` ENUM('M', 'F', 'MIXED', 'DEFAULT') NOT NULL DEFAULT 'DEFAULT',
  `layout_data` LONGTEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Комнаты и элементы схемы этажа
CREATE TABLE `rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `floor_id` INT NOT NULL,
  `building_id` INT NOT NULL,
  `room_number` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NULL,
  `capacity` INT NOT NULL DEFAULT 2,
  `is_technical` TINYINT(1) NOT NULL DEFAULT 0,
  `room_type` VARCHAR(50) NOT NULL DEFAULT 'room',
  `gender` ENUM('M', 'F', 'MIXED', 'DEFAULT') NOT NULL DEFAULT 'DEFAULT',
  `x_pos` INT NOT NULL DEFAULT 0,
  `y_pos` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Бронирования номеров
CREATE TABLE `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `room_id` INT NOT NULL,
  `status` ENUM('pending', 'rejected', 'approved', 'approved_bot') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Аккаунт Администратора по умолчанию (Логин: admin / Пароль: admin123)
INSERT INTO `users` (`first_name`, `last_name`, `name`, `login`, `phone`, `password`, `role`, `team_name`)
VALUES (
  'Админ', 
  'Главный', 
  'Администратор', 
  'admin', 
  '+79990000000', 
  '$2y$10$Y7mB/Z6bI5J6rJzI4e/B7eA/pG5wV8xS8m5y/k5hK.8w4/3N2o8fG', 
  'admin', 
  'Оргкомитет'
);