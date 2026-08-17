<?php
/**
 * Маршруты бронирования и публичные данные
 */

// Получение списка общежитий / зданий (публичный маршрут)
if ($route === 'public/buildings' && $method === 'GET') {
    $stmt = $pdo->query("SELECT id, name, address, description, image_url, status FROM buildings WHERE status = 'active' ORDER BY name ASC");
    $buildings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(['success' => true, 'data' => $buildings]);
}

// Получение схемы здания (публичный маршрут)
if ($route === 'public/layout' && $method === 'GET') {
    $buildingId = isset($_GET['building_id']) ? (int)$_GET['building_id'] : 0;
    if (!$buildingId) {
        jsonResponse(['error' => 'Не указан ID здания'], 400);
    }

    $stmt = $pdo->prepare("SELECT id, name, address, description, floors_count FROM buildings WHERE id = ?");
    $stmt->execute([$buildingId]);
    $building = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$building) {
        jsonResponse(['error' => 'Здание не найдено'], 404);
    }

    // Этажи
    $stmtFloors = $pdo->prepare("SELECT id, floor_number, description FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
    $stmtFloors->execute([$buildingId]);
    $floors = $stmtFloors->fetchAll(PDO::FETCH_ASSOC);

    // Комнаты
    $stmtRooms = $pdo->prepare("
        SELECT r.id, r.floor_id, r.room_number, r.capacity, r.gender_type, r.status, r.price,
               (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.status = 'approved') as occupied_beds
        FROM rooms r
        JOIN floors f ON r.floor_id = f.id
        WHERE f.building_id = ?
        ORDER BY r.room_number ASC
    ");
    $stmtRooms->execute([$buildingId]);
    $rooms = $stmtRooms->fetchAll(PDO::FETCH_ASSOC);

    // Группируем комнаты по этажам
    $roomsByFloor = [];
    foreach ($rooms as $room) {
        $roomsByFloor[$room['floor_id']][] = $room;
    }

    foreach ($floors as &$floor) {
        $floor['rooms'] = $roomsByFloor[$floor['id']] ?? [];
    }

    jsonResponse([
        'success' => true,
        'data' => [
            'building' => $building,
            'floors' => $floors
        ]
    ]);
}

// Создание бронирования
if ($route === 'book' && $method === 'POST') {
    $currentUser = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);

    $roomId = (int)($data['room_id'] ?? 0);
    $startDate = $data['start_date'] ?? date('Y-m-d');
    $endDate = $data['end_date'] ?? null;
    $comment = trim($data['comment'] ?? '');
    $passportUrl = trim($data['passport_url'] ?? '');
    $receiptUrl = trim($data['receipt_url'] ?? '');

    if (!$roomId) {
        jsonResponse(['error' => 'Укажите комнату для бронирования'], 400);
    }

    // Проверяем наличие комнаты и ее доступность
    $stmt = $pdo->prepare("
        SELECT r.*, 
               (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.status = 'approved') as occupied_beds
        FROM rooms r 
        WHERE r.id = ?
    ");
    $stmt->execute([$roomId]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$room) {
        jsonResponse(['error' => 'Комната не найдена'], 404);
    }

    if ($room['status'] === 'maintenance') {
        jsonResponse(['error' => 'Комната находится на обслуживании'], 400);
    }

    if ($room['occupied_beds'] >= $room['capacity']) {
        jsonResponse(['error' => 'В комнате нет свободных мест'], 400);
    }

    // Проверяем гендерное соответствие
    $userGender = $currentUser['gender'] ?? 'any';
    if ($room['gender_type'] !== 'any' && $userGender !== 'any' && $room['gender_type'] !== $userGender) {
        jsonResponse(['error' => 'Комната предназначена для проживания другого пола'], 400);
    }

    // Проверяем, нет ли уже активного бронирования
    $stmt = $pdo->prepare("SELECT id FROM bookings WHERE user_id = ? AND status IN ('pending', 'approved')");
    $stmt->execute([$currentUser['id']]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'У вас уже есть активная заявка или бронирование'], 400);
    }

    $insert = $pdo->prepare("
        INSERT INTO bookings (user_id, room_id, start_date, end_date, comment, passport_url, receipt_url, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");
    $insert->execute([$currentUser['id'], $roomId, $startDate, $endDate, $comment, $passportUrl, $receiptUrl]);

    jsonResponse(['success' => true, 'message' => 'Заявка на бронирование успешно подана!']);
}

// Текущее бронирование пользователя
if ($route === 'my-booking' && $method === 'GET') {
    $currentUser = requireAuth();

    $stmt = $pdo->prepare("
        SELECT b.*, r.room_number, r.price, r.gender_type, f.floor_number, bu.name as building_name, bu.address as building_address
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings bu ON f.building_id = bu.id
        WHERE b.user_id = ?
        ORDER BY b.id DESC
        LIMIT 1
    ");
    $stmt->execute([$currentUser['id']]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    jsonResponse(['success' => true, 'data' => $booking ?: null]);
}

// Список всех бронирований текущего пользователя
if ($route === 'my-bookings' && $method === 'GET') {
    $currentUser = requireAuth();

    $stmt = $pdo->prepare("
        SELECT b.*, r.room_number, r.price, f.floor_number, bu.name as building_name
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings bu ON f.building_id = bu.id
        WHERE b.user_id = ?
        ORDER BY b.id DESC
    ");
    $stmt->execute([$currentUser['id']]);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(['success' => true, 'data' => $bookings]);
}

// Отмена бронирования
if ($route === 'cancel-booking' && $method === 'POST') {
    $currentUser = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $bookingId = (int)($data['booking_id'] ?? 0);

    if (!$bookingId) {
        jsonResponse(['error' => 'Не указан ID бронирования'], 400);
    }

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'");
    $stmt->execute([$bookingId, $currentUser['id']]);

    if ($stmt->rowCount() > 0) {
        jsonResponse(['success' => true, 'message' => 'Бронирование успешно отменено']);
    } else {
        jsonResponse(['error' => 'Не удалось отменить бронирование (возможно, оно уже обработано или не найдено)'], 400);
    }
}