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
        DROP TABLE IF EXISTS `team_events`;
        DROP TABLE IF EXISTS `team_messages`;
        DROP TABLE IF EXISTS `teams`;
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

        CREATE TABLE `teams` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `name` VARCHAR(255) NOT NULL UNIQUE,
          `description` TEXT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `users` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `first_name` VARCHAR(100) NULL,
          `last_name` VARCHAR(100) NULL,
          `name` VARCHAR(255) NOT NULL,
          `login` VARCHAR(100) NOT NULL UNIQUE,
          `phone` VARCHAR(50) NULL,
          `password` VARCHAR(255) NOT NULL,
          `role` VARCHAR(50) NOT NULL DEFAULT 'user',
          `team_id` INT NULL,
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

        CREATE TABLE `team_messages` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `team_id` INT NOT NULL,
          `user_id` INT NOT NULL,
          `message` TEXT NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
          FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE `team_events` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `team_id` INT NOT NULL,
          `title` VARCHAR(255) NOT NULL,
          `description` TEXT NULL,
          `event_date` DATE NOT NULL,
          `event_time` TIME NULL,
          `created_by` INT NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
          FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    $pdo->exec($sql);

    $adminPassword = password_hash('admin123', PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO `users` (`first_name`, `last_name`, `name`, `login`, `phone`, `password`, `role`) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute(['Админ', 'Главный', 'Администратор', 'admin', '+79990000000', $adminPassword, 'admin']);
}

function ensureTablesExist($pdo) {
    try {
        $pdo->query("SELECT 1 FROM `users` LIMIT 1");
    } catch (Exception $e) {
        initFreshDatabase($pdo);
    }
}

ensureTablesExist($pdo);

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

function generateToken($userId) {
    return bin2hex(random_bytes(32));
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];

