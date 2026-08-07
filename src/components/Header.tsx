import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Users, 
  Building2, 
  BookmarkCheck, 
  ShieldCheck,
  Zap
} from 'lucide-react';

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout, isAdmin, isModerator } = useAuth();
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
    <header className="bg-slate-900 text-white sticky top-0 z-50 border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Логотип */}
        <Link to="/" className="flex items-center gap-2 text-white no-underline font-bold text-lg shrink-0">
          <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
            <Zap size={20} className="fill-current" />
          </div>
          <span className="tracking-wide">Алабуга</span>
        </Link>

        {/* Навигация для ПК (в одну строку) */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
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
            <div className="flex items-center gap-1 pl-2 ml-2 border-l border-slate-800">
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

        {/* Блок пользователя на ПК */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/50">
              <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center text-xs font-bold text-white">
                {user?.last_name?.[0] || user?.first_name?.[0] || 'U'}
              </div>
              <span className="text-xs font-medium text-slate-200">
                {user?.last_name} {user?.first_name || user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded-md"
                title="Выйти"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors no-underline shadow-sm"
            >
              Войти
            </Link>
          )}
        </div>

        {/* Правая часть на мобильных устройствах */}
        <div className="flex md:hidden items-center gap-2">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-xs no-underline"
              title="Личный кабинет"
            >
              {user?.last_name?.[0] || user?.first_name?.[0] || 'U'}
            </Link>
          ) : (
            <Link
              to="/auth"
              className="bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-md no-underline"
            >
              Войти
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
            aria-label="Меню"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Мобильное выпадающее меню */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-2 animate-in slide-in-from-top duration-200">
          {isAuthenticated && (
            <div className="pb-2 mb-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{user?.last_name} {user?.first_name || user?.name}</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-sky-400">{user?.role}</span>
            </div>
          )}

          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <Home size={18} />
            <span>Главная страница</span>
          </NavLink>

          {isAuthenticated && (
            <NavLink
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                  isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <User size={18} />
              <span>Личный кабинет</span>
            </NavLink>
          )}

          {(isAdmin || isModerator) && (
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Администрирование
              </div>

              <NavLink
                to="/admin-panel"
                end
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <ShieldCheck size={18} />
                <span>Общие настройки</span>
              </NavLink>

              <NavLink
                to="/admin-panel/users"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <Users size={18} />
                <span>Пользователи</span>
              </NavLink>

              <NavLink
                to="/admin-panel/buildings"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <Building2 size={18} />
                <span>Управление корпусами</span>
              </NavLink>

              <NavLink
                to="/admin-panel/bookings"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <BookmarkCheck size={18} />
                <span>Бронирования</span>
              </NavLink>

              <NavLink
                to="/admin-panel/teams"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <Users size={18} />
                <span>Управление командами</span>
              </NavLink>
            </div>
          )}

          {isAuthenticated && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors border-none bg-transparent cursor-pointer"
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