<?php
// ... (предыдущий код без изменений) ...

    if ($uri === 'register') {
        if ($method === 'POST') {
            $firstName = trim($data['first_name'] ?? '');
            $lastName = trim($data['last_name'] ?? '');
            $phone = trim($data['phone'] ?? '');
            $password = trim($data['password'] ?? '');
            $customLogin = trim($data['login'] ?? ''); // новое поле

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

            // Определяем логин: если введён пользователем — используем его, иначе генерируем
            if (!empty($customLogin)) {
                $autoLogin = $customLogin;
            } else {
                $autoLogin = 'u' . substr($phoneDigits, -8);
            }

            // Проверка уникальности логина
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
            $stmt->execute([$autoLogin]);
            if ($stmt->fetchColumn() > 0) {
                // Если логин занят, а он сгенерирован — пробуем добавить суффикс
                if (empty($customLogin)) {
                    $counter = 1;
                    do {
                        $autoLogin = 'u' . substr($phoneDigits, -8) . $counter;
                        $stmt->execute([$autoLogin]);
                        $exists = $stmt->fetchColumn() > 0;
                        $counter++;
                    } while ($exists && $counter < 100);
                } else {
                    http_response_code(400);
                    echo json_encode(['error' => 'Пользователь с таким логином уже зарегистрирован']);
                    exit();
                }
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

// ... (остальной код без изменений) ...