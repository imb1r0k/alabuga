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

    // Устаревшая колонка uuid больше не используется (задания привязываются по id).
    // Если она осталась в таблице от прежней схемы, удаляем её, чтобы обычные
    // INSERT без uuid не падали с ошибкой 500.
    try {
        $pdo->exec("ALTER TABLE vk_bot_tasks DROP COLUMN uuid");
    } catch (PDOException $ex) {
        // колонки нет — игнорируем
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        task_id INT NOT NULL,
        submission_text TEXT NOT NULL,
        has_attachments TINYINT(1) NOT NULL DEFAULT 0,
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

    $pdo->exec("CREATE TABLE IF NOT EXISTS vk_bot_report_media (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        file_url VARCHAR(512) NOT NULL,
        file_type ENUM('image', 'file') NOT NULL DEFAULT 'image',
        original_name VARCHAR(255) NOT NULL,
        file_size INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES vk_bot_reports(id) ON DELETE CASCADE
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

/**
 * Скачивает файл по URL и сохраняет его локально.
 *
 * @param string $url URL файла.
 * @param string $destinationDir Директория для сохранения.
 * @param string $filename Имя файла для сохранения (если не указано, будет сгенерировано).
 * @return string|false Локальный путь к файлу или false в случае ошибки.
 */
function downloadFileFromUrl(string $url, string $destinationDir, string $filename = ''): string|false {
    // Проверяем, существует ли директория, если нет - создаем
    if (!is_dir($destinationDir)) {
        if (!mkdir($destinationDir, 0777, true)) {
            error_log("Не удалось создать директорию для загрузки: " . $destinationDir);
            return false;
        }
    }

    $extension = pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION);
    if (empty($filename)) {
        $filename = uniqid() . (empty($extension) ? '' : '.' . $extension);
    } else {
        $filename .= (empty($extension) ? '' : '.' . $extension);
    }
    
    $filePath = rtrim($destinationDir, '/') . '/' . $filename;

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Таймаут 10 секунд
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($data === false || $httpCode !== 200) {
        error_log("Ошибка скачивания файла с URL: $url. HTTP код: $httpCode, Ошибка: $error");
        return false;
    }

    if (file_put_contents($filePath, $data) === false) {
        error_log("Не удалось сохранить скачанный файл: " . $filePath);
        return false;
    }

    return $filePath;
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

// === РАЗДЕЛ ОТЧЕТОВ ===
if ($uri === 'admin/vk-bot/reports') {
    requireAdmin($pdo);
    
    if ($method === 'GET') {
        $status = $_GET['status'] ?? 'all';
        $sql = "
            SELECT r.*, 
                   u.vk_id, u.vk_url, u.first_name as user_first_name, u.last_name as user_last_name,
                   t.title as task_title, t.description as task_description, t.difficulty, t.points, g.title as group_title
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

                // Базовое сообщение об одобрении
                $message = "✅ Ваше задание \"" . $report['title'] . "\" одобрено! Получено +{$points} баллов.";

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
                        $message .= "\n\n🎉 Поздравляем! Вы выполнили все задания волны — вам выдан лотерейный билет!\n🎫 Номер билета: {$ticketNum}";
                    }
                }

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

// === МЕДИАФАЙЛЫ ОТЧЕТОВ ===
if ($uri === 'admin/vk-bot/reports/media') {
    requireAdmin($pdo);
    if ($method === 'GET') {
        $reportId = (int)($_GET['report_id'] ?? 0);
        if (!$reportId) jsonError('ID отчета не указан', 400);
        
        $stmt = $pdo->prepare("SELECT * FROM vk_bot_report_media WHERE report_id = ? ORDER BY id ASC");
        $stmt->execute([$reportId]);
        jsonResponse($stmt->fetchAll());
    }
}

// === ЗАГРУЗКА МЕДИА ДЛЯ ОТЧЕТА ===
if ($uri === 'admin/vk-bot/reports/media/upload') {
    requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    
    $reportId = (int)($_POST['report_id'] ?? 0);
    if (!$reportId) jsonError('ID отчета не указан', 400);
    
    // Проверяем существование отчета
    $stmt = $pdo->prepare("SELECT id FROM vk_bot_reports WHERE id = ?");
    $stmt->execute([$reportId]);
    if (!$stmt->fetch()) jsonError('Отчет не найден', 404);
    
    $uploadedFiles = [];
    $errors = [];
    
    $vkPhotoUrl = $_POST['vk_photo_url'] ?? '';

    if (empty($vkPhotoUrl) && (!isset($_FILES['files']) || empty($_FILES['files']['name'][0]))) {
        jsonError('Файлы не загружены или ссылка на фото ВК не указана', 400);
    }
    
    $uploadDir = __DIR__ . '/uploads/vk_bot/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $maxFileSize = 10 * 1024 * 1024; // 10MB
    
    foreach ($_FILES['files']['name'] as $key => $name) {
        if ($_FILES['files']['error'][$key] !== UPLOAD_ERR_OK) {
            $errors[] = "Ошибка загрузки файла: $name";
            continue;
        }
        
        $fileType = $_FILES['files']['type'][$key];
        $fileSize = $_FILES['files']['size'][$key];
        $tmpPath = $_FILES['files']['tmp_name'][$key];
        
        if ($fileSize > $maxFileSize) {
            $errors[] = "Файл $name слишком большой (макс. 10MB)";
            continue;
        }
        
        $extension = pathinfo($name, PATHINFO_EXTENSION);
        $fileName = uniqid() . '.' . $extension;
        $filePath = $uploadDir . $fileName;
        
        if (move_uploaded_file($tmpPath, $filePath)) {
            $fileUrl = '/uploads/vk_bot/' . $fileName;
            $fileTypeDb = in_array($fileType, $allowedImageTypes) ? 'image' : 'file';
            
            $stmt = $pdo->prepare("
                INSERT INTO vk_bot_report_media (report_id, file_url, file_type, original_name, file_size) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$reportId, $fileUrl, $fileTypeDb, $name, $fileSize]);
            
            $uploadedFiles[] = [
                'id' => (int)$pdo->lastInsertId(),
                'file_url' => $fileUrl,
                'file_type' => $fileTypeDb,
                'original_name' => $name,
                'file_size' => $fileSize,
            ];
        } else {
            $errors[] = "Не удалось сохранить файл: $name";
        }
    }
    
    jsonResponse([
        'success' => !empty($uploadedFiles),
        'files' => $uploadedFiles,
        'errors' => $errors,
    ]);
}

// === УДАЛЕНИЕ МЕДИАФАЙЛА ===
if ($uri === 'admin/vk-bot/reports/media/delete') {
    requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    
    $mediaId = (int)($data['id'] ?? 0);
    if (!$mediaId) jsonError('ID медиафайла не указан', 400);
    
    $stmt = $pdo->prepare("SELECT file_url FROM vk_bot_report_media WHERE id = ?");
    $stmt->execute([$mediaId]);
    $media = $stmt->fetch();
    
    if (!$media) jsonError('Медиафайл не найден', 404);
    
    // Удаляем файл с диска
    $filePath = __DIR__ . $media['file_url'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }
    
    $stmt = $pdo->prepare("DELETE FROM vk_bot_report_media WHERE id = ?");
    $stmt->execute([$mediaId]);
    
    jsonResponse(['success' => true]);
}

// === БИЛЕТЫ ===
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
        $sql .= " WHERE tk.group_id = " . (int)$groupId;
    }
    $sql .= " ORDER BY tk.created_at DESC";
    $stmt = $pdo->query($sql);
    jsonResponse($stmt->fetchAll());
}

