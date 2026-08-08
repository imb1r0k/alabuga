import React, { useEffect, useState } from 'react';
import { Building2, Bed, Users, ClipboardList, Hourglass, CheckCircle2, XCircle, Archive } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { getAdminStats } from '../services/api';

interface AdminStats {
  buildings: number;
  rooms: number;
  total_seats: number;
  occupied_seats: number;
  total_bookings: number;
  status_counts: {
    pending: number;
    approved: number;
    approved_bot: number;
    rejected: number;
  };
  active_users: number;
}

export const AdminStatsWidget: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height="140px" rounded="12px" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { title: 'Корпусов', value: stats.buildings, icon: <Building2 size={24} />, color: '#3b82f6', bg: '#eff6ff' },
    { title: 'Комнат', value: stats.rooms, icon: <Bed size={24} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { title: 'Всего мест', value: stats.total_seats, icon: <Users size={24} />, color: '#10b981', bg: '#ecfdf5' },
    { title: 'Занято мест', value: `${stats.occupied_seats} / ${stats.total_seats}`, icon: <ClipboardList size={24} />, color: '#f59e0b', bg: '#fffbeb' },
    { title: 'Всего заявок', value: stats.total_bookings, icon: <Archive size={24} />, color: '#ef4444', bg: '#fef2f2' },
    { title: 'Активных участников', value: stats.active_users, icon: <Users size={24} />, color: '#06b6d4', bg: '#ecfeff' },
  ];

  const statusInfo = [
    { label: 'Ожидает', value: stats.status_counts.pending, color: '#f59e0b', bg: '#fff7ed' },
    { label: 'Одобрено', value: stats.status_counts.approved, color: '#10b981', bg: '#ecfdf5' },
    { label: 'Одобрено ботом', value: stats.status_counts.approved_bot, color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Отклонено', value: stats.status_counts.rejected, color: '#ef4444', bg: '#fef2f2' },
  ];

  return (
    <div>
      {/* Основные плитки */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>{card.title}</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', lineHeight: 1.2 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Сводка по статусам заявок */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={18} color="#0284c7" />
          Сводка по статусам заявок
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          {statusInfo.map((s) => (
            <div key={s.label} style={{ backgroundColor: s.bg, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '26px', fontWeight: 'bold', color: s.color, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};