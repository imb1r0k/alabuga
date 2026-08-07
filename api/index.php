<?php
// ============================================
// 1. CORS ЗАГОЛОВКИ - ДОЛЖНЫ БЫТЬ ПЕРВЫМИ!
// ============================================
// Разрешаем все домены
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400'); // Кэширование preflight на 24 часа

// Если это OPTIONS запрос (preflight) - завершаем здесь
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================
// 2. ОСТАЛЬНОЙ КОД
// ============================================
header('Content-Type: application/json; charset=utf-8');

// Подключение к базе данных
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

// Получение данных запроса
$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Получение заголовка авторизации
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$token = str_replace('Bearer ', '', $authHeader);

// Функции авторизации
function generateToken($userId) {
    return bin2hex(random_bytes(32)) . '_' . $userId . '_' . time();
}

function getUserByToken($pdo, $token) {
    if (empty($token)) return null;
    
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email FROM users u 
         INNER JOIN tokens t ON u.id = t.user_id 
         WHERE t.token = ? AND t.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    return $stmt->fetch();
}

// Маршруты API
switch ($uri) {
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
            $stmt = $pdo->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
            
            if ($stmt->execute([$name, $email, $hashedPassword])) {
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
                        'email' => $email
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
                    'email' => $user['email']
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