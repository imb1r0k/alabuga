<?php
// ============================================================
//  АЛАБУГА - API (единый файл)
//  Все маршруты обрабатываются здесь
// ============================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Подключение к БД ───────────────────────────────────────
function getPDO() {
    static $pdo = null;
    if ($pdo === null) {
        $host = 'localhost';
        $db   = 'alabuga';
        $user = 'root';
        $pass = '';
        $charset = 'utf8mb4';

        $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        try {
            $pdo = new PDO($dsn, $user, $pass, $options);
        } catch (PDOException $e) {
            jsonError('Ошибка подключения к БД: ' . $e->getMessage(), 500);
        }
    }
    return $pdo;
}

// ─── Ответы ─────────────────────────────────────────────────
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

// ─── Аутентификация ─────────────────────────────────────────
function requireAuth($pdo) {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        jsonError('Не авторизован', 401);
    }
    $auth = $headers['Authorization'];
    if (!preg_match('/Bearer\s+(.*)/i', $auth, $matches)) {
        jsonError('Неверный формат токена', 401);
    }
    $token = $matches[1];
    $stmt = $pdo->prepare("SELECT * FROM users WHERE token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonError('Сессия истекла', 401);
    }
    return $user;
}

function generateToken() {
    return bin2hex(random_bytes(32));
}

// ─── Основные переменные ────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$uri = preg_replace('#^api/#', '', $uri);
$uri = preg_replace('#^/#', '', $uri);

$input = file_get_contents('php://input');
$data = json_decode($input, true) ?? [];

$pdo = getPDO();
ensureTablesExist($pdo);

// ─── Разбор параметров пути ─────────────────────────────────
$parts = explode('/', $uri);
$resource = $parts[0] ?? '';
$id = $parts[1] ?? null;
$subresource = $parts[2] ?? null;
$subid = $parts[3] ?? null;

// ============================================================
//  АУТЕНТИФИКАЦИЯ
// ============================================================

