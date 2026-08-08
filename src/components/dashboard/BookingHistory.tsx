import React, { useState } from 'react';
import { History, MapPin, Trash2 } from 'lucide-react';
import { cancelMyBooking } from '../../services/api';
import { useToast } from '../Toast';

interface Booking {
  id: number;
  status: string;
  created_at: string;
  room_number: string;
  building_name: string;
  floor_number: number;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: '#f59e0b' },
  approved: { label: 'Одобрено', color: '#16a34a' },
  approved_bot: { label: 'Одобрено ботом', color: '#0284c7' },
  rejected: { label: 'Отклонено', color: '#ef4444' },
  recalled: { label: 'Отозвано', color: '#6b7280' },
  archived: { label: 'В архиве', color: '#6b7280' },
};

export const BookingHistory: React.FC<{ bookings: Booking[]; onRefresh?: () => void }> = ({ bookings, onRefresh }) => {
  const { showToast } = useToast();
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancel = async (bookingId: number) => {
    if (!window.confirm('Вы действительно хотите отозвать вашу заявку на заселение?')) return;
    setCancellingId(bookingId);
    try {
      await cancelMyBooking();
      showToast('Заявка успешно отозвана', 'info');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast('Ошибка отзыва заявки: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCancellingId(null);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={20} color="#0284c7" /> История бронирований
        </h3>
        <p style={{ color: '#94a3b8', marginTop: '12px' }}>У вас пока нет бронирований.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History size={20} color="#0284c7" /> История бронирований
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>#</th>
              <th style={{ padding: '8px' }}>Дата</th>
              <th style={{ padding: '8px' }}>Комната</th>
              <th style={{ padding: '8px' }}>Статус</th>
              <th style={{ padding: '8px' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const isActive = ['pending', 'approved', 'approved_bot'].includes(b.status);
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px' }}>#{b.id}</td>
                  <td style={{ padding: '8px' }}>{new Date(b.created_at).toLocaleString('ru-RU')}</td>
                  <td style={{ padding: '8px' }}>
                    <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    {b.building_name} — Этаж {b.floor_number} — №{b.room_number}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: statusMap[b.status]?.color || '#6b7280',
                    }}>
                      {statusMap[b.status]?.label || b.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    {isActive && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={cancellingId === b.id}
                        className="btn btn-danger"
                        style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={12} />
                        Отозвать
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};