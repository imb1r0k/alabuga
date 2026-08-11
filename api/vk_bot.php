<?php
// Создание таблиц при отсутствии
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_settings (
        `key` VARCHAR(64) PRIMARY KEY,
        `value` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_task_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        difficulty ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'easy',
        points INT NOT NULL DEFAULT 10,
        task_type ENUM('repost', 'post', 'other') NOT NULL DEFAULT 'other',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES vk_bot_task_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        task_id INT NOT NULL,
        submission_text TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        reject_reason VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES vk_bot_tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        group_id INT NOT NULL,
        ticket_number VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES vk_bot_task_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        report_id INT NULL,
        message TEXT NOT NULL,
        is_sent TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

} catch (PDOException $e) {
    jsonError('Ошибка инициализации таблиц бота ВК: ' . $e->getMessage(), 500);
}

// Заполнение дефолтных настроек сообщения бота если они отсутствуют
$defaultSettings = [
    'vk_token' => '',
    'vk_group_id' => '',
    'site_url' => 'https://ваш-сайт.ru',
    'welcome_text' => "Привет! Здесь ты гарантированно получаешь билет на участие в лотерее ценных призов!\n\nВыполни задания и получи билет на розыгрыш!",
    'success_text' => "Поздравляю с успешным выполнением всех заданий данной волны!",
    'draw_time' => '18:00'
];

foreach ($defaultSettings as $k => $v) {
    $stmt = $pdo->prepare("INSERT IGNORE INTO vk_bot_settings (`key`, `value`) VALUES (?, ?)");
    $stmt->execute([$k, $v]);
}

// Маршрутизация запросов к боту
if ($uri === 'admin/vk-bot/settings') {
    requireAdmin($pdo);
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT `key`, `value` FROM vk_bot_settings");
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['key']] = $r['value'];
        }
        jsonResponse($settings);
    }
    if ($method === 'POST') {
        requireStrictAdmin($pdo);
        foreach ($data as $k => $v) {
            $stmt = $pdo->prepare("INSERT INTO vk_bot_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");
            $stmt->execute([$k, (string)$v, (string)$v]);
        }
        jsonResponse(['success' => true]);
    }
}

