import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Home, User, LogOut, ChevronDown, Settings, BedDouble, Calendar, Users, Building2, Menu, X } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, isAuthenticated, isAdmin, isModerator, logout } = useAuth();
  const { siteTitle } = useSettings();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const adminNavItems = [
    { to: '/admin-panel', label: 'Главная', end: true },
    { to: '/admin-panel/users', label: 'Пользователи', end: false },
    { to: '/admin-panel/bookings', label: 'Бронирования', end: false },
    { to: '/admin-panel/buildings', label: 'Корпуса', end: false },
    { to: '/admin-panel/teams', label: 'Команды', end: false },
  ];

  const closeDropdowns = () => {
    setIsAdminDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAdminDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderAdminMenu = () => {
    if (!isAdmin && !isModerator) return null;
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
          className="flex items-center gap-1 text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md transition-colors"
        >
          <Settings size={18} />
          <span className="hidden sm:inline">Админ</span>
          <ChevronDown size={16} />
        </button>
        {isAdminDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-2 border border-gray-100 z-50">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeDropdowns}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm hover:bg-gray-50 ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAuthSection = () => {
    if (!isAuthenticated) {
      return (
        <div className="flex items-center gap-2">
          <Link to="/auth" className="px-4 py-2 text-sm text-gray-700 hover:text-blue-600 transition-colors">
            Войти
          </Link>
          <Link to="/auth?mode=register" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Регистрация
          </Link>
        </div>
      );
    }

    const fullName = user?.last_name && user?.first_name
      ? `${user.last_name} ${user.first_name}`
      : user?.name || user?.login;

    return (
      <div className="flex items-center gap-2">
        {renderAdminMenu()}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
        >
          <User size={18} />
          <span className="max-w-[150px] truncate">{fullName}</span>
        </Link>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          title="Выйти"
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  };

  const navigationLinks = (
    <>
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`
        }
      >
        <Home size={18} className="inline-block mr-1" />
        Главная
      </NavLink>
      {isAuthenticated && (
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`
          }
        >
          <User size={18} className="inline-block mr-1" />
          Личный кабинет
        </NavLink>
      )}
    </>
  );

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">🏠</span>
          <span className="text-xl font-bold text-gray-800">{siteTitle}</span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navigationLinks}
          {renderAuthSection()}
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          aria-label="Меню"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-2 space-y-2">
          {navigationLinks}
          {isAuthenticated ? (
            <div className="pt-2 border-t border-gray-100 space-y-1">
              {isAdmin || isModerator ? (
                <>
                  <div className="font-semibold text-gray-700 px-3 py-1">Админ-панель:</div>
                  {adminNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={closeDropdowns}
                      className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </>
              ) : null}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-700">{user?.name || user?.login}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                >
                  <LogOut size={16} />
                  Выйти
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Link to="/auth" onClick={closeDropdowns} className="flex-1 px-4 py-2 text-center text-sm bg-blue-600 text-white rounded-md">
                Войти
              </Link>
              <Link to="/auth?mode=register" onClick={closeDropdowns} className="flex-1 px-4 py-2 text-center text-sm border border-gray-300 rounded-md text-gray-700">
                Регистрация
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};