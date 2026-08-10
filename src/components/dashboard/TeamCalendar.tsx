import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { getMyTeamCalendar } from '../../services/api';

interface Event {
  id: number;
  title: string;
  event_date: string;
  description: string | null;
  image_url?: string | null;
  first_name: string | null;
  last_name: string | null;
}

export const TeamCalendar: React.FC<{ teamId: number }> = ({ teamId }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyTeamCalendar();
        setEvents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CalendarDays size={20} color="#0284c7" /> Календарь команды
      </h3>
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Загрузка...</p>
      ) : events.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Нет запланированных событий</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {events.map((ev) => (
            <div key={ev.id} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              {ev.image_url && (
                <img
                  src={ev.image_url}
                  alt={ev.title}
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{ev.title}</strong>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#64748b', marginLeft: 'auto' }}>
                    <Clock size={14} /> {new Date(ev.event_date).toLocaleString('ru-RU')}
                  </span>
                </div>
                {ev.description && <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 6px 0' }}>{ev.description}</p>}
                {ev.first_name && (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Добавил(а): {ev.first_name} {ev.last_name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};