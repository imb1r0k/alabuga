<?php
// ============================================
// 1. CORS ЗАГОЛОВКИ - ДОЛЖНЫ БЫТЬ ПЕРВЫМИ!
// ============================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================
// 2. ПОДКЛЮЧЕНИЕ К БД И ОБРАБОТКА
// ============================================
header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$dbname = 'imb1r0kya2';
$username = 'imb1r0kya2';
$password = 'sAMogyg6sAMogyg';
$port = 3306;

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка подключения к базе данных: ' . $e->getMessage()]);
    exit();
}

// Получение URI и метода
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = str_replace('/api', '', $uri);
$uri = str_replace('/index.php', '', $uri);
$uri = trim($uri, '/');
$method = $_SERVER['REQUEST_METHOD'];

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Надежное извлечение Bearer-токена
function getBearerToken() {
    $authHeader = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } else {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
    }
    if (preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        return $matches[1];
    }
    return '';
}

$token = getBearerToken();

function generateToken($userId) {
    return bin2hex(random_bytes(32)) . '_' . $userId . '_' . time();
}

function getUserByToken($pdo, $token) {
    if (empty($token)) return null;
    
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.role FROM users u 
         INNER JOIN tokens t ON u.id = t.user_id 
         WHERE t.token = ? AND t.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    return $stmt->fetch();
}

// Маршруты API
switch ($uri) {
    case 'settings':
        if ($method === 'GET') {
            try {
                $stmt = $pdo->query('SELECT `key`, `value` FROM settings');
                $settings = [];
                while ($row = $stmt->fetch()) {
                    $settings[$row['key']] = $row['value'];
                }
                if (!isset($settings['site_title'])) {
                    $settings['site_title'] = 'Алабуга - форум 2025';
                }
                echo json_encode($settings);
            } catch (Exception $e) {
                echo json_encode(['site_title' => 'Алабуга - форум 2025']);
            }
        } elseif ($method === 'POST') {
            $user = getUserByToken($pdo, $token);
            if (!$user || strtolower(trim($user['role'] ?? '')) !== 'admin') {
                http_response_code(403);
                echo json_encode(['error' => 'Недостаточно прав']);
                break;
            }
            $siteTitle = trim($input['site_title'] ?? '');
            if (!empty($siteTitle)) {
                $stmt = $pdo->prepare('INSERT INTO settings (`key`, `value`) VALUES ("site_title", ?) ON DUPLICATE KEY UPDATE `value` = ?');
                $stmt->execute([$siteTitle, $siteTitle]);
            }
            echo json_encode(['success' => true]);
        }
        break;

    case 'register':
        if ($method === 'POST') {
            $name = $input['name'] ?? '';
            $email = $input['email'] ?? '';
            $password = $input['password'] ?? '';
            
            if (empty($name) || empty($email) || empty($password)) {
                http_response_code(400);
                echo json_encode(['error' => 'Все поля обязательны']);
                break;
            }
            
            if (strlen($password) < 6) {
                http_response_code(400);
                echo json_encode(['error' => 'Пароль должен быть минимум 6 символов']);
                break;
            }
            
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Пользователь с таким email уже существует']);
                break;
            }
            
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
            
            if ($stmt->execute([$name, $email, $hashedPassword, 'user'])) {
                $userId = $pdo->lastInsertId();
                $newToken = generateToken($userId);
                
                $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
                $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
                $stmt->execute([$userId, $newToken, $expiresAt]);
                
                echo json_encode([
                    'success' => true,
                    'token' => $newToken,
                    'user' => [
                        'id' => $userId,
                        'name' => $name,
                        'email' => $email,
                        'role' => 'user'
                    ]
                ]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Ошибка регистрации']);
            }
        }
        break;
        
    case 'login':
        if ($method === 'POST') {
            $email = $input['email'] ?? '';
            $password = $input['password'] ?? '';
            
            if (empty($email) || empty($password)) {
                http_response_code(400);
                echo json_encode(['error' => 'Email и пароль обязательны']);
                break;
            }
            
            $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if (!$user || !password_verify($password, $user['password'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Неверный email или пароль']);
                break;
            }
            
            $newToken = generateToken($user['id']);
            
            $stmt = $pdo->prepare('DELETE FROM tokens WHERE user_id = ?');
            $stmt->execute([$user['id']]);
            
            $stmt = $pdo->prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
            $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
            $stmt->execute([$user['id'], $newToken, $expiresAt]);
            
            echo json_encode([
                'success' => true,
                'token' => $newToken,
                'user' => [
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'role' => $user['role']
                ]
            ]);
        }
        break;
        
    case 'user':
        if ($method === 'GET') {
            $user = getUserByToken($pdo, $token);
            if ($user) {
                echo json_encode($user);
            } else {
                http_response_code(401);
                echo json_encode(['error' => 'Не авторизован']);
            }
        }
        break;
        
    case 'logout':
        if ($method === 'POST') {
            if (!empty($token)) {
                $stmt = $pdo->prepare('DELETE FROM tokens WHERE token = ?');
                $stmt->execute([$token]);
            }
            echo json_encode(['success' => true]);
        }
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Метод не найден: ' . $uri]);
        break;
}
?>