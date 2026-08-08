// ─── История моих бронирований ───────────────────────────────────────────

    if ($uri === 'my-booking/history') {
        $user = requireAuth($pdo);
        $stmt = $pdo->prepare("
            SELECT b.id, b.status, b.comment, b.created_at, r.room_number, bu.name as building_name, f.floor_number
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN buildings bu ON r.building_id = bu.id
            JOIN floors f ON r.floor_id = f.id
            WHERE b.user_id = ?
            ORDER BY b.id DESC
            LIMIT 50
        ");
        $stmt->execute([$user['id']]);
        jsonResponse($stmt->fetchAll());
    }

    // ─── Профиль пользователя (GET/POST) ────────────────────────────────────

    if ($uri === 'profile') {
        $user = requireAuth($pdo);

        if ($method === 'GET') {
            // Возвращаем профиль (без пароля)
            unset($user['password']);
            jsonResponse($user);
        }

        if ($method === 'POST') {
            $about = isset($data['about']) ? trim($data['about']) : null;
            $vk = isset($data['vk']) ? trim($data['vk']) : null;
            $tg = isset($data['tg']) ? trim($data['tg']) : null;
            $instagram = isset($data['instagram']) ? trim($data['instagram']) : null;
            $whatsapp = isset($data['whatsapp']) ? trim($data['whatsapp']) : null;

            $stmt = $pdo->prepare("UPDATE users SET about = ?, vk = ?, tg = ?, instagram = ?, whatsapp = ? WHERE id = ?");
            $stmt->execute([$about, $vk, $tg, $instagram, $whatsapp, $user['id']]);

            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    // ─── Моя команда ─────────────────────────────────────────────────────────

    if ($uri === 'team/my') {
        $user = requireAuth($pdo);
        if (!$user['team_id']) jsonResponse(['team' => null, 'members' => []]);

        $stmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
        $stmt->execute([$user['team_id']]);
        $team = $stmt->fetch();
        if (!$team) jsonResponse(['team' => null, 'members' => []]);

        $stmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, u.name, u.login, u.phone,
                   COALESCE(tm.role, 'member') as team_role,
                   u.role as global_role
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
            WHERE u.team_id = ?
            ORDER BY u.last_name ASC
        ");
        $stmt->execute([$user['team_id'], $user['team_id']]);
        $members = $stmt->fetchAll();

        jsonResponse(['team' => $team, 'members' => $members]);
    }

    // ─── Чат моей команды ────────────────────────────────────────────────────

    if ($uri === 'team/chat') {
        $user = requireAuth($pdo);
        if (!$user['team_id']) jsonError('Вы не состоите в команде', 400);

        if ($method === 'GET') {
            $stmt = $pdo->prepare("
                SELECT m.id, m.message, m.created_at,
                       u.first_name, u.last_name, u.role as user_role
                FROM team_chat_messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.team_id = ?
                ORDER BY m.created_at ASC
            ");
            $stmt->execute([$user['team_id']]);
            jsonResponse($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $message = trim($data['message'] ?? '');
            if (!$message) jsonError('Сообщение не может быть пустым');

            $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
            $stmt->execute([$user['team_id'], $user['id'], $message]);
            jsonResponse(['success' => true]);
        }

        jsonError('Метод не поддерживается', 405);
    }

    // ─── Календарь моей команды ──────────────────────────────────────────────

    if ($uri === 'team/calendar') {
        $user = requireAuth($pdo);
        if (!$user['team_id']) jsonError('Вы не состоите в команде', 400);

        if ($method === 'GET') {
            $stmt = $pdo->prepare("
                SELECT e.*, u.first_name, u.last_name
                FROM team_calendar_events e
                LEFT JOIN users u ON e.created_by = u.id
                WHERE e.team_id = ?
                ORDER BY e.event_date ASC
            ");
            $stmt->execute([$user['team_id']]);
            jsonResponse($stmt->fetchAll());
        }

        jsonError('Метод не поддерживается', 405);
    }