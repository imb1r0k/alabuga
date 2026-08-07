import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from './Skeleton';
import { 
  Home, 
  Users, 
  BookmarkCheck, 
  Building2, 
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export const AdminLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated && !authLoading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="admin-card" style={{ maxWidth: '400px', width: '100%' }}>
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
  ];

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', backgroundColor: '#f4f6f9' }}>
      {/* Мобильное меню-бургер */}
      <div style={{
        display: 'none',
        '@media (max-width: 768px)': {
          display: 'block',
          position: 'absolute',
          top: 80,
          right: 16,
          zIndex: 200
        }
      }}>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="btn btn-secondary"
          aria-label="Меню"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Боковое меню (скрывается на мобильных) */}
      <aside
        className={`admin-sidebar ${mobileMenuOpen ? 'admin-sidebar-mobile' : ''}`}
        style={{
          width: '230px',
          backgroundColor: '#1e293b',
          color: '#fff',
          transition: 'width 0.2s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 100,
          borderRight: '1px solid #0f172a'
        }}
      >
        <div>
          <div style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '15px' }}>
              <ShieldCheck size={20} color="#38bdf8" />
              <span>Админка</span>
            </div>
          </div>
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
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? '#0284c7' : 'transparent',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s ease'
                  })}
                >
                  <IconComponent size={20} style={{ flexShrink: 0 }} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div style={{ padding: '12px', borderTop: '1px solid #334155', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
          Алабуга Admin 2025
        </div>
      </aside>

      {/* Контентная область */}
      <main style={{ flex: 1, overflowX: 'auto', padding: '0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '20px' }}>
          {children}
        </div>
      </main>
    </div>
  );
};