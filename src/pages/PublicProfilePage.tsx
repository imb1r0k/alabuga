import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Users, Globe, MessageCircle, Send, Camera, MapPin } from 'lucide-react';
import { getPublicProfile } from '../services/api';
import { Skeleton } from '../components/Skeleton';

interface PublicProfileData {
  user: {
    id: number;
    first_name: string;
    last_name: string;
    name: string;
    login: string;
    bio: string | null;
    social_vk: string | null;
    social_telegram: string | null;
    social_instagram: string | null;
    social_max: string | null;
    team_id: number | null;
    team_name: string | null;
  };
  team: { id: number; name: string; description: string | null } | null;
  members: Array<{ id: number; first_name: string; last_name: string; name: string; login: string; role: string }>;
}

const socialIcons: Record<string, { icon: React.ElementType; label: string }> = {
  social_vk: { icon: MessageCircle, label: 'VK' },
  social_telegram: { icon: Send, label: 'Telegram' },
  social_instagram: { icon: Camera, label: 'Instagram' },
  social_max: { icon: Globe, label: 'Max' },
};

export const PublicProfilePage: React.FC = () => {
  const { login } = useParams<{ login: string }>();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!login) return;
    setLoading(true);
    setError('');
    getPublicProfile(login)
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Пользователь не найден'))
      .finally(() => setLoading(false));
  }, [login]);

  if (loading) return <Skeleton width="100%" height={300} />;

  if (error || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Ошибка</h2>
        <p style={{ color: '#475569' }}>{error || 'Данные не найдены'}</p>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          <ArrowLeft size={16} /> На главную
        </Link>
      </div>
    );
  }

  const { user, team, members } = data;

  // Только заполненные соцсети
  const socials = Object.entries(socialIcons)
    .filter(([key]) => user[key as keyof typeof user])
    .map(([key, { icon, label }]) => ({
      icon,
      label,
      value: user[key as keyof typeof user] as string,
    }));

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', textDecoration: 'none', fontSize: '14px', marginBottom: '20px' }}>
        <ArrowLeft size={16} /> На главную
      </Link>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px' }}>
            {(user.last_name?.[0] || user.name?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>
              {user.last_name} {user.first_name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>@{user.login}</p>
          </div>
        </div>

        {user.bio && (
          <p style={{ marginTop: '16px', fontSize: '15px', color: '#334155', whiteSpace: 'pre-wrap' }}>{user.bio}</p>
        )}

        {socials.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {socials.map(({ icon: Icon, label, value }) => (
              <a
                key={label}
                href={value.startsWith('http') ? value : `https://${value}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#f1f5f9',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  textDecoration: 'none',
                  color: '#334155',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              >
                <Icon size={16} /> {label}: {value}
              </a>
            ))}
          </div>
        )}
      </div>

      {team && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#0284c7" /> Команда: {team.name}
          </h3>
          {team.description && <p style={{ color: '#64748b', marginBottom: '16px' }}>{team.description}</p>}
          <h4 style={{ fontSize: '15px', marginBottom: '10px', color: '#334155' }}>Участники ({members.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: m.role === 'captain' ? '#f0f9ff' : '#f8fafc',
                  border: m.role === 'captain' ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: m.role === 'captain' ? '#0284c7' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                  {(m.last_name?.[0] || m.name?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                    {m.last_name} {m.first_name || m.name}
                    {m.role === 'captain' && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Капитан</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>@{m.login}</div>
                </div>
                <Link to={`/public_profile/${m.login}`} title="Открыть профиль" style={{ color: '#0284c7' }}>
                  <User size={18} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};