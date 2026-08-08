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

// ─── Инициализация БД ───────────────────────────────────────────────────────

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
        DROP TABLE IF EXISTS `team_members`;
        DROP TABLE IF EXISTS `team_chat_messages`;
        DROP TABLE IF EXISTS `team_calendar_events`;
        DROP TABLE IF EXISTS `teams`;
        SET FOREIGN_KEY_CHECKS = 1;

        CREATE TABLE `settings` (
          `key` VARCHAR(50) NOT NULL PRIMARY KEY,
          `value` TEXT NULL,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        INSERT INTO `settings` (`key`, `value`) VALUES
        ('site_title', 'Алабуга - форум 2025'),
        ('hero_badge', 'Форум 2025'),
        ('hero_title', 'Добро пожаловать в систему проживания <span style=\"color: #38bdf8\">Алабуга</span>'),
        ('hero_description', 'Интерактивный сервис бронирования жилых помещений, работы с командами и расселения участников форума в реальном времени.'),
        ('hero_button_text', 'Войти / Зарегистрироваться'),
        ('hero_button_text_auth', 'Перейти в личный кабинет');

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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `tokens` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NOT NULL,
          `token` VARCHAR(255) NOT NULL UNIQUE,
          `expires_at` DATETIME NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `teams` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `name` VARCHAR(100) NOT NULL UNIQUE,
          `description` TEXT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `team_members` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `team_id` INT NOT NULL,
          `user_id` INT NOT NULL,
          `role` ENUM('captain','member') DEFAULT 'member',
          `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `team_chat_messages` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `team_id` INT NOT NULL,
          `user_id` INT NOT NULL,
          `message` TEXT NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

    $adminHash = password_hash('admin123', PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO `users` (`first_name`, `last_name`, `name`, `login`, `phone`, `password`, `role`, `team_name`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(['Админ', 'Главный', 'Администратор', 'admin', '+79990000000', $adminHash, 'admin', 'Оргкомитет']);
}

function ensureTablesExist($pdo) {
    try {
        $pdo->query("SELECT 1 FROM `users` LIMIT 1");
    } catch (Exception $e) {
        initFreshDatabase($pdo);
    }
}

ensureTablesExist($pdo);

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function getBearerToken() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } else if (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/i', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function getAuthUser($pdo) {
    $token = getBearerToken();
    if (!$token) return null;
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN tokens t ON u.id = t.user_id WHERE t.token = ? AND t.expires_at > NOW()");
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}

function requireAuth($pdo) {
    $user = getAuthUser($pdo);
    if (!$user) jsonError('Не авторизован', 401);
    return $user;
}

function requireAdmin($pdo) {
    $user = requireAuth($pdo);
    $role = strtolower(trim($user['role']));
    if (!in_array($role, ['admin', 'moderator'])) jsonError('Доступ запрещён', 403);
    return $user;
}

// ─── Определение маршрута ────────────────────────────────────────────────────

$uri = $_GET['route'] ?? '';
if (!$uri) {
    $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri = trim(preg_replace('#^/api/?#', '', $requestUri), '/');
}

$method = $_SERVER['REQUEST_METHOD'];

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];

try {

    // ─── Инициализация БД вручную ─────────────────────────────────────────

    if ($uri === 'init-db') {
        initFreshDatabase($pdo);
        jsonResponse(['success' => true, 'message' => 'База данных успешно инициализирована заново. Логин: admin / Пароль: admin123']);
    }

    // ─── Настройки (публичные + админские) ─────────────────────────────────

    if ($uri === 'settings') {
        if ($method === 'GET') {
            // Возвращаем все настройки
            $stmt = $pdo->query("SELECT `key`, `value` FROM settings");
            $rows = $stmt->fetchAll();
            $settings = [];
            foreach ($rows as $row) {
                $settings[$row['key']] = $row['value'];
            }
            jsonResponse($settings);
        }

        if ($method === 'POST') {
            $user = requireAdmin($pdo);

            // Принимаем объект с несколькими настройками: { site_title: "...", hero_badge: "...", ... }
            foreach ($data as $key => $value) {
                // Разрешаем только определённые ключи
                $allowed = ['site_title', 'hero_badge', 'hero_title', 'hero_description', 'hero_button_text', 'hero_button_text_auth'];
                if (!in_array($key, $allowed)) continue;
                $val = trim((string)$value);
                if ($val === '') continue;
                $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");
                $stmt->execute([$key, $val, $val]);
            }

            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    // ─── Глобальные уведомления ──────────────────────────────────────────────

    if ($uri === 'notifications/global') {
        if ($method === 'GET') {
            // Публичный запрос: возвращаем активное глобальное уведомление (с учётом статуса просмотра пользователем)
            $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'global_notification'");
            $stmt->execute();
            $raw = $stmt->fetchColumn();
            $notif = $raw ? json_decode($raw, true) : null;

            if (!$notif || empty($notif['enabled'])) {
                jsonResponse(['notification' => null]);
            }

            $type = $notif['type'] ?? 'permanent';
            $viewers = $notif['viewers'] ?? [];
            $user = getAuthUser($pdo);
            $viewerKey = $user ? trim((string)$user['login']) : null;

            // Для типа "one-view": если пользователь уже просмотрел — не показываем
            if ($type === 'one-view' && $viewerKey && in_array($viewerKey, $viewers, true)) {
                jsonResponse(['notification' => null]);
            }

            jsonResponse(['notification' => $notif]);
        }

        if ($method === 'POST') {
            // Админ: создать/обновить глобальное уведомление
            requireAdmin($pdo);

            $text = trim($data['text'] ?? '');
            $type = in_array($data['type'] ?? '', ['permanent', 'one-view'], true) ? $data['type'] : 'permanent';
            $enabled = !empty($data['enabled']);

            if (!$text) jsonError('Текст уведомления обязателен');

            // Сохраняем прежний список просмотревших
            $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'global_notification'");
            $stmt->execute();
            $raw = $stmt->fetchColumn();
            $existing = $raw ? json_decode($raw, true) : null;
            $viewers = $existing['viewers'] ?? [];

            $payload = json_encode([
                'text' => $text,
                'type' => $type,
                'enabled' => $enabled,
                'viewers' => $viewers,
            ], JSON_UNESCAPED_UNICODE);

            $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES ('global_notification', ?) ON DUPLICATE KEY UPDATE `value` = ?");
            $stmt->execute([$payload, $payload]);

            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'notifications/global/view') {
        // Пометить уведомление как просмотренное текущим пользователем
        if ($method === 'POST') {
            $user = requireAuth($pdo);
            $login = trim((string)$user['login']);
            if (!$login) jsonResponse(['success' => true]);

            $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'global_notification'");
            $stmt->execute();
            $raw = $stmt->fetchColumn();
            $notif = $raw ? json_decode($raw, true) : null;
            if (!$notif) jsonResponse(['success' => true]);

            $viewers = $notif['viewers'] ?? [];
            if (!in_array($login, $viewers, true)) {
                $viewers[] = $login;
                $notif['viewers'] = $viewers;
                $payload = json_encode($notif, JSON_UNESCAPED_UNICODE);
                $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES ('global_notification', ?) ON DUPLICATE KEY UPDATE `value` = ?");
                $stmt->execute([$payload, $payload]);
            }

            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    // ─── Регистрация ────────────────────────────────────────────────────────

    if ($uri === 'register') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

        $firstName = trim($data['first_name'] ?? '');
        $lastName  = trim($data['last_name'] ?? '');
        $phone     = trim($data['phone'] ?? '');
        $password  = trim($data['password'] ?? '');
        $customLogin = trim($data['login'] ?? '');

        // Валидация
        $errors = [];
        if (!$firstName) $errors[] = 'Имя обязательно';
        if (!$lastName) $errors[] = 'Фамилия обязательна';
        if (!$phone) $errors[] = 'Номер телефона обязателен';
        if (strlen($password) < 6) $errors[] = 'Пароль должен быть минимум 6 символов';

        $phoneDigits = preg_replace('/\D/', '', $phone);
        if (strlen($phoneDigits) < 10) $errors[] = 'Укажите корректный номер телефона';

        if ($errors) jsonError(implode('. ', $errors), 400);

        // Определяем логин: используем указанный или генерируем
        if ($customLogin) {
            $finalLogin = $customLogin;
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
            $stmt->execute([$finalLogin]);
            if ($stmt->fetchColumn() > 0) {
                jsonError('Логин уже занят, укажите другой', 400);
            }
        } else {
            $finalLogin = 'u' . substr($phoneDigits, -8);
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
            $stmt->execute([$finalLogin]);
            if ($stmt->fetchColumn() > 0) {
                $finalLogin = 'u' . $phoneDigits . rand(10, 99);
            }
        }

        // Проверка на дубликат телефона
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        if ($stmt->fetchColumn() > 0) {
            jsonError('Пользователь с таким номером телефона уже зарегистрирован', 400);
        }

        $fullName = $lastName . ' ' . $firstName;
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, name, login, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, 'user')");
        $stmt->execute([$firstName, $lastName, $fullName, $finalLogin, $phone, $hashedPassword]);
        $userId = (int)$pdo->lastInsertId();

        // Создаём токен
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $token, $expiresAt]);

        // Ответ с данными пользователя (пароль возвращаем в открытом виде для показа пользователю)
        $userData = [
            'id'         => $userId,
            'first_name' => $firstName,
            'last_name'  => $lastName,
            'name'       => $fullName,
            'login'      => $finalLogin,
            'phone'      => $phone,
            'role'       => 'user',
            'password'   => $password,
        ];

        jsonResponse(['token' => $token, 'user' => $userData]);
    }

    // ─── Авторизация (логин) ───────────────────────────────────────────────

    if ($uri === 'login') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

        $loginInput = trim($data['login'] ?? $data['phone'] ?? $data['email'] ?? '');
        $password   = trim($data['password'] ?? '');

        if (!$loginInput || !$password) {
            jsonError('Заполните логин/телефон и пароль', 400);
        }

        // Ищем пользователя по логину, телефону (точное совпадение) или по цифрам телефона
        $phoneDigits = preg_replace('/\D/', '', $loginInput);

        $stmt = $pdo->prepare("
            SELECT * FROM users
            WHERE login = :input
               OR phone = :input
               OR (CHAR_LENGTH(:digits) >= 10 AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '(', ''), ')', ''), '-', '') LIKE CONCAT('%', :digits2))
            LIMIT 1
        ");
        $stmt->execute([
            'input'   => $loginInput,
            'digits'  => $phoneDigits,
            'digits2' => $phoneDigits,
        ]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonError('Неверный логин/телефон или пароль', 401);
        }

        // Создаём новый токен
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$user['id'], $token, $expiresAt]);

        unset($user['password']);
        jsonResponse(['token' => $token, 'user' => $user]);
    }

    // ─── Текущий пользователь ──────────────────────────────────────────────

    if ($uri === 'user') {
        $user = requireAuth($pdo);
        unset($user['password']);
        jsonResponse($user);
    }

    // ─── Выход ──────────────────────────────────────────────────────────────

    if ($uri === 'logout') {
        $token = getBearerToken();
        if ($token) {
            $stmt = $pdo->prepare("DELETE FROM tokens WHERE token = ?");
            $stmt->execute([$token]);
        }
        jsonResponse(['success' => true]);
    }

    // ─── Команды ────────────────────────────────────────────────────────────

    if ($uri === 'admin/teams') {
        $user = requireAdmin($pdo);

        if ($method === 'GET') {
            $stmt = $pdo->query("SELECT * FROM teams ORDER BY name ASC");
            jsonResponse($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $action = $data['action'] ?? 'create';
            $id = (int)($data['id'] ?? 0);
            $name = trim($data['name'] ?? '');
            $desc = trim($data['description'] ?? '');

            if (empty($name)) jsonError('Название команды обязательно');

            if ($action === 'create') {
                $stmt = $pdo->prepare("INSERT INTO teams (name, description) VALUES (?, ?)");
                $stmt->execute([$name, $desc]);
            } elseif ($action === 'update' && $id > 0) {
                $stmt = $pdo->prepare("UPDATE teams SET name=?, description=? WHERE id=?");
                $stmt->execute([$name, $desc, $id]);
            }
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'admin/teams/delete') {
        $user = requireAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $id = (int)($data['id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true]);
    }

    if ($uri === 'admin/teams/add-member') {
        $user = requireAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $teamId = (int)($data['team_id'] ?? 0);
        $userId = (int)($data['user_id'] ?? 0);
        if ($teamId <= 0 || $userId <= 0) jsonError('Некорректные параметры');

        // Проверяем, что команда существует
        $stmt = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
        $stmt->execute([$teamId]);
        $teamName = $stmt->fetchColumn();
        if (!$teamName) jsonError('Команда не найдена', 404);

        // Проверяем пользователя
        $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        if (!$stmt->fetchColumn()) jsonError('Пользователь не найден', 404);

        // Устанавливаем команду в таблице users
        $stmt = $pdo->prepare("UPDATE users SET team_id = ?, team_name = ? WHERE id = ?");
        $stmt->execute([$teamId, $teamName, $userId]);

        // Добавляем запись в team_members (если её ещё нет)
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM team_members WHERE team_id = ? AND user_id = ?");
        $stmt->execute([$teamId, $userId]);
        if ($stmt->fetchColumn() == 0) {
            $stmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')");
            $stmt->execute([$teamId, $userId]);
        }

        jsonResponse(['success' => true]);
    }

    if ($uri === 'admin/teams/remove-member') {
        $user = requireAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $teamId = (int)($data['team_id'] ?? 0);
        $userId = (int)($data['user_id'] ?? 0);
        if ($teamId <= 0 || $userId <= 0) jsonError('Некорректные параметры');

        // Убираем команду из пользователя (только если он сейчас в этой команде)
        $stmt = $pdo->prepare("UPDATE users SET team_id = NULL, team_name = NULL WHERE id = ? AND team_id = ?");
        $stmt->execute([$userId, $teamId]);

        // Удаляем из team_members
        $stmt = $pdo->prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?");
        $stmt->execute([$teamId, $userId]);

        jsonResponse(['success' => true]);
    }

    if ($uri === 'admin/teams/members') {
        $user = requireAdmin($pdo);
        if ($method !== 'GET') jsonError('Метод не поддерживается', 405);
        $teamId = (int)($_GET['team_id'] ?? 0);
        $stmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, u.name, u.login,
                   COALESCE(tm.role, 'member') as role
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
            WHERE u.team_id = ?
            ORDER BY u.last_name ASC
        ");
        $stmt->execute([$teamId, $teamId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($uri === 'admin/teams/chat') {
        $user = requireAdmin($pdo);

        if ($method === 'GET') {
            $teamId = (int)($_GET['team_id'] ?? 0);
            $stmt = $pdo->prepare("
                SELECT m.id, m.message, m.created_at, u.first_name, u.last_name
                FROM team_chat_messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.team_id = ?
                ORDER BY m.created_at ASC
            ");
            $stmt->execute([$teamId]);
            jsonResponse($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $teamId = (int)($data['team_id'] ?? 0);
            $message = trim($data['message'] ?? '');
            if (!$message) jsonError('Сообщение не может быть пустым');
            $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
            $stmt->execute([$teamId, $user['id'], $message]);
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'admin/teams/calendar') {
        $user = requireAdmin($pdo);

        if ($method === 'GET') {
            $teamId = (int)($_GET['team_id'] ?? 0);
            $stmt = $pdo->prepare("SELECT * FROM team_calendar_events WHERE team_id = ? ORDER BY event_date ASC");
            $stmt->execute([$teamId]);
            jsonResponse($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $action = $data['action'] ?? 'create';
            $teamId = (int)($data['team_id'] ?? 0);

            if ($action === 'create') {
                $title = trim($data['title'] ?? '');
                $eventDate = trim($data['event_date'] ?? '');
                $desc = trim($data['description'] ?? '');
                if (!$title || !$eventDate) jsonError('Заполните название и дату');
                $stmt = $pdo->prepare("INSERT INTO team_calendar_events (team_id, title, event_date, description, created_by) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$teamId, $title, $eventDate, $desc, $user['id']]);
            } elseif ($action === 'delete') {
                $id = (int)($data['id'] ?? 0);
                $stmt = $pdo->prepare("DELETE FROM team_calendar_events WHERE id = ?");
                $stmt->execute([$id]);
            }
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    // ─── Маршруты Админ-панели ──────────────────────────────────────────────

    if (strpos($uri, 'admin/') === 0) {
        $user = requireAdmin($pdo);

        if ($uri === 'admin/users') {
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT id, first_name, last_name, name, login as email, phone, role, team_name, team_id, created_at FROM users ORDER BY id DESC");
                jsonResponse($stmt->fetchAll());
            }

            if ($method === 'POST') {
                $id = (int)($data['id'] ?? 0);
                $firstName = trim($data['first_name'] ?? '');
                $lastName = trim($data['last_name'] ?? '');
                $phone = trim($data['phone'] ?? '');
                $login = trim($data['email'] ?? $data['login'] ?? '');
                $role = trim($data['role'] ?? 'user');
                $teamName = trim($data['team_name'] ?? '');
                $teamId = (int)($data['team_id'] ?? 0);
                $password = trim($data['password'] ?? '');

                if ($id > 0) {
                    $fullName = $lastName . ' ' . $firstName;
                    $teamNameResolved = $teamName;
                    if ($teamId > 0) {
                        $stmt = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
                        $stmt->execute([$teamId]);
                        $teamNameResolved = $stmt->fetchColumn() ?: $teamName;
                    }
                    if ($password) {
                        $hash = password_hash($password, PASSWORD_DEFAULT);
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, name=?, phone=?, login=?, role=?, team_name=?, team_id=?, password=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $fullName, $phone, $login, $role, $teamNameResolved, $teamId ?: null, $hash, $id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, name=?, phone=?, login=?, role=?, team_name=?, team_id=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $fullName, $phone, $login, $role, $teamNameResolved, $teamId ?: null, $id]);
                    }

                    // Синхронизируем team_members с назначенной командой
                    // Если команда назначена — добавить запись (если её нет)
                    if ($teamId > 0) {
                        $stmt = $pdo->prepare("SELECT COUNT(*) FROM team_members WHERE team_id = ? AND user_id = ?");
                        $stmt->execute([$teamId, $id]);
                        if ($stmt->fetchColumn() == 0) {
                            $stmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')");
                            $stmt->execute([$teamId, $id]);
                        }
                    } else {
                        // Команда убрана — удаляем из всех team_members для этого пользователя
                        $stmt = $pdo->prepare("DELETE FROM team_members WHERE user_id = ?");
                        $stmt->execute([$id]);
                    }

                    jsonResponse(['success' => true]);
                }
                jsonError('ID пользователя не указан');
            }

            jsonError('Метод не поддерживается', 405);
        }

        if ($uri === 'admin/user-details') {
            $id = (int)($_GET['id'] ?? 0);
            $stmt = $pdo->prepare("
                SELECT b.id, b.status, b.created_at, r.room_number, bu.name as building_name, f.floor_number
                FROM bookings b
                JOIN rooms r ON b.room_id = r.id
                JOIN buildings bu ON r.building_id = bu.id
                JOIN floors f ON r.floor_id = f.id
                WHERE b.user_id = ? ORDER BY b.id DESC
            ");
            $stmt->execute([$id]);
            $history = $stmt->fetchAll();
            $current = count($history) > 0 ? $history[0] : null;
            jsonResponse([
                'current_booking' => $current,
                'bookings_history' => $history,
            ]);
        }

        if ($uri === 'admin/bookings') {
            if ($method === 'GET') {
                $stmt = $pdo->query("
                    SELECT b.id, b.user_id, b.room_id, b.status, b.created_at,
                           u.first_name, u.last_name, u.name as user_name, u.phone as user_phone, u.role,
                           r.room_number, r.gender, bu.name as building_name, f.floor_number
                    FROM bookings b
                    JOIN users u ON b.user_id = u.id
                    JOIN rooms r ON b.room_id = r.id
                    JOIN buildings bu ON r.building_id = bu.id
                    JOIN floors f ON r.floor_id = f.id
                    ORDER BY b.id DESC
                ");
                jsonResponse($stmt->fetchAll());
            }

            if ($method === 'POST') {
                $id = (int)($data['id'] ?? 0);
                $roomId = (int)($data['room_id'] ?? 0);
                $status = trim($data['status'] ?? 'pending');
                if ($id > 0) {
                    $stmt = $pdo->prepare("UPDATE bookings SET room_id = ?, status = ? WHERE id = ?");
                    $stmt->execute([$roomId, $status, $id]);
                }
                jsonResponse(['success' => true]);
            }

            jsonError('Метод не поддерживается', 405);
        }

        if ($uri === 'admin/buildings') {
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM buildings ORDER BY id ASC");
                jsonResponse($stmt->fetchAll());
            }

            if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM buildings WHERE id = ?");
                    $stmt->execute([$id]);
                } else {
                    $name = trim($data['name'] ?? '');
                    $gender = $data['gender'] ?? 'MIXED';
                    $id = (int)($data['id'] ?? 0);
                    if ($id > 0) {
                        $stmt = $pdo->prepare("UPDATE buildings SET name = ?, gender = ? WHERE id = ?");
                        $stmt->execute([$name, $gender, $id]);
                    } else {
                        $stmt = $pdo->prepare("INSERT INTO buildings (name, gender) VALUES (?, ?)");
                        $stmt->execute([$name, $gender]);
                    }
                }
                jsonResponse(['success' => true]);
            }

            jsonError('Метод не поддерживается', 405);
        }

        if ($uri === 'admin/floors') {
            if ($method === 'GET') {
                $buildingId = (int)($_GET['building_id'] ?? 0);
                $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
                $stmt->execute([$buildingId]);
                jsonResponse($stmt->fetchAll());
            }

            if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM floors WHERE id = ?");
                    $stmt->execute([$id]);
                } else {
                    $id = (int)($data['id'] ?? 0);
                    $buildingId = (int)($data['building_id'] ?? 0);
                    $floorNumber = (int)($data['floor_number'] ?? 1);
                    $width = (int)($data['width'] ?? 8);
                    $startRoomNum = isset($data['start_room_number']) ? (int)$data['start_room_number'] : null;
                    $orderType = $data['room_order_type'] ?? 'clockwise';
                    $gender = $data['gender'] ?? 'DEFAULT';
                    if ($id > 0) {
                        $stmt = $pdo->prepare("UPDATE floors SET width=?, start_room_number=?, room_order_type=?, gender=? WHERE id=?");
                        $stmt->execute([$width, $startRoomNum, $orderType, $gender, $id]);
                    } else {
                        $stmt = $pdo->prepare("INSERT INTO floors (building_id, floor_number, width, start_room_number, room_order_type, gender) VALUES (?, ?, ?, ?, ?, ?)");
                        $stmt->execute([$buildingId, $floorNumber, $width, $startRoomNum, $orderType, $gender]);
                    }
                }
                jsonResponse(['success' => true]);
            }

            jsonError('Метод не поддерживается', 405);
        }

        if ($uri === 'admin/rooms') {
            if ($method === 'GET') {
                $floorId = (int)($_GET['floor_id'] ?? 0);
                $stmt = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? ORDER BY y_pos ASC, x_pos ASC");
                $stmt->execute([$floorId]);
                jsonResponse($stmt->fetchAll());
            }

            if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM rooms WHERE id = ?");
                    $stmt->execute([$id]);
                } else {
                    $id = (int)($data['id'] ?? 0);
                    $floorId = (int)($data['floor_id'] ?? 0);
                    $buildingId = (int)($data['building_id'] ?? 0);
                    $roomNumber = trim($data['room_number'] ?? '');
                    $name = trim($data['name'] ?? '');
                    $capacity = (int)($data['capacity'] ?? 2);
                    $isTech = (int)($data['is_technical'] ?? 0);
                    $type = $data['room_type'] ?? 'room';
                    $gender = $data['gender'] ?? 'DEFAULT';
                    $x = (int)($data['x_pos'] ?? 0);
                    $y = (int)($data['y_pos'] ?? 0);
                    if ($id > 0) {
                        $stmt = $pdo->prepare("UPDATE rooms SET room_number=?, name=?, capacity=?, is_technical=?, room_type=?, gender=?, x_pos=?, y_pos=? WHERE id=?");
                        $stmt->execute([$roomNumber, $name, $capacity, $isTech, $type, $gender, $x, $y, $id]);
                    } else {
                        $stmt = $pdo->prepare("INSERT INTO rooms (floor_id, building_id, room_number, name, capacity, is_technical, room_type, gender, x_pos, y_pos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                        $stmt->execute([$floorId, $buildingId, $roomNumber, $name, $capacity, $isTech, $type, $gender, $x, $y]);
                    }
                }
                jsonResponse(['success' => true]);
            }

            jsonError('Метод не поддерживается', 405);
        }

        if ($uri === 'admin/all-rooms') {
            $stmt = $pdo->query("
                SELECT r.*, bu.name as building_name, f.floor_number
                FROM rooms r
                JOIN buildings bu ON r.building_id = bu.id
                JOIN floors f ON r.floor_id = f.id
                ORDER BY bu.id ASC, f.floor_number ASC, r.room_number ASC
            ");
            jsonResponse($stmt->fetchAll());
        }

        if ($uri === 'admin/room-bookings') {
            $roomId = (int)($_GET['room_id'] ?? 0);
            $stmt = $pdo->prepare("
                SELECT b.*, u.first_name, u.last_name, u.name as user_name, u.phone as user_phone
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.room_id = ? ORDER BY b.id DESC
            ");
            $stmt->execute([$roomId]);
            jsonResponse($stmt->fetchAll());
        }

        // Если ни один admin-маршрут не подошёл — 404
        jsonError('Маршрут не найден', 404);
    }

    // ─── 404 ──────────────────────────────────────────────────────────────────
    jsonError('Маршрут не найден', 404);

} catch (Exception $e) {
    jsonResponse(['error' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}