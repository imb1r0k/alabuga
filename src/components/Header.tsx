import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Skeleton } from './Skeleton';
import { 
  Home, 
  User, 
  Users, 
  BookmarkCheck, 
  Building2, 
  LogOut, 
  ShieldCheck
} from 'lucide-react';

export const Header = () => {
  const { user, logout, isAuthenticated, isAdmin, isModerator } = useAuth();
  const { siteTitle, loading: settingsLoading } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAdminZone = location.pathname.startsWith('/admin-panel');
  const isDashboardZone = location.pathname.startsWith('/dashboard');

  // Кнопка для гостя
  const guestBtn = (
    <Link to="/auth" className="btn btn-primary">
      Войти
    </Link>
  );

  // Кнопка выхода — всегда справа
  const logoutBtn = (
    <button onClick={handleLogout} className="btn btn-danger" key="logout">
      <LogOut size={16} style={{ marginRight: '4px' }} />
      Выйти
    </button>
  );

  // Основные кнопки в зависимости от зоны
  let leftNav = null;

  if (isAdminZone) {
    leftNav = (
      <div className="nav-animate" key="admin-nav">
        <NavLink to="/admin-panel" end className="btn btn-secondary btn-admin-nav">
          <Home size={16} style={{ marginRight: '4px' }} />
          Главная
        </NavLink>
        <NavLink to="/admin-panel/users" className="btn btn-secondary btn-admin-nav">
          <Users size={16} style={{ marginRight: '4px' }} />
          Пользователи
        </NavLink>
        <NavLink to="/admin-panel/bookings" className="btn btn-secondary btn-admin-nav">
          <BookmarkCheck size={16} style={{ marginRight: '4px' }} />
          Бронирования
        </NavLink>
        <NavLink to="/admin-panel/buildings" className="btn btn-secondary btn-admin-nav">
          <Building2 size={16} style={{ marginRight: '4px' }} />
          Корпуса
        </NavLink>
        <Link to="/" className="btn btn-primary">
          <Home size={16} style={{ marginRight: '4px' }} />
          На домашнюю
        </Link>
      </div>
    );
  } else if (isDashboardZone) {
    leftNav = (
      <div className="nav-animate" key="dashboard-nav">
        <Link to="/" className="btn btn-primary">
          <Home size={16} style={{ marginRight: '4px' }} />
          На домашнюю
        </Link>
        {(isAdmin || isModerator) && (
          <Link to="/admin-panel" className="btn btn-secondary">
            <ShieldCheck size={16} style={{ marginRight: '4px' }} />
            Админка
          </Link>
        )}
      </div>
    );
  } else {
    // Главная страница — для авторизованного
    leftNav = isAuthenticated ? (
      <div className="nav-animate" key="user-home">
        <span className="nav-user-info">
          {user?.name || user?.username || user?.phone}
        </span>
        {(isAdmin || isModerator) && (
          <Link to="/admin-panel" className="btn btn-secondary">
            <ShieldCheck size={16} style={{ marginRight: '4px' }} />
            Админка
          </Link>
        )}
        <Link to="/dashboard" className="btn btn-primary">
          <User size={16} style={{ marginRight: '4px' }} />
          Кабинет
        </Link>
      </div>
    ) : (
      <div className="nav-animate" key="guest">
        {guestBtn}
      </div>
    );
  }

  // Если пользователь авторизован, показываем кнопку выхода
  const rightBtn = isAuthenticated ? logoutBtn : (isAdminZone || isDashboardZone ? null : null);

  return (
    <header className="site-header">
      <div className="container header-container">
        {/* Логотип */}
        <div className="header-logo">
          {settingsLoading ? (
            <Skeleton width={180} height={24} rounded={true} className="inline-block" />
          ) : (
            <Link to="/" className="site-title">{siteTitle}</Link>
          )}
        </div>

        {/* Навигация — левая часть */}
        <nav className="header-nav" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {leftNav}
          {rightBtn && <div style={{ marginLeft: '12px' }}>{rightBtn}</div>}
        </nav>
      </div>
    </header>
  );
};