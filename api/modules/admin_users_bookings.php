<?php
// =============================================================================
// Модуль: Админ-панель — пользователи и бронирования
// Маршруты: admin/users, admin/user-details, admin/bookings, admin/room-bookings
// =============================================================================

// ─── Пользователи ──────────────────────────────────────────────────────────

if ($uri === 'admin/users') {
    $curatorUser = requireAdmin($pdo);

    if ($method === 'GET') {
        $curatorTeams = getCuratorTeams($pdo, $curatorUser['id']);
        if ($curatorTeams === null) {
                    $stmt = $pdo->query("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, rating, created_at FROM users ORDER BY id DESC");
                    $users = $stmt->fetchAll();
                } else {
                    if (empty($curatorTeams)) {
                        $users = [];
                    } else {
                        $placeholders = implode(',', array_fill(0, count($curatorTeams), '?'));
                        $stmt = $pdo->prepare("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, rating, created_at FROM users WHERE team_id IN ($placeholders) OR id = ? ORDER BY id DESC");
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
        unset($u);

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
                $password = trim($data['password'] ?? '');
                $rating = (int)($data['rating'] ?? 0);
        
                if ($id > 0) {
                    if ($curatorUser['role'] === 'curator' && !checkCuratorAccessToUser($pdo, $curatorUser['id'], $id) && $curatorUser['id'] != $id) {
                        jsonError('У вас нет доступа к редактированию этого пользователя', 403);
                    }
        
                    $fullName = $lastName . ' ' . $firstName . ($patronymic ? ' ' . $patronymic : '');
                    $teamNameResolved = $teamName;
                    // Если команда не выбрана или не существует — пишем NULL, иначе FK-ошибка
                    if ($teamId <= 0) {
                        $teamId = null;
                        $teamNameResolved = null;
                    } elseif ($role !== 'curator') {
                        $stmt = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
                        $stmt->execute([$teamId]);
                        $resolved = $stmt->fetchColumn();
                        if ($resolved) {
                            $teamNameResolved = $resolved;
                        } else {
                            $teamId = null;
                            $teamNameResolved = null;
                        }
                    }
        
                    if ($role === 'curator') {
                        $teamId = null;
                        $teamNameResolved = null;
                    }
        
                    if ($password) {
                        $hash = password_hash($password, PASSWORD_DEFAULT);
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, patronymic=?, name=?, phone=?, login=?, role=?, status=?, team_name=?, team_id=?, password=?, rating=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $phone, $login, $role, $status, $teamNameResolved, $teamId, $hash, $rating, $id]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, patronymic=?, name=?, phone=?, login=?, role=?, status=?, team_name=?, team_id=?, rating=? WHERE id=?");
                        $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $phone, $login, $role, $status, $teamNameResolved, $teamId, $rating, $id]);
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
                $curatorTeamIds = $data['curator_team_ids'] ?? [];
                if (is_array($curatorTeamIds)) {
                    $delStmt = $pdo->prepare("DELETE FROM curator_teams WHERE user_id = ?");
                    $delStmt->execute([$id]);
                    $insStmt = $pdo->prepare("INSERT INTO curator_teams (user_id, team_id) VALUES (?, ?)");
                    foreach ($curatorTeamIds as $tid) {
                        $insStmt->execute([$id, (int)$tid]);
                    }
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

// ─── Детали пользователя (история бронирований) ───────────────────────────

if ($uri === 'admin/user-details') {
    requireAdmin($pdo);
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

// ─── Бронирования (админ) ──────────────────────────────────────────────────

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

// ─── Заявки в комнате ──────────────────────────────────────────────────────

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

// ─── Ручное создание бронирования (Заселить вручную) ──────────────────────

if ($uri === 'admin/manual-booking') {
    requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);

    $roomId = (int)($data['room_id'] ?? 0);
    $status = trim($data['status'] ?? 'pending');
    $comment = isset($data['comment']) ? trim($data['comment']) : null;

    if (!$roomId) jsonError('Комната не выбрана', 400);
    if (!in_array($status, ['pending', 'approved', 'approved_bot', 'rejected', 'recalled', 'archived'], true)) {
        $status = 'pending';
    }

    // Проверяем комнату и её вместимость
    $stmt = $pdo->prepare("SELECT r.*, bu.name as building_name, f.floor_number FROM rooms r JOIN buildings bu ON r.building_id = bu.id JOIN floors f ON r.floor_id = f.id WHERE r.id = ? AND r.room_type = 'room' AND r.is_technical = 0");
    $stmt->execute([$roomId]);
    $room = $stmt->fetch();
    if (!$room) jsonError('Комната не найдена', 400);

    $user = null;
    $isNewUser = false;

    // Вариант A: выбран существующий пользователь
    $userId = (int)($data['user_id'] ?? 0);
    if ($userId > 0) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) jsonError('Пользователь не найден', 404);
    } else {
        // Вариант B: создать нового пользователя из ФИО
        $firstName = trim($data['first_name'] ?? '');
        $lastName  = trim($data['last_name'] ?? '');
        $patronymic = trim($data['patronymic'] ?? '');
        $phone     = trim($data['phone'] ?? '');
        if (!$firstName || !$lastName) jsonError('Укажите фамилию и имя нового пользователя', 400);

        $phoneDigits = preg_replace('/\D/', '', $phone);
        if ($phoneDigits === '') $phoneDigits = rand(1000000000, 9999999999);

        $finalLogin = 'u' . substr($phoneDigits, -8);
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE login = ?");
        $stmt->execute([$finalLogin]);
        if ($stmt->fetchColumn() > 0) {
            $finalLogin = 'u' . $phoneDigits . rand(10, 99);
        }

        $password = generatePassword();
        $fullName = $lastName . ' ' . $firstName . ($patronymic ? ' ' . $patronymic : '');
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, patronymic, name, login, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active')");
        $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $finalLogin, $phoneDigits, $hash]);
        $userId = (int)$pdo->lastInsertId();

        $user = [
            'id' => $userId,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'patronymic' => $patronymic,
            'name' => $fullName,
            'login' => $finalLogin,
            'phone' => $phoneDigits,
            'role' => 'user',
            'status' => 'active',
            'password' => $password,
        ];
        $isNewUser = true;
    }

    // Проверка на существующую активную заявку у пользователя
    $stmt = $pdo->prepare("SELECT b.id FROM bookings b WHERE b.user_id = ? AND b.status IN ('pending', 'approved', 'approved_bot') AND b.room_id != ? LIMIT 1");
    $stmt->execute([$user['id'], $roomId]);
    if ($stmt->fetch()) {
        jsonError('У пользователя уже есть активная заявка на другую комнату.', 400);
    }

    // Если статус активный — проверяем вместимость комнаты
    if (in_array($status, ['pending', 'approved', 'approved_bot'], true)) {
        $occStmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE room_id = ? AND status IN ('approved','approved_bot','pending') AND user_id != ?");
        $occStmt->execute([$roomId, $user['id']]);
        if ((int)$occStmt->fetchColumn() >= (int)$room['capacity']) {
            jsonError('Эта комната уже полностью заполнена', 400);
        }
    }

    // Обновляем пол комнаты, если он не задан явно (DEFAULT/MIXED)
    if ($room['gender'] === 'DEFAULT' || $room['gender'] === 'MIXED') {
        $detectedGender = detectGenderByLastName($user['last_name'] ?? $user['name'] ?? '');
        if ($detectedGender) {
            $stmt = $pdo->prepare("UPDATE rooms SET gender = ? WHERE id = ?");
            $stmt->execute([$detectedGender, $roomId]);
        }
    }

    $stmt = $pdo->prepare("INSERT INTO bookings (user_id, room_id, status, comment) VALUES (?, ?, ?, ?)");
    $stmt->execute([$user['id'], $roomId, $status, $comment]);
    $bookingId = (int)$pdo->lastInsertId();

    jsonResponse([
        'success' => true,
        'booking_id' => $bookingId,
        'new_user' => $isNewUser,
        'user' => $isNewUser ? $user : null,
        'booking' => [
            'id' => $bookingId,
            'room_number' => $room['room_number'],
            'building_name' => $room['building_name'],
            'floor_number' => $room['floor_number'],
            'status' => $status,
        ],
    ]);
}

