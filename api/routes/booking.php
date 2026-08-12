<?php
// ─── Маршруты: Бронирование ─────────────────────────────────────────────────
// Включает: моё текущее бронирование/отзыв, публичные данные корпусов,
// ручное и автоматическое бронирование.

/**
 * @var PDO    $pdo
 * @var string $method
 * @var array  $data
 */

// ─── Моё бронирование ──────────────────────────────────────────────────────

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

// ─── Публичные данные и Бронирование ─────────────────────────────────────────

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
        $floorsData[] = [
            'id' => (int)$floor['id'],
            'floor_number' => (int)$floor['floor_number'],
            'width' => (int)$floor['width'],
            'start_room_number' => $floor['start_room_number'],
            'room_order_type' => $floor['room_order_type'],
            'gender' => $floor['gender'],
            'rooms' => array_map(function($r) {
                $r['occupied'] = (int)$r['occupied'];
                return $r;
            }, $rooms->fetchAll()),
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

// ─── Ручное бронирование комнаты ─────────────────────────────────────────────

function booking_registerOrLoginUser($pdo, $data, &$isNewUser) {
    $mode = $data['mode'] ?? 'login';

    if ($mode === 'existing') {
        $user = requireAuth($pdo);
        $isNewUser = false;
        return $user;
    }

    if ($mode === 'register') {
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
        return $user;
    }

    // Режим по умолчанию — вход существующего пользователя
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
    $isNewUser = false;
    return $user;
}

function booking_hasActiveApplication($pdo, $userId) {
    $stmt = $pdo->prepare("
        SELECT b.id FROM bookings b
        WHERE b.user_id = ?
        AND b.status IN ('pending', 'approved', 'approved_bot')
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    return (bool)$stmt->fetch();
}

function booking_detectGender($pdo, $user, $room) {
    if ($room['gender'] == 'DEFAULT' || $room['gender'] == 'MIXED') {
        $detectedGender = detectGenderByLastName($user['last_name'] ?? $user['name'] ?? '');
        if ($detectedGender) {
            $stmt = $pdo->prepare("UPDATE rooms SET gender = ? WHERE id = ?");
            $stmt->execute([$detectedGender, $room['id']]);
            $room['gender'] = $detectedGender;
        }
    }
    return $room;
}

function booking_createToken($pdo) {
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$GLOBALS['__booking_user_id'] ?? 0, $token, $expiresAt]);
    return $token;
}

if ($uri === 'book') {
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

    $mode = $data['mode'] ?? 'login';
    $roomId = (int)($data['room_id'] ?? 0);

    if (!$roomId) jsonError('Комната не выбрана', 400);

    $stmt = $pdo->prepare("SELECT r.*, bu.name as building_name, f.floor_number FROM rooms r JOIN buildings bu ON r.building_id = bu.id JOIN floors f ON r.floor_id = f.id WHERE r.id = ?");
    $stmt->execute([$roomId]);
    $room = $stmt->fetch();
    if (!$room) jsonError('Комната не найдена', 404);

    $stmtOccupied = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status IN ('approved','approved_bot','pending')");
    $stmtOccupied->execute([$roomId]);
    $currentOccupied = (int)$stmtOccupied->fetchColumn();
    if ($currentOccupied >= (int)$room['capacity']) {
        jsonError('Эта комната уже полностью заполнена', 400);
    }

    $isNewUser = false;
    $user = booking_registerOrLoginUser($pdo, $data, $isNewUser);

    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    $stmt = $pdo->prepare("INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$user['id'], $token, $expiresAt]);

    $room = booking_detectGender($pdo, $user, $room);

    if (booking_hasActiveApplication($pdo, $user['id'])) {
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

// ─── Автоматическое бронирование ─────────────────────────────────────────────

function booking_getAvailableRoom($pdo, $gender) {
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

if ($uri === 'auto-book') {
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

    $mode = $data['mode'] ?? 'login';
    $gender = strtoupper(trim($data['gender'] ?? ''));
    if (!in_array($gender, ['M', 'F'], true)) jsonError('Пол обязателен (M или F)', 400);

    $isNewUser = false;
    $user = booking_registerOrLoginUser($pdo, $data, $isNewUser);

    if (booking_hasActiveApplication($pdo, $user['id'])) {
        jsonError("У вас уже есть активная заявка на заселение.", 400);
    }

    $available = booking_getAvailableRoom($pdo, $gender);
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

    $room = booking_detectGender($pdo, $user, $available['room']);

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
