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

    // Удаляем устаревший уникальный индекс unique_curator_team, если он блокирует совпадения team_id = 0
    try {
        $pdo->exec("ALTER TABLE curator_teams DROP INDEX unique_curator_team");
    } catch (PDOException $ex) {}

    // Попытка добавить колонки rating и completed_tasks если ещё не существуют
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN rating INT NOT NULL DEFAULT 0");
    } catch (PDOException $ex) {}
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN completed_tasks INT NOT NULL DEFAULT 0");
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
    if ($role === 'admin') return null; // null означает "все команды"
    
    if ($role === 'curator' || $role === 'moderator') {
        $stmt = $pdo->prepare("SELECT team_id FROM curator_teams WHERE user_id = ?");
        $stmt->execute([$userId]);
        $teams = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        if (in_array(0, $teams, true)) {
            return null; // 0 означает "все команды"
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

    // ─── Очистка: перенести все брони в архив ────────────────────────────

    if ($uri === 'admin/archive-bookings') {
        $user = requireStrictAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'archived' WHERE status NOT IN ('archived', 'recalled')");
        $stmt->execute();
        jsonResponse(['success' => true, 'affected' => $stmt->rowCount()]);
    }

    // ─── Очистка: перенести всех пользователей (кроме админов) в архив ───

    if ($uri === 'admin/archive-users') {
        $user = requireStrictAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $stmt = $pdo->prepare("UPDATE users SET status = 'archived' WHERE role <> 'admin' AND status = 'active'");
        $stmt->execute();
        jsonResponse(['success' => true, 'affected' => $stmt->rowCount()]);
    }

    // ─── Очистка: чаты ВСЕХ команд ───────────────────────────────────────

    if ($uri === 'admin/teams/clear-all-chats') {
        $user = requireStrictAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $stmt = $pdo->prepare("DELETE FROM team_chat_messages");
        $stmt->execute();
        jsonResponse(['success' => true, 'affected' => $stmt->rowCount()]);
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

    // ─── Глобальные уведомления ──────────────────────────────────────────────

    if ($uri === 'get-global-notification' || $uri === 'notifications/global') {
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

        if ($type === 'one-view' && $viewerKey && in_array($viewerKey, $viewers, true)) {
            jsonResponse(['notification' => null]);
        }

        jsonResponse(['notification' => $notif]);
    }

    if ($uri === 'save-global-notification') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        requireStrictAdmin($pdo);

        $text = trim($data['text'] ?? '');
        $type = in_array($data['type'] ?? '', ['permanent', 'one-view'], true) ? $data['type'] : 'permanent';
        $enabled = !empty($data['enabled']);

        if (!$text) jsonError('Текст уведомления обязателен');

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

    if ($uri === 'mark-notification-viewed' || $uri === 'notifications/global/view') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
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

    // ─── Авторизация (логин) ───────────────────────────────────────────────

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

    if ($uri === 'my-booking') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare("
            SELECT b.id, b.status, b.comment, r.room_number, bu.name as building_name, f.floor_number
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN buildings bu ON r.building_id = bu.id
            JOIN floors f ON r.floor_id = f.id
            WHERE b.user_id = ? AND b.status NOT IN ('archived')
            ORDER BY b.id DESC LIMIT 1
        ");
        $stmt->execute([$user['id']]);
        $booking = $stmt->fetch();
        jsonResponse(['booking' => $booking]);
    }

    if ($uri === 'cancel-booking' || $uri === 'my-booking/cancel') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $user = requireAuth($pdo);

        $stmt = $pdo->prepare("
            UPDATE bookings
            SET status = 'recalled', comment = 'Отозвано пользователем'
            WHERE user_id = ? AND status IN ('pending', 'approved', 'approved_bot')
        ");
        $stmt->execute([$user['id']]);

        if ($stmt->rowCount() === 0) {
            jsonError('Активных заявок для отзыва не найдено', 400);
        }

        jsonResponse(['success' => true, 'message' => 'Заявка успешно отозвана']);
    }

    if ($uri === 'admin/teams') {
        $user = requireAdmin($pdo);
        $curatorTeams = getCuratorTeams($pdo, $user['id']);

        if ($method === 'GET') {
            if ($curatorTeams === null) {
                $stmt = $pdo->query("SELECT * FROM teams ORDER BY name ASC");
            } else {
                if (empty($curatorTeams)) {
                    jsonResponse([]);
                }
                $placeholders = implode(',', array_fill(0, count($curatorTeams), '?'));
                $stmt = $pdo->prepare("SELECT * FROM teams WHERE id IN ($placeholders) ORDER BY name ASC");
                $stmt->execute($curatorTeams);
            }
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
                if (!checkCuratorAccessToTeam($pdo, $user['id'], $id)) {
                    jsonError('У вас нет доступа к редактированию этой команды', 403);
                }
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
        if (!checkCuratorAccessToTeam($pdo, $user['id'], $id)) {
            jsonError('У вас нет доступа к удалению этой команды', 403);
        }
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

        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }

        $stmt = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
        $stmt->execute([$teamId]);
        $teamName = $stmt->fetchColumn();
        if (!$teamName) jsonError('Команда не найдена', 404);

        $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        if (!$stmt->fetchColumn()) jsonError('Пользователь не найден', 404);

        $stmt = $pdo->prepare("UPDATE users SET team_id = ?, team_name = ? WHERE id = ?");
        $stmt->execute([$teamId, $teamName, $userId]);

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

        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }

        $stmt = $pdo->prepare("UPDATE users SET team_id = NULL, team_name = NULL WHERE id = ? AND team_id = ?");
        $stmt->execute([$userId, $teamId]);

        $stmt = $pdo->prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?");
        $stmt->execute([$teamId, $userId]);

        jsonResponse(['success' => true]);
    }

    if ($uri === 'admin/teams/members') {
        $user = requireAdmin($pdo);
        if ($method !== 'GET') jsonError('Метод не поддерживается', 405);
        $teamId = (int)($_GET['team_id'] ?? 0);

        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }

        $stmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, u.name, u.login, u.role as user_role,
                   COALESCE(tm.role, CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 'curator' ELSE 'member' END) as role
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
            WHERE (u.team_id = ?
               OR (LOWER(TRIM(u.role)) IN ('curator', 'moderator') AND u.id IN (
                   SELECT user_id FROM curator_teams WHERE team_id = ? OR team_id = 0
               )))
               AND u.status = 'active'
            ORDER BY CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 0 ELSE 1 END, u.last_name ASC
        ");
        $stmt->execute([$teamId, $teamId, $teamId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($uri === 'admin/teams/chat') {
        $user = requireAdmin($pdo);

        if ($method === 'GET') {
            $teamId = (int)($_GET['team_id'] ?? 0);
            if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
                jsonError('У вас нет доступа к этой команде', 403);
            }
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
            if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
                jsonError('У вас нет доступа к этой команде', 403);
            }
            $message = trim($data['message'] ?? '');
            if (!$message) jsonError('Сообщение не может быть пустым');
            $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
            $stmt->execute([$teamId, $user['id'], $message]);
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'admin/teams/clear-chat') {
        $user = requireAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $teamId = (int)($data['team_id'] ?? 0);
        if ($teamId <= 0) jsonError('Команда не указана');
        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }
        $stmt = $pdo->prepare("DELETE FROM team_chat_messages WHERE team_id = ?");
        $stmt->execute([$teamId]);
        jsonResponse(['success' => true]);
    }

    if ($uri === 'admin/teams/delete-message') {
        $user = requireAdmin($pdo);
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
        $messageId = (int)($data['message_id'] ?? 0);
        if ($messageId <= 0) jsonError('Сообщение не указано');

        $stmt = $pdo->prepare("SELECT team_id FROM team_chat_messages WHERE id = ?");
        $stmt->execute([$messageId]);
        $teamId = (int)$stmt->fetchColumn();
        if (!$teamId) jsonError('Сообщение не найдено', 404);

        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }
        $delStmt = $pdo->prepare("DELETE FROM team_chat_messages WHERE id = ?");
        $delStmt->execute([$messageId]);
        jsonResponse(['success' => true]);
    }

    if ($uri === 'admin/teams/calendar') {
        $user = requireAdmin($pdo);

        if ($method === 'GET') {
            $teamId = (int)($_GET['team_id'] ?? 0);
            if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
                jsonError('У вас нет доступа к этой команде', 403);
            }
            $stmt = $pdo->prepare("SELECT * FROM team_calendar_events WHERE team_id = ? ORDER BY event_date ASC");
            $stmt->execute([$teamId]);
            jsonResponse($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $postData = $_POST ?: $data;
            $action = $postData['action'] ?? 'create';
            $teamId = (int)($postData['team_id'] ?? 0);

            if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
                jsonError('У вас нет доступа к этой команде', 403);
            }

            if ($action === 'create') {
                $title = trim($postData['title'] ?? '');
                $eventDate = trim($postData['event_date'] ?? '');
                $desc = trim($postData['description'] ?? '');
                $imageUrl = trim($postData['image_url'] ?? '');

                if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                    $uploadDir = __DIR__ . '/../uploads/';
                    if (!is_dir($uploadDir)) {
                        @mkdir($uploadDir, 0777, true);
                    }
                    $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
                    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
                        $filename = 'event_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
                        $targetPath = $uploadDir . $filename;
                        if (move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
                            $imageUrl = '/uploads/' . $filename;
                        }
                    }
                }

                if (!$title) jsonError('Заполните название события');
                if (!$eventDate) {
                    $eventDate = date('Y-m-d H:i:s');
                } else {
                    $eventDate = date('Y-m-d H:i:s', strtotime($eventDate));
                }

                $stmt = $pdo->prepare("INSERT INTO team_calendar_events (team_id, title, event_date, description, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$teamId, $title, $eventDate, $desc, $imageUrl, $user['id']]);
            } elseif ($action === 'delete') {
                $id = (int)($postData['id'] ?? 0);
                $stmt = $pdo->prepare("DELETE FROM team_calendar_events WHERE id = ?");
                $stmt->execute([$id]);
            }
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'public/buildings') {
        $stmt = $pdo->query("SELECT * FROM buildings ORDER BY id ASC");
        $buildings = $stmt->fetchAll();
        $result = [];
        foreach ($buildings as $b) {
            $capStmt = $pdo->prepare("SELECT COALESCE(SUM(capacity),0) FROM rooms WHERE building_id = ? AND is_technical = 0 AND room_type = 'room'");
            $capStmt->execute([$b['id']]);
            $total_capacity = (int)$capStmt->fetchColumn();

            $occStmt = $pdo->prepare("
                SELECT COUNT(*) FROM bookings b
                JOIN rooms r ON b.room_id = r.id
                WHERE r.building_id = ? AND b.status IN ('approved','approved_bot','pending')
            ");
            $occStmt->execute([$b['id']]);
            $occupied = (int)$occStmt->fetchColumn();

            $result[] = [
                'id' => $b['id'],
                'name' => $b['name'],
                'gender' => $b['gender'],
                'total_capacity' => $total_capacity,
                'occupied_places' => $occupied,
            ];
        }
        jsonResponse($result);
    }

    if ($uri === 'public/layout') {
        $buildingId = (int)($_GET['building_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM buildings WHERE id = ?");
        $stmt->execute([$buildingId]);
        $building = $stmt->fetch();
        if (!$building) jsonError('Корпус не найден', 404);

        $floors = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
        $floors->execute([$buildingId]);
        $floorsData = [];

        $occupantsStmt = $pdo->prepare("
            SELECT u.first_name, u.last_name, u.patronymic, u.login
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.room_id = ? AND b.status IN ('approved', 'approved_bot') AND u.status = 'active'
        ");

        foreach ($floors->fetchAll() as $floor) {
            $rooms = $pdo->prepare("
                SELECT r.*,
                       (SELECT COUNT(*) FROM bookings b
                        WHERE b.room_id = r.id AND b.status IN ('approved','approved_bot','pending')) as occupied
                FROM rooms r
                WHERE r.floor_id = ?
                ORDER BY r.y_pos ASC, r.x_pos ASC
            ");
            $rooms->execute([$floor['id']]);
            $fetchedRooms = $rooms->fetchAll();

            foreach ($fetchedRooms as &$r) {
                $r['occupied'] = (int)$r['occupied'];
                if ($r['room_type'] === 'room') {
                    $occupantsStmt->execute([$r['id']]);
                    $r['occupants'] = $occupantsStmt->fetchAll();
                } else {
                    $r['occupants'] = [];
                }
            }

            $floorsData[] = [
                'id' => (int)$floor['id'],
                'floor_number' => (int)$floor['floor_number'],
                'width' => (int)$floor['width'],
                'start_room_number' => $floor['start_room_number'],
                'room_order_type' => $floor['room_order_type'],
                'gender' => $floor['gender'],
                'rooms' => $fetchedRooms,
            ];
        }

        jsonResponse([
            'building' => [
                'id' => (int)$building['id'],
                'name' => $building['name'],
                'gender' => $building['gender'],
            ],
            'floors' => $floorsData,
        ]);
    }

    if ($uri === 'book') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

        $mode = $data['mode'] ?? 'login';
        $roomId = (int)($data['room_id'] ?? 0);

        if (!$roomId) jsonError('Комната не выбрана', 400);

        $stmt = $pdo->prepare("
            SELECT r.*, bu.name as building_name, bu.gender as building_gender, f.floor_number, f.gender as floor_gender
            FROM rooms r
            JOIN buildings bu ON r.building_id = bu.id
            JOIN floors f ON r.floor_id = f.id
            WHERE r.id = ?
        ");
        $stmt->execute([$roomId]);
        $room = $stmt->fetch();
        if (!$room) jsonError('Комната не найдена', 404);

        $stmtOccupied = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status IN ('approved','approved_bot','pending')");
        $stmtOccupied->execute([$roomId]);
        $currentOccupied = (int)$stmtOccupied->fetchColumn();
        if ($currentOccupied >= (int)$room['capacity']) {
            jsonError('Эта комната уже полностью заполнена', 400);
        }

        $user = null;
        $isNewUser = false;

        if ($mode === 'existing') {
            $user = requireAuth($pdo);
            $isNewUser = false;
        } elseif ($mode === 'register') {
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

            $finalLogin = $customLogin ?: ('u' . substr($phoneDigits, -8));
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
            $stmt->execute([$finalLogin]);
            if ($stmt->fetchColumn() > 0) {
                if ($customLogin) jsonError('Логин уже занят', 400);
                $finalLogin = 'u' . $phoneDigits . rand(10, 99);
            }

            $fullName = $lastName . ' ' . $firstName . ($patronymic ? ' ' . $patronymic : '');
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, patronymic, name, login, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active')");
            $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $finalLogin, $phone, $hash]);
            $userId = (int)$pdo->lastInsertId();

            $user = [
                'id' => $userId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'patronymic' => $patronymic,
                'name' => $fullName,
                'login' => $finalLogin,
                'phone' => $phone,
                'role' => 'user',
                'status' => 'active',
                'password' => $password,
            ];
            $isNewUser = true;
        } else {
            $loginInput = trim($data['login'] ?? $data['phone'] ?? '');
            $password   = trim($data['password'] ?? '');
            if (!$loginInput || !$password) jsonError('Введите логин/телефон и пароль', 400);

            $phoneDigits = preg_replace('/\D/', '', $loginInput);
            $stmt = $pdo->prepare("
                SELECT * FROM users
                WHERE (login = :input OR phone = :input OR (CHAR_LENGTH(:digits) >= 10 AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '(', ''), ')', ''), '-', '') LIKE CONCAT('%', :digits2)))
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
            unset($user['password']);
        }

        $roomEffGender = $room['gender'] !== 'DEFAULT' ? $room['gender'] : ($room['floor_gender'] !== 'DEFAULT' ? $room['floor_gender'] : $room['building_gender']);
        
        if ($roomEffGender !== 'MIXED' && $roomEffGender !== 'DEFAULT') {
            $userLastName = $user['last_name'] ?? '';
            $userGender = detectGenderByLastName($userLastName);

            if ($userGender !== null && $userGender !== $roomEffGender) {
                $roomLabel = $roomEffGender === 'M' ? 'мальчиков (мужская)' : 'девочек (женская)';
                $userGenderLabel = $userGender === 'M' ? 'мужской' : 'женский';
                jsonError("Данная комната предназначена только для {$roomLabel}. Ваш пол был определён как {$userGenderLabel} по фамилии ({$userLastName}). Пожалуйста, выберите подходящую комнату.", 400);
            }
        }

        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
        $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$user['id'], $token, $expiresAt]);

        if ($room['gender'] == 'DEFAULT' || $room['gender'] == 'MIXED') {
            $detectedGender = detectGenderByLastName($user['last_name'] ?? $user['name'] ?? '');
            if ($detectedGender) {
                $stmt = $pdo->prepare("UPDATE rooms SET gender = ? WHERE id = ?");
                $stmt->execute([$detectedGender, $room['id']]);
                $room['gender'] = $detectedGender;
            }
        }

        $stmt = $pdo->prepare("
            SELECT b.id FROM bookings b
            WHERE b.user_id = ?
            AND b.status IN ('pending', 'approved', 'approved_bot')
            LIMIT 1
        ");
        $stmt->execute([$user['id']]);
        if ($stmt->fetch()) {
            jsonError("У вас уже есть активная заявка на заселение.", 400);
        }

        $stmt = $pdo->prepare("INSERT INTO bookings (user_id, room_id, status) VALUES (?, ?, 'pending')");
        $stmt->execute([$user['id'], $roomId]);
        $bookingId = (int)$pdo->lastInsertId();

        $booking = [
            'id' => $bookingId,
            'room_number' => $room['room_number'],
            'building_name' => $room['building_name'],
            'floor_number' => $room['floor_number'],
            'status' => 'pending',
        ];

        jsonResponse([
            'token' => $token,
            'user' => $user,
            'booking' => $booking,
            'new_user' => $isNewUser,
        ]);
    }

    if ($uri === 'auto-book') {
        if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

        $mode = $data['mode'] ?? 'login';
        $gender = strtoupper(trim($data['gender'] ?? ''));
        if (!in_array($gender, ['M', 'F'], true)) jsonError('Пол обязателен (M или F)', 400);

        $user = null;
        $isNewUser = false;

        if ($mode === 'existing') {
            $user = requireAuth($pdo);
            $isNewUser = false;
        } elseif ($mode === 'register') {
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

            $finalLogin = $customLogin ?: ('u' . substr($phoneDigits, -8));
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
            $stmt->execute([$finalLogin]);
            if ($stmt->fetchColumn() > 0) {
                if ($customLogin) jsonError('Логин уже занят', 400);
                $finalLogin = 'u' . $phoneDigits . rand(10, 99);
            }

            $fullName = $lastName . ' ' . $firstName . ($patronymic ? ' ' . $patronymic : '');
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, patronymic, name, login, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active')");
            $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $finalLogin, $phone, $hash]);
            $userId = (int)$pdo->lastInsertId();

            $user = [
                'id' => $userId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'patronymic' => $patronymic,
                'name' => $fullName,
                'login' => $finalLogin,
                'phone' => $phone,
                'role' => 'user',
                'status' => 'active',
                'password' => $password,
            ];
            $isNewUser = true;
        } else {
            $loginInput = trim($data['login'] ?? $data['phone'] ?? '');
            $password   = trim($data['password'] ?? '');
            if (!$loginInput || !$password) jsonError('Введите логин/телефон и пароль', 400);

            $phoneDigits = preg_replace('/\D/', '', $loginInput);
            $stmt = $pdo->prepare("
                SELECT * FROM users
                WHERE (login = :input OR phone = :input OR (CHAR_LENGTH(:digits) >= 10 AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '(', ''), ')', ''), '-', '') LIKE CONCAT('%', :digits2)))
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
            unset($user['password']);
        }

        $detectedUserGender = detectGenderByLastName($user['last_name'] ?? $user['name'] ?? '');
        if ($detectedUserGender !== null && $detectedUserGender !== $gender) {
            $userGenderLabel = $detectedUserGender === 'M' ? 'мужской' : 'женский';
            $selectedGenderLabel = $gender === 'M' ? 'мальчик' : 'девочка';
            jsonError("Несоответствие пола: По фамилии ({$user['last_name']}) ваш пол определён как {$userGenderLabel}, а в форме выбран пол '{$selectedGenderLabel}'. Проверьте правильность выбранного пола.", 400);
        }

        $stmt = $pdo->prepare("
            SELECT b.id FROM bookings b
            WHERE b.user_id = ?
            AND b.status IN ('pending', 'approved', 'approved_bot')
            LIMIT 1
        ");
        $stmt->execute([$user['id']]);
        if ($stmt->fetch()) {
            jsonError("У вас уже есть активная заявка на заселение.", 400);
        }

        function getAvailableRoom($pdo, $gender) {
            $buildings = $pdo->prepare("SELECT * FROM buildings WHERE gender = 'MIXED' OR gender = ? ORDER BY id ASC");
            $buildings->execute([$gender]);
            foreach ($buildings as $building) {
                $floors = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
                $floors->execute([$building['id']]);
                foreach ($floors as $floor) {
                    $floorEffGender = $floor['gender'] != 'DEFAULT' ? $floor['gender'] : $building['gender'];
                    $rooms = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? AND room_type='room' AND is_technical=0 ORDER BY room_number ASC");
                    $rooms->execute([$floor['id']]);
                    foreach ($rooms as $room) {
                        $roomEffGender = $room['gender'] != 'DEFAULT' ? $room['gender'] : $floorEffGender;
                        if ($roomEffGender !== 'MIXED' && $roomEffGender != $gender) continue;
                        $stmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status IN ('approved','approved_bot','pending')");
                        $stmt->execute([$room['id']]);
                        $cnt = (int)$stmt->fetchColumn();
                        if ($cnt < (int)$room['capacity']) {
                            return ['room' => $room, 'building' => $building, 'floor' => $floor];
                        }
                    }
                }
            }
            return null;
        }

        $available = getAvailableRoom($pdo, $gender);
        if (!$available) {
            jsonError('К сожалению, свободных комнат для этого пола сейчас нет. Попробуйте позже или выберите комнату вручную.', 404);
        }

        if ($mode !== 'existing') {
            $token = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
            $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
            $stmt->execute([$user['id'], $token, $expiresAt]);
        } else {
            $token = getBearerToken();
        }

        $room = $available['room'];

        if ($room['gender'] == 'DEFAULT' || $room['gender'] == 'MIXED') {
            $detectedGender = detectGenderByLastName($user['last_name'] ?? $user['name'] ?? '');
            if ($detectedGender) {
                $stmt = $pdo->prepare("UPDATE rooms SET gender = ? WHERE id = ?");
                $stmt->execute([$detectedGender, $room['id']]);
                $room['gender'] = $detectedGender;
            }
        }

        $stmt = $pdo->prepare("INSERT INTO bookings (user_id, room_id, status) VALUES (?, ?, 'pending')");
        $stmt->execute([$user['id'], $room['id']]);
        $bookingId = (int)$pdo->lastInsertId();

        $booking = [
            'id' => $bookingId,
            'room_number' => $room['room_number'],
            'building_name' => $available['building']['name'],
            'floor_number' => $available['floor']['floor_number'],
            'status' => 'pending',
        ];

        jsonResponse([
            'token' => $token,
            'user' => $user,
            'booking' => $booking,
            'new_user' => $isNewUser,
        ]);
    }

    if ($uri === 'profile') {
        $user = requireAuth($pdo);
        if ($method === 'GET') {
            unset($user['password']);
            jsonResponse($user);
        }
        if ($method === 'POST') {
            $bio = isset($data['bio']) ? trim($data['bio']) : ($user['bio'] ?? '');
            $social_vk = isset($data['social_vk']) ? trim($data['social_vk']) : ($user['social_vk'] ?? '');
            $social_telegram = isset($data['social_telegram']) ? trim($data['social_telegram']) : ($user['social_telegram'] ?? '');
            $social_instagram = isset($data['social_instagram']) ? trim($data['social_instagram']) : ($user['social_instagram'] ?? '');
            $social_max = isset($data['social_max']) ? trim($data['social_max']) : ($user['social_max'] ?? '');
            $stmt = $pdo->prepare("UPDATE users SET bio = ?, social_vk = ?, social_telegram = ?, social_instagram = ?, social_max = ? WHERE id = ?");
            $stmt->execute([$bio, $social_vk, $social_telegram, $social_instagram, $social_max, $user['id']]);
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $updated = $stmt->fetch();
            unset($updated['password']);
            jsonResponse($updated);
        }
        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'my-bookings') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare("
            SELECT b.id, b.status, b.created_at, b.updated_at,
                   r.room_number, bu.name as building_name, f.floor_number
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN buildings bu ON r.building_id = bu.id
            JOIN floors f ON r.floor_id = f.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        ");
        $stmt->execute([$user['id']]);
        jsonResponse($stmt->fetchAll());
    }

    if ($uri === 'my-team') {
        $user = requireAuth($pdo);
        if (!$user['team_id']) {
            jsonResponse(['team' => null, 'members' => []]);
        }
        $teamId = (int)$user['team_id'];
        $teamStmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
        $teamStmt->execute([$teamId]);
        $team = $teamStmt->fetch();
        if (!$team) {
            jsonResponse(['team' => null, 'members' => []]);
        }
        $membersStmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, u.name, u.login, u.role as user_role,
                   COALESCE(tm.role, CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 'curator' ELSE 'member' END) as role
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
            WHERE (u.team_id = ?
               OR (LOWER(TRIM(u.role)) IN ('curator', 'moderator') AND u.id IN (
                   SELECT user_id FROM curator_teams WHERE team_id = ? OR team_id = 0
               )))
               AND u.status = 'active'
            ORDER BY CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 0 ELSE 1 END, u.last_name ASC
        ");
        $membersStmt->execute([$teamId, $teamId, $teamId]);
        $members = $membersStmt->fetchAll();
        jsonResponse([
            'team' => $team,
            'members' => $members,
        ]);
    }

    if ($uri === 'my-team/chat') {
        $user = requireAuth($pdo);
        if (!$user['team_id']) jsonError('Вы не состоите в команде', 400);
        $teamId = (int)$user['team_id'];

        if ($method === 'GET') {
            $stmt = $pdo->prepare("
                SELECT m.id, m.message, m.created_at, u.first_name, u.last_name, u.role
                FROM team_chat_messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.team_id = ?
                ORDER BY m.created_at ASC
            ");
            $stmt->execute([$teamId]);
            jsonResponse($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $message = trim($data['message'] ?? '');
            if (!$message) jsonError('Сообщение не может быть пустым');
            $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
            $stmt->execute([$teamId, $user['id'], $message]);
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'my-team/calendar') {
        $user = requireAuth($pdo);
        if (!$user['team_id']) jsonError('Вы не состоите в команде', 400);
        $teamId = (int)$user['team_id'];
        if ($method === 'GET') {
            $stmt = $pdo->prepare("
                SELECT e.*, u.first_name, u.last_name
                FROM team_calendar_events e
                LEFT JOIN users u ON e.created_by = u.id
                WHERE e.team_id = ?
                ORDER BY e.event_date ASC
            ");
            $stmt->execute([$teamId]);
            jsonResponse($stmt->fetchAll());
        }
        jsonError('Метод не поддерживается', 405);
    }

    if ($uri === 'public/profile') {
        $login = trim($_GET['login'] ?? '');
        if (!$login) jsonError('Логин не указан', 400);
        $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ? AND status = 'active'");
        $stmt->execute([$login]);
        $user = $stmt->fetch();
        if (!$user) jsonError('Пользователь не найден', 404);

        unset($user['password']);

        $team = null;
        $members = [];
        if ($user['team_id']) {
            $teamId = (int)$user['team_id'];
            $teamStmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
            $teamStmt->execute([$teamId]);
            $team = $teamStmt->fetch();

            $membersStmt = $pdo->prepare("
                SELECT u.id, u.first_name, u.last_name, u.name, u.login, u.role as user_role,
                       COALESCE(tm.role, CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 'curator' ELSE 'member' END) as role
                FROM users u
                LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
                WHERE (u.team_id = ?
                   OR (LOWER(TRIM(u.role)) IN ('curator', 'moderator') AND u.id IN (
                       SELECT user_id FROM curator_teams WHERE team_id = ? OR team_id = 0
                   )))
                   AND u.status = 'active'
                ORDER BY CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 0 ELSE 1 END, u.last_name ASC
            ");
            $membersStmt->execute([$teamId, $teamId, $teamId]);
            $members = $membersStmt->fetchAll();
        }

        $currentBooking = null;
        $bookingStmt = $pdo->prepare("
            SELECT b.id, b.status, r.room_number, bu.name as building_name, f.floor_number
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN buildings bu ON r.building_id = bu.id
            JOIN floors f ON r.floor_id = f.id
            WHERE b.user_id = ? AND b.status NOT IN ('archived', 'recalled')
            ORDER BY b.id DESC LIMIT 1
        ");
        $bookingStmt->execute([$user['id']]);
        $currentBooking = $bookingStmt->fetch() ?: null;

        jsonResponse([
            'user' => $user,
            'team' => $team,
            'members' => $members,
            'current_booking' => $currentBooking,
        ]);
    }

    if (strpos($uri, 'admin/') === 0) {
        $curatorUser = requireAdmin($pdo);

        if ($uri === 'admin/users') {
            if ($method === 'GET') {
                $curatorTeams = getCuratorTeams($pdo, $curatorUser['id']);
                if ($curatorTeams === null) {
                    $stmt = $pdo->query("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, rating, completed_tasks, created_at FROM users ORDER BY id DESC");
                    $users = $stmt->fetchAll();
                } else {
                    if (empty($curatorTeams)) {
                        $stmt = $pdo->query("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, rating, completed_tasks, created_at FROM users WHERE team_id IS NULL OR team_id = 0 ORDER BY id DESC");
                        $users = $stmt->fetchAll();
                    } else {
                        $placeholders = implode(',', array_fill(0, count($curatorTeams), '?'));
                        $stmt = $pdo->prepare("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, rating, completed_tasks, created_at FROM users WHERE team_id IN ($placeholders) OR team_id IS NULL OR team_id = 0 OR id = ? ORDER BY id DESC");
                        $params = array_merge($curatorTeams, [$curatorUser['id']]);
                        $stmt->execute($params);
                        $users = $stmt->fetchAll();
                    }
                }

                foreach ($users as &$u) {
                    $roleClean = strtolower(trim($u['role']));
                    if ($roleClean === 'curator' || $roleClean === 'moderator') {
                        $ctStmt = $pdo->prepare("SELECT team_id FROM curator_teams WHERE user_id = ?");
                        $ctStmt->execute([$u['id']]);
                        $u['curator_team_ids'] = array_map('intval', $ctStmt->fetchAll(PDO::FETCH_COLUMN));
                    } else {
                        $u['curator_team_ids'] = [];
                    }
                }

                jsonResponse($users);
            }

            if ($method === 'POST') {
                $id = (int)($data['id'] ?? 0);
                $firstName = trim($data['first_name'] ?? '');
                $lastName = trim($data['last_name'] ?? '');
                $patronymic = trim($data['patronymic'] ?? '');
                $phone = trim($data['phone'] ?? '');
                $login = trim($data['email'] ?? $data['login'] ?? '');
                $role = trim($data['role'] ?? 'user');
                if ($role === 'moderator') $role = 'curator';
                $status = trim($data['status'] ?? 'active');
                $teamName = trim($data['team_name'] ?? '');
                $teamId = (int)($data['team_id'] ?? 0);
                $rating = (int)($data['rating'] ?? 0);
                $completedTasks = (int)($data['completed_tasks'] ?? 0);
                $password = trim($data['password'] ?? '');

                $curatorRoleClean = strtolower(trim($curatorUser['role'] ?? ''));
                if ($curatorRoleClean !== 'admin' && $role === 'admin') {
                    jsonError('Назначать роль Администратора может только Главный администратор', 403);
                }

                if ($id > 0) {
                    if ($curatorUser['role'] === 'curator' && !checkCuratorAccessToUser($pdo, $curatorUser['id'], $id) && $curatorUser['id'] != $id) {
                        jsonError('У вас нет доступа к редактированию этого пользователя', 403);
                    }

                    $fullName = $lastName . ' ' . $firstName . ($patronymic ? ' ' . $patronymic : '');
                    $teamNameResolved = $teamName;
                    if ($teamId > 0 && $role !== 'curator') {
                        $stmt = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
                        $stmt->execute([$teamId]);
                        $teamNameResolved = $stmt->fetchColumn() ?: $teamName;
                    }

                    if ($role === 'curator') {
                        $teamId = null;
                        $teamNameResolved = null;
                    }

                    if ($password) {
                        $hash = password_hash($password, PASSWORD_DEFAULT);
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, patronymic=?, name=?, phone=?, login=?, role=?, status=?, team_name=?, team_id=?, rating=?, completed_tasks=?, password=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $phone, $login, $role, $status, $teamNameResolved, $teamId, $rating, $completedTasks, $hash, $id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, patronymic=?, name=?, phone=?, login=?, role=?, status=?, team_name=?, team_id=?, rating=?, completed_tasks=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $phone, $login, $role, $status, $teamNameResolved, $teamId, $rating, $completedTasks, $id]);
                    }

                    if ($role !== 'curator') {
                        if ($teamId > 0) {
                            $stmt = $pdo->prepare("SELECT COUNT(*) FROM team_members WHERE team_id = ? AND user_id = ?");
                            $stmt->execute([$teamId, $id]);
                            if ($stmt->fetchColumn() == 0) {
                                $stmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')");
                                $stmt->execute([$teamId, $id]);
                            }
                        } else {
                            $stmt = $pdo->prepare("DELETE FROM team_members WHERE user_id = ?");
                            $stmt->execute([$id]);
                        }
                    }

                    if ($role === 'curator') {
                        $curatorTeamIds = array_unique(array_map('intval', $data['curator_team_ids'] ?? []));
                        $delStmt = $pdo->prepare("DELETE FROM curator_teams WHERE user_id = ?");
                        $delStmt->execute([$id]);
                        $insStmt = $pdo->prepare("INSERT IGNORE INTO curator_teams (user_id, team_id) VALUES (?, ?)");
                        foreach ($curatorTeamIds as $tid) {
                            $insStmt->execute([$id, (int)$tid]);
                        }
                    } else {
                        $delStmt = $pdo->prepare("DELETE FROM curator_teams WHERE user_id = ?");
                        $delStmt->execute([$id]);
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
            requireStrictAdmin($pdo);
            if ($method === 'GET') {
                $stmt = $pdo->query("
                    SELECT b.id, b.user_id, b.room_id, b.status, b.created_at, b.comment,
                           u.first_name, u.last_name, u.patronymic, u.name as user_name, u.phone as user_phone, u.login, u.team_name, u.role,
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
                $comment = isset($data['comment']) ? trim($data['comment']) : null;
                if ($id > 0) {
                    if ($comment !== null) {
                        $stmt = $pdo->prepare("UPDATE bookings SET room_id = ?, status = ?, comment = ? WHERE id = ?");
                        $stmt->execute([$roomId, $status, $comment, $id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE bookings SET room_id = ?, status = ? WHERE id = ?");
                        $stmt->execute([$roomId, $status, $id]);
                    }
                }
                jsonResponse(['success' => true]);
            }

            jsonError('Метод не поддерживается', 405);
        }

        if ($uri === 'admin/buildings') {
            requireStrictAdmin($pdo);
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
            requireStrictAdmin($pdo);
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
            requireStrictAdmin($pdo);
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
            requireStrictAdmin($pdo);
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
            requireStrictAdmin($pdo);
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

        jsonError('Маршрут не найден', 404);
    }

    jsonError('Маршрут не найден: ' . $uri, 404);

} catch (Exception $e) {
    jsonResponse(['error' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}