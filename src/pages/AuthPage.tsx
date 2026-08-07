import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, Check, Copy, Smartphone, User, Lock } from 'lucide-react';

// Форматирование телефона РФ
const formatPhone = (value: string) => {
  const phone = value.replace(/\D/g, '').slice(0, 11);
  if (phone.length === 0) return '';
  if (phone.length <= 1) return `+7 (${phone}`;
  if (phone.length <= 4) return `+7 (${phone.slice(1)}`;
  if (phone.length <= 7) return `+7 (${phone.slice(1, 4)}) ${phone.slice(4)}`;
  if (phone.length <= 9) return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
  return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
};

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Модалка после регистрации
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<{
    first_name: string;
    last_name: string;
    phone: string;
    username: string;
    password: string;
  } | null>(null);

  const { login: authLogin, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await authLogin(login, password);
        navigate('/');
      } else {
        // Валидация
        if (!firstName.trim() || !lastName.trim()) {
          setError('Фамилия и имя обязательны');
          setLoading(false);
          return;
        }
        
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length !== 11) {
          setError('Введите корректный номер телефона (11 цифр)');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('Пароль должен содержать минимум 6 символов');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Пароли не совпадают');
          setLoading(false);
          return;
        }

        const result = await register(firstName, lastName, cleanPhone, password);
        // Показываем модальное окно с данными
        setRegisteredUser({
          first_name: result.first_name || firstName,
          last_name: result.last_name || lastName,
          phone: result.phone || formatPhone(cleanPhone),
          username: result.username,
          password: result.password || password,
        });
        setShowSuccessModal(true);
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
      padding: '20px',
      background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)'
    }}>
      <div className="admin-card animate-fade-in" style={{ maxWidth: '420px', width: '100%', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(2,132,199,0.3)'
          }}>
            <User size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
            {isLogin ? 'Вход в систему' : 'Регистрация'}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            {isLogin ? 'Введите логин или телефон для входа' : 'Заполните все поля для регистрации'}
          </p>
        </div>
        
        {error && (
          <div style={{
            backgroundColor: '#fef2f2', color: '#dc2626', padding: '10px 14px',
            borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
            border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <X size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="input-group">
                  <label>Фамилия</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    placeholder="Иванов"
                  />
                </div>
                <div className="input-group">
                  <label>Имя</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    placeholder="Иван"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>Номер телефона</label>
                <div style={{ position: 'relative' }}>
                  <Smartphone size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="+7 (999) 123-45-67"
                    required={!isLogin}
                    disabled={loading}
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>Пароль</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isLogin}
                    minLength={6}
                    disabled={loading}
                    placeholder="Минимум 6 символов"
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>Повторите пароль</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                    minLength={6}
                    disabled={loading}
                    placeholder="Повторите пароль"
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>
            </>
          )}

          {isLogin && (
            <>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>Логин или номер телефона</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="alabuga_ivanov_1234 или +7 (999) 123-45-67"
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>Пароль</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    placeholder="Введите пароль"
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600 }}
          >
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'underline'
            }}
            disabled={loading}
          >
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ПОСЛЕ РЕГИСТРАЦИИ */}
      {showSuccessModal && registeredUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="admin-card animate-fade-in" style={{ maxWidth: '440px', width: '100%', padding: '28px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', boxShadow: '0 4px 12px rgba(22,163,74,0.3)'
              }}>
                <Check size={32} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Поздравляем с регистрацией!
              </h2>
            </div>
            
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Фамилия</span>
                  <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{registeredUser.last_name}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Имя</span>
                  <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{registeredUser.first_name}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Логин</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>{registeredUser.username}</p>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(registeredUser.username); }}
                      style={{ border: 'none', background: '#e0f2fe', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Копировать логин"
                    >
                      <Copy size={14} color="#0284c7" />
                    </button>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Номер телефона</span>
                  <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{registeredUser.phone}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Пароль</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{registeredUser.password}</p>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(registeredUser.password); }}
                      style={{ border: 'none', background: '#e0f2fe', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Копировать пароль"
                    >
                      <Copy size={14} color="#0284c7" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <span style={{ fontSize: '18px' }}>📸</span>
              <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
                <strong>Сделайте скриншот</strong> во избежание потери ваших данных для входа
              </p>
            </div>

            <button
              onClick={() => { setShowSuccessModal(false); navigate('/'); }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600 }}
            >
              <Check size={18} /> Войти в кабинет
            </button>
          </div>
        </div>
      )}
    </div>
  );
};