// === УВЕДОМЛЕНИЯ ===
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

// === ОТПРАВКА УВЕДОМЛЕНИЯ ВРУЧНУЮ ===
if ($uri === 'admin/vk-bot/send-notification') {
    requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    
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

// === РАССЫЛКА ===
if ($uri === 'admin/vk-bot/broadcast') {
    requireStrictAdmin($pdo);
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    
    $message = trim($data['message'] ?? '');
    $recipients = $data['recipients'] ?? 'all';
    
    if (!$message) jsonError('Текст сообщения обязателен', 400);
    
    // Получаем пользователей с VK ID
    $sql = "SELECT id, vk_id FROM users WHERE vk_id IS NOT NULL AND status = 'active'";
    
    if ($recipients === 'ticket_holders') {
        $sql .= " AND id IN (SELECT DISTINCT user_id FROM vk_bot_tickets)";
    } elseif ($recipients === 'active') {
        $sql .= " AND id IN (SELECT DISTINCT user_id FROM vk_bot_reports WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY))";
    }
    
    $stmt = $pdo->query($sql);
    $users = $stmt->fetchAll();
    
    $count = 0;
    foreach ($users as $user) {
        $notifStmt = $pdo->prepare("
            INSERT INTO vk_bot_notifications (user_id, message, is_sent) 
            VALUES (?, ?, 0)
        ");
        $notifStmt->execute([$user['id'], $message]);
        $count++;
    }
    
    jsonResponse([
        'success' => true, 
        'sent' => $count, 
        'total' => count($users),
        'recipients' => $recipients,
        'message' => "Рассылка добавлена в очередь для $count пользователей"
    ]);
}

// === СТАТИСТИКА БОТА ===
if ($uri === 'admin/vk-bot/stats') {
    requireAdmin($pdo);
    
    $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE vk_id IS NOT NULL")->fetchColumn();
    $totalReports = (int)$pdo->query("SELECT COUNT(*) FROM vk_bot_reports")->fetchColumn();
    $pendingReports = (int)$pdo->query("SELECT COUNT(*) FROM vk_bot_reports WHERE status = 'pending'")->fetchColumn();
    $approvedReports = (int)$pdo->query("SELECT COUNT(*) FROM vk_bot_reports WHERE status = 'approved'")->fetchColumn();
    $totalTickets = (int)$pdo->query("SELECT COUNT(*) FROM vk_bot_tickets")->fetchColumn();
    $totalTasks = (int)$pdo->query("SELECT COUNT(*) FROM vk_bot_tasks")->fetchColumn();
    $activeGroups = (int)$pdo->query("
        SELECT COUNT(*) FROM vk_bot_task_groups 
        WHERE start_date <= CURDATE() AND end_date >= CURDATE()
    ")->fetchColumn();
    
    jsonResponse([
        'total_users' => $totalUsers,
        'total_reports' => $totalReports,
        'pending_reports' => $pendingReports,
        'approved_reports' => $approvedReports,
        'total_tickets' => $totalTickets,
        'total_tasks' => $totalTasks,
        'active_groups' => $activeGroups,
    ]);
}

// === ЭКСПОРТ ДАННЫХ ===
if ($uri === 'admin/vk-bot/export') {
    requireStrictAdmin($pdo);
    
    $type = $_GET['type'] ?? 'reports';
    
    if ($type === 'reports') {
        $stmt = $pdo->query("
            SELECT r.*, u.first_name, u.last_name, u.vk_id, t.title as task_title, g.title as group_title
            FROM vk_bot_reports r
            JOIN users u ON r.user_id = u.id
            JOIN vk_bot_tasks t ON r.task_id = t.id
            JOIN vk_bot_task_groups g ON t.group_id = g.id
            ORDER BY r.created_at DESC
        ");
        jsonResponse($stmt->fetchAll());
    } elseif ($type === 'tickets') {
        $stmt = $pdo->query("
            SELECT tk.*, u.first_name, u.last_name, u.vk_id, u.rating, g.title as group_title
            FROM vk_bot_tickets tk
            JOIN users u ON tk.user_id = u.id
            JOIN vk_bot_task_groups g ON tk.group_id = g.id
            ORDER BY tk.created_at DESC
        ");
        jsonResponse($stmt->fetchAll());
    } else {
        jsonError('Неверный тип экспорта', 400);
    }
}

echo json_encode(['error' => 'Маршрут не найден: ' . $uri]);
exit();