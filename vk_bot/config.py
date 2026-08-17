import os

# Параметры подключения к MySQL БД
DB_HOST = os.getenv('DB_HOST', 'VH310.spaceweb.ru')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_NAME = os.getenv('DB_NAME', 'imb1r0kya2')
DB_USER = os.getenv('DB_USER', 'imb1r0kya2')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'sAMogyg6sAMogyg')