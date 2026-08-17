<?php
/**
 * Обработчик Callback API / LongPoll для ВК Бота
 * Принимает сообщения пользователей, сохраняет вложения (паспорт/квитанции) с прямой ссылкой или локальным скачиванием.
 */

require_once __DIR__ . '/index.php';

// Получаем тело запроса
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    echo "ok";
    exit;
}

// Получаем настройки бота из БД
$stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('vk_bot_token', 'vk_confirmation_code', 'vk_secret<dyad-write path="api/vk_bot.php" description="Исправление обработки вложений фотографий от бота VK с получением прямой ссылки на изображение и сохранением">
<?php
/**
 * Обработчик Callback API / LongPoll для ВК Бота
 * Принимает сообщения пользователей, сохраняет вложения (паспорт/квитанции) с прямой ссылкой или локальным скачиванием.
 */

require_once __DIR__ . '/index.php';<dyad-write path="api/vk_bot.php" description="Обработчик VK Callback API с правильным извлечением прямых ссылок на фото и сохранением файлов">
<?php
/**
 * Обработчик Callback API / Webhook для ВКонтакте бота
 * Корректно извлекает прямые ссылки на фотографии из sizes[] и скачивает их при необходимости
 */

require_once __DIR__ . '/index.php';

// Получаем тело запроса
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data || !is_array($data)) {
    echo "ok";
    exit;
}

// Получаем настройки бота из БД
$stmt = $pdo->query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('vk_bot_token', 'vk_confirmation_code', 'vk_secret_key', 'vk_group_id')");
$botSettings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

$confirmationCode = $botSettings['vk_confirmation_code'] ?? '';
$secretKey = $botSettings['vk_secret_key'] ?? '';
$botToken = $botSettings['vk_bot_token'] ?? '';

// Проверка секретного ключа, если задан
if (!empty($secretKey) && isset($data['secret']) && $data['secret'] !== $secretKey) {
    echo "invalid secret";
    exit;
}

// Ответ на подтверждение сервера в Callback API
if (isset($data['type']) && $data['type'] === 'confirmation') {
    echo $confirmationCode;
    exit;
}

/**
 * Функция отправки сообщения через VK API
 */
function vkSendMessage($peerId, $message, $token, $keyboard = null) {
    if (empty($token) || empty($peerId)) return false;
    
    $params = [
        'user_id' => $peerId,
        'random_id' => mt_rand(100000, 999999999),
        'message' => $message,
        'v' => '5.199',
        'access_token' => $token
    ];

    if ($keyboard) {
        $params['keyboard'] = is_string($keyboard) ? $keyboard : json_encode($keyboard, JSON_UNESCAPED_UNICODE);
    }

    $ch = curl_init('https://api.vk.com/method/messages.send');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

/**
 * Функция извлечения лучшей (максимального разрешения) прямой ссылки на фото из объекта VK Photo
 */
function getDirectPhotoUrl($photoObj) {
    if (!isset($photoObj['sizes']) || !is_array($photoObj['sizes']) || empty($photoObj['sizes'])) {
        return null;
    }

    $sizes = $photoObj['sizes'];
    // Приоритеты типов размеров VK: w (до 2560), z (до 1080), y (до 807), x (до 604), m (до 130), s (до 75)
    $priority = ['w' => 6, 'z' => 5, 'y' => 4, 'x' => 3, 'm' => 2, 's' => 1];
    
    $bestUrl = null;
    $maxPriority = -1;
    $maxWidth = 0;

    foreach ($sizes as $size) {
        $type = $size['type'] ?? '';
        $width = $size['width'] ?? 0;
        $url = $size['url'] ?? '';

        if (!empty($url)) {
            $p = $priority[$type] ?? 0;
            if ($p > $maxPriority || ($p === $maxPriority && $width > $maxWidth)) {
                $maxPriority = $p;
                $maxWidth = $width;
                $bestUrl = $url;
            }
        }
    }

    // Если по приоритетам не нашлось, берем последний элемент массива sizes
    if (!$bestUrl) {
        $last = end($sizes);
        $bestUrl = $last['url'] ?? null;
    }

    return $bestUrl;
}

/**
 * Скачивание фото на локальный сервер и сохранение в uploads
 */
function downloadAndSavePhoto($url) {
    if (empty($url)) return null;

    $uploadDir = __DIR__ . '/../uploads/photos/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $ext = 'jpg';
    $filename = 'vk_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $filePath = $uploadDir . $filename;

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $fileData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $fileData) {
        file_put_contents($filePath, $fileData);
        return '/uploads/photos/' . $filename;
    }

    // Если не удалось скачать локально, возвращаем прямую CDN ссылку
    return $url;
}

