import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface User {
  id: number;
  login: string;
  name: string;
  role: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (loginOrPhone: string, password: string) => Promise<void>;
  register: (lastName: string, firstName: string, phone: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isModerator: boolean;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await api.get('/user');
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (loginOrPhone: string, password: string) => {
    const isPhone = /^[0-9+\-() ]+$/.test(loginOrPhone);
    const payload: any = { password };
    if (isPhone) {
      payload.phone = loginOrPhone;
    } else {
      payload.login = loginOrPhone;
    }
    const response = await api.post('/login', payload);
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    await fetchUser();
  };

  const register = async (lastName: string, firstName: string, phone: string, password: string) => {
    const response = await api.post('/register', {
      last_name: lastName,
      first_name: firstName,
      phone,
      password
    });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    await fetchUser();
    // Возвращаем данные для окна с данными для входа
    return {
      last_name: user.last_name || lastName,
      first_name: user.first_name || firstName,
      login: user.login || '—',
      phone: user.phone || phone,
      password: password // важно, чтобы показать пароль
    };
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await api.post('/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const roleNormalized = user?.role ? String(user.role).trim().toLowerCase() : '';
  const isAdmin = roleNormalized === 'admin';
  const isModerator = roleNormalized === 'moderator' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser: fetchUser,
        isAuthenticated: !!user,
        isAdmin,
        isModerator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};