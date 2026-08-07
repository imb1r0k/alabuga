import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export const Header = () => {
  const { user, logout, isAuthenticated, isAdmin, isModerator } = useAuth();
  const { siteTitle } = useSettings();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header style={{
      backgroundColor: 'white',
      borderBottom: '1px solid #e0e0e0',
      padding: '0 20px',
      height: '64px',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%'
      }}>
        <Link to="/" style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#dc3545',
          textDecoration: 'none'
        }}>
          {siteTitle}
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated ? (
            <>
              <span style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>
                {user?.name || user?.email} ({user?.role})
              </span>

              {(isAdmin || isModerator) && (
                <Link
                  to="/admin-panel"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#28a745' }}
                >
                  Админка
                </Link>
              )}

              <Link
                to="/dashboard"
                className="btn btn-primary"
              >
                Кабинет
              </Link>

              <button
                onClick={handleLogout}
                className="btn btn-danger"
              >
                Выйти
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="btn btn-primary"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};