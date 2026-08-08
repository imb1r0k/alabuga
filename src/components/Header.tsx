import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Skeleton } from './Skeleton';
import {
  Home,
  User,
  LogOut,
  Menu,
  X,
  Users,
  Building2,
  BookmarkCheck,
  ShieldCheck
} from 'lucide-react';

// Проверяем, является ли значение ссылкой на изображение (svg, png и др.)
const isImageUrl = (value: string) => {
  if (!value) return false;
  const trimmed = value.trim();
  return /\.(svg|png|jpe?g|gif|webp|ico)(\?.*)?$/i.test(trimmed) || /^data:image\//i.test(trimmed);
};

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout, isAdmin, isModerator } = useAuth();
  const { siteTitle, loading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    color: isActive ? '#38bdf8' : '#94a3b8',
    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
    padding: '6px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s ease',
  });

  return (
    <header style={{
      backgroundColor: '#0f172a',
      color: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      borderBottom: '1px solid #1e293b',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    }}>
      <div style={{
                    width: '100%',
                    padding: '0 24px',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
              
              {/* Логотип: картинка (svg/png) или текст из БД */}
              <Link to="/" style={{ display: 'flex', alignItems: 'center', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px', marginRight: 'auto', flexShrink: 0 }}>
                              {settingsLoading ? (
                                <Skeleton width="200px" height="28px" rounded="6px" />
                              ) : isImageUrl(siteTitle) ? (
                                <img
                                  src={siteTitle}
                                  alt="Логотип сайта"
                                  style={{ height: '36px', width: 'auto', maxWidth: '220px', objectFit: 'contain', display: 'block' }}
                                />
                              ) : (
                                <span style={{ letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{siteTitle}</span>
                              )}
                            </Link>
      
              {/* Навигация ПК */}
              <nav className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flexShrink: 0 }}>
          <NavLink to="/" end style={navLinkStyle}>
            <Home size={16} />
            <span>Главная</span>
          </NavLink>

          {isAuthenticated && (
            <NavLink to="/dashboard" style={navLinkStyle}>
              <User size={16} />
              <span>Личный кабинет</span>
            </NavLink>
          )}

          {(isAdmin || isModerator) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px', borderLeft: '1px solid #334155' }}>
              <NavLink to="/admin-panel" end style={navLinkStyle}>
                <ShieldCheck size={16} />
                <span>Панель</span>
              </NavLink>

              <NavLink to="/admin-panel/users" style={navLinkStyle}>
                <Users size={16} />
                <span>Пользователи</span>
              </NavLink>

              <NavLink to="/admin-panel/buildings" style={navLinkStyle}>
                <Building2 size={16} />
                <span>Корпуса</span>
              </NavLink>

              <NavLink to="/admin-panel/bookings" style={navLinkStyle}>
                <BookmarkCheck size={16} />
                <span>Бронирования</span>
              </NavLink>

              <NavLink to="/admin-panel/teams" style={navLinkStyle}>
                <Users size={16} />
                <span>Команды</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Блок аккаунта ПК */}
                <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#1e293b', padding: '6px 12px', borderRadius: '20px', border: '1px solid #334155' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                {user?.last_name?.[0] || user?.first_name?.[0] || 'U'}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#e2e8f0' }}>
                {user?.last_name} {user?.first_name || user?.name}
              </span>
              <button
                onClick={handleLogout}
                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                title="Выйти"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="btn btn-primary"
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', textDecoration: 'none' }}
            >
              Войти
            </Link>
          )}
        </div>

        {/* Мобильная шапка */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px', textDecoration: 'none' }}
            >
              {user?.last_name?.[0] || user?.first_name?.[0] || 'U'}
            </Link>
          ) : (
            <Link
              to="/auth"
              className="btn btn-primary"
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}
            >
              Войти
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ padding: '8px', color: '#cbd5e1', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      {mobileMenuOpen && (
        <div style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isAuthenticated && (
            <div style={{ paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
              <span>{user?.last_name} {user?.first_name || user?.name}</span>
              <span style={{ backgroundColor: '#1e293b', padding: '2px 8px', borderRadius: '4px', color: '#38bdf8' }}>{user?.role}</span>
            </div>
          )}

          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              color: isActive ? '#38bdf8' : '#cbd5e1',
              backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            })}
          >
            <Home size={18} />
            <span>Главная страница</span>
          </NavLink>

          {isAuthenticated && (
            <NavLink
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                color: isActive ? '#38bdf8' : '#cbd5e1',
                backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              })}
            >
              <User size={18} />
              <span>Личный кабинет</span>
            </NavLink>
          )}

          {(isAdmin || isModerator) && (
            <div style={{ paddingTop: '8px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Администрирование
              </div>

              <NavLink
                to="/admin-panel"
                end
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                })}
              >
                <ShieldCheck size={18} />
                <span>Общие настройки</span>
              </NavLink>

              <NavLink
                to="/admin-panel/users"
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                })}
              >
                <Users size={18} />
                <span>Пользователи</span>
              </NavLink>

              <NavLink
                to="/admin-panel/buildings"
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                })}
              >
                <Building2 size={18} />
                <span>Управление корпусами</span>
              </NavLink>

              <NavLink
                to="/admin-panel/bookings"
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                })}
              >
                <BookmarkCheck size={18} />
                <span>Бронирования</span>
              </NavLink>

              <NavLink
                to="/admin-panel/teams"
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                })}
              >
                <Users size={18} />
                <span>Управление командами</span>
              </NavLink>
            </div>
          )}

          {isAuthenticated && (
            <div style={{ paddingTop: '8px', borderTop: '1px solid #1e293b' }}>
              <button
                onClick={handleLogout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', color: '#f87171', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                <LogOut size={18} />
                <span>Выйти из системы</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};