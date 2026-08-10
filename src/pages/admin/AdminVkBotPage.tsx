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

        {/* Баннер ожидания */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Sparkles size={32} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '20px', color: '#0f172a', fontWeight: 700 }}>
            Модуль VK Бота находится в разработке
          </h3>
          <p style={{ margin: '0 auto', maxWidth: '560px', color: '#64748b', fontSize: '15px', lineHeight: 1.6 }}>
            Здесь будет размещена настройка токенов сообщества ВКонтакте, шаблонов автоответов, а также проверка заданий с автоматическим начислением рейтинга участникам.
          </p>
        </div>

        {/* Заготовки возможностей */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2563eb', marginBottom: '10px' }}>
              <Settings2 size={20} />
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>Подключение VK API</strong>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Указание ключа доступа сообщества, секретного ключа и подтверждающих токенов Callback API.
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#16a34a', marginBottom: '10px' }}>
              <CheckSquare size={20} />
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>Проверка заданий</strong>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Управление списком квестов и заданий форума с автоматической проверкой отчетов от бота.
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d97706', marginBottom: '10px' }}>
              <Award size={20} />
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>Система рейтинга</strong>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Начисление очков рейтинга за выполнение заданий и отображение таблицы лидеров.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};