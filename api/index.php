<?php
// ─── Главный маршрутизатор API ──────────────────────────────────────────────
// CORS-заголовки и точка входа для всех маршрутов.
// Маршруты разбиты по папке api/routes/ по разделам функционала.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

// ─── Подключение к БД и общие функции ─────────────────────────────────────
require_once __DIR__ . '/helpers.php';

// ─── Определение маршрута ─────────────────────────────────────────────────
$uri = $_GET['route'] ?? '';
if (!$uri) {
    $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri = trim(preg_replace('#^/api/?#', '', $requestUri), '/');
}

$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];

try {

    // ─── VK Бот ──────────────────────────────────────────────────────────
    // Вынесен в отдельный файл, т.к. включает мини-фреймворк со своей
    // инициализацией таблиц и обработчиками.
    if (strpos($uri, 'admin/vk-bot') === 0 || strpos($uri, 'vk-bot') === 0) {
        require_once __DIR__ . '/vk_bot.php';
        exit();
    }

    // ─── Подключаем маршруты по разделам ─────────────────────────────────
    // Каждый файл обрабатывает свой набор $uri и вызывает jsonResponse/jsonError.
    // Если ни один маршрут не совпал — управление возвращается в этот файл.

    require __DIR__ . '/routes/auth.php';
    require __DIR__ . '/routes/settings.php';
    require __DIR__ . '/routes/notifications.php';
    require __DIR__ . '/routes/profile.php';
    require __DIR__ . '/routes/booking.php';
    require __DIR__ . '/routes/team.php';
    require __DIR__ . '/routes/admin_misc.php';
    require __DIR__ . '/routes/admin_users.php';
    require __DIR__ . '/routes/admin_teams.php';

    // ─── Если ни один маршрут не совпал ─────────────────────────────────
    jsonError('Маршрут не найден: ' . $uri, 404);

} catch (Exception $e) {
    jsonResponse(['error' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}
