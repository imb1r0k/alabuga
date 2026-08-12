<?php
// ─── Общие функции и подключение к базе данных ───────────────────────────────
// Подключается из api/index.php и api/routes/*.php.

$host = 'localhost';
$dbname = 'imb1r0kya2';
$username = 'imb1r0kya2';
$password = 'sAMogyg6sAMogyg';
$port = 3306;

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Автоматическое создание таблицы привязки кураторов к командам
    $pdo->exec("CREATE TABLE IF NOT EXISTS curator_teams (
        user_id INT NOT NULL,
        team_id INT NOT NULL,
        PRIMARY KEY (user_id, team_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    try {
        $pdo->exec("ALTER TABLE curator_teams DROP INDEX unique_curator_team");
    } catch (PDOException $ex) {}

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка подключения к базе данных: ' . $e->getMessage()]);
    exit();
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

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

function generatePassword($length = 8) {
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $password = '';
    for ($i = 0; $i < $length; $i++) {
        $password .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $password;
}

function getBearerToken() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } else if (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/i', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function getAuthUser($pdo) {
    $token = getBearerToken();
    if (!$token) return null;
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN tokens t ON u.id = t.user_id WHERE t.token = ? AND t.expires_at > NOW()");
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}

function requireAuth($pdo) {
    $user = getAuthUser($pdo);
    if (!$user) jsonError('Не авторизован', 401);
    return $user;
}

function requireAdmin($pdo) {
    $user = requireAuth($pdo);
    $role = strtolower(trim($user['role']));
    if (!in_array($role, ['admin', 'curator', 'moderator'])) jsonError('Доступ запрещён', 403);
    return $user;
}

function requireStrictAdmin($pdo) {
    $user = requireAuth($pdo);
    $role = strtolower(trim($user['role']));
    if ($role !== 'admin') jsonError('Доступ только для администраторов', 403);
    return $user;
}

function getCuratorTeams($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) return [];
    $role = strtolower(trim($user['role']));
    if ($role === 'admin') return null;

    if ($role === 'curator' || $role === 'moderator') {
        $stmt = $pdo->prepare("SELECT team_id FROM curator_teams WHERE user_id = ?");
        $stmt->execute([$userId]);
        $teams = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        if (in_array(0, $teams, true)) {
            return null;
        }
        return $teams;
    }
    return [];
}

function checkCuratorAccessToUser($pdo, $curatorId, $targetUserId) {
    $curatorTeams = getCuratorTeams($pdo, $curatorId);
    if ($curatorTeams === null) return true;

    $stmt = $pdo->prepare("SELECT team_id FROM users WHERE id = ?");
    $stmt->execute([$targetUserId]);
    $userTeamId = (int)$stmt->fetchColumn();

    return ($userTeamId === 0 || in_array($userTeamId, $curatorTeams, true));
}

function checkCuratorAccessToTeam($pdo, $curatorId, $teamId) {
    $curatorTeams = getCuratorTeams($pdo, $curatorId);
    if ($curatorTeams === null) return true;
    return in_array((int)$teamId, $curatorTeams, true);
}

function processAutoApproveBookings($pdo) {
    $settingStmt = $pdo->prepare("SELECT `value` FROM settings WHERE `key` = 'auto-accept-bookings'");
    $settingStmt->execute();
    $enabledVal = $settingStmt->fetchColumn();
    if ($enabledVal !== '1' && $enabledVal !== 'true') {
        return ['executed' => false, 'message' => 'Автоодобрение отключено в настройках', 'approved_count' => 0];
    }

    $stmt = $pdo->query("
        SELECT b.id, b.user_id, b.room_id, u.last_name, u.first_name, u.name,
               r.gender as room_gender, f.gender as floor_gender, bu.gender as building_gender
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        JOIN floors f ON r.floor_id = f.id
        JOIN buildings bu ON r.building_id = bu.id
        WHERE b.status = 'pending' AND u.status = 'active'
    ");
    $pendingList = $stmt->fetchAll();

    $approvedCount = 0;
    $updateStmt = $pdo->prepare("UPDATE bookings SET status = 'approved_bot', comment = 'Одобрено автоматически ботом' WHERE id = ?");

    foreach ($pendingList as $row) {
        $roomEff = $row['room_gender'] !== 'DEFAULT' ? $row['room_gender'] : ($row['floor_gender'] !== 'DEFAULT' ? $row['floor_gender'] : $row['building_gender']);
        $userGender = detectGenderByLastName($row['last_name'] ?: $row['name']);

        if ($roomEff === 'MIXED' || $roomEff === 'DEFAULT' || $userGender === null || $roomEff === $userGender) {
            $updateStmt->execute([$row['id']]);
            $approvedCount++;
        }
    }

    return ['executed' => true, 'approved_count' => $approvedCount];
}
