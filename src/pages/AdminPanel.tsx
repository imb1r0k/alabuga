import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export const AdminPanel = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { siteTitle, updateSiteTitle } = useSettings();

  const [titleInput, setTitleInput] = useState(siteTitle);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTitleInput(siteTitle);
  }, [siteTitle]);

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>
            Требуется авторизация
          </h2>
          <p style={{ color: '#666', textAlign: 'center' }}>
            Для доступа к админ-панели необходимо войти в систему.
          </p>
        </div>
      </div>
    );
  }

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await updateSiteTitle(titleInput);
      setMessage('Название сайта успешно обновлено!');
    } catch (err: any) {
      setMessage('Ошибка при сохранении: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card">
        <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#333' }}>
          Админ-панель
        </h1>
        
        <div style={{ borderTop: '1px solid #eee', paddingTop: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', color: '#666', display: 'block' }}>Имя</label>
            <p style={{ fontSize: '18px', color: '#333' }}>{user?.name}</p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', color: '#666', display: 'block' }}>Email</label>
            <p style={{ fontSize: '18px', color: '#333' }}>{user?.email}</p>
          </div>
          
          <div>
            <label style={{ fontSize: '14px', color: '#666', display: 'block' }}>Роль</label>
            <p style={{ fontSize: '18px', color: '#333' }}>{user?.role}</p>
          </div>
        </div>

        {isAdmin && (
          <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: '#333' }}>Настройки сайта</h3>
            
            {message && (
              <div style={{
                padding: '10px 15px',
                borderRadius: '4px',
                marginBottom: '16px',
                backgroundColor: message.includes('Ошибка') ? '#f8d7da' : '#d4edda',
                color: message.includes('Ошибка') ? '#721c24' : '#155724'
              }}>
                {message}
              </div>
            )}

            <form onSubmit={handleSaveTitle}>
              <div className="input-group">
                <label htmlFor="siteTitle">Название сайта (хранится в БД)</label>
                <input
                  id="siteTitle"
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить название'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};