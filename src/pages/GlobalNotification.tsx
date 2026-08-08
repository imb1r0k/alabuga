import React, { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { getGlobalNotification, markGlobalNotificationViewed } from '../services/api';

interface GlobalNotifData {
  text: string;
  type: 'permanent' | 'one-view';
  enabled?: boolean;
  viewers?: string[];
}

export const GlobalNotification: React.FC = () => {
  const [notification, setNotification] = useState<GlobalNotifData | null>(null);
  const [hidden, setHidden] = useState(false);

  // Каждые 5 секунд проверяем наличие активного глобального уведомления в БД
  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const data = await getGlobalNotification();
        if (!active) return;
        const notif = data?.notification || null;
        setNotification(notif);
        // Если уведомление активное — снова показываем (permanent показывается всегда)
        if (notif) setHidden(false);
      } catch (err) {
        // Игнорируем сетевые ошибки опроса
      }
    };

    check();
    const timer = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleClose = async () => {
    setHidden(true);
    try {
      await markGlobalNotificationViewed();
    } catch (err) {
      // Игнорируем ошибки при отметке просмотра
    }
  };

  if (!notification || hidden) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '70px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9990,
        maxWidth: '720px',
        width: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderLeft: '4px solid #0284c7',
        borderRadius: '10px',
        padding: '12px 14px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
        color: '#1e293b',
        fontSize: '14px',
        animation: 'toastIn 0.3s ease',
      }}
    >
      <span style={{ color: '#0284c7', flexShrink: 0, display: 'flex' }}>
        <Megaphone size={20} />
      </span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{notification.text}</span>
      <button
        onClick={handleClose}
        aria-label="Закрыть уведомление"
        title="Закрыть уведомление"
        style={{
          border: 'none',
          background: '#f1f5f9',
          color: '#475569',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
      >
        <X size={16} />
      </button>
    </div>
  );
};
