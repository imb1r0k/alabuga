<?php
// =============================================================================
// Модуль: Админ-панель — статистика, экспорт, очистка, автоодобрение
// Маршруты: admin/auto-approve, admin/stats, admin/export/*, admin/archive-*,
//           admin/teams/clear-all-chats
// =============================================================================

// ─── Автоодобрение бронирований ───────────────────────────────────────────

if ($uri === 'admin/auto-approve' || $uri === 'auto-approve-bookings') {
    $res = processAutoApproveBookings($pdo);
    jsonResponse($res);
}

// ─── Статистика для админ-панели ───────────────────────────────────────────

if ($uri === 'admin/stats') {
    $user = requireAdmin($pdo);

    $buildingsCount = (int)$pdo->query("SELECT COUNT(*) FROM buildings")->fetchColumn();
    $roomsCount = (int)$pdo->query("SELECT COUNT(*) FROM rooms WHERE is_technical = 0 AND room_type = 'room'")->fetchColumn();
    $totalSeats = (int)$pdo->query("SELECT COALESCE(SUM(capacity), 0) FROM rooms WHERE is_technical = 0 AND room_type = 'room'")->fetchColumn();

    $occupiedStmt = $pdo->query("SELECT COUNT(DISTINCT b.user_id) FROM bookings b WHERE b.status IN ('approved', 'approved_bot', 'pending')");
    $occupiedSeats = (int)$occupiedStmt->fetchColumn();

    $totalBookings = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status NOT IN ('archived', 'recalled')")->fetchColumn();

    $statusStmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM bookings WHERE status NOT IN ('archived', 'recalled') GROUP BY status");
    $statusCounts = ['pending' => 0, 'approved' => 0, 'approved_bot' => 0, 'rejected' => 0];
    foreach ($statusStmt->fetchAll() as $row) {
        if (isset($statusCounts[$row['status']])) {
            $statusCounts[$row['status']] = (int)$row['cnt'];
        }
    }

    $activeUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active' AND role <> 'admin'")->fetchColumn();

    jsonResponse([
        'buildings' => $buildingsCount,
        'rooms' => $roomsCount,
        'total_seats' => $totalSeats,
        'occupied_seats' => $occupiedSeats,
        'total_bookings' => $totalBookings,
        'status_counts' => $statusCounts,
        'active_users' => $activeUsers,
    ]);
}

// ─── Экспорт и Очистка ─────────────────────────────────────────────────────

if ($uri === 'admin/export/bookings') {
    $user = requireStrictAdmin($pdo);
    $stmt = $pdo->query("
        SELECT b.id, b.status, b.created_at, b.updated_at,
               u.last_name, u.first_name, u.patronymic, u.phone as user_phone, u.login, u.team_name,
               bu.name as building_name, f.floor_number, f.id as floor_id,
               r.room_number, r.capacity, r.gender
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        JOIN buildings bu ON r.building_id = bu.id
        JOIN floors f ON r.floor_id = f.id
        ORDER BY b.id DESC
    ");
    jsonResponse($stmt->fetchAll());
}

if ($uri === 'admin/export/layouts') {
    $user = requireStrictAdmin($pdo);
    $buildings = $pdo->query("SELECT * FROM buildings ORDER BY id ASC")->fetchAll();
    $result = [];

    foreach ($buildings as $building) {
        $floors = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
        $floors->execute([$building['id']]);
        $floorsData = [];

        foreach ($floors->fetchAll() as $floor) {
            $rooms = $pdo->prepare("SELECT * FROM rooms WHERE floor_id = ? ORDER BY y_pos ASC, x_pos ASC");
            $rooms->execute([$floor['id']]);
            $floorsData[] = [
                'id' => (int)$floor['id'],
                'floor_number' => (int)$floor['floor_number'],
                'width' => (int)$floor['width'],
                'start_room_number' => $floor['start_room_number'],
                'room_order_type' => $floor['room_order_type'],
                'gender' => $floor['gender'],
                'rooms' => $rooms->fetchAll(),
            ];
        }

        $result[] = [
            'id' => (int)$building['id'],
            'name' => $building['name'],
            'gender' => $building['gender'],
            'floors' => $floorsData,
        ];
    }

    jsonResponse($result);
}

if ($uri === 'admin/archive-bookings') {
    $user = requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $stmt = $pdo->prepare("UPDATE bookings SET status = 'archived' WHERE status NOT IN ('archived', 'recalled')");
    $stmt->execute();
    jsonResponse(['success' => true, 'affected' => $stmt->rowCount()]);
}

if ($uri === 'admin/archive-users') {
    $user = requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $stmt = $pdo->prepare("UPDATE users SET status = 'archived' WHERE role <> 'admin' AND status = 'active'");
    $stmt->execute();
    jsonResponse(['success' => true, 'affected' => $stmt->rowCount()]);
}

if ($uri === 'admin/teams/clear-all-chats') {
    $user = requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $stmt = $pdo->prepare("DELETE FROM team_chat_messages");
    $stmt->execute();
    jsonResponse(['success' => true, 'affected' => $stmt->rowCount()]);
}
