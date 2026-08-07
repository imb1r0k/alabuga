<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

echo json_encode([
    'status' => 'OK',
    'message' => 'PHP работает!',
    'time' => date('Y-m-d H:i:s')
]);