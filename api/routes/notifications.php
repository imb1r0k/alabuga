<?php
// ─── Маршруты: Глобальные уведомления ──────────────────────────────────────

/**
 * @var PDO    $pdo
 * @var string $method
 * @var array  $data
 */

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
