<?php
// =============================================================================
// Модуль: Заявки пользователей (через бота ВК)
// Маршруты: admin/requests, admin/requests/messages
// =============================================================================

// ─── Список заявок и управление статусами ─────────────────────────────────

if ($uri === 'admin/requests') {
    $curatorUser = requireAdmin($pdo);

    if ($method === 'GET') {
        $statusFilter = trim($_GET['status'] ?? '');
        $curatorTeams = getCuratorTeams($pdo, $curatorUser['id']);

        $sql = "
            SELECT r.*,
                   u.first_name, u.last_name, u.name as user_name, u.login, u.vk_id,
                   ru.first_name as resolver_first_name, ru.last_name as resolver_last_name
            FROM vk_bot_requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users ru ON r.resolved_by = ru.id
        ";
        $params = [];

        $whereClauses = [];
        if ($statusFilter !== '' && in_array($statusFilter, ['open', 'in_progress', 'resolved', 'rejected'])) {
            $whereClauses[] = "r.status = ?";
            $params[] = $statusFilter;
        }

        if ($curatorTeams !== null && !empty($curatorTeams)) {
            $placeholders = implode(',', array_fill(0, count($curatorTeams), '?'));
            $whereClauses[] = "u.team_id IN ($placeholders)";
            $params = array_merge($params, $curatorTeams);
        }

        if (!empty($whereClauses)) {
            $sql .= " WHERE " . implode(' AND ', $whereClauses);
        }

        $sql .= " ORDER BY r.created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        requireStrictAdmin($pdo);
        $requestId = (int)($data['id'] ?? 0);
        $newStatus = trim($data['status'] ?? '');
        $resolutionText = trim($data['resolution_text'] ?? '');

        if (!$requestId) jsonError('ID заявки не указан', 400);

        // Получаем заявку с данными пользователя
        $stmt = $pdo->prepare("
            SELECT r.*, u.vk_id, u.id as user_id, u.first_name, u.last_name
            FROM vk_bot_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        ");
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();
        if (!$request) jsonError('Заявка не найдена', 404);

        if ($newStatus && in_array($newStatus, ['resolved', 'rejected'])) {
            // Обновляем статус
            $stmt = $pdo->prepare("UPDATE vk_bot_requests SET status = ?, resolved_by = ?, resolution_text = ? WHERE id = ?");
            $stmt->execute([$newStatus, $curatorUser['id'], $resolutionText, $requestId]);

            // Добавляем сообщение от админа о решении
            $statusLabel = $newStatus === 'resolved' ? 'Решена' : 'Отклонена';
            $msgText = "Заявка #{$requestId} {$statusLabel}. " . ($resolutionText ?: '');
            $msgStmt = $pdo->prepare("INSERT INTO vk_bot_request_messages (request_id, user_id, message) VALUES (?, ?, ?)");
            $msgStmt->execute([$requestId, $curatorUser['id'], $msgText]);

            // Отправляем уведомление пользователю через бота
            if ($request['vk_id']) {
                $notifStmt = $pdo->prepare("INSERT INTO vk_bot_notifications (user_id, message) VALUES (?, ?)");
                $notifStmt->execute([$request['user_id'], "📋 {$statusLabel}: {$msgText}"]);
            }

            jsonResponse(['success' => true]);
        }

        jsonError('Некорректный статус', 400);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Сообщения по заявке ──────────────────────────────────────────────────

if ($uri === 'admin/requests/messages') {
    $curatorUser = requireAdmin($pdo);

    if ($method === 'GET') {
        $requestId = (int)($_GET['request_id'] ?? 0);
        if (!$requestId) jsonError('ID заявки не указан', 400);

        $stmt = $pdo->prepare("
            SELECT m.*, u.first_name, u.last_name, u.role
            FROM vk_bot_request_messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.request_id = ?
            ORDER BY m.created_at ASC
        ");
        $stmt->execute([$requestId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $requestId = (int)($data['request_id'] ?? 0);
        $message = trim($data['message'] ?? '');

        if (!$requestId) jsonError('ID заявки не указан', 400);
        if (!$message) jsonError('Сообщение не может быть пустым', 400);

        // Добавляем сообщение от админа
        $stmt = $pdo->prepare("INSERT INTO vk_bot_request_messages (request_id, user_id, message) VALUES (?, ?, ?)");
        $stmt->execute([$requestId, $curatorUser['id'], $message]);

        // Получаем данные о заявке для отправки уведомления пользователю
        $stmt = $pdo->prepare("
            SELECT r.*, u.vk_id, u.id as user_id
            FROM vk_bot_requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        ");
        $stmt->execute([$requestId]);
        $request = $stmt->fetch();

        if ($request && $request['vk_id']) {
            // Отправляем уведомление пользователю через бота
            $notifStmt = $pdo->prepare("INSERT INTO vk_bot_notifications (user_id, message) VALUES (?, ?)");
            $notifStmt->execute([$request['user_id'], "💬 Новое сообщение по заявке #{$requestId}: {$message}"]);
        }

        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}