// Обработка входящего сообщения
if (isset($data['type']) && ($data['type'] === 'message_new' || $data['type'] === 'message_reply')) {
    $msgObject = $data['object']['message'] ?? ($data['object'] ?? []);
    $fromId = $msgObject['from_id'] ?? ($msgObject['user_id'] ?? null);
    $text = trim($msgObject['text'] ?? '');
    $attachments = $msgObject['attachments'] ?? [];

    if ($fromId) {
        // Проверяем наличие фотографий во вложениях
        $savedPhotoUrls = [];

        foreach ($attachments as $attachment) {
            if (isset($attachment['type']) && $attachment['type'] === 'photo' && isset($attachment['photo'])) {
                $directUrl = getDirectPhotoUrl($attachment['photo']);
                if ($directUrl) {
                    $savedPath = downloadAndSavePhoto($directUrl);
                    if ($savedPath) {
                        $savedPhotoUrls[] = $savedPath;
                    }
                }
            } elseif (isset($attachment['type']) && $attachment['type'] === 'doc' && isset($attachment['doc']['url'])) {
                // Если прикреплен документ-изображение
                $docUrl = $attachment['doc']['url'];
                $savedPath = downloadAndSavePhoto($docUrl);
                if ($savedPath) {
                    $savedPhotoUrls[] = $savedPath;
                }
            }
        }

        // Если пользователь отправил фото
        if (!empty($savedPhotoUrls)) {
            $mainPhotoUrl = $savedPhotoUrls[0];

            // Находим пользователя по vk_id
            $uStmt = $pdo->prepare("SELECT id, name FROM users WHERE vk_id = ? OR vk_link LIKE ? LIMIT 1");
            $uStmt->execute([$fromId, "%id$fromId%"]);
            $user = $uStmt->fetch(PDO::FETCH_ASSOC);

            if ($user) {
                // Обновляем фото в профиле или последнее бронирование
                $upd = $pdo->prepare("UPDATE users SET avatar_url = ? WHERE id = ?");
                $upd->execute([$mainPhotoUrl, $user['id']]);

                // Также прикрепляем фото к активному бронированию пользователя, если требуется чек/паспорт
                $bStmt = $pdo->prepare("SELECT id FROM bookings WHERE user_id = ? ORDER BY id DESC LIMIT 1");
                $bStmt->execute([$user['id']]);
                $lastBooking = $bStmt->fetch(PDO::FETCH_ASSOC);

                if ($lastBooking) {
                    $updBook = $pdo->prepare("UPDATE bookings SET receipt_url = COALESCE(receipt_url, ?), passport_url = COALESCE(passport_url, ?) WHERE id = ?");
                    $updBook->execute([$mainPhotoUrl, $mainPhotoUrl, $lastBooking['id']]);
                }

                vkSendMessage($fromId, "Фотография успешно получена и прикреплена к вашему профилю/заявке!", $botToken);
            } else {
                vkSendMessage($fromId, "Фотография получена! Пожалуйста, укажите ваш логин или зарегистрируйтесь на сайте.", $botToken);
            }
        }
    }

    echo "ok";
    exit;
}

// По умолчанию отвечаем "ok" для VK Callback API
echo "ok";