-- Миграция для добавления рейтинга и выполненных заданий
ALTER TABLE users ADD COLUMN rating INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN completed_tasks INT NOT NULL DEFAULT 0;