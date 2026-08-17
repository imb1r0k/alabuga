<?php
// =============================================================================
// Модуль: Бронирование (публичные маршруты)
// Маршруты: public/buildings, public/layout, book, auto-book
//           my-booking, cancel-booking, my-bookings
// =============================================================================

// ─── Список корпусов ───────────────────────────────────────────────────────

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

// ─── Планировка корпуса (публичная) ─────────────────────────────────────────

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

// ─── Бронирование (выбор комнаты) ──────────────────────────────────────────

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

    // Проверка на дубликат заявки с теми же ФИО (нельзя создавать повторные заявки)
    $dupStmt = $pdo->prepare("
        SELECT b.id FROM bookings b
        JOIN users bu ON b.user_id = bu.id
        WHERE bu.last_name = ? AND bu.first_name = ?
          AND b.status IN ('pending', 'approved', 'approved_bot')
          AND bu.id != ?
        LIMIT 1
    ");
    $dupStmt->execute([$user['last_name'], $user['first_name'], $user['id']]);
    if ($dupStmt->fetch()) {
        jsonError("Уже существует заявка на заселение с такими же именем и фамилией.", 400);
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

// ─── Моё бронирование (текущее) ─────────────────────────────────────────────

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
    $stmt = $pdo->prepare("UPDATE bookings SET status = 'recalled', comment = 'Отозвано пользователем' WHERE user_id = ? AND status IN ('pending', 'approved', 'approved_bot')");
    $stmt->execute([$user['id']]);
    if ($stmt->rowCount() === 0) {
        jsonError('Активных заявок для отзыва не найдено', 400);
    }
    jsonResponse(['success' => true, 'message' => 'Заявка успешно отозвана']);
}

// ─── История бронирований ──────────────────────────────────────────────────

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
