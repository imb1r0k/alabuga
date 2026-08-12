<?php
// =============================================================================
// Модуль: Админ-панель — команды, участники, чат, календарь
// Маршруты: admin/teams, admin/teams/* (delete, add-member, remove-member,
//           members, chat, clear-chat, delete-message, calendar)
// =============================================================================

// ─── Список команд и создание/редактирование ──────────────────────────────

if ($uri === 'admin/teams') {
    $user = requireAdmin($pdo);
    $curatorTeams = getCuratorTeams($pdo, $user['id']);

    if ($method === 'GET') {
        if ($curatorTeams === null) {
            $stmt = $pdo->query("SELECT * FROM teams ORDER BY name ASC");
        } else {
            if (empty($curatorTeams)) {
                jsonResponse([]);
            }
            $placeholders = implode(',', array_fill(0, count($curatorTeams), '?'));
            $stmt = $pdo->prepare("SELECT * FROM teams WHERE id IN ($placeholders) ORDER BY name ASC");
            $stmt->execute($curatorTeams);
        }
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $action = $data['action'] ?? 'create';
        $id = (int)($data['id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $desc = trim($data['description'] ?? '');

        if (empty($name)) jsonError('Название команды обязательно');

        if ($action === 'create') {
            $stmt = $pdo->prepare("INSERT INTO teams (name, description) VALUES (?, ?)");
            $stmt->execute([$name, $desc]);
        } elseif ($action === 'update' && $id > 0) {
            if (!checkCuratorAccessToTeam($pdo, $user['id'], $id)) {
                jsonError('У вас нет доступа к редактированию этой команды', 403);
            }
            $stmt = $pdo->prepare("UPDATE teams SET name=?, description=? WHERE id=?");
            $stmt->execute([$name, $desc, $id]);
        }
        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Удаление команды ──────────────────────────────────────────────────────

if ($uri === 'admin/teams/delete') {
    $user = requireAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $id = (int)($data['id'] ?? 0);
    if (!checkCuratorAccessToTeam($pdo, $user['id'], $id)) {
        jsonError('У вас нет доступа к удалению этой команды', 403);
    }
    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['success' => true]);
}

// ─── Добавление участника ──────────────────────────────────────────────────

if ($uri === 'admin/teams/add-member') {
    $user = requireAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $teamId = (int)($data['team_id'] ?? 0);
    $userId = (int)($data['user_id'] ?? 0);
    if ($teamId <= 0 || $userId <= 0) jsonError('Некорректные параметры');

    if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
        jsonError('У вас нет доступа к этой команде', 403);
    }

    $stmt = $pdo->prepare("SELECT name FROM teams WHERE id = ?");
    $stmt->execute([$teamId]);
    $teamName = $stmt->fetchColumn();
    if (!$teamName) jsonError('Команда не найдена', 404);

    $stmt = $pdo->prepare("UPDATE users SET team_id = ?, team_name = ? WHERE id = ?");
    $stmt->execute([$teamId, $teamName, $userId]);

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM team_members WHERE team_id = ? AND user_id = ?");
    $stmt->execute([$teamId, $userId]);
    if ($stmt->fetchColumn() == 0) {
        $stmt = $pdo->prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')");
        $stmt->execute([$teamId, $userId]);
    }

    jsonResponse(['success' => true]);
}

// ─── Удаление участника ────────────────────────────────────────────────────

if ($uri === 'admin/teams/remove-member') {
    $user = requireAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $teamId = (int)($data['team_id'] ?? 0);
    $userId = (int)($data['user_id'] ?? 0);
    if ($teamId <= 0 || $userId <= 0) jsonError('Некорректные параметры');

    if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
        jsonError('У вас нет доступа к этой команде', 403);
    }

    $stmt = $pdo->prepare("UPDATE users SET team_id = NULL, team_name = NULL WHERE id = ? AND team_id = ?");
    $stmt->execute([$userId, $teamId]);

    $stmt = $pdo->prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?");
    $stmt->execute([$teamId, $userId]);

    jsonResponse(['success' => true]);
}

// ─── Участники команды ─────────────────────────────────────────────────────

if ($uri === 'admin/teams/members') {
    $user = requireAdmin($pdo);
    if ($method !== 'GET') jsonError('Метод не поддерживается', 405);
    $teamId = (int)($_GET['team_id'] ?? 0);

    if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
        jsonError('У вас нет доступа к этой команде', 403);
    }

    $stmt = $pdo->prepare("
        SELECT u.id, u.first_name, u.last_name, u.name, u.login, u.rating, u.role as user_role,
               COALESCE(tm.role, CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 'curator' ELSE 'member' END) as role
        FROM users u
        LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
        WHERE (u.team_id = ?
           OR (LOWER(TRIM(u.role)) IN ('curator', 'moderator') AND u.id IN (
               SELECT user_id FROM curator_teams WHERE team_id = ? OR team_id = 0
           )))
           AND u.status = 'active'
        ORDER BY CASE WHEN LOWER(TRIM(u.role)) IN ('curator', 'moderator') THEN 0 ELSE 1 END, u.rating DESC, u.last_name ASC
    ");
    $stmt->execute([$teamId, $teamId, $teamId]);
    jsonResponse($stmt->fetchAll());
}

// ─── Чат команды ───────────────────────────────────────────────────────────

if ($uri === 'admin/teams/chat') {
    $user = requireAdmin($pdo);

    if ($method === 'GET') {
        $teamId = (int)($_GET['team_id'] ?? 0);
        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }
        $stmt = $pdo->prepare("
            SELECT m.id, m.message, m.created_at, u.first_name, u.last_name
            FROM team_chat_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.team_id = ?
            ORDER BY m.created_at ASC
        ");
        $stmt->execute([$teamId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $teamId = (int)($data['team_id'] ?? 0);
        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }
        $message = trim($data['message'] ?? '');
        if (!$message) jsonError('Сообщение не может быть пустым');
        $stmt = $pdo->prepare("INSERT INTO team_chat_messages (team_id, user_id, message) VALUES (?, ?, ?)");
        $stmt->execute([$teamId, $user['id'], $message]);
        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Очистка чата команды ──────────────────────────────────────────────────

if ($uri === 'admin/teams/clear-chat') {
    $user = requireAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $teamId = (int)($data['team_id'] ?? 0);
    if ($teamId <= 0) jsonError('Команда не указана');
    if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
        jsonError('У вас нет доступа к этой команде', 403);
    }
    $stmt = $pdo->prepare("DELETE FROM team_chat_messages WHERE team_id = ?");
    $stmt->execute([$teamId]);
    jsonResponse(['success' => true]);
}

// ─── Удаление сообщения ────────────────────────────────────────────────────

if ($uri === 'admin/teams/delete-message') {
    $user = requireAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $messageId = (int)($data['message_id'] ?? 0);
    if ($messageId <= 0) jsonError('Сообщение не указано');

    $stmt = $pdo->prepare("SELECT team_id FROM team_chat_messages WHERE id = ?");
    $stmt->execute([$messageId]);
    $teamId = (int)$stmt->fetchColumn();
    if (!$teamId) jsonError('Сообщение не найдено', 404);

    if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
        jsonError('У вас нет доступа к этой команде', 403);
    }
    $delStmt = $pdo->prepare("DELETE FROM team_chat_messages WHERE id = ?");
    $delStmt->execute([$messageId]);
    jsonResponse(['success' => true]);
}

// ─── Календарь команды ─────────────────────────────────────────────────────

if ($uri === 'admin/teams/calendar') {
    $user = requireAdmin($pdo);

    if ($method === 'GET') {
        $teamId = (int)($_GET['team_id'] ?? 0);
        if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
            jsonError('У вас нет доступа к этой команде', 403);
        }
        $stmt = $pdo->prepare("SELECT * FROM team_calendar_events WHERE team_id = ? ORDER BY event_date ASC");
        $stmt->execute([$teamId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
            $action = $data['action'] ?? 'create';
            $teamId = (int)($data['team_id'] ?? 0);
    
            if (!checkCuratorAccessToTeam($pdo, $user['id'], $teamId)) {
                jsonError('У вас нет доступа к этой команде', 403);
            }
    
            if ($action === 'create') {
                $title = trim($data['title'] ?? '');
                $eventDate = trim($data['event_date'] ?? '');
                $desc = trim($data['description'] ?? '');
                if (!$title || !$eventDate) jsonError('Заполните название и дату');
    
                // Обработка загруженного изображения
                $imageUrl = trim($data['image_url'] ?? '');
                if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                    $uploadDir = __DIR__ . '/../uploads/team_events/';
                    if (!is_dir($uploadDir)) {
                        mkdir($uploadDir, 0777, true);
                    }
                    $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
                    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                    if (!in_array($ext, $allowed, true)) jsonError('Недопустимый формат изображения', 400);
                    $fileName = 'event_' . time() . '_' . uniqid() . '.' . $ext;
                    $filePath = $uploadDir . $fileName;
                    if (move_uploaded_file($_FILES['image']['tmp_name'], $filePath)) {
                        $imageUrl = '/uploads/team_events/' . $fileName;
                    } else {
                        jsonError('Не удалось сохранить изображение', 500);
                    }
                }
    
                $stmt = $pdo->prepare("INSERT INTO team_calendar_events (team_id, title, event_date, description, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$teamId, $title, $eventDate, $desc, $imageUrl ?: null, $user['id']]);
            } elseif ($action === 'delete') {
                $id = (int)($data['id'] ?? 0);
                $stmt = $pdo->prepare("DELETE FROM team_calendar_events WHERE id = ?");
                $stmt->execute([$id]);
            }
            jsonResponse(['success' => true]);
        }

    jsonError('Метод не поддерживается', 405);
}