if ($uri === 'admin/vk-bot/groups') {
    requireAdmin($pdo);
    if ($method === 'GET') {
        $stmt = $pdo->query("
            SELECT g.*, 
                   (SELECT COUNT(*) FROM vk_bot_tasks WHERE group_id = g.id) as tasks_count,
                   (SELECT COUNT(*) FROM vk_bot_tickets WHERE group_id = g.id) as tickets_issued
            FROM vk_bot_task_groups g
            ORDER BY g.start_date DESC, g.id DESC
        ");
        $groups = $stmt->fetchAll();
        $today = date('Y-m-d');
        foreach ($groups as &$g) {
            if ($g['start_date'] <= $today && $g['end_date'] >= $today) {
                $g['status'] = 'active';
            } else if ($g['start_date'] > $today) {
                $g['status'] = 'future';
            } else {
                $g['status'] = 'expired';
            }
        }
        jsonResponse($groups);
    }

    if ($method === 'POST') {
        $action = $data['action'] ?? 'save';
        if ($action === 'delete') {
            $id = (int)($data['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM vk_bot_task_groups WHERE id = ?");
            $stmt->execute([$id]);
            jsonResponse(['success' => true]);
        } else {
            $id = (int)($data['id'] ?? 0);
            $title = trim($data['title'] ?? '');
            $startDate = trim($data['start_date'] ?? '');
            $endDate = trim($data['end_date'] ?? '');

            if (!$title || !$startDate || !$endDate) {
                jsonError('Заполните название и даты действия группы заданий', 400);
            }

            if ($id > 0) {
                $stmt = $pdo->prepare("UPDATE vk_bot_task_groups SET title=?, start_date=?, end_date=? WHERE id=?");
                $stmt->execute([$title, $startDate, $endDate, $id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO vk_bot_task_groups (title, start_date, end_date) VALUES (?, ?, ?)");
                $stmt->execute([$title, $startDate, $endDate]);
            }
            jsonResponse(['success' => true]);
        }
    }
}

if ($uri === 'admin/vk-bot/tasks') {
    requireAdmin($pdo);
    if ($method === 'GET') {
        $groupId = (int)($_GET['group_id'] ?? 0);
        if ($groupId > 0) {
            $stmt = $pdo->prepare("SELECT * FROM vk_bot_tasks WHERE group_id = ? ORDER BY FIELD(difficulty, 'easy', 'medium', 'hard'), id ASC");
            $stmt->execute([$groupId]);
        } else {
            $stmt = $pdo->query("SELECT * FROM vk_bot_tasks ORDER BY group_id DESC, FIELD(difficulty, 'easy', 'medium', 'hard'), id ASC");
        }
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $action = $data['action'] ?? 'save';
        if ($action === 'delete') {
            $id = (int)($data['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM vk_bot_tasks WHERE id = ?");
            $stmt->execute([$id]);
            jsonResponse(['success' => true]);
        } else {
            $id = (int)($data['id'] ?? 0);
            $groupId = (int)($data['group_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            $description = trim($data['description'] ?? '');
            $difficulty = $data['difficulty'] ?? 'easy';
            $taskType = $data['task_type'] ?? 'other';

            if (!$groupId || !$title || !$description) {
                jsonError('Укажите группу, название и описание задания', 400);
            }

            $points = 10;
            if ($difficulty === 'medium') $points = 20;
            if ($difficulty === 'hard') $points = 30;

            if ($id > 0) {
                $stmt = $pdo->prepare("UPDATE vk_bot_tasks SET group_id=?, title=?, description=?, difficulty=?, points=?, task_type=? WHERE id=?");
                $stmt->execute([$groupId, $title, $description, $difficulty, $points, $taskType, $id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO vk_bot_tasks (group_id, title, description, difficulty, points, task_type) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$groupId, $title, $description, $difficulty, $points, $taskType]);
            }
            jsonResponse(['success' => true]);
        }
    }
}

// === ОБНОВЛЕННЫЙ РАЗДЕЛ REPORTS ===
if ($uri === 'admin/vk-bot/reports') {
    requireAdmin($pdo);
    
    if ($method === 'GET') {
        $status = $_GET['status'] ?? 'all';
        $sql = "
            SELECT r.*, 
                   u.vk_id, u.vk_url, u.first_name as user_first_name, u.last_name as user_last_name,
                   t.title as task_title, t.difficulty, t.points, g.title as group_title
            FROM vk_bot_reports r
            JOIN users u ON r.user_id = u.id
            JOIN vk_bot_tasks t ON r.task_id = t.id
            JOIN vk_bot_task_groups g ON t.group_id = g.id
        ";
        if ($status !== 'all') {
            $sql .= " WHERE r.status = " . $pdo->quote($status);
        }
        $sql .= " ORDER BY r.created_at DESC";
        $stmt = $pdo->query($sql);
        jsonResponse($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $id = (int)($data['id'] ?? 0);
        $status = $data['status'] ?? 'approved';
        $reason = trim($data['reject_reason'] ?? '');

        if (!$id) jsonError('ID отчета не указан', 400);

        // Получаем отчет с данными пользователя и задания
        $stmt = $pdo->prepare("
            SELECT r.*, 
                   t.points, t.title, t.group_id,
                   u.id as user_id, u.vk_id, u.vk_url
            FROM vk_bot_reports r
            JOIN vk_bot_tasks t ON r.task_id = t.id
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        ");
        $stmt->execute([$id]);
        $report = $stmt->fetch();
        if (!$report) jsonError('Отчет не найден', 404);

        $pdo->beginTransaction();
        try {
            // Обновляем статус отчета
            $stmt = $pdo->prepare("UPDATE vk_bot_reports SET status = ?, reject_reason = ? WHERE id = ?");
            $stmt->execute([$status, $reason, $id]);

            $message = '';
            if ($status === 'approved') {
                // Начисляем баллы пользователю
                $points = (int)$report['points'];
                $stmt = $pdo->prepare("UPDATE users SET rating = rating + ?, completed_tasks = completed_tasks + 1 WHERE id = ?");
                $stmt->execute([$points, $report['user_id']]);

                // Проверяем, все ли задания выполнены
                $totalStmt = $pdo->prepare("
                    SELECT COUNT(*) as total FROM vk_bot_tasks 
                    WHERE group_id = ?
                ");
                $totalStmt->execute([$report['group_id']]);
                $totalTasks = (int)$totalStmt->fetchColumn();

                $doneStmt = $pdo->prepare("
                    SELECT COUNT(DISTINCT r.task_id) as done
                    FROM vk_bot_reports r
                    WHERE r.user_id = ? 
                    AND r.task_id IN (SELECT id FROM vk_bot_tasks WHERE group_id = ?)
                    AND r.status = 'approved'
                ");
                $doneStmt->execute([$report['user_id'], $report['group_id']]);
                $doneTasks = (int)$doneStmt->fetchColumn();

                // Выдаем билет если все задания выполнены
                if ($totalTasks > 0 && $doneTasks >= $totalTasks) {
                    // Проверяем, не выдан ли уже билет
                    $checkTicket = $pdo->prepare("
                        SELECT id FROM vk_bot_tickets 
                        WHERE user_id = ? AND group_id = ?
                    ");
                    $checkTicket->execute([$report['user_id'], $report['group_id']]);
                    
                    if (!$checkTicket->fetch()) {
                        $ticketNum = 'TKT-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 6)) . '-' . rand(100, 999);
                        $insTicket = $pdo->prepare("
                            INSERT INTO vk_bot_tickets (user_id, group_id, ticket_number)
                            VALUES (?, ?, ?)
                        ");
                        $insTicket->execute([$report['user_id'], $report['group_id'], $ticketNum]);
                    }
                }

                $message = "✅ Ваше задание \"" . $report['title'] . "\" одобрено! Получено +{$points} баллов.";

            } elseif ($status === 'rejected') {
                $message = "❌ Ваше задание \"" . $report['title'] . "\" отклонено. Причина: " . ($reason ?: 'Не выполнено учение') . ". Отправьте отчет заново.";
            }

            // Добавляем уведомление в таблицу
            if ($message) {
                $notifStmt = $pdo->prepare("
                    INSERT INTO vk_bot_notifications (user_id, report_id, message) 
                    VALUES (?, ?, ?)
                ");
                $notifStmt->execute([$report['user_id'], $id, $message]);
            }

            $pdo->commit();
            jsonResponse(['success' => true, 'message' => $message]);

        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Ошибка обработки отчета: ' . $e->getMessage(), 500);
        }
    }
}
// === КОНЕЦ ОБНОВЛЕННОГО РАЗДЕЛА REPORTS ===

if ($uri === 'admin/vk-bot/tickets') {
    requireAdmin($pdo);
    $groupId = (int)($_GET['group_id'] ?? 0);
    $sql = "
        SELECT tk.*, u.vk_id, u.vk_url, u.first_name, u.last_name, u.rating as total_points, g.title as group_title
        FROM vk_bot_tickets tk
        JOIN users u ON tk.user_id = u.id
        JOIN vk_bot_task_groups g ON tk.group_id = g.id
    ";
    if ($groupId > 0) {
        $sql .= " WHERE tk.group_id = " . $groupId;
    }
    $sql .= " ORDER BY tk.created_at DESC";
    $stmt = $pdo->query($sql);
    jsonResponse($stmt->fetchAll());
}

// Добавляем эндпоинт для получения уведомлений (для админки)
if ($uri === 'admin/vk-bot/notifications') {
    requireAdmin($pdo);
    if ($method === 'GET') {
        $status = $_GET['status'] ?? 'all';
        $sql = "
            SELECT n.*, u.first_name, u.last_name, u.vk_id, u.vk_url
            FROM vk_bot_notifications n
            JOIN users u ON n.user_id = u.id
        ";
        if ($status === 'pending') {
            $sql .= " WHERE n.is_sent = 0";
        } elseif ($status === 'sent') {
            $sql .= " WHERE n.is_sent = 1";
        }
        $sql .= " ORDER BY n.created_at DESC";
        $stmt = $pdo->query($sql);
        jsonResponse($stmt->fetchAll());
    }
}

// Эндпоинт для ручной отправки уведомления (для админки)
if ($uri === 'admin/vk-bot/send-notification') {
    requireStrictAdmin($pdo);
    if ($method === 'POST') {
        $userId = (int)($data['user_id'] ?? 0);
        $message = trim($data['message'] ?? '');
        
        if (!$userId || !$message) {
            jsonError('Укажите пользователя и текст сообщения', 400);
        }
        
        // Проверяем, есть ли у пользователя VK ID
        $stmt = $pdo->prepare("SELECT vk_id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if (!$user || !$user['vk_id']) {
            jsonError('У пользователя нет привязанного VK ID', 400);
        }
        
        $notifStmt = $pdo->prepare("
            INSERT INTO vk_bot_notifications (user_id, message, is_sent) 
            VALUES (?, ?, 0)
        ");
        $notifStmt->execute([$userId, $message]);
        
        jsonResponse(['success' => true, 'message' => 'Уведомление добавлено в очередь']);
    }
}