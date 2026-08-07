import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { getAdminUsers, updateAdminUser, getUserDetails, getAdminTeams } from '../../services/api';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userFormData, setUserFormData] = useState<any>({});
  const [userDetails, setUserDetails] = useState<any>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userMsg, setUserMsg] = useState('');

  useEffect(() => {
    loadUsers();
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const data = await getAdminTeams();
      setTeams(data);
    } catch (err) {
      console.error('Ошибка загрузки команд:', err);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSelectUser = async (u: any) => {
    setSelectedUser(u);
    setUserFormData({
      id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      email: u.email || '',
      role: u.role || 'user',
      team_id: u.team_id || '',
      password: '',
    });
    setUserMsg('');
    try {
      const details = await getUserDetails(u.id);
      setUserDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setUserMsg('');
    try {
      await updateAdminUser(userFormData);
      setUserMsg('Данные пользователя успешно сохранены');
      loadUsers();
    } catch (err: any) {
      setUserMsg('Ошибка: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingUser(false);
    }
  };

  // Сопоставление id команды с названием
  const getTeamName = (id: any) => {
    const team = teams.find(t => t.id === Number(id));
    return team ? team.name : '—';
  };

  return (
    <AdminLayout>
      <div>
        {usersLoading ? (
          <Skeleton width="100%" height={250} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 1fr' : '1fr', gap: '20px' }}>
            <div>
              <h3 style={{ marginBottom: '12px' }}>Список пользователей</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '8px' }}>Фамилия</th>
                      <th style={{ padding: '8px' }}>Имя</th>
                      <th style={{ padding: '8px' }}>Телефон</th>
                      <th style={{ padding: '8px' }}>Логин (Email)</th>
                      <th style={{ padding: '8px' }}>Роль</th>
                      <th style={{ padding: '8px' }}>Команда</th>
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
                          backgroundColor: selectedUser?.id === u.id ? '#e9ecef' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px' }}>{u.last_name || '-'}</td>
                        <td style={{ padding: '8px' }}>{u.first_name || u.name}</td>
                        <td style={{ padding: '8px' }}>{u.phone || '-'}</td>
                        <td style={{ padding: '8px' }}>{u.email}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: u.role === 'admin' ? '#dc3545' : '#6c757d',
                            color: '#fff',
                            fontSize: '12px'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '8px' }}>{getTeamName(u.team_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedUser && (
              <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>Редактирование #{selectedUser.id}</h3>
                  <button onClick={() => setSelectedUser(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>

                {userMsg && (
                  <div style={{ padding: '8px', borderRadius: '4px', marginBottom: '12px', backgroundColor: userMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda', fontSize: '14px' }}>
                    {userMsg}
                  </div>
                )}

                <form onSubmit={handleSaveUser}>
                  <div className="input-group">
                    <label>Фамилия</label>
                    <input
                      type="text"
                      value={userFormData.last_name}
                      onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Имя</label>
                    <input
                      type="text"
                      value={userFormData.first_name}
                      onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
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
                    <label>Email (Логин)</label>
                    <input
                      type="email"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Новый пароль (оставьте пустым если не хотите менять)</label>
                    <input
                      type="password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Роль</label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="user">Пользователь</option>
                      <option value="moderator">Модератор</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Команда</label>
                    <select
                      value={userFormData.team_id}
                      onChange={(e) => setUserFormData({ ...userFormData, team_id: e.target.value ? Number(e.target.value) : '' })}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="">— Без команды —</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={savingUser} style={{ width: '100%', marginTop: '10px' }}>
                    {savingUser ? 'Сохранение...' : 'Сохранить пользователя'}
                  </button>
                </form>

                {userDetails && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                    <h4>Текущее бронирование</h4>
                    {userDetails.current_booking ? (
                      <p style={{ fontSize: '14px', color: '#333' }}>
                        {userDetails.current_booking.building_name}, Этаж {userDetails.current_booking.floor_number}, Комната {userDetails.current_booking.room_number} ({userDetails.current_booking.status})
                      </p>
                    ) : (
                      <p style={{ fontSize: '14px', color: '#888' }}>Нет активных бронирований</p>
                    )}

                    <h4 style={{ marginTop: '12px' }}>История бронирований</h4>
                    {userDetails.bookings_history?.length > 0 ? (
                      <ul style={{ paddingLeft: '20px', fontSize: '13px' }}>
                        {userDetails.bookings_history.map((bh: any) => (
                          <li key={bh.id}>
                            #{bh.id} - {bh.building_name}, комн. {bh.room_number} [{bh.status}] ({new Date(bh.created_at).toLocaleDateString()})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ fontSize: '13px', color: '#888' }}>История пуста</p>
                    )}
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