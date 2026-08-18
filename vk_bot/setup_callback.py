#!/usr/bin/env python3
"""
Скрипт для настройки Callback API бота ВКонтакте
Запустите этот скрипт для привязки бота к группе
"""

import sys
import requests
import json
import config
from database import get_bot_settings

def setup_callback():
    """Настройка Callback API"""
    print("=" * 60)
    print("🔧 НАСТРОЙКА CALLBACK API БОТА")
    print("=" * 60)
    
    # Получаем настройки
    settings = get_bot_settings()
    token = settings.get('vk_token', '')
    
    if not token:
        print("\n❌ ОШИБКА: VK Token не найден в базе данных!")
        print("Пожалуйста, добавьте VK Token в таблицу vk_bot_settings")
        return False
    
    print(f"\n✅ VK Token найден")
    print(f"🆔 ID группы: {config.GROUP_ID}")
    print(f"🔗 Callback URL: {config.CALLBACK_API_URL}")
    print(f"🔐 Секретный ключ: {config.CALLBACK_API_SECRET}")
    print(f"📋 Код подтверждения: {config.CALLBACK_CONFIRMATION_CODE}")
    
    print("\n" + "=" * 60)
    print("📋 ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:")
    print("=" * 60)
    print("\n1. Откройте https://vk.com/apps?act=manage")
    print("2. Выберите ваше приложение или создайте новое")
    print("3. В настройках приложения укажите:")
    print(f"   - Callback API URL: {config.CALLBACK_API_URL}")
    print(f"   - Секретный ключ: {config.CALLBACK_API_SECRET}")
    print("4. Включите Callback API в настройках группы")
    print("5. Добавьте следующие типы событий:")
    print("   ✅ Сообщения: message_new")
    print("6. Нажмите 'Подтвердить' для проверки")
    print("\n" + "=" * 60)
    
    # Проверка работоспособности
    print("\n🔄 Проверка работоспособности...")
    
    try:
        # Проверяем, что сервер запущен
        response = requests.get(
            f"http://{config.CALLBACK_API_HOST}:{config.CALLBACK_API_PORT}/vk/status",
            timeout=5
        )
        
        if response.status_code == 200:
            print("✅ Бот запущен и отвечает на запросы")
            data = response.json()
            print(f"📊 Статус: {data.get('status')}")
        else:
            print(f"⚠️ Бот не отвечает на http://{config.CALLBACK_API_HOST}:{config.CALLBACK_API_PORT}")
            print("Пожалуйста, запустите бота командой: python bot_callback.py")
    except Exception as e:
        print(f"⚠️ Бот не отвечает: {e}")
        print("Пожалуйста, запустите бота командой: python bot_callback.py")
    
    # Предложение открыть настройки
    print("\n" + "=" * 60)
    print("🌐 ОТКРЫТЬ НАСТРОЙКИ В VK:")
    print("=" * 60)
    print(f"\n1. Настройки Callback API:")
    print(f"   https://vk.com/groups?act=settings&id={config.GROUP_ID}")
    print(f"\n2. Настройки приложения:")
    print(f"   https://vk.com/apps?act=manage")
    print("\n" + "=" * 60)
    
    # Проверка подтверждения
    print("\n❓ После настройки проверьте, что сервер подтвержден")
    print("Если сервер не подтвержден, проверьте:")
    print("  - Бот запущен")
    print("  - Callback URL доступен извне")
    print("  - В настройках группы включен Callback API")
    print("  - В настройках приложения указан Callback URL")
    print(f"  - Код подтверждения: {config.CALLBACK_CONFIRMATION_CODE}")
    
    return True


def test_callback():
    """Тестирование Callback API"""
    print("\n" + "=" * 60)
    print("🔍 ТЕСТИРОВАНИЕ CALLBACK API")
    print("=" * 60)
    
    url = f"http://{config.CALLBACK_API_HOST}:{config.CALLBACK_API_PORT}/vk/callback"
    
    # Тест подтверждения
    test_data = {
        "type": "confirmation",
        "group_id": config.GROUP_ID
    }
    
    try:
        response = requests.post(
            url,
            json=test_data,
            timeout=5
        )
        
        if response.status_code == 200:
            expected = config.CALLBACK_CONFIRMATION_CODE
            actual = response.text.strip()
            
            if actual == expected:
                print(f"✅ Тест подтверждения пройден!")
                print(f"   Ожидалось: {expected}")
                print(f"   Получено: {actual}")
            else:
                print(f"❌ Тест подтверждения не пройден!")
                print(f"   Ожидалось: {expected}")
                print(f"   Получено: {actual}")
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"Ответ: {response.text}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        print("Пожалуйста, убедитесь, что бот запущен")


def main():
    """Главная функция"""
    print("\n" + "=" * 60)
    print("🤖 НАСТРОЙКА ВК БОТА (CALLBACK API)")
    print("=" * 60)
    
    print("\nВыберите действие:")
    print("1. Показать инструкцию по настройке")
    print("2. Протестировать Callback API")
    print("3. Выполнить оба действия")
    print("4. Выйти")
    
    choice = input("\nВаш выбор (1-4): ").strip()
    
    if choice == "1":
        setup_callback()
    elif choice == "2":
        test_callback()
    elif choice == "3":
        setup_callback()
        test_callback()
    else:
        print("До свидания!")
        sys.exit(0)


if __name__ == '__main__':
    main()