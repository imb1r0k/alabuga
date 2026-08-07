import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from './Skeleton';
import { 
  Home, 
  Users, 
  BookmarkCheck, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  // Сохранение состояния свернутости в localStorage
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  };

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
      <div style={{ padding: '20px' }}>
        <Skeleton width="100%" height={40} className="mb-4" />
        <Skeleton width="100%" height={400} />
      </div>
    );
  }

  const navItems = [
    { to: '/admin-panel', label: 'Главная', icon: Home, end: true },
    { to: '/admin-panel/users', label: 'Пользователи', icon: Users, end: false },
    { to: '/admin-panel/bookings', label: 'Бронирования', icon: BookmarkCheck, end: false },
    { to: '/admin-panel/buildings', label: 'Корпуса и Этажи', icon: Building2, end: false },
    { to: '/admin-panel/teams', label: 'Команды', icon: Users, end: false },
  ];

  // ... остальной код без изменений (возвращаемый JSX и логика)
  return (
    <div className="admin-layout" style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f4f6f9' }}>
      {/* Боковая навигация слева */}
      <aside
        className="admin-sidebar"
        style={{
          width: collapsed ? '68px' : '230px',
          backgroundColor: '#1e293b',
          color: '#fff',
          transition: 'width 0.2s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 100,
          borderRight: '1px solid #0f172a',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div>
          {/* Шапка бокового меню */}
          <div style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid #334155'
          }}>
            {!collapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '15px' }}>
                <ShieldCheck size={20} color="#38bdf8" />
                <span>Админка</span>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '6px'
              }}
            >
              {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {/* Список разделов */}
          <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: collapsed ? '12px 0' : '10px 14px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: '8px',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? '#0284c7' : 'transparent',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s ease'
                  })}
                  title={collapsed ? item.label : undefined}
                >
                  <IconComponent size={20} style={{ flexShrink: 0 }} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Подвал меню */}
        <div style={{ padding: '12px', borderTop: '1px solid #334155', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
          {!collapsed && <span>Алабуга Admin 2025</span>}
        </div>
      </aside>

      {/* Основное содержимое */}
      <main className="admin-content" style={{ flex: 1, overflowX: 'auto', padding: '0', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, padding: '20px' }}>
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};