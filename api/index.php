<?php
// ... (весь существующий код без изменений до места с ensureTablesExist)

function ensureTablesExist($pdo) {
    try {
        $pdo->query("SELECT `status` FROM `users` LIMIT 1");
        $pdo->query("SELECT `status` FROM `bookings` LIMIT 1");
        // Проверяем наличие новых полей для профиля
        try {
            $pdo->query("SELECT `about` FROM `users` LIMIT 1");
        } catch (Exception $e) {
            // Добавляем поля для профиля
            $pdo->exec("ALTER TABLE `users` 
                ADD COLUMN `about` TEXT NULL AFTER `team_id`,
                ADD COLUMN `social_vk` VARCHAR(255) NULL AFTER `about`,
                ADD COLUMN `social_max` VARCHAR(255) NULL AFTER `social_vk`,
                ADD COLUMN `social_telegram` VARCHAR(255) NULL AFTER `social_max`,
                ADD COLUMN `social_instagram` VARCHAR(255) NULL AFTER `social_telegram`
            ");
        }
    } catch (Exception $e) {
        // ... (остальное)
    }
}

// Далее идёт остальной код...