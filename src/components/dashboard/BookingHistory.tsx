import React from 'react';
import { History, MapPin } from 'lucide-react';

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
  archived: { label: 'В архиве', color: '#6b7280' },
};

export const BookingHistory: React.FC<{ bookings: Booking[] }> = ({ bookings }) => {
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
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};