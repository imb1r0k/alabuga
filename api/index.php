// ... (внутри handleDefaultRoutes, случай 'admin/users')
case 'admin/users':
    checkAdmin($pdo, $token);
    if ($method === 'GET') {
        $stmt = $pdo->query('SELECT id, first_name, last_name, name, username, phone, role, team_name, created_at FROM users ORDER BY id DESC');
        echo json_encode($stmt->fetchAll());
    } elseif ($method === 'POST') {
        $id = $input['id'] ?? null;
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID пользователя не указан']); break; }
        $firstName = $input['first_name'] ?? '';
        $lastName = $input['last_name'] ?? '';
        $phone = $input['phone'] ?? '';
        $username = $input['username'] ?? ''; // было $email
        $role = $input['role'] ?? 'user';
        $teamName = $input['team_name'] ?? '';

        $sql = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?, username = ?, role = ?, team_name = ?';
        $params = [$firstName, $lastName, $phone, $username, $role, $teamName];

        if (!empty($input['password'])) {
            $sql .= ', password = ?';
            $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
        }
        $sql .= ' WHERE id = ?';
        $params[] = $id;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['success' => true]);
    }
    break;