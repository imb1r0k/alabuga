import os

# Параметры подключения к MySQL БД
DB_HOST = os.getenv('DB_HOST', 'VH310.spaceweb.ru')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_NAME = os.getenv('DB_NAME', 'imb1r0kya2')
DB_USER = os.getenv('DB_USER', 'imb1r0kya2')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'sAMogyg6sAMogyg')

# Настройки Callback API
CALLBACK_API_SECRET = os.getenv('CALLBACK_API_SECRET', 'IXLVL4sySPnsPO4E')
CALLBACK_API_PORT = int(os.getenv('CALLBACK_API_PORT', 5000))
CALLBACK_API_HOST = os.getenv('CALLBACK_API_HOST', '127.0.0.1')  # Только localhost, Nginx будет проксировать
CALLBACK_API_URL = os.getenv('CALLBACK_API_URL', 'https://alabuga.exowpn.ru/vk/callback')
CALLBACK_CONFIRMATION_CODE = os.getenv('CALLBACK_CONFIRMATION_CODE', 'f7282f1c')
GROUP_ID = os.getenv('GROUP_ID', '240686222')

# VK API настройки
VK_API_VERSION = '5.199'