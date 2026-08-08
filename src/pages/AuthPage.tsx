import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatPhoneInput } from '../utils/phone';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [patronymic, setPatronymic] = useState('');
  const [showPatronymic, setShowPatronymic] = useState(false);
  const [phone, setPhone] = useState('');
  const [regLogin, setRegLogin] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [manualPassword, setManualPassword] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<any>(null);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
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
        // Проверяем пароль только если пользователь решил указать свой
        if (manualPassword) {
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
        }
        // Если пароль не введён вручную — бэкенд сгенерирует его автоматически
        const userData = await register(lastName, firstName, phone, manualPassword ? password : '', regLogin, patronymic);
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
              {regSuccess.patronymic && <p><strong>Отчество:</strong> {regSuccess.patronymic}</p>}
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
                  <label htmlFor="loginUsername">Логин или номер телефона</label>
                  <input
                    id="loginUsername"
                    name="username"
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    placeholder="Введите логин или номер телефона"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="loginPassword">Пароль</label>
                  <input
                    id="loginPassword"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label htmlFor="regUsername">Логин (необязательно, можно оставить пустым)</label>
                  <input
                    id="regUsername"
                    name="username"
                    type="text"
                    value={regLogin}
                    onChange={(e) => setRegLogin(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    placeholder="Например, ivanov (необязательно)"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label htmlFor="lastName">Фамилия</label>
                    <input
                      id="lastName"
                      name="familyName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="firstName">Имя</label>
                    <input
                      id="firstName"
                      name="givenName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Переключатель «Укажу отчество» */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={showPatronymic}
                      onChange={(e) => setShowPatronymic(e.target.checked)}
                      disabled={loading}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Укажу отчество
                  </label>
                </div>

                {showPatronymic && (
                  <div className="input-group">
                    <label htmlFor="patronymic">Отчество (необязательно)</label>
                    <input
                      id="patronymic"
                      name="patronymic"
                      type="text"
                      value={patronymic}
                      onChange={(e) => setPatronymic(e.target.value)}
                      autoComplete="additional-name"
                      disabled={loading}
                      placeholder="Например, Иванович"
                    />
                  </div>
                )}

                <div className="input-group">
                  <label htmlFor="phone">Номер телефона</label>
                  <input
                    id="phone"
                    name="tel"
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    autoComplete="tel"
                    placeholder="+7 (___) ___-__-__"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Переключатель «Придумаю пароль сам» */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={manualPassword}
                      onChange={(e) => {
                        setManualPassword(e.target.checked);
                        if (!e.target.checked) {
                          setPassword('');
                          setPasswordConfirm('');
                        }
                      }}
                      disabled={loading}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Придумаю пароль сам
                  </label>
                </div>

                {manualPassword && (
                  <>
                    <div className="input-group">
                      <label htmlFor="regPassword">Пароль (минимум 6 символов)</label>
                      <input
                        id="regPassword"
                        name="new-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={loading}
                      />
                    </div>

                    <div className="input-group">
                      <label htmlFor="regPasswordConfirm">Повторите пароль</label>
                      <input
                        id="regPasswordConfirm"
                        name="new-password-confirm"
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={loading}
                      />
                    </div>
                  </>
                )}

                {!manualPassword && (
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                    🔑 Система автоматически сгенерирует пароль для вашего аккаунта.
                  </p>
                )}
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
                setManualPassword(false);
                setShowPatronymic(false);
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