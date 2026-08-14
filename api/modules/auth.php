<?php
// =============================================================================
// Модуль: Авторизация и регистрация
// Маршруты: register, login, user, logout
// =============================================================================

// ─── Регистрация ────────────────────────────────────────────────────────────

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

// ─── Авторизация ────────────────────────────────────────────────────────────

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
        LIMIT 1
    ");
    $stmt->execute([
        'input'   => $loginInput,
        'digits'  => $phoneDigits,
        'digits2' => $phoneDigits,
    ]);
    $user = $stmt->fetch();

    if ($user && strtolower(trim($user['status'])) === 'archived') {
        jsonError('Ваш аккаунт деактивирован. Свяжитесь с администратором.', 403);
    }

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

// ─── Текущий пользователь и выход ───────────────────────────────────────────

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