if ($uri === 'register' && $method === 'POST') {
    $lastName = trim($data['last_name'] ?? '');
    $firstName = trim($data['first_name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';
    $login = trim($data['login'] ?? '');

    if (!$lastName || !$firstName || !$phone || strlen($password) < 6) {
        jsonError('Заполните все обязательные поля (пароль минимум 6 символов)');
    }

    // Автогенерация логина
    if (empty($login)) {
        $login = strtolower(transliterate($lastName . '_' . $firstName));
    }

    // Проверка уникальности
    $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ? OR phone = ?");
    $stmt->execute([$login, $phone]);
    if ($stmt->fetch()) {
        jsonError('Такой логин или телефон уже используется');
    }

    $token = generateToken();
    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (login, password, first_name, last_name, phone, token, role, status) VALUES (?, ?, ?, ?, ?, ?, 'user', 'active')");
    $stmt->execute([$login, $hashed, $firstName, $lastName, $phone, $token]);

    $userId = $pdo->lastInsertId();
    $user = [
        'id' => (int)$userId,
        'login' => $login,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'phone' => $phone,
        'role' => 'user',
        'token' => $token,
        'password' => $password, // для единоразового показа
    ];
    jsonResponse(['token' => $token, 'user' => $user], 201);
}

if ($uri === 'login' && $method === 'POST') {
    $loginOrPhone = trim($data['login'] ?? $data['phone'] ?? '');
    $password = $data['password'] ?? '';

    if (!$loginOrPhone || !$password) {
        jsonError('Введите логин/телефон и пароль');
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ? OR phone = ?");
    $stmt->execute([$loginOrPhone, $loginOrPhone]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Неверный логин или пароль', 401);
    }

    if ($user['status'] === 'archived') {
        jsonError('Аккаунт архивирован', 403);
    }

    $token = generateToken();
    $stmt = $pdo->prepare("UPDATE users SET token = ? WHERE id = ?");
    $stmt->execute([$token, $user['id']]);
    $user['token'] = $token;
    unset($user['password']);
    jsonResponse(['token' => $token, 'user' => $user]);
}

if ($uri === 'logout' && $method === 'POST') {
    $user = requireAuth($pdo);
    $stmt = $pdo->prepare("UPDATE users SET token = NULL WHERE id = ?");
    $stmt->execute([$user['id']]);
    jsonResponse(['success' => true]);
}

if ($uri === 'user' && $method === 'GET') {
    $user = requireAuth($pdo);
    unset($user['password']);
    // Добавляем поля профиля (если есть)
    $user['about'] = $user['about'] ?? '';
    $user['social_vk'] = $user['social_vk'] ?? '';
    $user['social_max'] = $user['social_max'] ?? '';
    $user['social_telegram'] = $user['social_telegram'] ?? '';
    $user['social_instagram'] = $user['social_instagram'] ?? '';
    jsonResponse($user);
}

// ============================================================
//  НАСТРОЙКИ ПОРТАЛА
// ============================================================

if ($uri === 'settings' && $method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM settings WHERE id = 1");
    $settings = $stmt->fetch();
    if (!$settings) {
        jsonResponse([
            'site_title' => 'Алабуга - форум 2025',
            'hero_badge' => 'Форум 2025',
            'hero_title' => 'Добро пожаловать в систему проживания <span style="color: #38bdf8">Алабуга</span>',
            'hero_description' => 'Интерактивный сервис бронирования жилых помещений, работы с командами и расселения участников форума в реальном времени.',
            'hero_button_text' => 'Войти / Зарегистрироваться',
            'hero_button_text_auth' => 'Перейти в личный кабинет',
        ]);
    }
    jsonResponse($settings);
}

if ($uri === 'settings' && $method === 'POST') {
    requireAuth($pdo);
    $allowed = ['site_title', 'hero_badge', 'hero_title', 'hero_description', 'hero_button_text', 'hero_button_text_auth'];
    $fields = [];
    $values = [];
    foreach ($allowed as $key) {
        if (isset($data[$key])) {
            $fields[] = "$key = ?";
            $values[] = $data[$key];
        }
    }
    if (empty($fields)) {
        jsonError('Нет данных для обновления');
    }
    $sql = "UPDATE settings SET " . implode(', ', $fields) . " WHERE id = 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);
    jsonResponse(['success' => true]);
}

// ============================================================
//  ГЛОБАЛЬНОЕ УВЕДОМЛЕНИЕ
// ============================================================

if ($uri === 'global-notification' && $method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM global_notifications WHERE id = 1");
    $notif = $stmt->fetch();
    jsonResponse(['notification' => $notif ?: null]);
}

if ($uri === 'global-notification' && $method === 'POST') {
    requireAuth($pdo);
    $text = trim($data['text'] ?? '');
    $type = $data['type'] ?? 'permanent';
    $enabled = isset($data['enabled']) ? (int)(bool)$data['enabled'] : 0;
    $stmt = $pdo->prepare("INSERT INTO global_notifications (id, text, type, enabled) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE text = ?, type = ?, enabled = ?");
    $stmt->execute([$text, $type, $enabled, $text, $type, $enabled]);
    jsonResponse(['success' => true]);
}

if ($uri === 'global-notification/viewed' && $method === 'POST') {
    // Отмечаем просмотр - в реальности должно быть связано с пользователем,
    // но для простоты просто отвечаем успехом
    jsonResponse(['success' => true]);
}

// ============================================================
//  СТАТИСТИКА ДЛЯ АДМИНКИ
// ============================================================

if ($uri === 'admin/stats' && $method === 'GET') {
    requireAuth($pdo);

    $buildings = (int)$pdo->query("SELECT COUNT(*) FROM buildings")->fetchColumn();
    $rooms = (int)$pdo->query("SELECT COUNT(*) FROM rooms WHERE room_type = 'room'")->fetchColumn();
    $totalSeats = (int)$pdo->query("SELECT COALESCE(SUM(capacity), 0) FROM rooms WHERE room_type = 'room'")->fetchColumn();

    $stmt = $pdo->query("SELECT COUNT(*) FROM bookings WHERE status NOT IN ('rejected', 'archived')");
    $occupiedSeats = (int)$stmt->fetchColumn();

    $totalBookings = (int)$pdo->query("SELECT COUNT(*) FROM bookings")->fetchColumn();

    $statusCounts = [
        'pending' => 0,
        'approved' => 0,
        'approved_bot' => 0,
        'rejected' => 0,
    ];
    $stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM bookings GROUP BY status");
    foreach ($stmt->fetchAll() as $row) {
        if (isset($statusCounts[$row['status']])) {
            $statusCounts[$row['status']] = (int)$row['cnt'];
        }
    }

    $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();

    jsonResponse([
        'buildings' => $buildings,
        'rooms' => $rooms,
        'total_seats' => $totalSeats,
        'occupied_seats' => $occupiedSeats,
        'total_bookings' => $totalBookings,
        'status_counts' => $statusCounts,
        'active_users' => $activeUsers,
    ]);
}

// ============================================================
//  ЭКСПОРТ И АРХИВИРОВАНИЕ
// ============================================================

if ($uri === 'admin/export/bookings' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->query("
        SELECT b.*, u.last_name, u.first_name, u.phone as user_phone, u.login,
               r.room_number, r.capacity, r.gender,
               bu.name as building_name, f.floor_number
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN rooms r ON b.room_id = r.id
        LEFT JOIN buildings bu ON r.building_id = bu.id
        LEFT JOIN floors f ON r.floor_id = f.id
        ORDER BY b.created_at DESC
    ");
    jsonResponse($stmt->fetchAll());
}

if ($uri === 'admin/export/layouts' && $method === 'GET') {
    requireAuth($pdo);
    $buildings = $pdo->query("SELECT * FROM buildings")->fetchAll();
    foreach ($buildings as &$b) {
        $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
        $stmt->execute([$b['id']]);
        $floors = $stmt->fetchAll();
        foreach ($floors as &$f) {
            $stmt = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ?");
            $stmt->execute([$f['id']]);
            $f['rooms'] = $stmt->fetchAll();
        }
        $b['floors'] = $floors;
    }
    jsonResponse($buildings);
}

if ($uri === 'admin/archive/bookings' && $method === 'POST') {
    requireAuth($pdo);
    $stmt = $pdo->exec("UPDATE bookings SET status = 'archived' WHERE status IN ('pending', 'approved', 'approved_bot')");
    jsonResponse(['affected' => $stmt]);
}

if ($uri === 'admin/archive/users' && $method === 'POST') {
    requireAuth($pdo);
    $stmt = $pdo->exec("UPDATE users SET status = 'archived' WHERE role = 'user' AND status = 'active'");
    jsonResponse(['affected' => $stmt]);
}

// ============================================================
//  УПРАВЛЕНИЕ КОРПУСАМИ
// ============================================================

if ($resource === 'admin' && $id === 'buildings' && $subresource === null && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->query("SELECT * FROM buildings ORDER BY id ASC");
    jsonResponse($stmt->fetchAll());
}

if ($resource === 'admin' && $id === 'buildings' && $subresource === null && $method === 'POST') {
    requireAuth($pdo);
    $name = trim($data['name'] ?? '');
    $gender = $data['gender'] ?? 'MIXED';
    if (!$name) jsonError('Введите название корпуса');
    $stmt = $pdo->prepare("INSERT INTO buildings (name, gender) VALUES (?, ?)");
    $stmt->execute([$name, $gender]);
    jsonResponse(['id' => (int)$pdo->lastInsertId(), 'success' => true], 201);
}

if ($resource === 'admin' && is_numeric($id) && $subresource === null && $method === 'DELETE') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("DELETE FROM buildings WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['success' => true]);
}

if ($resource === 'admin' && $id === 'buildings' && is_numeric($subresource) && $subid === 'floors' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
    $stmt->execute([$subresource]);
    jsonResponse($stmt->fetchAll());
}

// ============================================================
//  УПРАВЛЕНИЕ ЭТАЖАМИ
// ============================================================

if ($resource === 'admin' && $id === 'floors' && $subresource === null && $method === 'POST') {
    requireAuth($pdo);
    $buildingId = (int)($data['building_id'] ?? 0);
    $floorNumber = (int)($data['floor_number'] ?? 0);
    $width = (int)($data['width'] ?? 8);
    $gender = $data['gender'] ?? 'DEFAULT';
    $startRoomNumber = isset($data['start_room_number']) ? (int)$data['start_room_number'] : null;
    $roomOrderType = $data['room_order_type'] ?? 'clockwise';

    if (!$buildingId || !$floorNumber) jsonError('Не указаны building_id или floor_number');

    if ($startRoomNumber === null) {
        // Автоподсчёт начального номера
        $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number DESC LIMIT 1");
        $stmt->execute([$buildingId]);
        $lastFloor = $stmt->fetch();
        if ($lastFloor) {
            $startRoomNumber = ($lastFloor['start_room_number'] ?? 1) + ((int)$lastFloor['width'] * 2);
        } else {
            $startRoomNumber = 1;
        }
    }

    $stmt = $pdo->prepare("INSERT INTO floors (building_id, floor_number, width, gender, start_room_number, room_order_type) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$buildingId, $floorNumber, $width, $gender, $startRoomNumber, $roomOrderType]);
    jsonResponse(['id' => (int)$pdo->lastInsertId(), 'success' => true], 201);
}

if ($resource === 'admin' && is_numeric($id) && $subresource === null && $method === 'DELETE') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("DELETE FROM floors WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['success' => true]);
}

if ($resource === 'admin' && $id === 'floors' && is_numeric($subresource) && $subid === 'rooms' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? ORDER BY x_pos ASC, y_pos ASC");
    $stmt->execute([$subresource]);
    jsonResponse($stmt->fetchAll());
}

// ============================================================
//  УПРАВЛЕНИЕ КОМНАТАМИ
// ============================================================

if ($resource === 'admin' && $id === 'rooms' && $subresource === null && $method === 'POST') {
    requireAuth($pdo);
    $floorId = (int)($data['floor_id'] ?? 0);
    $buildingId = (int)($data['building_id'] ?? 0);
    $roomNumber = $data['room_number'] ?? '';
    $name = $data['name'] ?? 'Комната';
    $capacity = (int)($data['capacity'] ?? 2);
    $isTechnical = (int)($data['is_technical'] ?? 0);
    $roomType = $data['room_type'] ?? 'room';
    $gender = $data['gender'] ?? 'DEFAULT';
    $xPos = (int)($data['x_pos'] ?? 0);
    $yPos = (int)($data['y_pos'] ?? 0);

    if (!$floorId || !$buildingId) jsonError('Не указаны floor_id или building_id');

    if (isset($data['id']) && $data['id']) {
        // Обновление
        $stmt = $pdo->prepare("UPDATE rooms SET room_number = ?, name = ?, capacity = ?, is_technical = ?, room_type = ?, gender = ?, x_pos = ?, y_pos = ? WHERE id = ?");
        $stmt->execute([$roomNumber, $name, $capacity, $isTechnical, $roomType, $gender, $xPos, $yPos, $data['id']]);
        jsonResponse(['id' => (int)$data['id'], 'success' => true]);
    } else {
        // Вставка
        $stmt = $pdo->prepare("INSERT INTO rooms (floor_id, building_id, room_number, name, capacity, is_technical, room_type, gender, x_pos, y_pos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$floorId, $buildingId, $roomNumber, $name, $capacity, $isTechnical, $roomType, $gender, $xPos, $yPos]);
        jsonResponse(['id' => (int)$pdo->lastInsertId(), 'success' => true], 201);
    }
}

if ($resource === 'admin' && is_numeric($id) && $subresource === null && $method === 'DELETE') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("DELETE FROM rooms WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['success' => true]);
}

// ============================================================
//  БРОНИРОВАНИЯ (админка)
// ============================================================

if ($resource === 'admin' && $id === 'bookings' && $subresource === null && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->query("
        SELECT b.*, u.last_name, u.first_name as user_name, u.phone as user_phone,
               r.room_number, r.capacity, r.gender,
               bu.name as building_name, bu.id as building_id, f.floor_number
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN rooms r ON b.room_id = r.id
        LEFT JOIN buildings bu ON r.building_id = bu.id
        LEFT JOIN floors f ON r.floor_id = f.id
        ORDER BY b.created_at DESC
    ");
    jsonResponse($stmt->fetchAll());
}

if ($resource === 'rooms' && is_numeric($id) && $subresource === 'bookings' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT b.*, u.last_name, u.first_name as user_name, u.phone as user_phone
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.room_id = ? AND b.status NOT IN ('rejected', 'archived')
        ORDER BY b.created_at DESC
    ");
    $stmt->execute([$id]);
    jsonResponse($stmt->fetchAll());
}

if ($uri === 'admin/bookings/update' && $method === 'POST') {
    requireAuth($pdo);
    $bookingId = (int)($data['id'] ?? 0);
    if (!$bookingId) jsonError('ID бронирования не указан');

    $updateFields = [];
    $values = [];

    if (isset($data['room_id'])) {
        $updateFields[] = "room_id = ?";
        $values[] = (int)$data['room_id'];
    }
    if (isset($data['status'])) {
        $updateFields[] = "status = ?";
        $values[] = $data['status'];
    }
    if (isset($data['comment'])) {
        $updateFields[] = "comment = ?";
        $values[] = $data['comment'];
    }

    if (empty($updateFields)) {
        jsonError('Нет данных для обновления');
    }

    $sql = "UPDATE bookings SET " . implode(', ', $updateFields) . " WHERE id = ?";
    $values[] = $bookingId;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);
    jsonResponse(['success' => true]);
}

if ($uri === 'admin/all-rooms' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->query("
        SELECT r.id, r.room_number, r.name, r.capacity, r.gender,
               b.name as building_name, f.floor_number, r.building_id, r.floor_id
        FROM rooms r
        JOIN buildings b ON r.building_id = b.id
        JOIN floors f ON r.floor_id = f.id
        WHERE r.room_type = 'room'
        ORDER BY b.name, f.floor_number, r.room_number
    ");
    jsonResponse($stmt->fetchAll());
}

// ============================================================
//  ПОЛЬЗОВАТЕЛИ (админка)
// ============================================================

if ($uri === 'admin/users' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->query("
        SELECT u.*, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        ORDER BY u.id ASC
    ");
    $users = $stmt->fetchAll();
    foreach ($users as &$u) {
        unset($u['password']);
    }
    jsonResponse($users);
}

if ($uri === 'admin/users/update' && $method === 'POST') {
    requireAuth($pdo);
    $userId = (int)($data['id'] ?? 0);
    if (!$userId) jsonError('ID пользователя не указан');

    $updateFields = [];
    $values = [];

    foreach (['first_name', 'last_name', 'phone', 'email', 'role', 'status', 'team_id'] as $field) {
        if (isset($data[$field])) {
            $updateFields[] = "$field = ?";
            $values[] = $data[$field];
        }
    }

    if (!empty($data['password'])) {
        $updateFields[] = "password = ?";
        $values[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }

    if (empty($updateFields)) {
        jsonError('Нет данных для обновления');
    }

    $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ?";
    $values[] = $userId;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);
    jsonResponse(['success' => true]);
}

if ($resource === 'admin' && $id === 'users' && is_numeric($subresource) && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT u.*, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.id = ?
    ");
    $stmt->execute([$subresource]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Пользователь не найден', 404);
    unset($user['password']);

    // Текущее бронирование
    $stmt = $pdo->prepare("
        SELECT b.*, r.room_number, f.floor_number, b.name as building_name
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN buildings b ON r.building_id = b.id
        JOIN floors f ON r.floor_id = f.id
        WHERE b.user_id = ? AND b.status NOT IN ('rejected', 'archived')
        ORDER BY b.created_at DESC LIMIT 1
    ");
    $stmt->execute([$subresource]);
    $user['current_booking'] = $stmt->fetch() ?: null;

    jsonResponse($user);
}

// ============================================================
//  КОМАНДЫ (админка)
// ============================================================

if ($uri === 'admin/teams' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->query("
        SELECT t.*, COUNT(tm.id) as members_count
        FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id
        GROUP BY t.id
        ORDER BY t.name
    ");
    $teams = $stmt->fetchAll();
    foreach ($teams as &$t) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE team_id = ?");
        $stmt->execute([$t['id']]);
        $t['members_count'] += (int)$stmt->fetchColumn();
    }
    jsonResponse($teams);
}

if ($uri === 'admin/teams' && $method === 'POST') {
    requireAuth($pdo);
    $name = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');
    $action = $data['action'] ?? 'create';

    if ($action === 'create') {
        if (!$name) jsonError('Введите название команды');
        $stmt = $pdo->prepare("INSERT INTO teams (name, description) VALUES (?, ?)");
        $stmt->execute([$name, $description]);
        $teamId = (int)$pdo->lastInsertId();
        // Создаём капитана
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'captain')");
        $stmt->execute([$teamId, $user['id']]);
        $stmt = $pdo->prepare("UPDATE users SET team_id = ? WHERE id = ?");
        $stmt->execute([$teamId, $user['id']]);
        jsonResponse(['id' => $teamId, 'success' => true], 201);
    } elseif ($action === 'update') {
        $teamId = (int)($data['id'] ?? 0);
        if (!$teamId || !$name) jsonError('Не указаны id или name');
        $stmt = $pdo->prepare("UPDATE teams SET name = ?, description = ? WHERE id = ?");
        $stmt->execute([$name, $description, $teamId]);
        jsonResponse(['success' => true]);
    }
}

if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $method === 'DELETE') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("DELETE FROM team_members WHERE team_id = ?");
    $stmt->execute([$subresource]);
    $stmt = $pdo->prepare("UPDATE users SET team_id = NULL WHERE team_id = ?");
    $stmt->execute([$subresource]);
    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
    $stmt->execute([$subresource]);
    jsonResponse(['success' => true]);
}

// Участники команды
if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'members' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT u.id, u.first_name, u.last_name, u.login, u.role, u.phone,
               COALESCE(tm.role, 'member') as member_role
        FROM users u
        LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
        WHERE u.team_id = ?
        ORDER BY u.last_name
    ");
    $stmt->execute([$subresource, $subresource]);
    jsonResponse($stmt->fetchAll());
}

if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'members' && $method === 'POST') {
    requireAuth($pdo);
    $userId = (int)($data['user_id'] ?? 0);
    if (!$userId) jsonError('user_id не указан');
    $stmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')");
    $stmt->execute([$subresource, $userId]);
    $stmt = $pdo->prepare("UPDATE users SET team_id = ? WHERE id = ?");
    $stmt->execute([$subresource, $userId]);
    jsonResponse(['success' => true], 201);
}

if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'members' && is_numeric(($parts[4] ?? null)) && $method === 'DELETE') {
    requireAuth($pdo);
    $userId = (int)$parts[4];
    $stmt = $pdo->prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?");
    $stmt->execute([$subresource, $userId]);
    $stmt = $pdo->prepare("UPDATE users SET team_id = NULL WHERE id = ?");
    $stmt->execute([$userId]);
    jsonResponse(['success' => true]);
}

// Чат команды (админ)
if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'chat' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT m.id, m.message, m.created_at, u.first_name, u.last_name, u.role
        FROM team_chat_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.team_id = ?
        ORDER BY m.created_at ASC
    ");
    $stmt->execute([$subresource]);
    $messages = $stmt->fetchAll();
    foreach ($messages as &$msg) {
        $msg['is_curator'] = in_array(strtolower($msg['role']), ['admin', 'moderator']);
    }
    jsonResponse($messages);
}

if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'chat' && $method === 'POST') {
    requireAuth($pdo);
    $message = trim($data['message'] ?? '');
    if (!$message) jsonError('Сообщение не может быть пустым');
    $user = requireAuth($pdo);
    $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
    $stmt->execute([$subresource, $user['id'], $message]);
    jsonResponse(['success' => true], 201);
}

// Календарь команды (админ)
if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'calendar' && $method === 'GET') {
    requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT * FROM team_calendar_events
        WHERE team_id = ?
        ORDER BY event_date ASC
    ");
    $stmt->execute([$subresource]);
    jsonResponse($stmt->fetchAll());
}

if ($resource === 'admin' && $id === 'teams' && is_numeric($subresource) && $subid === 'calendar' && $method === 'POST') {
    requireAuth($pdo);
    $title = trim($data['title'] ?? '');
    $eventDate = $data['event_date'] ?? '';
    $description = trim($data['description'] ?? '');
    if (!$title || !$eventDate) jsonError('Укажите название и дату события');
    $stmt = $pdo->prepare("INSERT INTO team_calendar_events (team_id, title, event_date, description) VALUES (?, ?, ?, ?)");
    $stmt->execute([$subresource, $title, $eventDate, $description]);
    jsonResponse(['success' => true], 201);
}

if ($resource === 'admin' && $id === 'teams' && $subresource === 'calendar' && is_numeric(($parts[4] ?? null)) && $method === 'DELETE') {
    requireAuth($pdo);
    $eventId = (int)$parts[4];
    $stmt = $pdo->prepare("DELETE FROM team_calendar_events WHERE id = ?");
    $stmt->execute([$eventId]);
    jsonResponse(['success' => true]);
}

// ============================================================
//  ЛИЧНЫЙ КАБИНЕТ ПОЛЬЗОВАТЕЛЯ
// ============================================================

if ($uri === 'my-booking' && $method === 'GET') {
    $user = requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT b.*, r.room_number, bu.name as building_name, f.floor_number
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN buildings bu ON r.building_id = bu.id
        JOIN floors f ON r.floor_id = f.id
        WHERE b.user_id = ? AND b.status NOT IN ('rejected', 'archived')
        ORDER BY b.created_at DESC LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $booking = $stmt->fetch();
    jsonResponse(['booking' => $booking ?: null]);
}

if ($uri === 'my-bookings' && $method === 'GET') {
    $user = requireAuth($pdo);
    $stmt = $pdo->prepare("
        SELECT b.id, b.status, b.comment, b.created_at,
               r.room_number, bu.name as building_name, f.floor_number
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN buildings bu ON r.building_id = bu.id
        JOIN floors f ON r.floor_id = f.id
        WHERE b.user_id = ? AND b.status <> 'archived'
        ORDER BY b.created_at DESC
    ");
    $stmt->execute([$user['id']]);
    jsonResponse($stmt->fetchAll());
}

if ($uri === 'my-team' && $method === 'GET') {
    $user = requireAuth($pdo);
    $teamId = (int)$user['team_id'];
    if (!$teamId) jsonResponse(['team' => null]);

    $stmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
    $stmt->execute([$teamId]);
    $team = $stmt->fetch();
    if (!$team) jsonResponse(['team' => null]);

    $stmt = $pdo->prepare("
        SELECT u.id, u.first_name, u.last_name, u.role, u.login,
               COALESCE(tm.role, 'member') as member_role
        FROM users u
        LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
        WHERE u.team_id = ?
        ORDER BY u.last_name
    ");
    $stmt->execute([$teamId, $teamId]);
    $members = $stmt->fetchAll();

    jsonResponse(['team' => $team, 'members' => $members]);
}

if ($uri === 'my-team/chat' && $method === 'GET') {
    $user = requireAuth($pdo);
    $teamId = (int)$user['team_id'];
    if (!$teamId) jsonError('Вы не состоите в команде', 403);

    $stmt = $pdo->prepare("
        SELECT m.id, m.message, m.created_at, u.first_name, u.last_name, u.role
        FROM team_chat_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.team_id = ?
        ORDER BY m.created_at
    ");
    $stmt->execute([$teamId]);
    $messages = $stmt->fetchAll();
    foreach ($messages as &$msg) {
        $msg['is_curator'] = in_array(strtolower($msg['role']), ['admin', 'moderator']);
    }
    jsonResponse($messages);
}

if ($uri === 'my-team/chat' && $method === 'POST') {
    $user = requireAuth($pdo);
    $teamId = (int)$user['team_id'];
    if (!$teamId) jsonError('Вы не состоите в команде', 403);

    $message = trim($data['message'] ?? '');
    if (!$message) jsonError('Сообщение не может быть пустым');

    $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
    $stmt->execute([$teamId, $user['id'], $message]);
    jsonResponse(['success' => true]);
}

if ($uri === 'my-team/calendar' && $method === 'GET') {
    $user = requireAuth($pdo);
    $teamId = (int)$user['team_id'];
    if (!$teamId) jsonError('Вы не состоите в команде', 403);

    $stmt = $pdo->prepare("
        SELECT * FROM team_calendar_events
        WHERE team_id = ?
        ORDER BY event_date
    ");
    $stmt->execute([$teamId]);
    jsonResponse($stmt->fetchAll());
}

// Обновление профиля
if ($uri === 'profile' && $method === 'POST') {
    $user = requireAuth($pdo);
    $about = trim($data['about'] ?? '');
    $socialVk = trim($data['social_vk'] ?? '');
    $socialMax = trim($data['social_max'] ?? '');
    $socialTelegram = trim($data['social_telegram'] ?? '');
    $socialInstagram = trim($data['social_instagram'] ?? '');

    $stmt = $pdo->prepare("UPDATE users SET about = ?, social_vk = ?, social_max = ?, social_telegram = ?, social_instagram = ? WHERE id = ?");
    $stmt->execute([$about, $socialVk, $socialMax, $socialTelegram, $socialInstagram, $user['id']]);
    jsonResponse(['success' => true]);
}

// ============================================================
//  ПУБЛИЧНЫЕ ДАННЫЕ ДЛЯ БРОНИРОВАНИЯ
// ============================================================

if ($uri === 'public/buildings' && $method === 'GET') {
    $stmt = $pdo->query("
        SELECT b.id, b.name, b.gender,
               (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id AND r.room_type = 'room') as total_rooms,
               (SELECT COALESCE(SUM(r.capacity), 0) FROM rooms r WHERE r.building_id = b.id AND r.room_type = 'room') as total_capacity,
               (SELECT COUNT(*) FROM bookings bk
                JOIN rooms r2 ON bk.room_id = r2.id
                WHERE r2.building_id = b.id AND bk.status NOT IN ('rejected', 'archived')) as occupied_places
        FROM buildings b
        ORDER BY b.name
    ");
    jsonResponse($stmt->fetchAll());
}

if ($resource === 'public' && $id === 'buildings' && is_numeric($subresource) && $subid === 'layout' && $method === 'GET') {
    $buildingId = (int)$subresource;

    $stmt = $pdo->prepare("SELECT * FROM buildings WHERE id = ?");
    $stmt->execute([$buildingId]);
    $building = $stmt->fetch();
    if (!$building) jsonError('Корпус не найден', 404);

    $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
    $stmt->execute([$buildingId]);
    $floors = $stmt->fetchAll();

    foreach ($floors as &$f) {
        $stmt = $pdo->prepare("
            SELECT r.*, 
                   (SELECT COUNT(*) FROM bookings bk WHERE bk.room_id = r.id AND bk.status NOT IN ('rejected', 'archived')) as occupied
            FROM rooms r
            WHERE r.floor_id = ?
            ORDER BY r.x_pos, r.y_pos
        ");
        $stmt->execute([$f['id']]);
        $f['rooms'] = $stmt->fetchAll();
    }

    jsonResponse(['building' => $building, 'floors' => $floors]);
}

// ============================================================
//  БРОНИРОВАНИЕ КОМНАТЫ
// ============================================================

if ($uri === 'book' && $method === 'POST') {
    $roomId = (int)($data['room_id'] ?? 0);
    if (!$roomId) jsonError('room_id не указан');

    $room = getRoomWithDetails($pdo, $roomId);
    if (!$room) jsonError('Комната не найдена', 404);

    $mode = $data['mode'] ?? '';
    $token = null;
    $userId = null;

    if ($mode === 'existing' || isset($data['token'])) {
        $user = requireAuth($pdo);
        $userId = (int)$user['id'];
        $token = $user['token'];
    } elseif ($mode === 'login') {
        $login = trim($data['login'] ?? '');
        $password = $data['password'] ?? '';
        if (!$login || !$password) jsonError('Введите логин/телефон и пароль');
        $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ? OR phone = ?");
        $stmt->execute([$login, $login]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password'])) {
            jsonError('Неверный логин или пароль', 401);
        }
        $userId = (int)$user['id'];
        $token = generateToken();
        $stmt = $pdo->prepare("UPDATE users SET token = ? WHERE id = ?");
        $stmt->execute([$token, $userId]);
    } elseif ($mode === 'register') {
        $lastName = trim($data['last_name'] ?? '');
        $firstName = trim($data['first_name'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $password = $data['password'] ?? '';
        $login = trim($data['login'] ?? '');

        if (!$lastName || !$firstName || !$phone || strlen($password) < 6) {
            jsonError('Заполните все обязательные поля (пароль минимум 6 символов)');
        }
        if (empty($login)) {
            $login = strtolower(transliterate($lastName . '_' . $firstName));
        }
        $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ? OR phone = ?");
        $stmt->execute([$login, $phone]);
        if ($stmt->fetch()) {
            jsonError('Такой логин или телефон уже используется');
        }
        $token = generateToken();
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (login, password, first_name, last_name, phone, token, role, status) VALUES (?, ?, ?, ?, ?, ?, 'user', 'active')");
        $stmt->execute([$login, $hashed, $firstName, $lastName, $phone, $token]);
        $userId = (int)$pdo->lastInsertId();
        $newUser = [
            'id' => $userId, 'login' => $login, 'first_name' => $firstName,
            'last_name' => $lastName, 'phone' => $phone, 'role' => 'user',
            'password' => $password,
        ];
    } else {
        jsonError('Не указан способ бронирования');
    }

    // Проверка на существующую активную бронь у пользователя
    $stmt = $pdo->prepare("SELECT id FROM bookings WHERE user_id = ? AND status NOT IN ('rejected', 'archived')");
    $stmt->execute([$userId]);
    if ($stmt->fetch()) {
        jsonError('У вас уже есть активное бронирование');
    }

    // Проверка вместимости комнаты
    $bookedCount = (int)$pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status NOT IN ('rejected', 'archived')")->execute([$roomId]) ?: 0;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status NOT IN ('rejected', 'archived')");
    $stmt->execute([$roomId]);
    $bookedCount = (int)$stmt->fetchColumn();
    if ($bookedCount >= (int)$room['capacity']) {
        jsonError('Комната уже заполнена');
    }

    $stmt = $pdo->prepare("INSERT INTO bookings (room_id, user_id, status, comment) VALUES (?, ?, 'pending', '')");
    $stmt->execute([$roomId, $userId]);
    $bookingId = (int)$pdo->lastInsertId();

    $booking = [
        'id' => $bookingId,
        'room_number' => $room['room_number'],
        'building_name' => $room['building_name'],
        'floor_number' => $room['floor_number'],
        'status' => 'pending',
    ];

    jsonResponse([
        'booking' => $booking,
        'token' => $token,
        'user' => $newUser ?? null,
        'new_user' => isset($newUser) ? true : false,
    ], 201);
}

// Автоматическое бронирование
if ($uri === 'auto-book' && $method === 'POST') {
    $gender = $data['gender'] ?? 'M';
    if (!in_array($gender, ['M', 'F'])) jsonError('Неверный пол');

    $mode = $data['mode'] ?? '';
    $token = null;
    $userId = null;
    $newUser = null;

    // Аналогичная логика авторизации/регистрации
    if ($mode === 'existing') {
        $user = requireAuth($pdo);
        $userId = (int)$user['id'];
        $token = $user['token'];
    } elseif ($mode === 'login') {
        $login = trim($data['login'] ?? '');
        $password = $data['password'] ?? '';
        if (!$login || !$password) jsonError('Введите логин/телефон и пароль');
        $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ? OR phone = ?");
        $stmt->execute([$login, $login]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password'])) {
            jsonError('Неверный логин или пароль', 401);
        }
        $userId = (int)$user['id'];
        $token = generateToken();
        $stmt = $pdo->prepare("UPDATE users SET token = ? WHERE id = ?");
        $stmt->execute([$token, $userId]);
    } elseif ($mode === 'register') {
        $lastName = trim($data['last_name'] ?? '');
        $firstName = trim($data['first_name'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $password = $data['password'] ?? '';
        $login = trim($data['login'] ?? '');

        if (!$lastName || !$firstName || !$phone || strlen($password) < 6) {
            jsonError('Заполните все обязательные поля (пароль минимум 6 символов)');
        }
        if (empty($login)) {
            $login = strtolower(transliterate($lastName . '_' . $firstName));
        }
        $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ? OR phone = ?");
        $stmt->execute([$login, $phone]);
        if ($stmt->fetch()) {
            jsonError('Такой логин или телефон уже используется');
        }
        $token = generateToken();
        $hashed = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (login, password, first_name, last_name, phone, token, role, status) VALUES (?, ?, ?, ?, ?, ?, 'user', 'active')");
        $stmt->execute([$login, $hashed, $firstName, $lastName, $phone, $token]);
        $userId = (int)$pdo->lastInsertId();
        $newUser = [
            'id' => $userId, 'login' => $login, 'first_name' => $firstName,
            'last_name' => $lastName, 'phone' => $phone, 'role' => 'user',
            'password' => $password,
        ];
    } else {
        jsonError('Не указан способ бронирования');
    }

    // Проверка на существующую активную бронь
    $stmt = $pdo->prepare("SELECT id FROM bookings WHERE user_id = ? AND status NOT IN ('rejected', 'archived')");
    $stmt->execute([$userId]);
    if ($stmt->fetch()) {
        jsonError('У вас уже есть активное бронирование');
    }

    // Ищем первую доступную комнату подходящего пола
    $genderCondition = $gender === 'M' ? "gender IN ('M', 'MIXED')" : "gender IN ('F', 'MIXED')";
    $stmt = $pdo->query("
        SELECT r.*, b.name as building_name, f.floor_number
        FROM rooms r
        JOIN buildings b ON r.building_id = b.id
        JOIN floors f ON r.floor_id = f.id
        WHERE r.room_type = 'room'
          AND {$genderCondition}
          AND r.capacity > (SELECT COUNT(*) FROM bookings bk WHERE bk.room_id = r.id AND bk.status NOT IN ('rejected', 'archived'))
        ORDER BY b.name, f.floor_number, r.room_number
        LIMIT 1
    ");
    $room = $stmt->fetch();

    if (!$room) {
        jsonError('Нет доступных комнат для вашего пола');
    }

    $stmt = $pdo->prepare("INSERT INTO bookings (room_id, user_id, status, comment) VALUES (?, ?, 'pending', '')");
    $stmt->execute([$room['id'], $userId]);
    $bookingId = (int)$pdo->lastInsertId();

    $booking = [
        'id' => $bookingId,
        'room_number' => $room['room_number'],
        'building_name' => $room['building_name'],
        'floor_number' => $room['floor_number'],
        'status' => 'pending',
    ];

    jsonResponse([
        'booking' => $booking,
        'token' => $token,
        'user' => $newUser ?? null,
        'new_user' => isset($newUser) ? true : false,
    ], 201);
}

// ============================================================
//  ОБЩИЕ МАРШРУТЫ НЕ НАЙДЕНЫ
// ============================================================

function transliterate($string) {
    $converter = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
        'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
        'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
        'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
        'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'ts', 'ч' => 'ch',
        'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
        'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        'А' => 'A', 'Б' => 'B', 'В' => 'V', 'Г' => 'G', 'Д' => 'D',
        'Е' => 'E', 'Ё' => 'E', 'Ж' => 'Zh', 'З' => 'Z', 'И' => 'I',
        'Й' => 'Y', 'К' => 'K', 'Л' => 'L', 'М' => 'M', 'Н' => 'N',
        'О' => 'O', 'П' => 'P', 'Р' => 'R', 'С' => 'S', 'Т' => 'T',
        'У' => 'U', 'Ф' => 'F', 'Х' => 'H', 'Ц' => 'Ts', 'Ч' => 'Ch',
        'Ш' => 'Sh', 'Щ' => 'Sch', 'Ъ' => '', 'Ы' => 'Y', 'Ь' => '',
        'Э' => 'E', 'Ю' => 'Yu', 'Я' => 'Ya',
    ];
    return strtr($string, $converter);
}

function getRoomWithDetails($pdo, $roomId) {
    $stmt = $pdo->prepare("
        SELECT r.*, b.name as building_name, f.floor_number
        FROM rooms r
        JOIN buildings b ON r.building_id = b.id
        JOIN floors f ON r.floor_id = f.id
        WHERE r.id = ?
    ");
    $stmt->execute([$roomId]);
    return $stmt->fetch();
}

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
        // Таблицы ещё не созданы - ничего не делаем, ошибки будут позже
    }
}

// Если дошли до сюда - маршрут не найден
jsonError('Маршрут не найден: ' . $uri, 404);