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

    // Автоматическое создание таблицы привязки кураторов к командам
    $pdo->exec("CREATE TABLE IF NOT EXISTS curator_teams (
        user_id INT NOT NULL,
        team_id INT NOT NULL,
        PRIMARY KEY (user_id, team_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    try {
        $pdo->exec("ALTER TABLE curator_teams DROP INDEX unique_curator_team");
    } catch (PDOException $ex) {}

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка подключения к базе данных: ' . $e->getMessage()]);
    exit();
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function detectGenderByLastName($lastName) {
    $lastName = trim((string)$lastName);
    if ($lastName === '') return null;
    $lastNameLower = mb_strtolower($lastName, 'UTF-8');

    if (
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ая' ||
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'яя' ||
        mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ова' ||
        mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ева' ||
        mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ина' ||
        mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ына' ||
        mb_substr($lastNameLower, -4, 4, 'UTF-8') === 'ская' ||
        mb_substr($lastNameLower, -4, 4, 'UTF-8') === 'цкая'
    ) {
        return 'F';
    }

    if (
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ов' ||
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ев' ||
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ин' ||
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ын' ||
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ий' ||
        mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ый' ||
        mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ский' ||
        mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'цкий'
    ) {
        return 'M';
    }

    $lastChar = mb_substr($lastNameLower, -1, 1, 'UTF-8');
    if ($lastChar === 'а' || $lastChar === 'я') {
        return 'F';
    }

    if (in_array($lastChar, ['б','в','г','д','ж','з','к','л','м','н','п','р','с','т','ф','х','ц','ч','ш','щ','й'], true)) {
        return 'M';
    }

    return null;
}

function generatePassword($length = 8) {
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $password = '';
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $password;
}

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
    if (!in_array($role, ['admin', 'curator', 'moderator'])) jsonError('Доступ запрещён', 403);
    return $user;
}

function requireStrictAdmin($pdo) {
    $user = requireAuth($pdo);
    $role = strtolower(trim($user['role']));
    if ($role !== 'admin') jsonError('Доступ только для администраторов', 403);
    return $user;
}

function getCuratorTeams($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) return [];
    $role = strtolower(trim($user['role']));
    if ($role === 'admin') return null;
    
    if ($role === 'curator' || $role === 'moderator') {
        $stmt = $pdo->prepare("SELECT team_id FROM curator_teams WHERE user_id = ?");
        $stmt->execute([$userId]);
        $teams = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        if (in_array(0, $teams, true)) {
            return null;
        }
        return $teams;
    }
    return [];
}

function checkCuratorAccessToUser($pdo, $curatorId, $targetUserId) {
    $curatorTeams = getCuratorTeams($pdo, $curatorId);
    if ($curatorTeams === null) return true;
    
    $stmt = $pdo->prepare("SELECT team_id FROM users WHERE id = ?");
    $stmt->execute([$targetUserId]);
    $userTeamId = (int)$stmt->fetchColumn();

    return ($userTeamId === 0 || in_array($userTeamId, $curatorTeams, true));
}

function checkCuratorAccessToTeam($pdo, $curatorId, $teamId) {
    $curatorTeams = getCuratorTeams($pdo, $curatorId);
    if ($curatorTeams === null) return true;
    return in_array((int)$teamId, $curatorTeams, true);
}

