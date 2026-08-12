<?php
// ─── Маршруты: Моя команда ──────────────────────────────────────────────────

/**
 * @var PDO    $pdo
 * @var string $method
 * @var array  $data
 */

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
