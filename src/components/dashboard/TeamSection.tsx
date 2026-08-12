import React from 'react';
import { Users, ShieldCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';

interface Member {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  login: string;
  role: string;
  rating?: number;
  user_role?: string;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
}

export const TeamSection: React.FC<{ team: Team | null; members: Member[] }> = ({ team, members }) => {
  const { showRating } = useSettings();

  // Сортировка: кураторы/модераторы сверху, затем по убыванию рейтинга
  const sortedMembers = [...members].sort((a, b) => {
    const aIsCurator = a.role === 'curator' || a.user_role === 'curator' || a.user_role === 'moderator';
    const bIsCurator = b.role === 'curator' || b.user_role === 'curator' || b.user_role === 'moderator';
    if (aIsCurator && !bIsCurator) return -1;
    if (!aIsCurator && bIsCurator) return 1;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  if (!team) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} color="#0284c7" /> Моя команда
        </h3>
        <p style={{ color: '#94a3b8', marginTop: '12px' }}>Вы не состоите в команде.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Users size={20} color="#0284c7" /> Моя команда: {team.name}
      </h3>
      {team.description && <p style={{ color: '#64748b', marginBottom: '16px' }}>{team.description}</p>}
      <h4 style={{ fontSize: '15px', marginBottom: '10px', color: '#334155' }}>Участники ({members.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedMembers.map((m) => {
          const isCurator = m.role === 'curator' || m.user_role === 'curator' || m.user_role === 'moderator';

          return (
            <Link
              key={m.id}
              to={`/public_profile/${m.login}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: isCurator ? '#eff6ff' : m.role === 'captain' ? '#f0f9ff' : '#f8fafc',
                border: isCurator ? '1px solid #bfdbfe' : m.role === 'captain' ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isCurator ? '#eff6ff' : m.role === 'captain' ? '#f0f9ff' : '#f8fafc')}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isCurator ? '#2563eb' : m.role === 'captain' ? '#0284c7' : '#cbd5e1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
              >
                {(m.last_name?.[0] || m.name?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{m.last_name} {m.first_name || m.name}</span>
                  {showRating && (
                    <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Star size={12} /> {m.rating ?? 0}
                    </span>
                  )}
                  {isCurator && (
                    <span style={{ fontSize: '11px', backgroundColor: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <ShieldCheck size={12} /> Куратор
                    </span>
                  )}
                  {m.role === 'captain' && !isCurator && (
                    <span style={{ fontSize: '11px', backgroundColor: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                      Капитан
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>@{m.login}</div>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Открыть профиль →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};