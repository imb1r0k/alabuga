-- Таблица настроек бота ВКонтакте
CREATE TABLE IF NOT EXISTS `vk_bot_settings` (
  `key` VARCHAR(64) NOT NULL,
  `value` TEXT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Начальные настройки сообщения бота
INSERT IGNORE INTO `vk_bot_settings` (`key`, `value`) VALUES
('vk_token', ''),
('vk_group_id', ''),
('welcome_text', 'Привет! Здесь ты гарантированно получаешь билет на участие в лотерее ценных призов!\n\nВыполни задания и получи билет на розыгрыш!'),
('success_text', 'Поздравляю с успешным выполнением всех заданий данной волны!'),
('draw_time', '18:00');

-- Таблица волн (групп) заданий с датами активности
CREATE TABLE IF NOT EXISTS `vk_bot_task_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица конкретных заданий внутри волны
CREATE TABLE IF NOT EXISTS `vk_bot_tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `group_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `difficulty` ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'easy',
  `points` INT NOT NULL DEFAULT 10,
  `task_type` ENUM('repost', 'post', 'other') NOT NULL DEFAULT 'other',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_vk_tasks_group` FOREIGN KEY (`group_id`) REFERENCES `vk_bot_task_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица пользователей ВКонтакте и их рейтинга
CREATE TABLE IF NOT EXISTS `vk_bot_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vk_id` BIGINT NOT NULL UNIQUE,
  `first_name` VARCHAR(100) DEFAULT '',
  `last_name` VARCHAR(100) DEFAULT '',
  `points` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица высланных отчетов по заданиям на проверку
CREATE TABLE IF NOT EXISTS `vk_bot_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `task_id` INT NOT NULL,
  `submission_text` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `reject_reason` VARCHAR(255) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_vk_reports_user` FOREIGN KEY (`user_id`) REFERENCES `vk_bot_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vk_reports_task` FOREIGN KEY (`task_id`) REFERENCES `vk_bot_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица выданных лотерейных билетов
CREATE TABLE IF NOT EXISTS `vk_bot_tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `group_id` INT NOT NULL,
  `ticket_number` VARCHAR(64) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_vk_tickets_user` FOREIGN KEY (`user_id`) REFERENCES `vk_bot_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vk_tickets_group` FOREIGN KEY (`group_id`) REFERENCES `vk_bot_task_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;