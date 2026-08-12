<?php
/**
 * Скрипт для автоматического одобрения бронирований через CRON
 * Запускать каждые 5-10 минут
 */

// Отключаем вывод ошибок в ответ
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Функция для логирования
function logMessage($message) {
    $logFile = __DIR__ . '/logs/cron_auto_approve.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

try {
    logMessage("=== ЗАПУСК АВТООДОБРЕНИЯ ===");
    
    // Подключаем конфигурацию БД
    $host = 'localhost';
    $dbname = 'imb1r0kya2';
    $username = 'imb1r0kya2';
    $password = 'sAMogyg6sAMogyg';
    $port = 3306;
    
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    // Проверяем настройку автоодобрения
    $settingStmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'auto-accept-bookings'");
    $settingStmt->execute();
    $enabledVal = $settingStmt->fetchColumn();
    
    if ($enabledVal !== '1' && $enabledVal !== 'true') {
        logMessage("Автоодобрение отключено в настройках");
        echo "Автоодобрение отключено\n";
        exit(0);
    }

    // Режим автозаселения: gender (по полу) или gender_and_vk_duplicate
    // (по полу + совпадению фамилии и имени среди аккаунтов с VK-ссылкой)
    $modeStmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'auto-book-mode'");
    $modeStmt->execute();
    $modeVal = $modeStmt->fetchColumn();
    $checkVkDuplicate = ($modeVal === 'gender_and_vk_duplicate');
    logMessage("Режим автозаселения: " . ($checkVkDuplicate ? "по полу + VK-дубликаты" : "по полу"));
    
    // Получаем список ожидающих бронирований
    $stmt = $pdo->query("
        SELECT b.id, b.user_id, b.room_id,
               u.last_name, u.first_name, u.name,
               u.vk_url, u.bot_registered,
               r.gender as room_gender,
               f.gender as floor_gender,
               bu.gender as building_gender
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings bu ON r.building_id = bu.id
        WHERE b.status = 'pending' AND u.status = 'active'
    ");
    $pendingList = $stmt->fetchAll();
    
    logMessage("Найдено ожидающих бронирований: " . count($pendingList));
    
    // Функция определения пола по фамилии (копия из index.php)
    function detectGenderByLastName($lastName) {
        $lastName = trim((string)$lastName);
        if ($lastName === '') return null;
        $lastNameLower = mb_strtolower($lastName, 'UTF-8');

        if (
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ая' ||
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'яя' ||
            mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ова' ||
            mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ева' ||
            mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ина' ||
            mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ына' ||
            mb_substr($lastNameLower, -4, 4, 'UTF-8') === 'ская' ||
            mb_substr($lastNameLower, -4, 4, 'UTF-8') === 'цкая'
        ) {
            return 'F';
        }

        if (
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ов' ||
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ев' ||
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ин' ||
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ын' ||
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ий' ||
            mb_substr($lastNameLower, -2, 2, 'UTF-8') === 'ый' ||
            mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'ский' ||
            mb_substr($lastNameLower, -3, 3, 'UTF-8') === 'цкий'
        ) {
            return 'M';
        }

        $lastChar = mb_substr($lastNameLower, -1, 1, 'UTF-8');
        if ($lastChar === 'а' || $lastChar === 'я') {
            return 'F';
        }

        if (in_array($lastChar, ['б','в','г','д','ж','з','к','л','м','н','п','р','с','т','ф','х','ц','ч','ш','щ','й'], true)) {
            return 'M';
        }

        return null;
    }
    
    $approvedCount = 0;
    $updateStmt = $pdo->prepare("UPDATE bookings SET status = 'approved_bot', comment = 'Одобрено автоматически ботом' WHERE id = ?");

    // Вспомогательная функция: поиск VK-дубликата (тот же человек через бота ВК)
    function findVkDuplicate($pdo, $row) {
        if (empty($row['last_name']) || empty($row['first_name'])) return null;
        $dupStmt = $pdo->prepare("
            SELECT b.room_id
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE u.last_name = ? AND u.first_name = ?
              AND u.vk_url IS NOT NULL AND u.vk_url != ''
              AND u.bot_registered = 1
              AND u.id != ?
              AND b.status IN ('approved','approved_bot','pending')
            ORDER BY b.id DESC
            LIMIT 1
        ");
        $dupStmt->execute([$row['last_name'], $row['first_name'], $row['user_id']]);
        return $dupStmt->fetch();
    }

    foreach ($pendingList as $row) {
        $roomEff = $row['room_gender'] !== 'DEFAULT'
            ? $row['room_gender']
            : ($row['floor_gender'] !== 'DEFAULT'
                ? $row['floor_gender']
                : $row['building_gender']);
        
        $userGender = detectGenderByLastName($row['last_name'] ?: $row['name']);

        if ($roomEff === 'MIXED' || $roomEff === 'DEFAULT' || $userGender === null || $roomEff === $userGender) {
            // В режиме "по полу + VK-дубликаты": если у человека уже есть одобренный
            // дубликат в ДРУГОЙ комнате — пропускаем, чтобы поселить их вместе
            if ($checkVkDuplicate) {
                $dup = findVkDuplicate($pdo, $row);
                if ($dup && (int)$dup['room_id'] !== (int)$row['room_id']) {
                    logMessage("Пропущено бронирование ID: {$row['id']} (человек уже заселён через VK-аккаунт в комнате {$dup['room_id']})");
                    continue;
                }
            }
            $updateStmt->execute([$row['id']]);
            $approvedCount++;
            logMessage("Одобрено бронирование ID: {$row['id']} (пользователь: {$row['first_name']} {$row['last_name']})");
        }
    }
    
    logMessage("Одобрено бронирований: $approvedCount");
    logMessage("=== ЗАВЕРШЕНО ===");
    
    echo "Одобрено бронирований: $approvedCount\n";
    
} catch (Exception $e) {
    logMessage("ОШИБКА: " . $e->getMessage());
    echo "Ошибка: " . $e->getMessage() . "\n";
    exit(1);
}