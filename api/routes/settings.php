<?php
// ─── Маршруты: Настройки сайта ──────────────────────────────────────────────

/**
 * @var PDO    $pdo
 * @var string $method
 * @var array  $data
 */

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
            $allowed = ['site_title', 'hero_badge', 'hero_title', 'hero_description', 'hero_button_text', 'hero_button_text_auth', 'auto-accept-bookings'];
            if (!in_array($key, $allowed)) continue;
            $val = trim((string)$value);
            $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?");
            $stmt->execute([$key, $val, $val]);
        }

        jsonResponse(['success' => true]);
    }

    jsonError('Метод не поддерживается', 405);
}
