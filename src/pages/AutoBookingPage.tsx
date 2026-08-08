import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft, CheckCircle, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { autoBook } from '../services/api';

type Gender = 'M' | 'F' | null;
type AuthStep = 'auth' | 'login' | 'register' | 'result';

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

export const AutoBookingPage: React.FC = () => {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [gender, setGender] = useState<Gender>(null);
  const [autoMode, setAutoMode] = useState(false); // выбран ли автоматический метод
  const [authStep, setAuthStep] = useState<AuthStep>(isAuthenticated ? 'result' : 'auth');

  // Данные формы
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [regLogin, setRegLogin] = useState(user?.login || '');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gender) {
      setError('Сначала укажите ваш пол');
      return;
    }
    setError('');
    setLoading(true);

    try {
      let payload: any = { gender };
      let token = '';
      let userData = null;
      let booking = null;
      let newUser = false;

      if (isAuthenticated) {
        payload = { ...payload, mode: 'existing' };
        const response = await autoBook(payload);
        token = response.token;
        userData = response.user;
        booking = response.booking;
        newUser = response.new_user;
      } else if (authStep === 'login') {
        if (!loginInput || !password) {
          setError('Заполните логин/телефон и пароль');
          setLoading(false);
          return;
        }
        payload = { ...payload, mode: 'login', login: loginInput, password };
        const response = await autoBook(payload);
        token = response.token;
        userData = response.user;
        booking = response.booking;
        newUser = response.new_user;
      } else if (authStep === 'register') {
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
        payload = {
          ...payload,
          mode: 'register',
          first_name: firstName,
          last_name: lastName,
          phone,
          password,
          login: regLogin.trim(),
        };
        const response = await autoBook(payload);
        token = response.token;
        userData = response.user;
        booking = response.booking;
        newUser = response.new_user;
      }

      if (token) {
        localStorage.setItem('token', token);
        await refreshUser();
      }

      setResult({ booking, user: userData, newUser });
      setAuthStep('result');
      showToast('Бронирование отправлено!', 'success');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleManualMethod = () => {
    navigate('/', { state: { scrollToBooking: true } });
  };

  return (
    <div style={{ padding: '32px 24px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', textDecoration: 'none', fontSize: '14px', marginBottom: '20px' }}>
        <ArrowLeft size={16} /> На главную
      </Link>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserPlus size={32} />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>Заселение</h1>
        <p style={{ color: '#64748b', fontSize: '15px' }}>Выберите ваш пол и способ заселения</p>
      </div>

      {/* Всегда показываем шаги, кроме результата */}
      {authStep !== 'result' && (
        <div>
          {/* Шаг 1: пол */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>Ваш пол</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setGender('M')}
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: `2px solid ${gender === 'M' ? '#0284c7' : '#cbd5e1'}`,
                  backgroundColor: gender === 'M' ? '#f0f9ff' : '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: gender === 'M' ? '#0284c7' : '#475569',
                  transition: 'all 0.2s',
                }}
              >
                🚹 Мальчик
              </button>
              <button
                onClick={() => setGender('F')}
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: `2px solid ${gender === 'F' ? '#e11d48' : '#cbd5e1'}`,
                  backgroundColor: gender === 'F' ? '#fdf2f8' : '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: gender === 'F' ? '#e11d48' : '#475569',
                  transition: 'all 0.2s',
                }}
              >
                🚺 Девочка
              </button>
            </div>
          </div>

          {/* Шаг 2: метод */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>Как хотите заселиться?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleManualMethod}
                disabled={!gender}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: gender ? '#fff' : '#f1f5f9',
                  cursor: gender ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  color: gender ? '#0f172a' : '#94a3b8',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>🔍 Выбрать комнату самому</span>
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={() => { setAutoMode(true); setAuthStep(isAuthenticated ? 'result' : 'auth'); }}
                disabled={!gender}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #0284c7',
                  backgroundColor: gender ? '#e0f2fe' : '#f1f5f9',
                  cursor: gender ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  color: gender ? '#0c4a6e' : '#94a3b8',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <span>🤖 Заселить автоматически (система выберет комнату)</span>
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>

          {/* Шаг 3: форма для авто-метода */}
          {autoMode && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              {isAuthenticated ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', marginBottom: '16px' }}>
                    <UserCheck size={20} color="#0284c7" />
                    <span style={{ fontSize: '14px', color: '#075985', fontWeight: 500 }}>
                      Вы вошли как {user?.last_name} {user?.first_name}
                    </span>
                  </div>
                  {error && <div style={{ padding: '10px', borderRadius: '6px', marginBottom: '12px', backgroundColor: '#f8d7da', color: '#721c24', fontSize: '13px' }}>{error}</div>}
                  <button onClick={handleSubmit} className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                    {loading ? 'Поиск комнаты...' : 'Подтвердить и заселить автоматически'}
                  </button>
                </div>
              ) : (
                <div>
                  {authStep === 'auth' ? (
                    <div>
                      <p style={{ fontSize: '15px', color: '#0f172a', marginBottom: '16px' }}>Вам потребуется аккаунт для бронирования.</p>
                      <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                        <button className="btn btn-primary" onClick={() => setAuthStep('login')} style={{ padding: '12px', fontSize: '15px' }}>У меня есть аккаунт</button>
                        <button className="btn btn-secondary" onClick={() => setAuthStep('register')} style={{ padding: '12px', fontSize: '15px' }}>Зарегистрироваться</button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      {error && <div style={{ padding: '10px', borderRadius: '6px', marginBottom: '14px', backgroundColor: '#f8d7da', color: '#721c24', fontSize: '13px' }}>{error}</div>}
                      {authStep === 'login' ? (
                        <>
                          <div className="input-group">
                            <label>Логин или номер телефона</label>
                            <input type="text" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} placeholder="Введите логин или телефон" disabled={loading} />
                          </div>
                          <div className="input-group">
                            <label>Пароль</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" disabled={loading} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="input-group">
                            <label>Логин (необязательно)</label>
                            <input type="text" value={regLogin} onChange={(e) => setRegLogin(e.target.value)} placeholder="Например, ivanov" disabled={loading} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                              <label>Фамилия</label>
                              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
                            </div>
                            <div className="input-group">
                              <label>Имя</label>
                              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
                            </div>
                          </div>
                          <div className="input-group">
                            <label>Номер телефона</label>
                            <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="+7 (___) ___-__-__" disabled={loading} />
                          </div>
                          <div className="input-group">
                            <label>Пароль (минимум 6 символов)</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
                          </div>
                          <div className="input-group">
                            <label>Повторите пароль</label>
                            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} disabled={loading} />
                          </div>
                        </>
                      )}
                      <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                        {loading ? 'Поиск комнаты...' : 'Заселить автоматически'}
                      </button>
                      {authStep === 'register' && (
                        <button
                          type="button"
                          onClick={() => setAuthStep('login')}
                          style={{ marginTop: '12px', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '14px', width: '100%' }}
                          disabled={loading}
                        >
                          Уже есть аккаунт? Войти
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {authStep === 'result' && result && (
        <div>
          <div style={{ backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
            <CheckCircle size={32} color="#16a34a" style={{ marginBottom: '8px' }} />
            <h3 style={{ margin: 0, color: '#155724', fontSize: '17px' }}>Бронирование отправлено!</h3>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#155724' }}>
              Ваша заявка на комнату <strong>№{result.booking.room_number}</strong> ({result.booking.building_name}, этаж {result.booking.floor_number}) принята. Статус: <strong>Ожидает подтверждения</strong>.
            </p>
          </div>

          {result.newUser && result.user.password && (
            <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffe69c', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: '#856404' }}>Ваши данные для входа:</h4>
              <div style={{ fontSize: '14px', color: '#664d03', lineHeight: '1.8' }}>
                <p><strong>Фамилия:</strong> {result.user.last_name}</p>
                <p><strong>Имя:</strong> {result.user.first_name}</p>
                <p><strong>Логин:</strong> <strong style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{result.user.login}</strong></p>
                <p><strong>Пароль:</strong> <strong style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{result.user.password}</strong></p>
              </div>
              <p style={{ fontSize: '12px', color: '#856404', fontStyle: 'italic', margin: '8px 0 0' }}>
                📸 Сохраните эти данные — они понадобятся для входа в личный кабинет.
              </p>
            </div>
          )}

          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', padding: '12px' }}>
            На главную
          </button>
        </div>
      )}
    </div>
  );
};