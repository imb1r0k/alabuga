import React from 'react';
import { Users } from 'lucide-react';

interface Member {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  login: string;
  role: string;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
}

export const TeamSection: React.FC<{ team: Team | null; members: Member[] }> = ({ team, members }) => {
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
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: m.role === 'captain' ? '#0284c7' : '#cbd5e1',
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
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                {m.last_name} {m.first_name || m.name}
                {m.role === 'captain' && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                    Капитан
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>@{m.login}</div>
            </div>
            {m.role !== 'captain' && (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Участник</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};