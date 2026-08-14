<?php
// =============================================================================
// Модуль: Админ-панель — здания, этажи, комнаты
// Маршруты: admin/buildings, admin/floors, admin/rooms, admin/all-rooms
// =============================================================================

// ─── Здания ────────────────────────────────────────────────────────────────

if ($uri === 'admin/buildings') {
    requireStrictAdmin($pdo);
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM buildings ORDER BY id ASC");
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $action = $data['action'] ?? '';
        if ($action === 'delete') {
            $id = (int)($data['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM buildings WHERE id = ?");
            $stmt->execute([$id]);
        } else {
            $name = trim($data['name'] ?? '');
            $gender = $data['gender'] ?? 'MIXED';
            $id = (int)($data['id'] ?? 0);
            if ($id > 0) {
                $stmt = $pdo->prepare("UPDATE buildings SET name = ?, gender = ? WHERE id = ?");
                $stmt->execute([$name, $gender, $id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO buildings (name, gender) VALUES (?, ?)");
                $stmt->execute([$name, $gender]);
            }
        }
        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Этажи ─────────────────────────────────────────────────────────────────

if ($uri === 'admin/floors') {
    requireStrictAdmin($pdo);
    if ($method === 'GET') {
        $buildingId = (int)($_GET['building_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC");
        $stmt->execute([$buildingId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $action = $data['action'] ?? '';
        if ($action === 'delete') {
            $id = (int)($data['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM floors WHERE id = ?");
            $stmt->execute([$id]);
        } else {
            $id = (int)($data['id'] ?? 0);
            $buildingId = (int)($data['building_id'] ?? 0);
            $floorNumber = (int)($data['floor_number'] ?? 1);
            $width = (int)($data['width'] ?? 8);
            $startRoomNum = isset($data['start_room_number']) ? (int)$data['start_room_number'] : null;
            $orderType = $data['room_order_type'] ?? 'clockwise';
            $gender = $data['gender'] ?? 'DEFAULT';
            if ($id > 0) {
                $stmt = $pdo->prepare("UPDATE floors SET width=?, start_room_number=?, room_order_type=?, gender=? WHERE id=?");
                $stmt->execute([$width, $startRoomNum, $orderType, $gender, $id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO floors (building_id, floor_number, width, start_room_number, room_order_type, gender) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$buildingId, $floorNumber, $width, $startRoomNum, $orderType, $gender]);
            }
        }
        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Комнаты ───────────────────────────────────────────────────────────────

if ($uri === 'admin/rooms') {
    requireStrictAdmin($pdo);
    if ($method === 'GET') {
        $floorId = (int)($_GET['floor_id'] ?? 0);
        $stmt = $pdo->prepare("
            SELECT r.*,
                   (SELECT COUNT(*) FROM bookings b
                    WHERE b.room_id = r.id AND b.status IN ('approved','approved_bot','pending')) as occupied
            FROM rooms r
            WHERE r.floor_id = ?
            ORDER BY r.y_pos ASC, r.x_pos ASC
        ");
        $stmt->execute([$floorId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $action = $data['action'] ?? '';
        if ($action === 'delete') {
            $id = (int)($data['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM rooms WHERE id = ?");
            $stmt->execute([$id]);
        } else {
            $id = (int)($data['id'] ?? 0);
            $floorId = (int)($data['floor_id'] ?? 0);
            $buildingId = (int)($data['building_id'] ?? 0);
            $roomNumber = trim($data['room_number'] ?? '');
            $name = trim($data['name'] ?? '');
            $capacity = (int)($data['capacity'] ?? 2);
            $isTech = (int)($data['is_technical'] ?? 0);
            $type = $data['room_type'] ?? 'room';
            $gender = $data['gender'] ?? 'DEFAULT';
            $x = (int)($data['x_pos'] ?? 0);
            $y = (int)($data['y_pos'] ?? 0);
            if ($id > 0) {
                $stmt = $pdo->prepare("UPDATE rooms SET room_number=?, name=?, capacity=?, is_technical=?, room_type=?, gender=?, x_pos=?, y_pos=? WHERE id=?");
                $stmt->execute([$roomNumber, $name, $capacity, $isTech, $type, $gender, $x, $y, $id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO rooms (floor_id, building_id, room_number, name, capacity, is_technical, room_type, gender, x_pos, y_pos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$floorId, $buildingId, $roomNumber, $name, $capacity, $isTech, $type, $gender, $x, $y]);
            }
        }
        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Все комнаты ───────────────────────────────────────────────────────────

if ($uri === 'admin/all-rooms') {
    requireStrictAdmin($pdo);
    $stmt = $pdo->query("
        SELECT r.*, bu.name as building_name, f.floor_number
        FROM rooms r
        JOIN buildings bu ON r.building_id = bu.id
        JOIN floors f ON r.floor_id = f.id
        ORDER BY bu.id ASC, f.floor_number ASC, r.room_number ASC
    ");
    jsonResponse($stmt->fetchAll());
}
