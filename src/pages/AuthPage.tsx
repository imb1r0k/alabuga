import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [login, setLogin] = useState(''); // для входа
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<any>(null); // данные для показа модального окна

  const { login: loginUser, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLogin) {
      // Проверка паролей
      if (password !== confirmPassword) {
        setError('Пароли не совпадают');
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        await loginUser(login, password);
        navigate('/');
      } else {
        const userData = await register(firstName, lastName, phone, password);
        setRegisteredUser(userData); // показываем модалку
        // Не navigate сразу – покажем данные
        // При закрытии модалки перейдем на главную
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setRegisteredUser(null);
    navigate('/');
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    transition: 'border-color 0.3s ease'
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>
          {isLogin ? 'Вход в систему' : 'Регистрация'}
        </h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isLogin ? (
            <>
              <div className="input-group">
                <label htmlFor="login">Логин или телефон</label>
                <input
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                  disabled={loading}
                  style={inputStyle}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label htmlFor="lastName">Фамилия</label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                    style={inputStyle}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="firstName">Имя</label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="phone">Телефон</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  required
                  disabled={loading}
                  style={inputStyle}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Формат: +7 (900) 123-45-67</small>
              </div>
            </>
          )}

          <div className="input-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              style={inputStyle}
            />
            {!isLogin && <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Минимум 6 символов</small>}
          </div>

          {!isLogin && (
            <div className="input-group">
              <label htmlFor="confirmPassword">Повторите пароль</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                style={inputStyle}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px' }}
            disabled={loading}
          >
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>

      {/* Модальное окно с данными после регистрации */}
      {registeredUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ textAlign: 'center', color: '#28a745', marginBottom: '20px' }}>
              Поздравляем с регистрацией!
            </h2>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Фамилия:</strong> {registeredUser.last_name}</p>
              <p><strong>Имя:</strong> {registeredUser.first_name}</p>
              <p><strong>Логин:</strong> {registeredUser.login}</p>
              <p><strong>Телефон:</strong> {registeredUser.phone}</p>
              <p><strong>Пароль:</strong> {password}</p>
            </div>
            <p style={{ fontSize: '14px', color: '#dc3545', textAlign: 'center', marginBottom: '20px' }}>
              Сделайте скриншот во избежание потери ваших данных для входа
            </p>
            <button className="btn btn-primary" onClick={handleCloseModal} style={{ width: '100%' }}>
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Функция форматирования телефона в формате +7 (___) ___-__-__
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('7')) {
    // уже с 7
  } else if (digits.startsWith('8')) {
    // заменить 8 на 7
  } else {
    // добавить 7
    return input;
  }

  let result = '';
  if (digits.length > 0) result = '+7';
  if (digits.length > 1) result += ' (' + digits.substring(1, 4);
  if (digits.length >= 4) result += ') ' + digits.substring(4, 7);
  if (digits.length >= 7) result += '-' + digits.substring(7, 9);
  if (digits.length >= 9) result += '-' + digits.substring(9, 11);
  return result;
}