$uri = $_GET['route'] ?? '';
if (!$uri) {
    $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri = trim(preg_replace('#^/api/?#', '', $requestUri), '/');
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($uri === 'init-db') {
        initFreshDatabase($pdo);
        echo json_encode(['success' => true, 'message' => 'База данных успешно инициализирована заново. Логин: admin / Пароль: admin123']);
        exit();
    }

    if ($uri === 'settings') {
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'site_title'");
            $stmt->execute();
            $val = $stmt->fetchColumn();
            echo json_encode(['site_title' => $val ?: 'Алабуга - форум 2025']);
        } else if ($method === 'POST') {
            $user = getAuthUser($pdo);
            if (!$user || $user['role'] !== 'admin') {
                http_response_code(403);
                echo json_encode(['error' => 'Доступ запрещён']);
                exit();
            }
            $title = trim($data['site_title'] ?? '');
            if (!$title) {
                http_response_code(400);
                echo json_encode(['error' => 'Название сайта не может быть пустым']);
                exit();
            }
            $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES ('site_title', ?) ON DUPLICATE KEY UPDATE `value` = ?");
            $stmt->execute([$title, $title]);
            echo json_encode(['success' => true, 'site_title' => $title]);
        }
        exit();
    }

    // ==== Авторизация ====
    if ($uri === 'login') {
        if ($method === 'POST') {
            $loginInput = trim($data['login'] ?? $data['phone'] ?? $data['email'] ?? '');
            $password = trim($data['password'] ?? '');
            if (!$loginInput || !$password) {
                http_response_code(400);
                echo json_encode(['error' => 'Заполните логин/телефон и пароль']);
                exit();
            }
            $phoneDigits = preg_replace('/\D/', '', $loginInput);
            $stmt = $pdo->prepare("
                SELECT * FROM users 
                WHERE login = :input 
                   OR phone = :input 
                   OR (CHAR_LENGTH(:digits) >= 10 AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '(', ''), ')', ''), '-', '') LIKE CONCAT('%', :digits))
                LIMIT 1
            ");
            $stmt->execute(['input' => $loginInput, 'digits' => $phoneDigits]);
            $user = $stmt->fetch();
            if (!$user || !password_verify($password, $user['password'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Неверный логин/телефон или пароль']);
                exit();
            }
            $token = generateToken($user['id']);
            $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
            $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
            $stmt->execute([$user['id'], $token, $expiresAt]);
            unset($user['password']);
            echo json_encode(['token' => $token, 'user' => $user]);
        }
        exit();
    }

    if ($uri === 'register') {
        if ($method === 'POST') {
            $firstName = trim($data['first_name'] ?? '');
            $lastName = trim($data['last_name'] ?? '');
            $phone = trim($data['phone'] ?? '');
            $password = trim($data['password'] ?? '');
            if (!$firstName || !$lastName || !$phone || !$password) {
                http_response_code(400);
                echo json_encode(['error' => 'Все поля обязательны для заполнения']);
                exit();
            }
            $phoneDigits = preg_replace('/\D/', '', $phone);
            if (strlen($phoneDigits) < 10) {
                http_response_code(400);
                echo json_encode(['error' => 'Укажите корректный номер телефона']);
                exit();
            }
            $autoLogin = 'u' . substr($phoneDigits, -8);
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
            $stmt->execute([$autoLogin]);
            if ($stmt->fetchColumn() > 0) {
                $autoLogin = 'u' . $phoneDigits;
            }
            $fullName = $lastName . ' ' . $firstName;
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            try {
                $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, name, login, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, 'user')");
                $stmt->execute([$firstName, $lastName, $fullName, $autoLogin, $phone, $hashedPassword]);
                $userId = $pdo->lastInsertId();
                $token = generateToken($userId);
                $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $token, $expiresAt]);
                $userData = [
                    'id' => $userId,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'name' => $fullName,
                    'login' => $autoLogin,
                    'phone' => $phone,
                    'role' => 'user',
                    'password' => $password
                ];
                echo json_encode(['token' => $token, 'user' => $userData]);
            } catch (PDOException $e) {
                http_response_code(400);
                echo json_encode(['error' => 'Пользователь с таким номером телефона или логином уже зарегистрирован']);
            }
        }
        exit();
    }

    if ($uri === 'user') {
        $user = getAuthUser($pdo);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Не авторизован']);
            exit();
        }
        unset($user['password']);
        echo json_encode($user);
        exit();
    }

    if ($uri === 'logout') {
        $token = getBearerToken();
        if ($token) {
            $stmt = $pdo->prepare("DELETE FROM tokens WHERE token = ?");
            $stmt->execute([$token]);
        }
        echo json_encode(['success' => true]);
        exit();
    }

    // ==== Админ-панель ====
    if (strpos($uri, 'admin/') === 0) {
        $user = getAuthUser($pdo);
        if (!$user || !in_array($user['role'], ['admin', 'moderator'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Доступ запрещён']);
            exit();
        }

        // Пользователи
        if ($uri === 'admin/users') {
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT id, first_name, last_name, name, login as email, phone, role, team_id, created_at FROM users ORDER BY id DESC");
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $id = (int)($data['id'] ?? 0);
                $firstName = trim($data['first_name'] ?? '');
                $lastName = trim($data['last_name'] ?? '');
                $phone = trim($data['phone'] ?? '');
                $login = trim($data['email'] ?? $data['login'] ?? '');
                $role = trim($data['role'] ?? 'user');
                $teamId = isset($data['team_id']) ? (int)$data['team_id'] : null;
                $password = trim($data['password'] ?? '');
                if ($id > 0) {
                    $fullName = $lastName . ' ' . $firstName;
                    if ($password) {
                        $hash = password_hash($password, PASSWORD_DEFAULT);
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, name=?, phone=?, login=?, role=?, team_id=?, password=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $fullName, $phone, $login, $role, $teamId, $hash, $id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, name=?, phone=?, login=?, role=?, team_id=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $fullName, $phone, $login, $role, $teamId, $id]);
                    }
                    echo json_encode(['success' => true]);
                }
            }
            exit();
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
            echo json_encode(['current_booking' => $current, 'bookings_history' => $history]);
            exit();
        }

        // Бронирования
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
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $id = (int)($data['id'] ?? 0);
                $roomId = (int)($data['room_id'] ?? 0);
                $status = trim($data['status'] ?? 'pending');
                if ($id > 0) {
                    $stmt = $pdo->prepare("UPDATE bookings SET room_id = ?, status = ? WHERE id = ?");
                    $stmt->execute([$roomId, $status, $id]);
                    echo json_encode(['success' => true]);
                }
            }
            exit();
        }

        // Корпуса
        if ($uri === 'admin/buildings') {
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM buildings ORDER BY id ASC");
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM buildings WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true]);
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
                    echo json_encode(['success' => true]);
                }
            }
            exit();
        }

        // Этажи
        if ($uri === 'admin/floors') {
            if ($method === 'GET') {
                $buildingId = (int)($_GET['building_id'] ?? 0);
                $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
                $stmt->execute([$buildingId]);
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM floors WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true]);
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
                    echo json_encode(['success' => true]);
                }
            }
            exit();
        }

        // Комнаты
        if ($uri === 'admin/rooms') {
            if ($method === 'GET') {
                $floorId = (int)($_GET['floor_id'] ?? 0);
                $stmt = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? ORDER BY y_pos ASC, x_pos ASC");
                $stmt->execute([$floorId]);
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM rooms WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true]);
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
                    echo json_encode(['success' => true]);
                }
            }
            exit();
        }

        if ($uri === 'admin/all-rooms') {
            $stmt = $pdo->query("
                SELECT r.*, bu.name as building_name, f.floor_number 
                FROM rooms r 
                JOIN buildings bu ON r.building_id = bu.id 
                JOIN floors f ON r.floor_id = f.id 
                ORDER BY bu.id ASC, f.floor_number ASC, r.room_number ASC
            ");
            echo json_encode($stmt->fetchAll());
            exit();
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
            echo json_encode($stmt->fetchAll());
            exit();
        }

        // ==== Команды ====
        if ($uri === 'admin/teams') {
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM teams ORDER BY id ASC");
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true]);
                } else {
                    $id = (int)($data['id'] ?? 0);
                    $name = trim($data['name'] ?? '');
                    $description = trim($data['description'] ?? '');
                    if (!$name) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Название команды обязательно']);
                        exit();
                    }
                    if ($id > 0) {
                        $stmt = $pdo->prepare("UPDATE teams SET name = ?, description = ? WHERE id = ?");
                        $stmt->execute([$name, $description, $id]);
                    } else {
                        $stmt = $pdo->prepare("INSERT INTO teams (name, description) VALUES (?, ?)");
                        $stmt->execute([$name, $description]);
                    }
                    echo json_encode(['success' => true]);
                }
            }
            exit();
        }

        if ($uri === 'admin/team-users') {
            $teamId = (int)($_GET['team_id'] ?? 0);
            $stmt = $pdo->prepare("SELECT id, first_name, last_name, name, phone, role FROM users WHERE team_id = ?");
            $stmt->execute([$teamId]);
            echo json_encode($stmt->fetchAll());
            exit();
        }

        if ($uri === 'admin/team-messages') {
            if ($method === 'GET') {
                $teamId = (int)($_GET['team_id'] ?? 0);
                $stmt = $pdo->prepare("
                    SELECT m.*, u.first_name, u.last_name, u.name as user_name 
                    FROM team_messages m 
                    JOIN users u ON m.user_id = u.id 
                    WHERE m.team_id = ? ORDER BY m.created_at ASC
                ");
                $stmt->execute([$teamId]);
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $teamId = (int)($data['team_id'] ?? 0);
                $message = trim($data['message'] ?? '');
                if (!$message) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Сообщение не может быть пустым']);
                    exit();
                }
                $stmt = $pdo->prepare("INSERT INTO team_messages (team_id, user_id, message) VALUES (?, ?, ?)");
                $stmt->execute([$teamId, $user['id'], $message]);
                echo json_encode(['success' => true]);
            }
            exit();
        }

        if ($uri === 'admin/team-events') {
            if ($method === 'GET') {
                $teamId = (int)($_GET['team_id'] ?? 0);
                $stmt = $pdo->prepare("SELECT * FROM team_events WHERE team_id = ? ORDER BY event_date ASC, event_time ASC");
                $stmt->execute([$teamId]);
                echo json_encode($stmt->fetchAll());
            } else if ($method === 'POST') {
                $action = $data['action'] ?? '';
                if ($action === 'delete') {
                    $id = (int)($data['id'] ?? 0);
                    $stmt = $pdo->prepare("DELETE FROM team_events WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true]);
                } else {
                    $teamId = (int)($data['team_id'] ?? 0);
                    $title = trim($data['title'] ?? '');
                    $description = trim($data['description'] ?? '');
                    $eventDate = trim($data['event_date'] ?? '');
                    $eventTime = isset($data['event_time']) ? trim($data['event_time']) : null;
                    if (!$title || !$eventDate) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Название и дата обязательны']);
                        exit();
                    }
                    $stmt = $pdo->prepare("INSERT INTO team_events (team_id, title, description, event_date, event_time, created_by) VALUES (?, ?, ?, ?, ?, ?)");
                    $stmt->execute([$teamId, $title, $description, $eventDate, $eventTime, $user['id']]);
                    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
                }
            }
            exit();
        }
    }

    http_response_code(404);
    echo json_encode(['error' => 'Маршрут не найден']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка сервера: ' . $e->getMessage()]);
}