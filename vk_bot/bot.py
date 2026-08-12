-- Удаляем колонку agreement_accepted
ALTER TABLE users DROP COLUMN agreement_accepted;

-- Проверяем структуру
DESCRIBE users;

-- Обновляем существующих пользователей (у кого уже было подтверждение)
UPDATE users 
SET agreement_accepted_at = NOW() 
WHERE id IN (25, 21, 20, 19, 18, 17, 16, 15, 14, 13);

-- Проверяем результат
SELECT id, vk_id, first_name, last_name, agreement_accepted_at, bot_registered 
FROM users 
ORDER BY id DESC 
LIMIT 20;