import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<any>(null);
  const [customLogin, setCustomLogin] = useState('');
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    if (digits[0] === '8' || digits[0] === '7') {
      const code = digits.slice(1, 4);
      const first = digits.slice(4, 7);
      const second = digits.slice(7, 9);
      const third = digits.slice(9, 11);
      let result = `+7 (${code}`;
      if (first) result += `) ${first}`;
      if (second) result += `-${second}`;
      if (third) result += `-${third}`;
      return result;
    }
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        if (!loginInput && !phone) {
          setError('Введите логин или номер телефона');
          setLoading(false);
          return;
        }
        const loginValue = loginInput || phone;
        await login(loginValue, password);
        navigate('/');
      } else {
        if (!lastName.trim() || !firstName.trim()) {
          setError('Фамилия и Имя обязательны');
          setLoading(false);
          return;
        }
        if (!phone.trim()) {
          setError('Номер телефона обязателен');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Пароль должен быть минимум 6 символов');
          setLoading(false);
          return;
        }
        if (password !== passwordConfirm) {
          setError('Пароли не совпадают');
          setLoading(false);
          return;
        }
        const userData = await register(lastName, firstName, phone, password, customLogin);
        setRegSuccess(userData);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>
          {isLogin ? 'Вход в систему' : 'Регистрация'}
        </h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {regSuccess ? (
          <div style={{
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#155724', marginBottom: '16px' }}>🎉 Поздравляем с регистрацией!</h3>
            <div style={{ textAlign: 'left', backgroundColor: '#fff', padding: '16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', lineHeight: '1.8' }}>
              <p><strong>Фамилия:</strong> {regSuccess.last_name}</p>
              <p><strong>Имя:</strong> {regSuccess.first_name}</p>
              <p><strong>Логин:</strong> <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px', fontSize: '16px' }}>{regSuccess.login}</code></p>
              <p><strong>Номер телефона:</strong> {regSuccess.phone}</p>
              <p><strong>Пароль:</strong> <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>{regSuccess.password || password}</code></p>
            </div>
            <p style={{ color: '#856404', fontSize: '13px', marginBottom: '16px', fontStyle: 'italic' }}>
              📸 Сделайте скриншот во избежание потери ваших данных для входа
            </p>
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary"
            >
              Перейти на главную
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off">
            {isLogin ? (
              <>
                <div className="input-group">
                  <label htmlFor="loginInput">Логин или номер телефона</label>
                  <input
                    id="loginInput"
                    type="text"
                    name="username"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    disabled={loading}
                    placeholder="Введите логин или номер телефона"
                    autoComplete="username"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="password">Пароль</label>
                  <input
                    id="password"
                    type="password"
                    name="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label htmlFor="lastName">Фамилия</label>
                  <input
                    id="lastName"
                    type="text"
                    name="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="family-name"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="firstName">Имя</label>
                  <input
                    id="firstName"
                    type="text"
                    name="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="given-name"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="phone">Номер телефона</label>
                  <input
                    id="phone"
                    type="tel"
                    name="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+7 (___) ___-__-__"
                    required
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="customLogin">Логин (необязательно)</label>
                  <input
                    id="customLogin"
                    type="text"
                    name="nickname"
                    value={customLogin}
                    onChange={(e) => setCustomLogin(e.target.value)}
                    disabled={loading}
                    placeholder="Оставьте пустым — будет сгенерирован автоматически"
                    autoComplete="nickname"
                  />
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Если не указать, система сама создаст логин на основе номера телефона
                  </p>
                </div>

                <div className="input-group">
                  <label htmlFor="password">Пароль (минимум 6 символов)</label>
                  <input
                    id="password"
                    type="password"
                    name="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="passwordConfirm">Повторите пароль</label>
                  <input
                    id="passwordConfirm"
                    type="password"
                    name="new-password-confirm"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
            </button>
          </form>
        )}

        {!regSuccess && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setPassword('');
                setPasswordConfirm('');
                setCustomLogin('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              disabled={loading}
            >
              {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};