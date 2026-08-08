import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let idCounter = 0;

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
};

const COLORS = {
  success: { bg: '#ffffff', border: '#16a34a', accent: '#16a34a', icon: '#16a34a' },
  error: { bg: '#ffffff', border: '#dc2626', accent: '#dc2626', icon: '#dc2626' },
  info: { bg: '#ffffff', border: '#0284c7', accent: '#0284c7', icon: '#0284c7' },
} as const;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Контейнер уведомлений */}
      <div style={{
        position: 'fixed',
        top: '70px',
        right: '16px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '360px',
        width: 'calc(100% - 32px)',
      }}>
        {toasts.map((t) => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                backgroundColor: c.bg,
                border: `1px solid ${c.border}`,
                borderLeft: `4px solid ${c.border}`,
                borderRadius: '8px',
                padding: '12px 14px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                fontSize: '13px',
                color: '#1e293b',
                animation: 'toastIn 0.25s ease',
              }}
            >
              <span style={{ color: c.icon, flexShrink: 0, marginTop: '1px' }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', flexShrink: 0 }}
                aria-label="Закрыть уведомление"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast должен использоваться внутри ToastProvider');
  }
  return context;
};
