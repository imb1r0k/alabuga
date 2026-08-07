import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { getAdminUsers, updateAdminUser, getUserDetails, getAdminTeams } from '../../services/api';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [userFormData, setUserFormData] = useState<any>({
    id: 0,
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    role: 'user',
    team_name: '',
    team_id: 0,
    password: '',
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
    loadTeams();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const data = await getAdminTeams();
      setTeams(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectUser = async (u: any) => {
    setSelectedUser(u);
    setMsg('');
    setUserFormData({
      id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      email: u.email || '',
      role: u.role || 'user',
      team_name: u.team_name || '',
      team_id: u.team_id || 0,
      password: '',
    });
    try {
      const details = await getUserDetails(u.id);
      setUserDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await updateAdminUser(userFormData);
      setMsg('Пользователь успешно обновлен');
      loadUsers();
    } catch (err: any) {
      setMsg('Ошибка: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div>
        <h2 style={{ marginBottom: '16px', fontSize: '20px', color: '#0f172a' }}>Управление пользователями</h2>
        {loading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div>
            <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px' }}>#</th>
                    <th style={{ padding: '10px' }}>ФИО</th>
                    <th style={{ padding: '10px' }}>Логин</th>
                    <th style={{ padding: '10px' }}>Телефон</th>
                    <th style={{ padding: '10px' }}>Роль</th>
                    <th style={{ padding: '10px' }}>Команда</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        backgroundColor: selectedUser?.id === u.id ? '#e0f2fe' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px' }}>#{u.id}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{u.last_name} {u.first_name || u.name}</td>
                      <td style={{ padding: '10px' }}>{u.email || u.login}</td>
                      <td style={{ padding: '10px' }}>{u.phone || '-'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fff',
                          backgroundColor: u.role === 'admin' ? '#dc2626' : u.role === 'moderator' ? '#2563eb' : '#64748b'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{u.team_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedUser && (
              <div style={{ marginTop: '24px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Редактирование пользователя #{selectedUser.id}</h3>
                  <button onClick={() => setSelectedUser(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>

                {msg && (
                  <div style={{ padding: '10px', borderRadius: '4px', marginBottom: '12px', backgroundColor: msg.includes('Ошибка') ? '#f8d7da' : '#d4edda', fontSize: '14px' }}>
                    {msg}
                  </div>
                )}

                <form onSubmit={handleSaveUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="input-group">
                    <label>Имя</label>
                    <input
                      type="text"
                      value={userFormData.first_name}
                      onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Фамилия</label>
                    <input
                      type="text"
                      value={userFormData.last_name}
                      onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Логин / Email</label>
                    <input
                      type="text"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Телефон</label>
                    <input
                      type="text"
                      value={userFormData.phone}
                      onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Роль</label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="user">Пользователь (user)</option>
                      <option value="moderator">Модератор (moderator)</option>
                      <option value="admin">Администратор (admin)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Команда</label>
                    <select
                      value={userFormData.team_id || 0}
                      onChange={(e) => {
                        const teamId = Number(e.target.value);
                        const team = teams.find((t) => t.id === teamId);
                        setUserFormData({
                          ...userFormData,
                          team_id: teamId,
                          team_name: team ? team.name : '',
                        });
                      }}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value={0}>— Без команды —</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Новый пароль (оставьте пустым, чтобы не менять)</label>
                    <input
                      type="password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      placeholder="Новый пароль"
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </form>

                {userDetails?.current_booking && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Текущее бронирование</h4>
                    <p style={{ fontSize: '13px', color: '#475569' }}>
                      Корпус: <strong>{userDetails.current_booking.building_name}</strong>, Этаж: <strong>{userDetails.current_booking.floor_number}</strong>, Комната: <strong>№{userDetails.current_booking.room_number}</strong> (Статус: {userDetails.current_booking.status})
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};