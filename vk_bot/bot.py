def check_user_agreement(user_id):
    """Проверяет, согласился ли пользователь с правилами (по наличию даты)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT agreement_accepted_at FROM users WHERE id = %s", (user_id,))
            result = cursor.fetchone()
            if result:
                return result.get('agreement_accepted_at') is not None
            return False
    except Exception as e:
        logger.error(f"Ошибка проверки согласия пользователя {user_id}: {e}")
        return False
    finally:
        conn.close()


def set_user_agreement(user_id):
    """Устанавливает отметку о согласии пользователя с правилами (ставит текущую дату)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            logger.info(f"set_user_agreement: Начинаем обновление для user_id={user_id}")
            
            # Сначала проверяем, существует ли пользователь
            cursor.execute("SELECT id, agreement_accepted_at FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            if not user:
                logger.error(f"set_user_agreement: Пользователь {user_id} не найден")
                return False
            
            logger.info(f"set_user_agreement: Текущее значение agreement_accepted_at = {user.get('agreement_accepted_at')}")
            
            # Обновляем согласие - ставим текущую дату
            cursor.execute("""
                UPDATE users 
                SET agreement_accepted_at = NOW() 
                WHERE id = %s
            """, (user_id,))
            
            # Проверяем, что обновление произошло
            affected_rows = cursor.rowcount
            logger.info(f"set_user_agreement: affected_rows = {affected_rows}")
            
            if affected_rows > 0:
                # Проверяем, что действительно обновилось
                cursor.execute("SELECT agreement_accepted_at FROM users WHERE id = %s", (user_id,))
                result = cursor.fetchone()
                logger.info(f"set_user_agreement: После обновления - agreement_accepted_at = {result.get('agreement_accepted_at') if result else None}")
                
                if result and result.get('agreement_accepted_at') is not None:
                    logger.info(f"set_user_agreement: ✅ Успешно! Пользователь {user_id} подтвердил согласие")
                    return True
                else:
                    logger.error(f"set_user_agreement: ❌ Не удалось подтвердить обновление для пользователя {user_id}")
                    return False
            else:
                logger.warning(f"set_user_agreement: ❌ Не удалось обновить согласие для пользователя {user_id}")
                return False
                
    except Exception as e:
        logger.error(f"set_user_agreement: Ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        conn.close()