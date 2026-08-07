import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import {
  getAdminTeams,
  saveAdminTeam,
  deleteAdminTeam,
  getTeamUsers,
  getTeamMessages,
  sendTeamMessage,
  getTeamEvents,
  saveTeamEvent,
  deleteTeamEvent,
} from '../../services/api';
import {
  Plus,
  Trash2,
  Users,
  MessageSquare,
  CalendarDays,
  Send,
  X,
  Save,
  Pencil,
  AlertTriangle,
} from 'lucide-react';

export const AdminTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'chat' | 'calendar'>('members');

  // Данные выбранной команды
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Редактирование команды
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });

  // Модальное окно создания команды
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });

  // Отправка сообщения
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Добавление события
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '', event_time: '' });
  const [savingEvent, setSavingEvent] = useState(false);

  // Подтверждение удаления
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'team' | 'event'; id: number; name: string } | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setTeamsLoading(true);
    try {
      const data = await getAdminTeams();
      setTeams(data);
      if (data.length > 0) {
        handleSelectTeam(data[0]);
      } else {
        setSelectedTeam(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTeamsLoading(false);
    }
  };

  const handleSelectTeam = async (team: any) => {
    setSelectedTeam(team);
    setTeamForm({ name: team.name, description: team.description || '' });
    setEditingTeam(false);
    setActiveTab('members');
    // Загружаем данные команды
    try {
      const [m, c, e] = await Promise.all([
        getTeamUsers(team.id),
        getTeamMessages(team.id),
        getTeamEvents(team.id)
      ]);
      setMembers(m);
      setMessages(c);
      setEvents(e);
    } catch (err) {
      console.error('Ошибка загрузки данных команды:', err);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeam.name.trim()) return;
    try {
      await saveAdminTeam(newTeam);
      setNewTeam({ name: '', description: '' });
      setShowCreateModal(false);
      loadTeams();
    } catch (err) {
      console.error('Ошибка создания команды:', err);
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    if (!teamForm.name.trim()) return;
    try {
      await saveAdminTeam({ id: selectedTeam.id, name: teamForm.name, description: teamForm.description });
      setEditingTeam(false);
      const updated = { ...selectedTeam, name: teamForm.name, description: teamForm.description };
      setSelectedTeam(updated);
      setTeams(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error('Ошибка обновления команды:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { type, id } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    if (type === 'team') {
      try {
        await deleteAdminTeam(id);
        setSelectedTeam(null);
        loadTeams();
      } catch (err) {
        console.error('Ошибка удаления команды:', err);
      }
    } else if (type === 'event') {
      try {
        await deleteTeamEvent(id);
        if (selectedTeam) {
          const e = await getTeamEvents(selectedTeam.id);
          setEvents(e);
        }
      } catch (err) {
        console.error('Ошибка удаления события:', err);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      await sendTeamMessage(selectedTeam.id, newMessage);
      setNewMessage('');
      const updated = await getTeamMessages(selectedTeam.id);
      setMessages(updated);
    } catch (err) {
      console.error('Ошибка отправки сообщения:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newEvent.title.trim() || !newEvent.event_date) return;
    setSavingEvent(true);
    try {
      await saveTeamEvent({
        team_id: selectedTeam.id,
        title: newEvent.title,
        description: newEvent.description,
        event_date: newEvent.event_date,
        event_time: newEvent.event_time || null,
      });
      setNewEvent({ title: '', description: '', event_date: '', event_time: '' });
      const updated = await getTeamEvents(selectedTeam.id);
      setEvents(updated);
    } catch (err) {
      console.error('Ошибка добавления события:', err);
    } finally {
      setSavingEvent(false);
    }
  };

  if (teamsLoading) {
    return (
      <AdminLayout>
        <Skeleton width="100%" height={400} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }} className="admin-teams-grid">
        {/* Список команд */}
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', color: '#1e293b', margin: 0 }}>Команды</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                border: 'none',
                background: '#0284c7',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px'
              }}
            >
              <Plus size={14} /> Добавить
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teams.length === 0 && (
              <p style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center' }}>
                Команды не созданы
              </p>
            )}
            {teams.map(t => (
              <div
                key={t.id}
                onClick={() => !editingTeam && handleSelectTeam(t)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: selectedTeam?.id === t.id ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  backgroundColor: selectedTeam?.id === t.id ? '#f0f9ff' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{t.name}</strong>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {t.description || 'Без описания'}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmTarget({ type: 'team', id: t.id, name: t.name });
                  }}
                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Детали команды */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {selectedTeam ? (
            <>
              {/* Шапка команды */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>{selectedTeam.name}</h2>
                  {!editingTeam && (
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                      {selectedTeam.description || 'Нет описания'}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!editingTeam ? (
                    <button
                      onClick={() => setEditingTeam(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Pencil size={14} /> Редактировать
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingTeam(false); setTeamForm({ name: selectedTeam.name, description: selectedTeam.description || '' }); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '13px' }}
                      >
                        Отмена
                      </button>
                      <button onClick={handleUpdateTeam} className="btn btn-primary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Save size={14} /> Сохранить
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Форма редактирования команды */}
              {editingTeam && (
                <form onSubmit={handleUpdateTeam} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div className="input-group">
                    <label>Название</label>
                    <input
                      type="text"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Описание</label>
                    <textarea
                      value={teamForm.description}
                      onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                      rows={3}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                </form>
              )}

              {/* Табы */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                {([
                  { key: 'members', label: 'Участники', icon: Users },
                  { key: 'chat', label: 'Чат', icon: MessageSquare },
                  { key: 'calendar', label: 'Календарь', icon: CalendarDays },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      border: 'none',
                      background: activeTab === tab.key ? '#e0f2fe' : 'transparent',
                      color: activeTab === tab.key ? '#0284c7' : '#64748b',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: activeTab === tab.key ? 600 : 400,
                      fontSize: '14px'
                    }}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Таб: Участники */}
              {activeTab === 'members' && (
                <div>
                  {members.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>В команде пока нет участников.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>ФИО</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Телефон</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Роль</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px' }}>{u.last_name} {u.first_name || u.name}</td>
                            <td style={{ padding: '8px' }}>{u.phone || '—'}</td>
                            <td style={{ padding: '8px' }}>{u.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Таб: Чат */}
              {activeTab === 'chat' && (
                <div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    {messages.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Сообщений пока нет.</p>
                    ) : (
                      messages.map(m => (
                        <div key={m.id} style={{ marginBottom: '8px' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{m.first_name} {m.last_name}</strong>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                            {new Date(m.created_at).toLocaleTimeString()}
                          </span>
                          <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#334155' }}>{m.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Введите сообщение..."
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={sendingMessage || !newMessage.trim()} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Send size={16} /> Отправить
                    </button>
                  </form>
                </div>
              )}

              {/* Таб: Календарь */}
              {activeTab === 'calendar' && (
                <div>
                  <form onSubmit={handleAddEvent} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#334155' }}>Добавить событие</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="input-group">
                        <label>Название</label>
                        <input
                          type="text"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label>Описание</label>
                        <input
                          type="text"
                          value={newEvent.description}
                          onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        />
                      </div>
                      <div className="input-group">
                        <label>Дата</label>
                        <input
                          type="date"
                          value={newEvent.event_date}
                          onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label>Время</label>
                        <input
                          type="time"
                          value={newEvent.event_time}
                          onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={savingEvent} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Plus size={16} /> {savingEvent ? 'Сохранение...' : 'Добавить'}
                    </button>
                  </form>

                  {events.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Событий пока нет.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {events.map(ev => (
                        <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                          <div>
                            <strong style={{ fontSize: '14px' }}>{ev.title}</strong>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {new Date(ev.event_date).toLocaleDateString()} {ev.event_time ? ` в ${ev.event_time}` : ''}
                              {ev.description && ` — ${ev.description}`}
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteConfirmTarget({ type: 'event', id: ev.id, name: ev.title })}
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>
              Выберите команду из списка слева
            </p>
          )}
        </div>
      </div>

      {/* Модальное окно создания команды */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Новая команда</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTeam}>
              <div className="input-group">
                <label>Название</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label>Описание</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {deleteConfirmTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px' }}>Подтверждение удаления</h3>
            </div>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
              Вы действительно хотите удалить {deleteConfirmTarget.type === 'team' ? 'команду' : 'событие'} <strong>«{deleteConfirmTarget.name}»</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmTarget(null)}>Отмена</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};