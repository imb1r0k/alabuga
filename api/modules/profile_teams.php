<?php
// =============================================================================
// Модуль: Личный профиль, команды (со стороны пользователя)
// Маршруты: profile, my-team, my-team/chat, my-team/calendar, public/profile
// =============================================================================

// ─── Личный профиль ─────────────────────────────────────────────────────────

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

// ─── Моя команда ────────────────────────────────────────────────────────────

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

// ─── Публичный профиль пользователя ────────────────────────────────────────

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
