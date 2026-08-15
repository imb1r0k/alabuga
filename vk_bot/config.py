import os

# Параметры подключения к MySQL БД (на сервере используется localhost)
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_NAME = os.getenv('DB_NAME', 'imb1r0kya2')
DB_USER = os.getenv('DB_USER', 'imb1r0kya2')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'sAMogyg6sAMogyg')