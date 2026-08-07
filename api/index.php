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

// Функция инициализации базы данных "с нуля"
function initFreshDatabase($pdo) {
    // Удаляем старые таблицы
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
          `name` VARCHAR(255) NULL,
          `login` VARCHAR(255) NOT NULL UNIQUE,
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
    $queries = [
        // settings
        "CREATE TABLE IF NOT EXISTS `settings` (
          `key` VARCHAR(50) NOT NULL PRIMARY KEY,
          `value` TEXT NULL,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
        "INSERT IGNORE INTO `settings` (`key`, `value`) VALUES ('site_title', 'Алабуга - форум 2025');",

        // users (если таблица не существует)
        "CREATE TABLE IF NOT EXISTS `users` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `first_name` VARCHAR(100) NULL,
          `last_name` VARCHAR(100) NULL,
          `name` VARCHAR(255) NULL,
          `login` VARCHAR(255) NOT NULL UNIQUE,
          `phone` VARCHAR(50) NULL,
          `password` VARCHAR(255) NOT NULL,
          `role` VARCHAR(50) NOT NULL DEFAULT 'user',
          `team_name` VARCHAR(100) NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // tokens
        "CREATE TABLE IF NOT EXISTS `tokens` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NOT NULL,
          `token` VARCHAR(255) NOT NULL UNIQUE,
          `expires_at` DATETIME NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        // buildings, floors, rooms, bookings
        "CREATE TABLE IF NOT EXISTS `buildings` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `name` VARCHAR(255) NOT NULL,
          `gender` ENUM('M', 'F', 'MIXED') NOT NULL DEFAULT 'MIXED',
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        "CREATE TABLE IF NOT EXISTS `floors` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `building_id` INT NOT NULL,
          `floor_number` INT NOT NULL,
          `width` INT NOT NULL DEFAULT 8,
          `start_room_number` INT NULL DEFAULT NULL,
          `room_order_type` VARCHAR(20) NOT NULL DEFAULT 'clockwise',
          `gender` ENUM('M', 'F', 'MIXED', 'DEFAULT') NOT NULL DEFAULT 'DEFAULT',
          `layout_data` LONGTEXT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        "CREATE TABLE IF NOT EXISTS `rooms` (
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
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        "CREATE TABLE IF NOT EXISTS `bookings` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NOT NULL,
          `room_id` INT NOT NULL,
          `status` ENUM('pending', 'rejected', 'approved', 'approved_bot') NOT NULL DEFAULT 'pending',
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
    ];

    foreach ($queries as $q) {
        try { $pdo->exec($q); } catch (Exception $e) {}
    }

    // Попытка добавить недостающие колонки (если таблица users была создана старой версией)
    try {
        $pdo->exec("ALTER TABLE `users` CHANGE `email` `login` VARCHAR(255) NOT NULL UNIQUE;");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE `users` ADD `phone` VARCHAR(50) NULL AFTER `login`;");
    } catch (Exception $e) {}
}

ensureTablesExist($pdo);

// Роутинг
$uri = '';
if (!empty($_GET['route'])) {
    $uri = $_GET['route'];
} elseif (!empty($_SERVER['PATH_INFO'])) {
    $uri = $_SERVER['PATH_INFO'];
} else {
    $requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $requestUri = preg_replace('/^.*?index\.php/i', '', $requestUri);
    $requestUri = preg_replace('/^\/api/i', '', $requestUri);
    $uri = $requestUri;
}
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
            'SELECT u.id, u.first_name, u.last_name, u.name, u.login, u.phone, u.role, u.team_name FROM users u 
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

// Вспомогательная функция генерации уникального логина
function generateUniqueLogin($pdo, $firstName, $lastName) {
    $base = strtolower(translit($firstName . '.' . $lastName));
    $base = preg_replace('/[^a-z0-9.]/', '', $base);
    if (strlen($base) < 3) $base = 'user';
    $login = $base;
    $i = 1;
    while (true) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE login = ?');
        $stmt->execute([$login]);
        if (!$stmt->fetch()) break;
        $login = $base . $i++;
    }
    return $login;
}

