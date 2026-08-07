import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Skeleton } from '../components/Skeleton';

export const AdminPanel = () => {
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const { siteTitle, loading: settingsLoading, updateSiteTitle } = useSettings();

  const [titleInput, setTitleInput] = useState(siteTitle);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Initialize titleInput when settings load
  useEffect(() => {
    if (!settingsLoading) {
      setTitleInput(siteTitle);
    }
  }, [siteTitle, settingsLoading]);

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

  // Show skeletons while loading auth or settings data
  if (authLoading || settingsLoading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card" style={{ minHeight: '400px' }}>
          <div style={{ padding: '24px' }}>
            {/* Admin header with skeletons */}
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '28px', marginBottom: '16px', color: '#333', visibility: 'hidden' }}>
                Админ-панель
              </h1>
              
              <div style={{ borderTop: '1px solid #eee', paddingTop: '24px', visibility: 'hidden' }}>
                <div style={{ marginBottom: '16px' }}>
                  <Skeleton width={80} height={16} className="mb-2" />
                  <Skeleton width={150} height={16} />
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <Skeleton width={80} height={16} className="mb-2" />
                  <Skeleton width={150} height={16} />
                </div>
                
                <div>
                  <Skeleton width={80} height={16} className="mb-2" />
                  <Skeleton width={100} height={16} />
                </div>
              </div>
            </div>

            {/* Settings section skeleton */}
            <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '24px', visibility: 'hidden' }}>
              <h3 style={{ marginBottom: '16px', color: '#333', visibility: 'hidden' }}>
                Настройки сайта
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <Skeleton width={180} height={20} className="mb-2" />
                <Skeleton width={300} height={20} />
              </div>
              
              <button
                className="btn btn-primary"
                style={{ opacity: '0.5' }}
              >
                Сохранить название
              </button>
            </div>
          </div>
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