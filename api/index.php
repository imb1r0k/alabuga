<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$dbname = 'imb1r0kya2';
$username = 'imb1r0kya2';
$password = 'sAMogyg6sAMogyg';
$port = 3306;

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка подключения к базе данных: ' . $e->getMessage()]);
    exit();
}

function initFreshDatabase($pdo) {
    $sql = "
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS `bookings`;
        DROP TABLE IF EXISTS `rooms`;
        DROP TABLE IF EXISTS `floors`;
        DROP TABLE IF EXISTS `buildings`;
        DROP TABLE IF EXISTS `tokens`;
        DROP TABLE IF EXISTS `users`;
        DROP TABLE IF EXISTS `settings`;
        SET FOREIGN_KEY_CHECKS = 1;

        CREATE TABLE `settings` (
          `key` VARCHAR(50) NOT NULL PRIMARY KEY,
          `value` TEXT NULL,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        INSERT INTO `settings` (`key`, `value`) VALUES ('site_title', 'Алабуга - форум 2025');

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
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `tokens` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NOT NULL,
          `token` VARCHAR(255) NOT NULL UNIQUE,
          `expires_at` DATETIME NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `buildings` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `name` VARCHAR(255) NOT NULL,
          `gender` ENUM('M', 'F', 'MIXED') NOT NULL DEFAULT 'MIXED',
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `bookings` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NOT NULL,
          `room_id` INT NOT NULL,
          `status` ENUM('pending', 'rejected', 'approved', 'approved_bot') NOT NULL DEFAULT 'pending',
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
          FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    $pdo->exec($sql);

    $adminPassword = password_hash('admin123', PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO `users` (`first_name`, `last_name`, `name`, `login`, `phone`, `password`, `role`, `team_name`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(['Админ', 'Главный', 'Администратор', 'admin', '+79990000000', $adminPassword, 'admin', 'Оргкомитет']);
}

function ensureTablesExist($pdo) {
    // ... КОД БЕЗ ИЗМЕНЕНИЙ (там корректен CREATE TABLE IF NOT EXISTS tokens)
    // Он уже содержит правильный user_id.
}

ensureTablesExist($pdo);

// ... Дальше код идёт как раньше, но в регистрации исправляем INSERT INTO tokens (user_id, token, expires_at)

try {
    switch ($uri) {
        // ... другие кейсы ...

        case 'register':
            if ($method === 'POST') {
                // ... (проверки)
                
                if ($stmt->execute([$firstName, $lastName, $name, $login, $phoneClean, $hashedPassword, 'user'])) {
                    $userId = $pdo->lastInsertId();
                    $newToken = generateToken($userId);
                    
                    $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
                    $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                    $stmt->execute([$userId, $newToken, $expiresAt]);
                    
                    // ...
                }
            }
            break;
        // ...
    }
} catch (Exception $e) {
    // ...
}
?>