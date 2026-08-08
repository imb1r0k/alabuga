// ─── Публичный профиль пользователя ─────────────────────────────────────

if ($uri === 'public/profile') {
    $login = trim($_GET['login'] ?? '');
    if (!$login) jsonError('Логин не указан', 400);
    $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ? AND status = 'active'");
    $stmt->execute([$login]);
    $user = $stmt->fetch();
    if (!$user) jsonError('Пользователь не найден', 404);

    // Удаляем пароль
    unset($user['password']);

    // Получаем команду
    $team = null;
    $members = [];
    if ($user['team_id']) {
        $teamId = (int)$user['team_id'];
        $teamStmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
        $teamStmt->execute([$teamId]);
        $team = $teamStmt->fetch();

        $membersStmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, u.name, u.login,
                   COALESCE(tm.role, 'member') as role
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
            WHERE u.team_id = ?
            ORDER BY u.last_name ASC
        ");
        $membersStmt->execute([$teamId, $teamId]);
        $members = $membersStmt->fetchAll();
    }

    // Получаем активное бронирование (не архивное и не отклонённое)
    $booking = null;
    $stmt = $pdo->prepare("
        SELECT b.id, b.status, b.comment, r.room_number, bu.name as building_name, f.floor_number
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN buildings bu ON r.building_id = bu.id
        JOIN floors f ON r.floor_id = f.id
        WHERE b.user_id = ? AND b.status IN ('pending','approved','approved_bot')
        ORDER BY b.id DESC LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $booking = $stmt->fetch();

    jsonResponse([
        'user' => $user,
        'team' => $team,
        'members' => $members,
        'booking' => $booking
    ]);
}