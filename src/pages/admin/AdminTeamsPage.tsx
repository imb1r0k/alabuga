import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import {
  getAdminTeams,
  saveAdminTeam,
  deleteAdminTeam,
  getAdminTeamMembers,
  getAdminTeamChat,
  sendAdminTeamMessage,
  getAdminTeamCalendar,
  addAdminTeamEvent,
  deleteAdminTeamEvent,
} from '../../services/api';
import { Users, MessageSquare, Calendar, Trash2, Plus, Save, X } from 'lucide-react';

export const AdminTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Данные выбранной команды
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const data = await getAdminTeams();
      setTeams(data);
      if (data.length > 0) {
        handleSelectTeam(data[0]);
      } else {
        setSelectedTeam(null);
        setTeamMembers([]);
        setChatMessages([]);
        setCalendarEvents([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = async (team: any) => {
    setSelectedTeam(team);
    try {
      const [members, chat, events] = await Promise.all([
        getAdminTeamMembers(team.id),
        getAdminTeamChat(team.id),
        getAdminTeamCalendar(team.id),
      ]);
      setTeamMembers(members);
      setChatMessages(chat);
      setCalendarEvents(events);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await saveAdminTeam({ name: newTeamName, description: newTeamDesc, action: 'create' });
      setNewTeamName('');
      setNewTeamDesc('');
      setShowCreateForm(false);
      loadTeams();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (team: any) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamDesc(team.description || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !teamName.trim()) return;
    try {
      await saveAdminTeam({ id: editingTeam.id, name: teamName, description: teamDesc, action: 'update' });
      setEditingTeam(null);
      loadTeams();
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async (id: number) => {
    if (!id) return;
    try {
      await deleteAdminTeam(id);
      setDeleteConfirmId(null);
      loadTeams();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedTeam) return;
    try {
      await sendAdminTeamMessage(selectedTeam.id, chatInput);
      setChatInput('');
      const newChat = await getAdminTeamChat(selectedTeam.id);
      setChatMessages(newChat);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate || !selectedTeam) return;
    try {
      await addAdminTeamEvent(selectedTeam.id, {
        title: newEventTitle,
        event_date: newEventDate,
        description: '',
      });
      setNewEventTitle('');
      setNewEventDate('');
      const newEvents = await getAdminTeamCalendar(selectedTeam.id);
      setCalendarEvents(newEvents);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!eventId) return;
    try {
      await deleteAdminTeamEvent(eventId);
      const newEvents = await getAdminTeamCalendar(selectedTeam.id);
      setCalendarEvents(newEvents);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Управление командами</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={18} /> Создать команду
        </button>
      </div>

      {saveMsg && (
        <div style={{ padding: '8px', borderRadius: '4px', marginBottom: '12px', backgroundColor: saveMsg.includes('Ошибка') ? '#f8d7da' : '#d4edda' }}>
          {saveMsg}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateTeam} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <input
              type="text"
              placeholder="Название команды"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text"
              placeholder="Описание (необязательно)"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <button type="submit" className="btn btn-primary">Создать</button>
          </div>
        </form>
      )}

      {loading ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Список команд */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155' }}>Команды</h4>
            {teams.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>Пока не создано команд</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {teams.map((team) => (
                  <div
                    key={team.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: selectedTeam?.id === team.id ? '#e0f2fe' : '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                    }}
                  >
                    <button
                      onClick={() => handleSelectTeam(team)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flex: 1, fontSize: '13px', color: '#1e293b' }}
                    >
                      <strong>{team.name}</strong>
                      {team.description && <div style={{ fontSize: '11px', color: '#64748b' }}>{team.description}</div>}
                    </button>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleStartEdit(team)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}
                        title="Редактировать"
                      >
                        <Plus size={14} color="#0284c7" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(team.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}
                        title="Удалить"
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Детали выбранной команды */}
          {selectedTeam ? (
            <div>
              {/* Редактирование команды */}
              {editingTeam && editingTeam.id === selectedTeam.id && (
                <form onSubmit={handleSaveEdit} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                    <input
                      type="text"
                      value={teamDesc}
                      onChange={(e) => setTeamDesc(e.target.value)}
                      placeholder="Описание"
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Save size={16} /> Сохранить
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingTeam(null)}>Отмена</button>
                  </div>
                </form>
              )}

              {/* Пользователи команды */}
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} /> Участники ({teamMembers.length})
                </h4>
                {teamMembers.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>В команде пока нет участников</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>ФИО</th>
                        <th style={{ padding: '8px' }}>Логин</th>
                        <th style={{ padding: '8px' }}>Роль</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px' }}>{m.last_name} {m.first_name || m.name}</td>
                          <td style={{ padding: '8px' }}>{m.login}</td>
                          <td style={{ padding: '8px' }}>{m.role === 'captain' ? 'Капитан' : 'Участник'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Командный чат */}
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} /> Командный чат
                </h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Сообщений пока нет</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '13px' }}>{msg.first_name} {msg.last_name}</strong>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{new Date(msg.created_at).toLocaleString()}</span>
                        <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{msg.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Введите сообщение..."
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button type="submit" className="btn btn-primary">Отправить</button>
                </form>
              </div>

              {/* Календарь команды */}
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} /> Календарь команды
                </h4>
                <form onSubmit={handleAddCalendarEvent} style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Название события"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }}
                  />
                  <input
                    type="datetime-local"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={16} /> Добавить
                  </button>
                </form>
                {calendarEvents.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>Событий пока нет</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {calendarEvents.map((ev) => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px' }}>
                        <div>
                          <strong style={{ fontSize: '14px' }}>{ev.title}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(ev.event_date).toLocaleString()}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Выберите команду слева</p>
          )}
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>Подтверждение удаления</h3>
            <p style={{ fontSize: '14px', color: '#475569' }}>Вы уверены, что хотите удалить эту команду? Все связанные данные (участники, чат, календарь) будут удалены.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>Отмена</button>
              <button className="btn btn-danger" onClick={() => confirmDelete(deleteConfirmId)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};