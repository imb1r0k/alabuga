import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { getAdminUsers, updateAdminUser, getUserDetails, getAdminTeams } from '../../services/api';
import { Link } from 'react-router-dom';
import { QrCode, X, Shield, CheckSquare, Square } from 'lucide-react';

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
    status: 'active',
    team_name: '',
    team_id: 0,
    password: '',
    curator_team_ids: [],
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedForQr, setSelectedForQr] = useState<any>(null);
  const { showToast } = useToast();

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
    const rawRole = (u.role || 'user').toLowerCase();
    const normalizedRole = rawRole === 'moderator' ? 'curator' : rawRole;

    setUserFormData({
      id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      email: u.email || u.login || '',
      role: normalizedRole,
      status: u.status || 'active',
      team_name: u.team_name || '',
      team_id: u.team_id || 0,
      password: '',
      curator_team_ids: u.curator_team_ids || [],
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
      showToast('Пользователь успешно обновлен', 'success');
      loadUsers();
    } catch (err: any) {
      const errorText = 'Ошибка: ' + (err.response?.data?.error || err.message);
      setMsg(errorText);
      showToast(errorText, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCuratorTeam = (teamId: number) => {
    setUserFormData((prev: any) => {
      let currentIds: number[] = prev.curator_team_ids || [];
      // Если было выбрано "Все команды" (0), при выборе конкретной сбрасываем 0
      if (currentIds.includes(0)) {
        currentIds = [];
      }

      if (teamId === 0) {
        // Режим "Все команды"
        return { ...prev, curator_team_ids: [0] };
      }

      if (currentIds.includes(teamId)) {
        currentIds = currentIds.filter((id) => id !== teamId);
      } else {
        currentIds = [...currentIds, teamId];
      }
      return { ...prev, curator_team_ids: currentIds };
    });
  };

  const handleQrOpen = (u: any) => {
    setSelectedForQr(u);
  };

  const getPublicProfileUrl = (login: string) => {
    return `${window.location.origin}/public_profile/${login}`;
  };

  const getRoleBadge = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin') {
      return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff', backgroundColor: '#dc2626' }}>Администратор</span>;
    }
    if (r === 'curator' || r === 'moderator') {
      return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff', backgroundColor: '#2563eb' }}>Куратор</span>;
    }
    return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff', backgroundColor: '#64748b' }}>Пользователь</span>;
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
                    <th style={{ padding: '10px' }}>Статус</th>
                    <th style={{ padding: '10px' }}>Команда</th>
                    <th style={{ padding: '10px' }}>Действия</th>
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
                      <td style={{ padding: '10px' }}>{getRoleBadge(u.role)}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fff',
                          backgroundColor: u.status === 'archived' ? '#6b7280' : '#16a34a'
                        }}>
                          {u.status === 'archived' ? 'В архиве' : 'Активен'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{u.team_name || '-'}</td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Link
                            to={`/public_profile/${u.email || u.login}`}
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 8px', textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Открыть
                          </Link>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={(e) => { e.stopPropagation(); handleQrOpen(u); }}
                          >
                            <QrCode size={14} /> QR
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Модалка редактирования пользователя */}
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
                    <label>Статус</label>
                    <select
                      value={userFormData.status}
                      onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="active">Активен</option>
                      <option value="archived">В архиве</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Роль</label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                      <option value="user">Пользователь (user)</option>
                      <option value="curator">Куратор (curator)</option>
                      <option value="admin">Администратор (admin)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Команда участника</label>
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

                  {/* Если пользователь Куратор — блок выбора закреплённых за ним команд */}
                  {userFormData.role === 'curator' && (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={16} /> Привязанные к куратору команды для управления:
                      </h4>
                      <p style={{ fontSize: '12px', color: '#0284c7', marginBottom: '12px' }}>
                        Куратор сможет управлять только пользователями и сообщениями выбранных команд.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Опция "Все команды" */}
                        <div
                          onClick={() => handleToggleCuratorTeam(0)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: userFormData.curator_team_ids?.includes(0) ? '#e0f2fe' : '#fff',
                            border: '1px solid #cbd5e1',
                            fontWeight: userFormData.curator_team_ids?.includes(0) ? 600 : 400,
                          }}
                        >
                          {userFormData.curator_team_ids?.includes(0) ? <CheckSquare size={18} color="#0284c7" /> : <Square size={18} color="#94a3b8" />}
                          <span style={{ fontSize: '13px' }}>🌐 Все команды (полный доступ к командам)</span>
                        </div>

                        {!userFormData.curator_team_ids?.includes(0) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginTop: '4px' }}>
                            {teams.map((t) => {
                              const isChecked = userFormData.curator_team_ids?.includes(t.id);
                              return (
                                <div
                                  key={t.id}
                                  onClick={() => handleToggleCuratorTeam(t.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: isChecked ? '#e0f2fe' : '#fff',
                                    border: `1px solid ${isChecked ? '#0284c7' : '#cbd5e1'}`,
                                    fontSize: '13px',
                                  }}
                                >
                                  {isChecked ? <CheckSquare size={16} color="#0284c7" /> : <Square size={16} color="#94a3b8" />}
                                  <span>{t.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

        {/* Модалка QR-кода */}
        {selectedForQr && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', maxWidth: '400px', width: '100%', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', position: 'relative' }}>
              <button
                onClick={() => setSelectedForQr(null)}
                style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a' }}>QR-код пользователя</h3>
              <div style={{ textAlign: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getPublicProfileUrl(selectedForQr.email || selectedForQr.login))}`}
                  alt="QR-код"
                  style={{ width: '200px', height: '200px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <p style={{ marginTop: '12px', fontSize: '14px', color: '#475569', wordBreak: 'break-all' }}>
                  <a href={getPublicProfileUrl(selectedForQr.email || selectedForQr.login)} target="_blank" rel="noreferrer" style={{ color: '#0284c7' }}>
                    {getPublicProfileUrl(selectedForQr.email || selectedForQr.login)}
                  </a>
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedForQr(null)}>Закрыть</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};