import { useAuth } from '../contexts/AuthContext';

export const DashboardPage = () => {
  const { user, isAuthenticated } = useAuth();

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
            Для доступа к личному кабинету необходимо войти в систему.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card">
        <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#333' }}>
          Личный кабинет
        </h1>
        
        <div style={{ borderTop: '1px solid #eee', paddingTop: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', color: '#666', display: 'block' }}>Имя</label>
            <p style={{ fontSize: '18px', color: '#333' }}>{user?.name || 'Не указано'}</p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', color: '#666', display: 'block' }}>Email</label>
            <p style={{ fontSize: '18px', color: '#333' }}>{user?.email}</p>
          </div>
          
          <div>
            <label style={{ fontSize: '14px', color: '#666', display: 'block' }}>ID пользователя</label>
            <p style={{ fontSize: '18px', color: '#333' }}>#{user?.id}</p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #eee', marginTop: '24px', paddingTop: '24px' }}>
          <h3 style={{ marginBottom: '12px', color: '#333' }}>Ваша информация</h3>
          <p style={{ color: '#666' }}>
            Здесь будет отображаться информация о вашем аккаунте и активности.
          </p>
        </div>
      </div>
    </div>
  );
};