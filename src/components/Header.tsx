import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();

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
          Crimson Phoenix
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isAuthenticated ? (
            <>
              <span style={{ fontSize: '14px', color: '#666' }}>
                {user?.name || user?.email}
              </span>
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