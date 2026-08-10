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

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vk_id BIGINT UNIQUE NOT NULL,
        first_name VARCHAR(100) DEFAULT '',
        last_name VARCHAR(100) DEFAULT '',
        points INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        FOREIGN KEY (user_id) REFERENCES vk_bot_users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES vk_bot_tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        group_id INT NOT NULL,
        ticket_number VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES vk_bot_users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES vk_bot_task_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (PDOException $e) {
    jsonError('Ошибка инициализации таблиц бота ВК: ' . $e->getMessage(), 500);
}

// Заполнение дефолтных настроек сообщения бота если они отсутствуют
$defaultSettings = [
    'vk_token' => '',
    'vk_group_id' => '',
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

if ($uri === 'admin/vk-bot/reports') {
    requireAdmin($pdo);
    if ($method === 'GET') {
        $status = $_GET['status'] ?? 'all';
        $sql = "
            SELECT r.*, u.vk_id, u.first_name as user_first_name, u.last_name as user_last_name,
                   t.title as task_title, t.difficulty, t.points, g.title as group_title
            FROM vk_bot_reports r
            JOIN vk_bot_users u ON r.user_id = u.id
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

        $stmt = $pdo->prepare("SELECT * FROM vk_bot_reports WHERE id = ?");
        $stmt->execute([$id]);
        $report = $stmt->fetch();
        if (!$report) jsonError('Отчет не найден', 404);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE vk_bot_reports SET status = ?, reject_reason = ? WHERE id = ?");
            $stmt->execute([$status, $reason, $id]);

            if ($status === 'approved' && $report['status'] !== 'approved') {
                $taskStmt = $pdo->prepare("SELECT points, group_id FROM vk_bot_tasks WHERE id = ?");
                $taskStmt->execute([$report['task_id']]);
                $task = $taskStmt->fetch();

                if ($task) {
                    $updUser = $pdo->prepare("UPDATE vk_bot_users SET points = points + ? WHERE id = ?");
                    $updUser->execute([$task['points'], $report['user_id']]);

                    // Проверяем, выполнил ли пользователь все задания из этой группы
                    $totalTasksStmt = $pdo->prepare("SELECT COUNT(*) FROM vk_bot_tasks WHERE group_id = ?");
                    $totalTasksStmt->execute([$task['group_id']]);
                    $totalTasks = (int)$totalTasksStmt->fetchColumn();

                    $approvedTasksStmt = $pdo->prepare("
                        SELECT COUNT(DISTINCT r.task_id) 
                        FROM vk_bot_reports r 
                        JOIN vk_bot_tasks t ON r.task_id = t.id 
                        WHERE r.user_id = ? AND t.group_id = ? AND r.status = 'approved'
                    ");
                    $approvedTasksStmt->execute([$report['user_id'], $task['group_id']]);
                    $approvedTasks = (int)$approvedTasksStmt->fetchColumn();

                    if ($totalTasks > 0 && $approvedTasks >= $totalTasks) {
                        // Выдаем билет если ещё не выдан для этой группы
                        $checkTicket = $pdo->prepare("SELECT id FROM vk_bot_tickets WHERE user_id = ? AND group_id = ?");
                        $checkTicket->execute([$report['user_id'], $task['group_id']]);
                        if (!$checkTicket->fetch()) {
                            $ticketNum = 'TKT-' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 6)) . '-' . rand(100, 999);
                            $insTicket = $pdo->prepare("INSERT INTO vk_bot_tickets (user_id, group_id, ticket_number) VALUES (?, ?, ?)");
                            $insTicket->execute([$report['user_id'], $task['group_id'], $ticketNum]);
                        }
                    }
                }
            }
            $pdo->commit();
            jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Ошибка обработки отчета: ' . $e->getMessage(), 500);
        }
    }
}

if ($uri === 'admin/vk-bot/tickets') {
    requireAdmin($pdo);
    $groupId = (int)($_GET['group_id'] ?? 0);
    $sql = "
        SELECT tk.*, u.vk_id, u.first_name, u.last_name, u.points as total_points, g.title as group_title
        FROM vk_bot_tickets tk
        JOIN vk_bot_users u ON tk.user_id = u.id
        JOIN vk_bot_task_groups g ON tk.group_id = g.id
    ";
    if ($groupId > 0) {
        $sql .= " WHERE tk.group_id = " . $groupId;
    }
    $sql .= " ORDER BY tk.created_at DESC";
    $stmt = $pdo->query($sql);
    jsonResponse($stmt->fetchAll());
}