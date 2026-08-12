import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { getAdminUsers, updateAdminUser, getUserDetails, getAdminTeams } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { QrCode, X, Shield, CheckSquare, Square, Search, Filter, RotateCcw } from 'lucide-react';

function setCookie(name: string, value: string, days = 30) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export const AdminUsersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Фильтры
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [onlyActive, setOnlyActive] = useState<boolean>(() => {
    const val = getCookie('users_show_active_only');
    return val !== null ? val === 'true' : true;
  });
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

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
      rating: 0,
      curator_team_ids: [],
    });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedForQr, setSelectedForQr] = useState<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    setCookie('users_show_active_only', String(onlyActive));
  }, [onlyActive]);

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

  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Фильтр по активным / архивным
    if (onlyActive) {
      result = result.filter((u) => u.status === 'active');
    }

    // Фильтр по роли
    if (roleFilter !== 'all') {
      result = result.filter((u) => {
        const r = (u.role || '').toLowerCase();
        if (roleFilter === 'curator') return r === 'curator' || r === 'moderator';
        return r === roleFilter;
      });
    }

    // Фильтр по команде
    if (teamFilter !== 'all') {
      if (teamFilter === 'none') {
        result = result.filter((u) => !u.team_id || Number(u.team_id) === 0);
      } else {
        const targetTeamId = Number(teamFilter);
        result = result.filter((u) => Number(u.team_id) === targetTeamId);
      }
    }

    // Поиск по ФИО, логину, телефону
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((u) => {
        const fullName = `${u.last_name || ''} ${u.first_name || ''} ${u.patronymic || ''} ${u.name || ''}`.toLowerCase();
        const login = (u.email || u.login || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        const role = (u.role || '').toLowerCase();
        const team = (u.team_name || '').toLowerCase();

        return (
          fullName.includes(q) ||
          login.includes(q) ||
          phone.includes(q) ||
          role.includes(q) ||
          team.includes(q)
        );
      });
    }

    return result;
  }, [users, onlyActive, roleFilter, teamFilter, searchTerm]);

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
          rating: u.rating ?? 0,
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
      
      if (teamId === 0) {
        if (currentIds.includes(0)) {
          return { ...prev, curator_team_ids: [] };
        }
        return { ...prev, curator_team_ids: [0] };
      }

      if (currentIds.includes(0)) {
        currentIds = [];
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

  const isFiltered = !onlyActive || roleFilter !== 'all' || teamFilter !== 'all';

  return (
    <AdminLayout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Управление пользователями</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Отображается {filteredUsers.length} из {users.length} пользователей
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowFiltersModal(!showFiltersModal)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                backgroundColor: isFiltered ? '#e0f2fe' : '#f1f5f9',
                borderColor: isFiltered ? '#0284c7' : '#cbd5e1',
                color: isFiltered ? '#0284c7' : '#334155',
                fontWeight: 600,
              }}
            >
              <Filter size={16} />
              <span>Фильтры</span>
              {isFiltered && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }} />}
            </button>

            <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {showFiltersModal && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            alignItems: 'end',
            fontSize: '13px'
          }}>
            <div>
              <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>Отображать статус</label>
              <select
                value={onlyActive ? 'active' : 'all'}
                onChange={(e) => setOnlyActive(e.target.value === 'active')}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="active">Только активных (архивные скрыты)</option>
                <option value="all">Всех пользователей (включая архивных)</option>
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>Фильтр по роли</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="all">Все роли</option>
                <option value="user">Пользователи</option>
                <option value="curator">Кураторы</option>
                <option value="admin">Администраторы</option>
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>Фильтр по команде</label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="all">Все команды</option>
                <option value="none">Без команды</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setOnlyActive(true);
                  setRoleFilter('all');
                  setTeamFilter('all');
                  setSearchTerm('');
                }}
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}
              >
                <RotateCcw size={14} /> Сбросить фильтры
              </button>
            </div>
          </div>
        )}

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
                                        <th style={{ padding: '10px' }}>Рейтинг</th>
                                        <th style={{ padding: '10px' }}>Команда</th>
                    <th style={{ padding: '10px' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCuratorRole = u.role === 'curator' || u.role === 'moderator';

                      return (
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
                                                    <td style={{ padding: '10px', fontWeight: 600, color: '#2563eb' }}>
                                                      ⭐ {u.rating ?? 0}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                            {isCuratorRole ? (
                              u.curator_team_ids?.includes(0) ? (
                                <span style={{ fontWeight: 600, color: '#0284c7' }}>any</span>
                              ) : u.curator_team_ids?.length > 0 ? (
                                teams
                                  .filter((t) => u.curator_team_ids.includes(t.id))
                                  .map((t) => t.name)
                                  .join(', ') || '-'
                              ) : (
                                '-'
                              )
                            ) : (
                              u.team_name || '-'
                            )}
                          </td>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ВСПЛЫВАЮЩЕЕ МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЯ */}
            {selectedUser && (
              <div style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '16px'
              }}>
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  maxWidth: '650px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                  position: 'relative',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Редактирование пользователя #{selectedUser.id}</h3>
                    <button
                      onClick={() => setSelectedUser(null)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                    >
                      <X size={20} />
                    </button>
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
                                          <label>⭐ Рейтинг</label>
                                          <input
                                            type="number"
                                            min={0}
                                            value={userFormData.rating}
                                            onChange={(e) => setUserFormData({ ...userFormData, rating: Number(e.target.value) })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
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
                        <option value="curator">Куратор (curator)</option>
                        {isAdmin && <option value="admin">Администратор (admin)</option>}
                      </select>
                    </div>

                    {userFormData.role !== 'curator' && (
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
                    )}

                    {userFormData.role === 'curator' && (
                      <div style={{ gridColumn: '1 / -1', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Shield size={16} /> Закрепленные за куратором команды:
                        </h4>
                        <p style={{ fontSize: '12px', color: '#0284c7', marginBottom: '12px' }}>
                          Куратор сможет управлять участниками и чатом только выбранных команд.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            onClick={() => handleToggleCuratorTeam(0)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              backgroundColor: userFormData.curator_team_ids?.includes(0) ? '#e0f2fe' : '#fff',
                              border: `1px solid ${userFormData.curator_team_ids?.includes(0) ? '#0284c7' : '#cbd5e1'}`,
                              fontWeight: userFormData.curator_team_ids?.includes(0) ? 600 : 400,
                            }}
                          >
                            {userFormData.curator_team_ids?.includes(0) ? <CheckSquare size={18} color="#0284c7" /> : <Square size={18} color="#94a3b8" />}
                            <span style={{ fontSize: '13px' }}>🌐 Все команды (any)</span>
                          </div>

                          {!userFormData.curator_team_ids?.includes(0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginTop: '6px' }}>
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
                                      padding: '8px 10px',
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

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px' }}>
                      <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                        {saving ? 'Сохранение...' : 'Сохранить изменения'}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedUser(null)}>
                        Закрыть
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