function translit($text) {
    $converter = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
        'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
        'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
        'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
        'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'c', 'ч' => 'ch',
        'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
        'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        'А' => 'A', 'Б' => 'B', 'В' => 'V', 'Г' => 'G', 'Д' => 'D',
        'Е' => 'E', 'Ё' => 'E', 'Ж' => 'Zh', 'З' => 'Z', 'И' => 'I',
        'Й' => 'Y', 'К' => 'K', 'Л' => 'L', 'М' => 'M', 'Н' => 'N',
        'О' => 'O', 'П' => 'P', 'Р' => 'R', 'С' => 'S', 'Т' => 'T',
        'У' => 'U', 'Ф' => 'F', 'Х' => 'H', 'Ц' => 'C', 'Ч' => 'Ch',
        'Ш' => 'Sh', 'Щ' => 'Sch', 'Ъ' => '', 'Ы' => 'Y', 'Ь' => '',
        'Э' => 'E', 'Ю' => 'Yu', 'Я' => 'Ya'
    ];
    return strtr($text, $converter);
}

try {
    switch ($uri) {
        case 'init-db':
            initFreshDatabase($pdo);
            echo json_encode([
                'success' => true,
                'message' => 'База данных успешно создана с нуля. Логин администратора: admin, пароль: admin123',
            ]);
            break;

        case 'settings':
            // без изменений
            break;

        case 'register':
            if ($method === 'POST') {
                $firstName = trim($input['first_name'] ?? '');
                $lastName = trim($input['last_name'] ?? '');
                $phone = trim($input['phone'] ?? '');
                $password = $input['password'] ?? '';

                if (empty($firstName) || empty($lastName) || empty($phone) || empty($password)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Все поля обязательны']);
                    break;
                }

                // Проверяем уникальность телефона
                $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ?');
                $stmt->execute([$phone]);
                if ($stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Пользователь с таким номером телефона уже существует']);
                    break;
                }

                $login = generateUniqueLogin($pdo, $firstName, $lastName);
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

                $stmt = $pdo->prepare('INSERT INTO users (first_name, last_name, name, login, phone, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $name = $firstName . ' ' . $lastName;
                if ($stmt->execute([$firstName, $lastName, $name, $login, $phone, $hashedPassword, 'user'])) {
                    $userId = $pdo->lastInsertId();

                    // Создаем токен
                    $newToken = generateToken($userId);
                    $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
                    $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                    $stmt->execute([$userId, $newToken, $expiresAt]);

                    echo json_encode([
                        'success' => true,
                        'token' => $newToken,
                        'user' => [
                            'id' => $userId,
                            'first_name' => $firstName,
                            'last_name' => $lastName,
                            'name' => $name,
                            'login' => $login,
                            'phone' => $phone,
                            'role' => 'user'
                        ]
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode(['error' => 'Не удалось создать пользователя']);
                }
            }
            break;

        case 'login':
            if ($method === 'POST') {
                $identifier = trim($input['identifier'] ?? ''); // логин или телефон
                $password = $input['password'] ?? '';

                if (empty($identifier) || empty($password)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Логин/телефон и пароль обязательны']);
                    break;
                }

                $stmt = $pdo->prepare('SELECT * FROM users WHERE login = ? OR phone = ?');
                $stmt->execute([$identifier, $identifier]);
                $user = $stmt->fetch();

                if (!$user || !password_verify($password, $user['password'])) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Неверный логин/телефон или пароль']);
                    break;
                }

                $newToken = generateToken($user['id']);
                $stmt = $pdo->prepare('DELETE FROM tokens WHERE user_id = ?');
                $stmt->execute([$user['id']]);

                $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
                $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                $stmt->execute([$user['id'], $newToken, $expiresAt]);

                // Убираем пароль из ответа
                unset($user['password']);

                echo json_encode([
                    'success' => true,
                    'token' => $newToken,
                    'user' => $user
                ]);
            }
            break;

        case 'user':
            // без изменений (только возвращает login, phone)
            break;

        case 'admin/users':
            // обновляем запрос на получение пользователей, т.к. поле email теперь login
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT id, first_name, last_name, name, login, phone, role, team_name, created_at FROM users ORDER BY id DESC');
                $users = $stmt->fetchAll();
                echo json_encode($users);
            } elseif ($method === 'POST') {
                // обновляем логику – field email заменяем на login
                $id = $input['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Не указан ID пользователя']);
                    break;
                }
                $firstName = $input['first_name'] ?? '';
                $lastName = $input['last_name'] ?? '';
                $phone = $input['phone'] ?? '';
                $login = $input['login'] ?? '';
                $role = $input['role'] ?? 'user';
                $teamName = $input['team_name'] ?? '';

                $sql = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?, login = ?, role = ?, team_name = ?';
                $params = [$firstName, $lastName, $phone, $login, $role, $teamName];

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

        // остальные маршруты без изменений (кроме тех, где используется email – там меняем на login/phone)

        // ... остальные эндпоинты (admin/bookings и т.д.) уже используют join и не зависят от email напрямую, поэтому их оставляем

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