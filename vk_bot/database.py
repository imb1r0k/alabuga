def check_user_agreement(user_id):
    """Проверяет, согласился ли пользователь с правилами"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT agreement_accepted FROM users WHERE id = %s", (user_id,))
            result = cursor.fetchone()
            if result:
                return result.get('agreement_accepted') == 1
            return False
    except Exception as e:
        logger.error(f"Ошибка проверки согласия пользователя {user_id}: {e}")
        return False
    finally:
        conn.close()


def set_user_agreement(user_id):
    """Устанавливает отметку о согласии пользователя с правилами"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Сначала проверяем, существует ли пользователь
            cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            if not user:
                logger.error(f"Пользователь {user_id} не найден")
                return False
            
            # Обновляем согласие
            cursor.execute("""
                UPDATE users 
                SET agreement_accepted = 1, agreement_accepted_at = NOW() 
                WHERE id = %s
            """, (user_id,))
            
            # Проверяем, что обновление произошло
            affected_rows = cursor.rowcount
            if affected_rows > 0:
                logger.info(f"Пользователь {user_id} подтвердил согласие с правилами. Обновлено {affected_rows} строк.")
                return True
            else:
                logger.warning(f"Не удалось обновить согласие для пользователя {user_id}")
                return False
    except Exception as e:
        logger.error(f"Ошибка установки согласия для пользователя {user_id}: {e}")
        return False
    finally:
        conn.close()