<?php
// =============================================================================
// Модуль: Настройки и глобальные уведомления
// Маршруты: settings, get-global-notification, save-global-notification,
//           mark-notification-viewed
// =============================================================================

// ─── Настройки ──────────────────────────────────────────────────────────────

if ($uri === 'settings') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT `key`, `value` FROM settings");
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['key']] = $row['value'];
        }
        jsonResponse($settings);
    }

    if ($method === 'POST') {
        $user = requireStrictAdmin($pdo);

        foreach ($data as $key => $value) {
            $allowed = ['site_title', 'hero_badge', 'hero_title', 'hero_description', 'hero_button_text', 'hero_button_text_auth', 'auto-accept-bookings', 'show_rating'];
            if (!in_array($key, $allowed)) continue;
            $val = trim((string)$value);
            $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");
            $stmt->execute([$key, $val, $val]);
        }

        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}

// ─── Получение глобального уведомления ─────────────────────────────────────

if ($uri === 'get-global-notification' || $uri === 'notifications/global') {
    $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'global_notification'");
    $stmt->execute();
    $raw = $stmt->fetchColumn();
    $notif = $raw ? json_decode($raw, true) : null;

    if (!$notif || empty($notif['enabled'])) {
        jsonResponse(['notification' => null]);
    }

    $type = $notif['type'] ?? 'permanent';
    $viewers = $notif['viewers'] ?? [];
    $user = getAuthUser($pdo);
    $viewerKey = $user ? trim((string)$user['login']) : null;

    if ($type === 'one-view' && $viewerKey && in_array($viewerKey, $viewers, true)) {
        jsonResponse(['notification' => null]);
    }

    jsonResponse(['notification' => $notif]);
}

// ─── Сохранение глобального уведомления ────────────────────────────────────

if ($uri === 'save-global-notification') {
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    requireStrictAdmin($pdo);

    $text = trim($data['text'] ?? '');
    $type = in_array($data['type'] ?? '', ['permanent', 'one-view'], true) ? $data['type'] : 'permanent';
    $enabled = !empty($data['enabled']);

    if (!$text) jsonError('Текст уведомления обязателен');

    $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'global_notification'");
    $stmt->execute();
    $raw = $stmt->fetchColumn();
    $existing = $raw ? json_decode($raw, true) : null;
    $viewers = $existing['viewers'] ?? [];

    $payload = json_encode([
        'text' => $text,
        'type' => $type,
        'enabled' => $enabled,
        'viewers' => $viewers,
    ], JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES ('global_notification', ?) ON DUPLICATE KEY UPDATE `value` = ?");
    $stmt->execute([$payload, $payload]);

    jsonResponse(['success' => true]);
}

// ─── Отметка уведомления просмотренным ─────────────────────────────────────

if ($uri === 'mark-notification-viewed' || $uri === 'notifications/global/view') {
    if ($method !== 'POST') jsonError('Метод не поддерживается', 405);
    $user = requireAuth($pdo);
    $login = trim((string)$user['login']);
    if (!$login) jsonResponse(['success' => true]);

    $stmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'global_notification'");
    $stmt->execute();
    $raw = $stmt->fetchColumn();
    $notif = $raw ? json_decode($raw, true) : null;
    if (!$notif) jsonResponse(['success' => true]);

    $viewers = $notif['viewers'] ?? [];
    if (!in_array($login, $viewers, true)) {
        $viewers[] = $login;
        $notif['viewers'] = $viewers;
        $payload = json_encode($notif, JSON_UNESCAPED_UNICODE);
        $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES ('global_notification', ?) ON DUPLICATE KEY UPDATE `value` = ?");
        $stmt->execute([$payload, $payload]);
    }

    jsonResponse(['success' => true]);
}
