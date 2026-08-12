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
            $stmt = $pdo->query("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, created_at FROM users ORDER BY id DESC");
            $users = $stmt->fetchAll();
        } else {
            if (empty($curatorTeams)) {
                $users = [];
            } else {
                $placeholders = implode(',', array_fill(0, count($curatorTeams), '?'));
                $stmt = $pdo->prepare("SELECT id, first_name, last_name, patronymic, name, login as email, phone, role, status, team_name, team_id, created_at FROM users WHERE team_id IN ($placeholders) OR id = ? ORDER BY id DESC");
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
                $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, patronymic=?, name=?, phone=?, login=?, role=?, status=?, team_name=?, team_id=?, password=? WHERE id=?");
                $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $phone, $login, $role, $status, $teamNameResolved, $teamId, $hash, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, patronymic=?, name=?, phone=?, login=?, role=?, status=?, team_name=?, team_id=? WHERE id=?");
                $stmt->execute([$firstName, $lastName, $patronymic, $fullName, $phone, $login, $role, $status, $teamNameResolved, $teamId, $id]);
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
