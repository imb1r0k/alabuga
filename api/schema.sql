SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `bookings`;
DROP TABLE IF EXISTS `rooms`;
DROP TABLE IF EXISTS `floors`;
DROP TABLE IF EXISTS `buildings`;
DROP TABLE IF EXISTS `tokens`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Настройки сайта
CREATE TABLE `settings` (
  `key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `value` TEXT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`key`, `value`) VALUES ('site_title', 'Алабуга - форум 2025');

-- 2. Пользователи
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(50) NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'user',
  `team_name` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Создаем дефолтного администратора (пароль: admin123)
INSERT INTO `users` (`first_name`, `last_name`, `name`, `email`, `phone`, `password`, `role`, `team_name`)
VALUES ('Админ', 'Главный', 'Администратор', 'admin@alabuga.ru', '+79990000000', '$2y$10$e88yC0w.1/a7GjQW.S3x2uA6x30cO4c6B7H6K2M8P1L1I1N1O1Q1S', 'admin', 'Оргкомитет');

-- 3. Токены авторизации
CREATE TABLE `tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Корпуса
CREATE TABLE `buildings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `gender` ENUM('M', 'F') NOT NULL DEFAULT 'M',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Этажи
CREATE TABLE `floors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `building_id` INT NOT NULL,
  `floor_number` INT NOT NULL,
  `width` INT NOT NULL DEFAULT 8,
  `gender` ENUM('M', 'F', 'DEFAULT') NOT NULL DEFAULT 'DEFAULT',
  `layout_data` LONGTEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Комнаты
CREATE TABLE `rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `floor_id` INT NOT NULL,
  `building_id` INT NOT NULL,
  `room_number` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NULL,
  `capacity` INT NOT NULL DEFAULT 2,
  `is_technical` TINYINT(1) NOT NULL DEFAULT 0,
  `gender` ENUM('M', 'F', 'DEFAULT') NOT NULL DEFAULT 'DEFAULT',
  `x_pos` INT NOT NULL DEFAULT 0,
  `y_pos` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Бронирования
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