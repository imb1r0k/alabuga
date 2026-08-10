import React from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Bot, MessageSquare, Award, CheckSquare, Sparkles, Settings2, Shield } from 'lucide-react';

export const AdminVkBotPage: React.FC = () => {
  return (
    <AdminLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
            }}
          >
            <Bot size={30} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 800 }}>
              Бот ВКонтакте
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
              Интеграция с сообществом VK, проверка выполнения заданий и система рейтинга
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};