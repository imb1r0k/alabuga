<?php
// =============================================================================
// Модуль: Автоматическое бронирование
// Маршрут: auto-book
// =============================================================================

if ($uri === 'auto-book') {
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

    $mode = $data['mode'] ?? 'login';
    $gender = strtoupper(trim($data['gender'] ?? ''));
    if (!in_array($gender, ['M', 'F'], true)) jsonError('Пол обязателен (M или F)', 400);

    $user = null;
    $isNewUser = false;

    if ($mode === 'existing') {
        $user = requireAuth($pdo);
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
            'id' => $userId, 'first_name' => $firstName, 'last_name' => $lastName,
            'patronymic' => $patronymic, 'name' => $fullName, 'login' => $finalLogin,
            'phone' => $phone, 'role' => 'user', 'status' => 'active', 'password' => $password,
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
            'input' => $loginInput, 'digits' => $phoneDigits, 'digits2' => $phoneDigits,
        ]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password'])) {
            jsonError('Неверный логин/телефон или пароль', 401);
        }
        unset($user['password']);
    }

    // Проверка на существующую активную заявку
    $stmt = $pdo->prepare("SELECT b.id FROM bookings b WHERE b.user_id = ? AND b.status IN ('pending', 'approved', 'approved_bot') LIMIT 1");
    $stmt->execute([$user['id']]);
    if ($stmt->fetch()) {
        jsonError("У вас уже есть активная заявка на заселение.", 400);
    }

    // Определяем режим автозаселения из настроек
    $autoBookMode = 'gender';
    $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'auto-book-mode'");
    $stmt->execute();
    $modeVal = $stmt->fetchColumn();
    if ($modeVal === 'gender_and_vk_duplicate') $autoBookMode = 'gender_and_vk_duplicate';

    // Поиск свободной комнаты
    $available = autoBookFindAvailableRoom($pdo, $gender, $autoBookMode, $user['id']);
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

// ─── Вспомогательная функция поиска свободной комнаты ─────────────────────

function autoBookFindAvailableRoom($pdo, $gender, $mode = 'gender', $userId = null) {
    // Если режим gender_and_vk_duplicate — ищем дубликат по фамилии+имени среди
    // аккаунтов, созданных ботом ВК (vk_url не пуст, bot_registered = 1)
    $duplicateUser = null;
    $duplicateGender = null;
    if ($mode === 'gender_and_vk_duplicate' && $userId) {
        $stmt = $pdo->prepare("SELECT last_name, first_name FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $cur = $stmt->fetch();
        if ($cur && !empty($cur['last_name']) && !empty($cur['first_name'])) {
            $dupStmt = $pdo->prepare("
                SELECT id, last_name, first_name
                FROM users
                WHERE last_name = ? AND first_name = ?
                  AND vk_url IS NOT NULL AND vk_url != ''
                  AND bot_registered = 1
                  AND id != ?
                LIMIT 1
            ");
            $dupStmt->execute([$cur['last_name'], $cur['first_name'], $userId]);
            $duplicateUser = $dupStmt->fetch();
        }
        if ($duplicateUser) {
            $detected = detectGenderByLastName($duplicateUser['last_name'] ?? '');
            $duplicateGender = $detected ?: 'M';
        }
    }

    // Пол для поиска: если нашли дубль — используем его пол, иначе исходный
    $searchGender = $duplicateGender ?: $gender;

    $buildings = $pdo->prepare("SELECT * FROM buildings WHERE gender = 'MIXED' OR gender = ? ORDER BY id ASC");
    $buildings->execute([$searchGender]);
    foreach ($buildings as $building) {
        $floors = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
        $floors->execute([$building['id']]);
        foreach ($floors as $floor) {
            $floorEffGender = $floor['gender'] != 'DEFAULT' ? $floor['gender'] : $building['gender'];
            $rooms = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? AND room_type='room' AND is_technical=0 ORDER BY room_number ASC");
            $rooms->execute([$floor['id']]);
            foreach ($rooms as $room) {
                $roomEffGender = $room['gender'] != 'DEFAULT' ? $room['gender'] : $floorEffGender;
                if ($roomEffGender !== 'MIXED' && $roomEffGender != $searchGender) continue;

                // Если есть дубль — сначала проверяем, не живёт ли он в этой комнате
                if ($duplicateUser) {
                    $dupBookingStmt = $pdo->prepare("
                        SELECT COUNT(*) FROM bookings
                        WHERE room_id = ? AND user_id = ? AND status IN ('approved','approved_bot','pending')
                    ");
                    $dupBookingStmt->execute([$room['id'], $duplicateUser['id']]);
                    if ((int)$dupBookingStmt->fetchColumn() > 0) {
                        // Дубль здесь — проверяем свободное место
                        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status IN ('approved','approved_bot','pending')");
                        $cntStmt->execute([$room['id']]);
                        if ((int)$cntStmt->fetchColumn() < (int)$room['capacity']) {
                            return ['room' => $room, 'building' => $building, 'floor' => $floor];
                        }
                    }
                }

                // Стандартная проверка: свободна ли комната
                $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status IN ('approved','approved_bot','pending')");
                $cntStmt->execute([$room['id']]);
                if ((int)$cntStmt->fetchColumn() < (int)$room['capacity']) {
                    return ['room' => $room, 'building' => $building, 'floor' => $floor];
                }
            }
        }
    }
    return null;
}
