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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        INSERT INTO `settings` (`key`, `value`) VALUES ('site_title', 'Алабуга - форум 2025');

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

        CREATE TABLE `tokens` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NOT NULL,
          `token` VARCHAR(255) NOT NULL UNIQUE,
          `expires_at` DATETIME NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE `buildings` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `name` VARCHAR(255) NOT NULL,
          `gender` ENUM('M', 'F') NOT NULL DEFAULT 'M',
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    ";

    $pdo->exec($sql);

    // Добавляем аккаунт администратора по умолчанию
    $adminPassword = password_hash('admin123', PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO `users` (`first_name`, `last_name`, `name`, `email`, `phone`, `password`, `role`, `team_name`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(['Админ', 'Главный', 'Администратор', 'admin@alabuga.ru', '+79990000000', $adminPassword, 'admin', 'Оргкомитет']);
}

// Автоматически создаем таблицы, если их нет
try {
    $pdo->query("SELECT 1 FROM `users` LIMIT 1");
} catch (Exception $e) {
    initFreshDatabase($pdo);
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = str_replace('/api', '', $uri);
$uri = str_replace('/index.php', '', $uri);
$uri = trim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'];

$input = json_decode(file_get_contents('php://input'), true) ?? [];

function getBearerToken() {
    $authHeader = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } else {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    }
    if (preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        return $matches[1];
    }
    return '';
}

$token = getBearerToken();

function generateToken($userId) {
    return bin2hex(random_bytes(32)) . '_' . $userId . '_' . time();
}

function getUserByToken($pdo, $token) {
    if (empty($token)) return null;
    try {
        $stmt = $pdo->prepare(
            'SELECT u.id, u.first_name, u.last_name, u.name, u.email, u.phone, u.role, u.team_name FROM users u 
             INNER JOIN tokens t ON u.id = t.user_id 
             WHERE t.token = ? AND t.expires_at > NOW()'
        );
        $stmt->execute([$token]);
        return $stmt->fetch() ?: null;
    } catch (Exception $e) {
        return null;
    }
}

function checkAdmin($pdo, $token) {
    $user = getUserByToken($pdo, $token);
    $role = strtolower(trim($user['role'] ?? ''));
    if (!$user || ($role !== 'admin' && $role !== 'moderator')) {
        http_response_code(403);
        echo json_encode(['error' => 'Недостаточно прав доступа']);
        exit();
    }
    return $user;
}

// Главная логика маршрутизации
try {
    switch ($uri) {
        case 'init-db':
            initFreshDatabase($pdo);
            echo json_encode([
                'success' => true,
                'message' => 'База данных успешно пересоздана с нуля!',
                'default_admin' => [
                    'email' => 'admin@alabuga.ru',
                    'password' => 'admin123'
                ]
            ]);
            break;

        case 'settings':
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT `key`, `value` FROM settings');
                $settings = [];
                while ($row = $stmt->fetch()) {
                    $settings[$row['key']] = $row['value'];
                }
                if (!isset($settings['site_title'])) {
                    $settings['site_title'] = 'Алабуга - форум 2025';
                }
                echo json_encode($settings);
            } elseif ($method === 'POST') {
                checkAdmin($pdo, $token);
                $siteTitle = trim($input['site_title'] ?? '');
                if (!empty($siteTitle)) {
                    $stmt = $pdo->prepare('INSERT INTO settings (`key`, `value`) VALUES ("site_title", ?) ON DUPLICATE KEY UPDATE `value` = ?');
                    $stmt->execute([$siteTitle, $siteTitle]);
                }
                echo json_encode(['success' => true]);
            }
            break;

        case 'register':
            if ($method === 'POST') {
                $name = $input['name'] ?? '';
                $email = $input['email'] ?? '';
                $password = $input['password'] ?? '';
                
                if (empty($email) || empty($password)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Email и пароль обязательны']);
                    break;
                }
                
                $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
                $stmt->execute([$email]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Пользователь с таким email уже существует']);
                    break;
                }
                
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
                
                if ($stmt->execute([$name, $email, $hashedPassword, 'user'])) {
                    $userId = $pdo->lastInsertId();
                    $newToken = generateToken($userId);
                    
                    $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
                    $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                    $stmt->execute([$userId, $newToken, $expiresAt]);
                    
                    echo json_encode([
                        'success' => true,
                        'token' => $newToken,
                        'user' => [
                            'id' => $userId,
                            'name' => $name,
                            'email' => $email,
                            'role' => 'user'
                        ]
                    ]);
                }
            }
            break;
            
        case 'login':
            if ($method === 'POST') {
                $email = $input['email'] ?? '';
                $password = $input['password'] ?? '';
                
                $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
                $stmt->execute([$email]);
                $user = $stmt->fetch();
                
                if (!$user || !password_verify($password, $user['password'])) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Неверный email или пароль']);
                    break;
                }
                
                $newToken = generateToken($user['id']);
                $stmt = $pdo->prepare('DELETE FROM tokens WHERE user_id = ?');
                $stmt->execute([$user['id']]);
                
                $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
                $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                $stmt->execute([$user['id'], $newToken, $expiresAt]);
                
                echo json_encode([
                    'success' => true,
                    'token' => $newToken,
                    'user' => $user
                ]);
            }
            break;
            
        case 'user':
            if ($method === 'GET') {
                $user = getUserByToken($pdo, $token);
                if ($user) {
                    echo json_encode($user);
                } else {
                    http_response_code(401);
                    echo json_encode(['error' => 'Не авторизован']);
                }
            }
            break;

        // ----- УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (АДМИНКА) -----
        case 'admin/users':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT id, first_name, last_name, name, email, phone, role, team_name, created_at FROM users ORDER BY id DESC');
                $users = $stmt->fetchAll();
                echo json_encode($users);
            } elseif ($method === 'POST') {
                $id = $input['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Не указан ID пользователя']);
                    break;
                }
                $firstName = $input['first_name'] ?? '';
                $lastName = $input['last_name'] ?? '';
                $phone = $input['phone'] ?? '';
                $email = $input['email'] ?? '';
                $role = $input['role'] ?? 'user';
                $teamName = $input['team_name'] ?? '';

                $sql = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?, email = ?, role = ?, team_name = ?';
                $params = [$firstName, $lastName, $phone, $email, $role, $teamName];

                if (!empty($input['password'])) {
                    $sql .= ', password = ?';
                    $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
                }

                $sql .= ' WHERE id = ?';
                $params[] = $id;

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                echo json_encode(['success' => true]);
            }
            break;

        case 'admin/user-details':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $userId = $_GET['id'] ?? null;
                if (!$userId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'ID пользователя не указан']);
                    break;
                }

                $stmt = $pdo->prepare('
                    SELECT b.id, b.status, b.created_at, r.room_number, r.name as room_name,
                           fl.floor_number, bu.name as building_name
                    FROM bookings b
                    LEFT JOIN rooms r ON b.room_id = r.id
                    LEFT JOIN floors fl ON r.floor_id = fl.id
                    LEFT JOIN buildings bu ON r.building_id = bu.id
                    WHERE b.user_id = ? ORDER BY b.created_at DESC
                ');
                $stmt->execute([$userId]);
                $bookings = $stmt->fetchAll();

                $currentBooking = !empty($bookings) ? $bookings[0] : null;

                echo json_encode([
                    'current_booking' => $currentBooking,
                    'bookings_history' => $bookings
                ]);
            }
            break;

        // ----- УПРАВЛЕНИЕ БРОНИРОВАНИЯМИ (АДМИНКА) -----
        case 'admin/bookings':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $stmt = $pdo->query('
                    SELECT b.id, b.status, b.created_at, b.user_id, b.room_id,
                           u.first_name, u.last_name, u.name as user_name, u.email as user_email, u.phone as user_phone,
                           r.room_number, r.name as room_name, r.gender as room_gender,
                           fl.id as floor_id, fl.floor_number, fl.gender as floor_gender,
                           bu.id as building_id, bu.name as building_name, bu.gender as building_gender
                    FROM bookings b
                    JOIN users u ON b.user_id = u.id
                    JOIN rooms r ON b.room_id = r.id
                    JOIN floors fl ON r.floor_id = fl.id
                    JOIN buildings bu ON r.building_id = bu.id
                    ORDER BY b.id DESC
                ');
                $bookings = $stmt->fetchAll();

                foreach ($bookings as &$b) {
                    $gender = $b['room_gender'];
                    if ($gender === 'DEFAULT') {
                        $gender = $b['floor_gender'];
                    }
                    if ($gender === 'DEFAULT') {
                        $gender = $b['building_gender'];
                    }
                    $b['gender'] = $gender;
                }

                echo json_encode($bookings);
            } elseif ($method === 'POST') {
                $id = $input['id'] ?? null;
                $status = $input['status'] ?? 'pending';
                $roomId = $input['room_id'] ?? null;

                if (!$id || !$roomId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Не заполнены обязательные поля']);
                    break;
                }

                $stmt = $pdo->prepare('UPDATE bookings SET status = ?, room_id = ? WHERE id = ?');
                $stmt->execute([$status, $roomId, $id]);

                if (isset($input['user_id'])) {
                    $uStmt = $pdo->prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?');
                    $uStmt->execute([
                        $input['first_name'] ?? '',
                        $input['last_name'] ?? '',
                        $input['phone'] ?? '',
                        $input['user_id']
                    ]);
                }

                echo json_encode(['success' => true]);
            }
            break;

        // ----- КОРПУСА, ЭТАЖИ И КОМНАТЫ -----
        case 'admin/buildings':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT * FROM buildings ORDER BY id ASC');
                echo json_encode($stmt->fetchAll());
            } elseif ($method === 'POST') {
                $name = $input['name'] ?? 'Новый корпус';
                $gender = $input['gender'] ?? 'M';

                if (isset($input['id'])) {
                    $stmt = $pdo->prepare('UPDATE buildings SET name = ?, gender = ? WHERE id = ?');
                    $stmt->execute([$name, $gender, $input['id']]);
                    echo json_encode(['success' => true]);
                } else {
                    $stmt = $pdo->prepare('INSERT INTO buildings (name, gender) VALUES (?, ?)');
                    $stmt->execute([$name, $gender]);
                    $bId = $pdo->lastInsertId();

                    $fStmt = $pdo->prepare('INSERT INTO floors (building_id, floor_number, width, gender) VALUES (?, 1, 8, "DEFAULT")');
                    $fStmt->execute([$bId]);

                    echo json_encode(['success' => true, 'id' => $bId]);
                }
            }
            break;

        case 'admin/floors':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $buildingId = $_GET['building_id'] ?? null;
                if (!$buildingId) {
                    echo json_encode([]);
                    break;
                }
                $stmt = $pdo->prepare('SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC');
                $stmt->execute([$buildingId]);
                echo json_encode($stmt->fetchAll());
            } elseif ($method === 'POST') {
                $buildingId = $input['building_id'] ?? null;
                $floorNumber = $input['floor_number'] ?? 1;
                $width = $input['width'] ?? 8;
                $gender = $input['gender'] ?? 'DEFAULT';

                if (isset($input['id'])) {
                    $stmt = $pdo->prepare('UPDATE floors SET width = ?, gender = ? WHERE id = ?');
                    $stmt->execute([$width, $gender, $input['id']]);
                } else {
                    $stmt = $pdo->prepare('INSERT INTO floors (building_id, floor_number, width, gender) VALUES (?, ?, ?, ?)');
                    $stmt->execute([$buildingId, $floorNumber, $width, $gender]);
                }
                echo json_encode(['success' => true]);
            }
            break;

        case 'admin/rooms':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $floorId = $_GET['floor_id'] ?? null;
                if (!$floorId) {
                    echo json_encode([]);
                    break;
                }
                $stmt = $pdo->prepare('SELECT * FROM rooms WHERE floor_id = ?');
                $stmt->execute([$floorId]);
                echo json_encode($stmt->fetchAll());
            } elseif ($method === 'POST') {
                $id = $input['id'] ?? null;
                $floorId = $input['floor_id'] ?? null;
                $buildingId = $input['building_id'] ?? null;
                $roomNumber = $input['room_number'] ?? '';
                $name = $input['name'] ?? '';
                $capacity = $input['capacity'] ?? 2;
                $isTechnical = isset($input['is_technical']) ? (int)$input['is_technical'] : 0;
                $gender = $input['gender'] ?? 'DEFAULT';
                $xPos = $input['x_pos'] ?? 0;
                $yPos = $input['y_pos'] ?? 0;

                if ($id) {
                    $stmt = $pdo->prepare('
                        UPDATE rooms 
                        SET room_number = ?, name = ?, capacity = ?, is_technical = ?, gender = ?, x_pos = ?, y_pos = ?
                        WHERE id = ?
                    ');
                    $stmt->execute([$roomNumber, $name, $capacity, $isTechnical, $gender, $xPos, $yPos, $id]);
                } else {
                    $stmt = $pdo->prepare('
                        INSERT INTO rooms (floor_id, building_id, room_number, name, capacity, is_technical, gender, x_pos, y_pos)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ');
                    $stmt->execute([$floorId, $buildingId, $roomNumber, $name, $capacity, $isTechnical, $gender, $xPos, $yPos]);
                }
                echo json_encode(['success' => true]);
            }
            break;

        case 'admin/all-rooms':
            checkAdmin($pdo, $token);
            if ($method === 'GET') {
                $stmt = $pdo->query('
                    SELECT r.id, r.room_number, r.name, fl.floor_number, bu.name as building_name
                    FROM rooms r
                    JOIN floors fl ON r.floor_id = fl.id
                    JOIN buildings bu ON r.building_id = bu.id
                    ORDER BY bu.name, fl.floor_number, r.room_number
                ');
                echo json_encode($stmt->fetchAll());
            }
            break;

        case 'logout':
            if ($method === 'POST') {
                if (!empty($token)) {
                    $stmt = $pdo->prepare('DELETE FROM tokens WHERE token = ?');
                    $stmt->execute([$token]);
                }
                echo json_encode(['success' => true]);
            }
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Метод не найден: ' . $uri]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
}
?>