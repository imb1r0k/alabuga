import React, { useState } from 'react';
import { X, CheckCircle, KeyRound, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { bookRoom } from '../services/api';

interface BookingModalProps {
  room: any;
  buildingName: string;
  floorNumber: number;
  onClose: () => void;
}

type Stage = 'auth' | 'login' | 'register' | 'confirm' | 'result';

export const BookingModal: React.FC<BookingModalProps> = ({ room, buildingName, floorNumber, onClose }) => {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [stage, setStage] = useState<Stage>(isAuthenticated ? 'confirm' : 'auth');
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
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length === 0) { setPhone(''); return; }
    if (value[0] === '8' || value[0] === '7') {
      const code = value.slice(1, 4);
      const first = value.slice(4, 7);
      const second = value.slice(7, 9);
      const third = value.slice(9, 11);
      let result = `+7 (${code}`;
      if (first) result += `) ${first}`;
      if (second) result += `-${second}`;
      if (third) result += `-${third}`;
      setPhone(result);
    } else {
      setPhone(value);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Если пользователь авторизован — используем его токен и отправляем бронь
      if (isAuthenticated) {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Токен не найден');
        const response = await bookRoom({
          mode: 'existing',
          room_id: room.id,
          first_name: firstName,
          last_name: lastName,
          phone,
          login: regLogin,
        });
        setResult({ booking: response.booking, user: response.user, newUser: false });
        setStage('result');
        showToast('Бронирование отправлено!', 'success');
        return;
      }

      // Обычный путь для неавторизованных
      let token = '';
      let userData = null;
      let booking = null;
      let newUser = false;

      if (stage === 'login') {
        if (!loginInput || !password) {
          setError('Заполните логин/телефон и пароль');
          setLoading(false);
          return;
        }
        const payload = { mode: 'login', room_id: room.id, login: loginInput, password };
        const response = await bookRoom(payload);
        token = response.token;
        userData = response.user;
        booking = response.booking;
        newUser = response.new_user;
      } else {
        // Регистрация
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
        const payload = {
          mode: 'register',
          room_id: room.id,
          first_name: firstName,
          last_name: lastName,
          phone,
          password,
          login: regLogin.trim(),
        };
        const response = await bookRoom(payload);
        token = response.token;
        userData = response.user;
        booking = response.booking;
        newUser = response.new_user;
      }

      // Сохраняем токен и обновляем пользователя
      localStorage.setItem('token', token);
      await refreshUser();

      setResult({ booking, user: userData, newUser });
      setStage('result');
      showToast('Бронирование отправлено!', 'success');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Обработчик "Нет, изменить данные" — переходим в режим редактирования
  const handleEditData = () => {
    setStage('register');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
        >
          <X size={20} />
        </button>

        <div style={{ padding: '24px' }}>
          {/* Заголовок */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Бронирование комнаты</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                {buildingName} — Этаж {floorNumber} — Комната {room.room_number}
              </p>
            </div>
          </div>

          {stage === 'auth' && (
            <div>
              <p style={{ fontSize: '15px', color: '#0f172a', marginBottom: '20px' }}>
                У тебя есть аккаунт?
              </p>
              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <button className="btn btn-primary" onClick={() => setStage('login')} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                  Да, у меня есть аккаунт
                </button>
                <button className="btn btn-secondary" onClick={() => setStage('register')} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                  Нет, я новый участник
                </button>
              </div>
            </div>
          )}

          {/* Подтверждение для авторизованного пользователя */}
          {stage === 'confirm' && isAuthenticated && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <UserCheck size={20} color="#0284c7" />
                <span style={{ fontSize: '14px', color: '#075985', fontWeight: 500 }}>
                  Вы вошли как {user?.last_name} {user?.first_name}
                </span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '15px', color: '#0f172a', marginBottom: '12px' }}>Проверьте ваши данные для бронирования:</p>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '14px', lineHeight: 1.8 }}>
                  <p><strong>Фамилия:</strong> {lastName}</p>
                  <p><strong>Имя:</strong> {firstName}</p>
                  <p><strong>Телефон:</strong> {phone}</p>
                  <p><strong>Логин:</strong> {regLogin || user?.login}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <button className="btn btn-primary" onClick={handleConfirm} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                  Все верно, отправить заявку
                </button>
                <button className="btn btn-secondary" onClick={handleEditData} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                  Изменить данные
                </button>
              </div>

              {error && (
                <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', backgroundColor: '#f8d7da', color: '#721c24', fontSize: '13px' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {(stage === 'login' || stage === 'register') && (
            <form onSubmit={handleConfirm}>
              {error && (
                <div style={{ padding: '10px', borderRadius: '6px', marginBottom: '14px', backgroundColor: '#f8d7da', color: '#721c24', fontSize: '13px' }}>
                  {error}
                </div>
              )}

              {stage === 'login' ? (
                <>
                  <div className="input-group">
                    <label>Логин или номер телефона</label>
                    <input
                      type="text"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      placeholder="Введите логин или номер телефона"
                      disabled={loading}
                    />
                  </div>
                  <div className="input-group">
                    <label>Пароль</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Введите пароль"
                      disabled={loading}
                    />
                  </div>
                </>
              ) : (
                <>
                  {!isAuthenticated && (
                    <div className="input-group">
                      <label>Логин (необязательно)</label>
                      <input
                        type="text"
                        value={regLogin}
                        onChange={(e) => setRegLogin(e.target.value)}
                        placeholder="Например, ivanov"
                        disabled={loading}
                      />
                    </div>
                  )}
                  {isAuthenticated && (
                    <div className="input-group">
                      <label>Логин (нельзя изменить)</label>
                      <input
                        type="text"
                        value={user?.login}
                        disabled
                      />
                    </div>
                  )}
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
                  {!isAuthenticated && (
                    <>
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
                </>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '15px' }}>
                {loading ? 'Отправка...' : (isAuthenticated ? 'Сохранить и отправить' : (stage === 'login' ? 'Войти и забронировать' : 'Зарегистрироваться и забронировать'))}
              </button>

              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setStage(stage === 'login' ? 'register' : 'login')}
                  style={{ marginTop: '12px', background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '14px', width: '100%' }}
                  disabled={loading}
                >
                  {stage === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                </button>
              )}
            </form>
          )}

          {stage === 'result' && result && (
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

              <button className="btn btn-primary" onClick={onClose} style={{ width: '100%', padding: '12px' }}>
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};