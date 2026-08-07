import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const adminNavItems = [
    { to: '/admin-panel', label: 'Главная', end: true },
    { to: '/admin-panel/users', label: 'Пользователи', end: false },
    { to: '/admin-panel/buildings', label: 'Корпуса', end: false },
    { to: '/admin-panel/bookings', label: 'Бронирования', end: false },
    { to: '/admin-panel/teams', label: 'Команды', end: false },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header style={{ backgroundColor: '#0f172a', padding: '12px 0', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>⚡</span>
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>Алабуга</span>
        </Link>

        {isAuthenticated && (
          <nav style={{ display: 'flex', gap: '20px' }}>
            <NavLink to="/" style={({ isActive }) => ({ color: isActive ? '#3b82f6' : '#e2e8f0', textDecoration: 'none' })}>
              Главная
            </NavLink>
            <NavLink to="/booking" style={({ isActive }) => ({ color: isActive ? '#3b82f6' : '#e2e8f0', textDecoration: 'none' })}>
              Бронирование
            </NavLink>
            <NavLink to="/dashboard" style={({ isActive }) => ({ color: isActive ? '#3b82f6' : '#e2e8f0', textDecoration: 'none' })}>
              Личный кабинет
            </NavLink>
          </nav>
        )}

        {(user?.role === 'admin' || user?.role === 'moderator') && (
          <nav style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="nav-animation"
                style={({ isActive }) => ({
                  color: isActive ? '#fff' : '#e2e8f0',
                  backgroundColor: isActive ? '#0284c7' : 'transparent',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated ? (
            <>
              <span style={{ color: '#e2e8f0', fontSize: '14px' }}>
                {user?.last_name} {user?.first_name || user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Выйти
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};