import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, AlertTriangle } from 'lucide-react';

export const ArchivedAccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #fecaca',
          maxWidth: '480px',
          width: '100%',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <AlertTriangle size={36} color="#dc2626" />
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: '24px', color: '#991b1b', fontWeight: 700 }}>
          Аккаунт деактивирован
        </h1>

        <p style={{ fontSize: '15px', color: '#475569', lineHeight: '1.5', marginBottom: '8px' }}>
          Ваш аккаунт был перемещён в архив администратором.
        </p>

        {user && (
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px' }}>
            Пользователь: {user.last_name} {user.first_name} ({user.login})
          </p>
        )}

        <button
          onClick={handleLogout}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            fontSize: '15px',
            fontWeight: 600,
            backgroundColor: '#dc2626',
            borderColor: '#dc2626',
            color: '#fff',
          }}
        >
          <LogOut size={18} />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
};
