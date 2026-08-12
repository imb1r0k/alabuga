<?php
// ─── Маршруты: Личный профиль и мои бронирования ──────────────────────────

/**
 * @var PDO    $pdo
 * @var string $method
 * @var array  $data
 */

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

// ─── Публичный профиль ──────────────────────────────────────────────────────

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
