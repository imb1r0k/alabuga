-- Добавляем колонку role к таблице users
ALTER TABLE users ADD COLUMN role ENUM('user', 'admin', 'moderator') DEFAULT 'user';