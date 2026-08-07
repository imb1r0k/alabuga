import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Skeleton } from './Skeleton';
import { useState, useEffect } from 'react';

export const Header = () => {
  const { user, logout, isAuthenticated, isAdmin, isModerator } = useAuth();
  const { siteTitle, loading: settingsLoading } = useSettings();
  const location = useLocation();

  // Определяем текущий раздел
  const isAdminPage = location.pathname.startsWith('/admin-panel');
  const isDashboardPage = location.pathname.startsWith('/dashboard');
  const mode = isAdminPage ? 'admin' : isDashboardPage ? 'dashboard' : 'home';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Общие стили для кнопок навигации
  const navBtnStyles = {
    fontSize: '14px',
    padding: '8px 14px',
    borderRadius: '6px',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    fontWeight: 500,
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
        width: '100%',
      }}>
        <div style={{ minWidth: '150px' }}>
          {settingsLoading ? (
            <Skeleton width={180} height={24} rounded={true} className="inline-block" />
          ) : (
            <Link to="/" style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#dc3545',
              textDecoration: 'none'
            }}>
              {siteTitle}
            </Link>
          )}
        </div>
        
        {/* Кнопки навигации в зависимости от режима */}
        <div
          key={mode}
          className="nav-animation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: mode === 'home' ? 'fadeInRight 0.3s ease' : 'fadeInLeft 0.3s ease',
          }}
        >
          {mode === 'admin' && (
            <>
              <Link
                to="/"
                className="btn btn-secondary"
                style={{ fontSize: '14px', padding: '8px 14px' }}
              >
                На домашнюю
              </Link>
            </>
          )}

          {mode === 'dashboard' && (
            <>
              <Link
                to="/"
                className="btn btn-secondary"
                style={{ fontSize: '14px', padding: '8px 14px' }}
              >
                На домашнюю
              </Link>
            </>
          )}

          {mode === 'home' && isAuthenticated && (
            <>
              <span style={{ fontSize: '14px', color: '#666', marginRight: '8px' }}>
                {user?.last_name} {user?.first_name || user?.name}
              </span>

              {(isAdmin || isModerator) && (
                <Link
                  to="/admin-panel"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#28a745', fontSize: '14px', padding: '8px 14px' }}
                >
                  Админка
                </Link>
              )}

              <Link
                to="/dashboard"
                className="btn btn-primary"
                style={{ fontSize: '14px', padding: '8px 14px' }}
              >
                Кабинет
              </Link>
            </>
          )}

          {mode === 'home' && !isAuthenticated && (
            <Link
              to="/auth"
              className="btn btn-primary"
              style={{ fontSize: '14px', padding: '8px 14px' }}
            >
              Войти
            </Link>
          )}

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="btn btn-danger"
              style={{ fontSize: '14px', padding: '8px 14px' }}
            >
              Выйти
            </button>
          )}
        </div>
      </div>
    </header>
  );
};