function processAutoApproveBookings($pdo) {
    $settingStmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'auto-accept-bookings'");
    $settingStmt->execute();
    $enabledVal = $settingStmt->fetchColumn();
    if ($enabledVal !== '1' && $enabledVal !== 'true') {
        return ['executed' => false, 'message' => 'Автоодобрение отключено в настройках', 'approved_count' => 0];
    }

    $stmt = $pdo->query("
        SELECT b.id, b.user_id, b.room_id, u.last_name, u.first_name, u.name,
               r.gender as room_gender, f.gender as floor_gender, bu.gender as building_gender
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings bu ON r.building_id = bu.id
        WHERE b.status = 'pending' AND u.status = 'active'
    ");
    $pendingList = $stmt->fetchAll();

    $approvedCount = 0;
    $updateStmt = $pdo->prepare("UPDATE bookings SET status = 'approved_bot', comment = 'Одобрено автоматически ботом' WHERE id = ?");

    foreach ($pendingList as $row) {
        $roomEff = $row['room_gender'] !== 'DEFAULT' ? $row['room_gender'] : ($row['floor_gender'] !== 'DEFAULT' ? $row['floor_gender'] : $row['building_gender']);
        $userGender = detectGenderByLastName($row['last_name'] ?: $row['name']);

        if ($roomEff === 'MIXED' || $roomEff === 'DEFAULT' || $userGender === null || $roomEff === $userGender) {
            $updateStmt->execute([$row['id']]);
            $approvedCount++;
        }
    }

    return ['executed' => true, 'approved_count' => $approvedCount];
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

// Перенаправление всех вызовов к боту ВК в отдельный модуль
if (strpos($uri, 'admin/vk-bot') === 0 || strpos($uri, 'vk-bot') === 0) {
    require_once __DIR__ . '/vk_bot.php';
    exit();
}

try {

    // ─── Автоодобрение бронирований ───────────────────────────────────────

    if ($uri === 'admin/auto-approve' || $uri === 'auto-approve-bookings') {
        $res = processAutoApproveBookings($pdo);
        jsonResponse($res);
    }

    // ─── Статистика для админ-панели ──────────────────────────────────────

    if ($uri === 'admin/stats') {
        $user = requireAdmin($pdo);

        $buildingsCount = (int)$pdo->query("SELECT COUNT(*) FROM buildings")->fetchColumn();
        $roomsCount = (int)$pdo->query("SELECT COUNT(*) FROM rooms WHERE is_technical = 0 AND room_type = 'room'")->fetchColumn();
        $totalSeats = (int)$pdo->query("SELECT COALESCE(SUM(capacity), 0) FROM rooms WHERE is_technical = 0 AND room_type = 'room'")->fetchColumn();

        $occupiedStmt = $pdo->query("
            SELECT COUNT(DISTINCT b.user_id)
            FROM bookings b
            WHERE b.status IN ('approved', 'approved_bot', 'pending')
        ");
        $occupiedSeats = (int)$occupiedStmt->fetchColumn();

        $totalBookings = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status NOT IN ('archived', 'recalled')")->fetchColumn();

        $statusStmt = $pdo->query("
            SELECT status, COUNT(*) as cnt
            FROM bookings
            WHERE status NOT IN ('archived', 'recalled')
            GROUP BY status
        ");
        $statusCounts = ['pending' => 0, 'approved' => 0, 'approved_bot' => 0, 'rejected' => 0];
        foreach ($statusStmt->fetchAll() as $row) {
            if (isset($statusCounts[$row['status']])) {
                $statusCounts[$row['status']] = (int)$row['cnt'];
            }
        }

        $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active' AND role <> 'admin'")->fetchColumn();

        jsonResponse([
            'buildings' => $buildingsCount,
            'rooms' => $roomsCount,
            'total_seats' => $totalSeats,
            'occupied_seats' => $occupiedSeats,
            'total_bookings' => $totalBookings,
            'status_counts' => $statusCounts,
            'active_users' => $activeUsers,
        ]);
    }

    // ─── Экспорт всех бронирований ────────────────────────────────────────

    if ($uri === 'admin/export/bookings') {
        $user = requireStrictAdmin($pdo);
        $stmt = $pdo->query("
            SELECT b.id, b.status, b.created_at, b.updated_at,
                   u.last_name, u.first_name, u.patronymic, u.phone as user_phone, u.login, u.team_name,
                   bu.name as building_name, f.floor_number, f.id as floor_id,
                   r.room_number, r.capacity, r.gender
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN rooms r ON b.room_id = r.id
            JOIN buildings bu ON r.building_id = bu.id
            JOIN floors f ON r.floor_id = f.id
            ORDER BY b.id DESC
        ");
        jsonResponse($stmt->fetchAll());
    }

    // ─── Экспорт макетов всех корпусов ────────────────────────────────────

    if ($uri === 'admin/export/layouts') {
        $user = requireStrictAdmin($pdo);
        $buildings = $pdo->query("SELECT * FROM buildings ORDER BY id ASC")->fetchAll();
        $result = [];

        foreach ($buildings as $building) {
            $floors = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
            $floors->execute([$building['id']]);
            $floorsData = [];

            foreach ($floors->fetchAll() as $floor) {
                $rooms = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? ORDER BY y_pos ASC, x_pos ASC");
                $rooms->execute([$floor['id']]);
                $floorsData[] = [
                    'id' => (int)$floor['id'],
                    'floor_number' => (int)$floor['floor_number'],
                    'width' => (int)$floor['width'],
                    'start_room_number' => $floor['start_room_number'],
                    'room_order_type' => $floor['room_order_type'],
                    'gender' => $floor['gender'],
                    'rooms' => $rooms->fetchAll(),
                ];
            }

            $result[] = [
                'id' => (int)$building['id'],
                'name' => $building['name'],
                'gender' => $building['gender'],
                'floors' => $floorsData,
            ];
        }

        jsonResponse($result);
    }

    // ─── Настройки ─────────────────────────────────────────────────────────

    if ($uri === 'settings') {
        if ($method === 'GET') {
            $stmt = $pdo->query("SELECT `key`, `value` FROM settings");
            $rows = $stmt->fetchAll();
            $settings = [];
            foreach ($rows as $row) {
                $settings[$row['key']] = $row['value'];
            }
            jsonResponse($settings);
        }

        if ($method === 'POST') {
            $user = requireStrictAdmin($pdo);

            foreach ($data as $key => $value) {
                $allowed = ['site_title', 'hero_badge', 'hero_title', 'hero_description', 'hero_button_text', 'hero_button_text_auth', 'auto-accept-bookings'];
                if (!in_array($key, $allowed)) continue;
                $val = trim((string)$value);
                $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");
                $stmt->execute([$key, $val, $val]);
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
        $patronymic = trim($data['patronymic'] ?? '');
        $phone     = trim($data['phone'] ?? '');
        $password  = trim($data['password'] ?? '');
        $customLogin = trim($data['login'] ?? '');

        $errors = [];
        if (!$firstName) $errors[] = 'Имя обязательно';
        if (!$lastName) $errors[] = 'Фамилия обязательна';
        if (!$phone) $errors[] = 'Номер телефона обязателен';
        if ($password !== '' && strlen($password) < 6) $errors[] = 'Пароль должен быть минимум 6 символов';

        $phoneDigits = preg_replace('/\D/', '', $phone);
        if (strlen($phoneDigits) < 10) $errors[] = 'Укажите корректный номер телефона';

        if ($errors) jsonError(implode('. ', $errors), 400);

        if ($password === '') {
            $password = generatePassword();
        }

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

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        if ($stmt->fetchColumn() > 0) {
            jsonError('Пользователь с таким номером телефона уже зарегистрирован', 400);
        }

        $fullName = $lastName . ' ' . $firstName . ($patronymic ? ' ' . $patronymic : '');
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, patronymic, name, login, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active')");
        $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $finalLogin, $phone, $hashedPassword]);
        $userId = (int)$pdo->lastInsertId();

        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $token, $expiresAt]);

        $userData = [
            'id'         => $userId,
            'first_name' => $firstName,
            'last_name'  => $lastName,
            'patronymic' => $patronymic,
            'name'       => $fullName,
            'login'      => $finalLogin,
            'phone'      => $phone,
            'role'       => 'user',
            'status'     => 'active',
            'password'   => $password,
        ];

        jsonResponse(['token' => $token, 'user' => $userData]);
    }

    // ─── Авторизация ────────────────────────────────────────────────────────

    if ($uri === 'login') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

        $loginInput = trim($data['login'] ?? $data['phone'] ?? $data['email'] ?? '');
        $password   = trim($data['password'] ?? '');

        if (!$loginInput || !$password) {
            jsonError('Заполните логин/телефон и пароль', 400);
        }

        $phoneDigits = preg_replace('/\D/', '', $loginInput);

        $stmt = $pdo->prepare("
            SELECT * FROM users
            WHERE (login = :input
               OR phone = :input
               OR (CHAR_LENGTH(:digits) >= 10 AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '(', ''), ')', ''), '-', '') LIKE CONCAT('%', :digits2)))
              AND status = 'active'
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

        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$user['id'], $token, $expiresAt]);

        unset($user['password']);
        jsonResponse(['token' => $token, 'user' => $user]);
    }

    if ($uri === 'user') {
        $user = requireAuth($pdo);
        unset($user['password']);
        jsonResponse($user);
    }

    if ($uri === 'logout') {
        $token = getBearerToken();
        if ($token) {
            $stmt = $pdo->prepare("DELETE FROM tokens WHERE token = ?");
            $stmt->execute([$token]);
        }
        jsonResponse(['success' => true]);
    }

    jsonError('Маршрут не найден: ' . $uri, 404);

} catch (Exception $e) {
    jsonResponse(['error' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}