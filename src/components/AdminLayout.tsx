import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from './Skeleton';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();

  if (!isAuthenticated && !authLoading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>Требуется авторизация</h2>
          <p style={{ color: '#666', textAlign: 'center' }}>Для доступа к админ-панели необходимо войти в систему.</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card" style={{ minHeight: '400px' }}>
          <Skeleton width="100%" height={40} className="mb-4" />
          <Skeleton width="100%" height={250} />
        </div>
      </div>
    );
  }

  const getLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: '10px 20px',
    borderBottom: isActive ? '3px solid #007bff' : '3px solid transparent',
    fontWeight: isActive ? ('bold' as const) : ('normal' as const),
    color: isActive ? '#007bff' : '#555',
    textDecoration: 'none',
    display: 'inline-block',
  });

  return (
    <div className="container" style={{ paddingTop: '30px', paddingBottom: '50px' }}>
      <div className="card">
        <h1 style={{ fontSize: '26px', marginBottom: '20px', color: '#333' }}>Панель администратора</h1>

        {/* Навигационное меню по отдельным страницам */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #eee', marginBottom: '24px', flexWrap: 'wrap' }}>
          <NavLink to="/admin-panel" end style={getLinkStyle}>
            Главная
          </NavLink>
          <NavLink to="/admin-panel/users" style={getLinkStyle}>
            Пользователи
          </NavLink>
          <NavLink to="/admin-panel/bookings" style={getLinkStyle}>
            Бронирования
          </NavLink>
          <NavLink to="/admin-panel/buildings" style={getLinkStyle}>
            Корпуса
          </NavLink>
        </div>

        {/* Содержимое текущей страницы */}
        <div>{children || <Outlet />}</div>
      </div>
    </div>
  );
};