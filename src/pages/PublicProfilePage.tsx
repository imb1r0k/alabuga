import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, MapPin, ShieldCheck } from 'lucide-react';
import { getPublicProfile } from '../services/api';

export const PublicProfilePage: React.FC = () => {
  const { login } = useParams<{ login: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!login) return;
    setLoading(true);
    getPublicProfile(login)
      .then((data) => setProfile(data))
      .catch((err: any) => setError(err.response?.data?.error || 'Ошибка загрузки профиля'))
      .finally(() => setLoading(false));
  }, [login]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px' }}><p style={{ color: '#ef4444' }}>{error}</p></div>;
  if (!profile) return null;

  const { user, team, members, current_booking } = profile;

  const socialFields = [
    { key: 'social_vk', label: 'VK' },
    { key: 'social_telegram', label: 'Telegram' },
    { key: 'social_instagram', label: 'Instagram' },
    { key: 'social_max', label: 'Max' },
  ];

  const statusInfo = (status: string) => {
    if (status === 'approved') return { label: 'Одобрено', color: '#16a34a' };
    if (status === 'approved_bot') return { label: 'Одобрено ботом', color: '#0284c7' };
    if (status === 'pending') return { label: 'Ожидает подтверждения', color: '#f59e0b' };
    if (status === 'recalled') return { label: 'Отозвано', color: '#6b7280' };
    if (status === 'rejected') return { label: 'Отклонено', color: '#ef4444' };
    return { label: status, color: '#6b7280' };
  };

  return (
    <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', textDecoration: 'none', marginBottom: '20px' }}>
        <ArrowLeft size={16} /> На главную
      </Link>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', flexShrink: 0
          }}>
            {(user.last_name?.[0] || user.name?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>
              {user.last_name} {user.first_name || user.name}
            </h2>
            <div style={{ color: '#64748b', fontSize: '14px' }}>@{user.login}</div>
          </div>
        </div>

        {user.bio && (
          <div style={{ marginBottom: '16px' }}>
            <strong style={{ fontSize: '14px', color: '#334155' }}>О себе:</strong>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>{user.bio}</p>
          </div>
        )}

        <div>
          <strong style={{ fontSize: '14px', color: '#334155' }}>Соцсети:</strong>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            {socialFields
              .filter(({ key }) => user[key])
              .map(({ key, label }) => (
                <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px' }}>
                  {label}: {user[key]}
                </span>
              ))}
            {!socialFields.some(({ key }) => user[key]) && <span style={{ color: '#94a3b8', fontSize: '14px' }}>Не указаны</span>}
          </div>
        </div>
      </div>

      {current_booking && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#0f172a' }}>Проживание</h3>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '12px' }}>
            {current_booking.status === 'approved' || current_booking.status === 'approved_bot'
              ? 'Проживает в:'
              : 'Заявка в:'}{' '}
            <MapPin size={14} style={{ verticalAlign: 'middle' }} /> Корпус <strong>{current_booking.building_name}</strong>, этаж <strong>{current_booking.floor_number}</strong>, комната <strong>№{current_booking.room_number}</strong>
          </p>
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#fff', backgroundColor: statusInfo(current_booking.status).color }}>
            {statusInfo(current_booking.status).label}
          </span>
        </div>
      )}

      {team && (
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#0284c7" /> Команда: {team.name}
          </h3>
          <h4 style={{ fontSize: '15px', marginBottom: '10px', color: '#334155' }}>Участники ({members.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map((m: any) => {
              const isCurator = m.role === 'curator' || m.user_role === 'curator' || m.user_role === 'moderator';

              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: isCurator ? '#eff6ff' : m.role === 'captain' ? '#f0f9ff' : '#f8fafc', border: isCurator ? '1px solid #bfdbfe' : m.role === 'captain' ? '1px solid #bae6fd' : '1px solid #e2e8f0' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isCurator ? '#2563eb' : m.role === 'captain' ? '#0284c7' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                    {(m.last_name?.[0] || m.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{m.last_name} {m.first_name || m.name}</span>
                      {isCurator && (
                        <span style={{ fontSize: '11px', backgroundColor: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <ShieldCheck size={12} /> Куратор
                        </span>
                      )}
                      {m.role === 'captain' && !isCurator && <span style={{ fontSize: '11px', backgroundColor: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Капитан</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>@{m.login}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};