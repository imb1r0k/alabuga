import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import {
  getAdminTeams,
  saveAdminTeam,
  deleteAdminTeam,
  getAdminTeamMembers,
  addAdminTeamMember,
  removeAdminTeamMember,
  getAdminUsers,
  getAdminTeamChat,
  sendAdminTeamMessage,
  clearAdminTeamChat,
  deleteAdminTeamMessage,
  getAdminTeamCalendar,
  addAdminTeamEvent,
  deleteAdminTeamEvent,
} from '../../services/api';
import { Users, MessageSquare, Calendar, Trash2, Plus, Save, UserPlus, UserMinus, Eraser, ShieldCheck, Search, Image as ImageIcon, X } from 'lucide-react';

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Добавление участников
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Данные выбранной команды
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventImageUrl, setNewEventImageUrl] = useState('');
  const [newEventImageFile, setNewEventImageFile] = useState<File | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await getAdminUsers();
      setAllUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

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
      showToast('Команда успешно создана', 'success');
      loadTeams();
    } catch (err: any) {
      showToast('Ошибка при создании команды: ' + (err.response?.data?.error || err.message), 'error');
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
      showToast('Команда успешно обновлена', 'success');
      loadTeams();
    } catch (err: any) {
      showToast('Ошибка при обновлении команды: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const confirmDelete = async (id: number) => {
    if (!id) return;
    try {
      await deleteAdminTeam(id);
      setDeleteConfirmId(null);
      showToast('Команда удалена', 'success');
      loadTeams();
    } catch (err: any) {
      showToast('Ошибка при удалении команды: ' + (err.response?.data?.error || err.message), 'error');
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
    } catch (err: any) {
      showToast('Ошибка при отправке сообщения: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleClearChat = async () => {
    if (!selectedTeam) return;
    if (!window.confirm(`Вы уверены, что хотите полностью очистить чат команды «${selectedTeam.name}»?`)) return;
    try {
      await clearAdminTeamChat(selectedTeam.id);
      setChatMessages([]);
      showToast('Чат команды очищен', 'success');
    } catch (err: any) {
      showToast('Ошибка очистки чата: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDeleteChatMessage = async (msgId: number) => {
    if (!selectedTeam || !msgId) return;
    try {
      await deleteAdminTeamMessage(msgId);
      setChatMessages((prev) => prev.filter((m) => m.id !== msgId));
      showToast('Сообщение удалено', 'success');
    } catch (err: any) {
      showToast('Ошибка удаления сообщения: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleAddCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !selectedTeam) return;

    // Если время не выбрано - ставим прямо сейчас
    const targetDate = newEventDate ? newEventDate : new Date().toISOString().slice(0, 16);

    try {
      await addAdminTeamEvent(
        selectedTeam.id,
        {
          title: newEventTitle,
          event_date: targetDate,
          description: '',
          image_url: newEventImageUrl,
        },
        newEventImageFile
      );

      setNewEventTitle('');
      setNewEventDate('');
      setNewEventImageUrl('');
      setNewEventImageFile(null);

      const newEvents = await getAdminTeamCalendar(selectedTeam.id);
      setCalendarEvents(newEvents);
      showToast('Событие добавлено в календарь', 'success');
    } catch (err: any) {
      showToast('Ошибка при добавлении события: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleAddMember = async (userId: number) => {
    if (!selectedTeam || !userId) return;
    try {
      await addAdminTeamMember(selectedTeam.id, userId);
      const members = await getAdminTeamMembers(selectedTeam.id);
      setTeamMembers(members);
      showToast('Участник добавлен в команду', 'success');
      loadUsers();
    } catch (err: any) {
      showToast('Ошибка при добавлении участника: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleRemoveMember = async (userId: number, memberName: string) => {
    if (!selectedTeam || !userId) return;
    if (!window.confirm(`Удалить участника ${memberName} из команды?`)) return;
    try {
      await removeAdminTeamMember(selectedTeam.id, userId);
      const members = await getAdminTeamMembers(selectedTeam.id);
      setTeamMembers(members);
      showToast('Участник удалён из команды', 'success');
      loadUsers();
    } catch (err: any) {
      showToast('Ошибка при удалении участника: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!eventId) return;
    try {
      await deleteAdminTeamEvent(eventId);
      const newEvents = await getAdminTeamCalendar(selectedTeam.id);
      setCalendarEvents(newEvents);
      showToast('Событие удалено', 'success');
    } catch (err: any) {
      showToast('Ошибка при удалении события: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Фильтрованный список участников для модалки добавления
  const filteredUsersForAdd = useMemo(() => {
    let result = allUsers.filter((u) => !u.team_id || Number(u.team_id) === Number(selectedTeam?.id));
    if (memberSearch.trim()) {
      const q = memberSearch.trim().toLowerCase();
      result = result.filter((u) => {
        const fullName = `${u.last_name || ''} ${u.first_name || ''} ${u.patronymic || ''} ${u.name || ''}`.toLowerCase();
        const login = (u.email || u.login || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        return fullName.includes(q) || login.includes(q) || phone.includes(q);
      });
    }
    return result;
  }, [allUsers, selectedTeam, memberSearch]);

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Управление командами</h2>
      </div>

      {loading ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
          
          {/* Левое боковое меню со списком команд */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155' }}>Команды</h4>
            {teams.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>Пока не создано команд</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
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

            {/* Кнопка создания команды */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              {!showCreateForm ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateForm(true)}
                  style={{ width: '100%', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Создать команду
                </button>
              ) : (
                <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Название команды"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <input
                    type="text"
                    placeholder="Описание (необязательно)"
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }}>Сохранить</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)} style={{ fontSize: '12px' }}>Отмена</button>
                  </div>
                </form>
              )}
            </div>
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

              {/* Участники команды */}
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} /> Участники ({teamMembers.length})
                  <button
                    onClick={() => { setMemberSearch(''); setShowAddMemberModal(true); }}
                    className="btn btn-primary"
                    style={{ marginLeft: 'auto', fontSize: '12px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <UserPlus size={14} /> Добавить
                  </button>
                </h4>
                {teamMembers.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>В команде пока нет участников</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                          <th style={{ padding: '8px' }}>ФИО</th>
                          <th style={{ padding: '8px' }}>Логин</th>
                          <th style={{ padding: '8px' }}>Роль</th>
                          <th style={{ padding: '8px', width: '60px' }}>Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.map((m) => {
                          const isCurator = m.role === 'curator' || m.user_role === 'curator' || m.user_role === 'moderator';

                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{m.last_name} {m.first_name || m.name}</td>
                              <td style={{ padding: '8px' }}>{m.login}</td>
                              <td style={{ padding: '8px' }}>
                                {isCurator ? (
                                  <span style={{ fontSize: '11px', backgroundColor: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <ShieldCheck size={12} /> Куратор
                                  </span>
                                ) : m.role === 'captain' ? (
                                  'Капитан'
                                ) : (
                                  'Участник'
                                )}
                              </td>
                              <td style={{ padding: '8px' }}>
                                {!isCurator && (
                                  <button
                                    onClick={() => handleRemoveMember(m.id, `${m.last_name} ${m.first_name || m.name}`)}
                                    title="Удалить из команды"
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}
                                  >
                                    <UserMinus size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Командный чат */}
              <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} /> Командный чат
                  </h4>
                  {chatMessages.length > 0 && (
                    <button
                      onClick={handleClearChat}
                      className="btn btn-danger"
                      style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eraser size={14} /> Очистить чат
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Сообщений пока нет</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '13px' }}>{msg.first_name} {msg.last_name}</strong>
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{new Date(msg.created_at).toLocaleString()}</span>
                          <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{msg.message}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteChatMessage(msg.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}
                          title="Удалить сообщение"
                        >
                          <Trash2 size={14} />
                        </button>
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
                
                <form onSubmit={handleAddCalendarEvent} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Название события"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      required
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1, minWidth: '180px' }}
                    />
                    <input
                      type="datetime-local"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      title="Если не выбрано, установится текущие дата и время"
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Ссылка на изображение (необязательно)"
                      value={newEventImageUrl}
                      onChange={(e) => setNewEventImageUrl(e.target.value)}
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1, minWidth: '180px', fontSize: '13px' }}
                    />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', backgroundColor: '#e2e8f0', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: '#334155' }}>
                      <ImageIcon size={16} />
                      {newEventImageFile ? newEventImageFile.name.slice(0, 15) + '...' : 'Загрузить файл'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewEventImageFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Plus size={16} /> Добавить событие
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    * Если дата не выбрана, событие создастся на текущее время.
                  </span>
                </form>

                {calendarEvents.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>Событий пока нет</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {calendarEvents.map((ev) => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', backgroundColor: '#ffffff' }}>
                        {ev.image_url && (
                          <img src={ev.image_url} alt={ev.title} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, border: '1px solid #cbd5e1' }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{ev.title}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{new Date(ev.event_date).toLocaleString('ru-RU')}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                          title="Удалить событие"
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

      {/* Модальное окно добавления участника с поиском */}
      {showAddMemberModal && selectedTeam && (
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
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '520px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button
              onClick={() => setShowAddMemberModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a' }}>
              Добавление участника в команду «{selectedTeam.name}»
            </h3>

            {/* Поиск среди пользователей */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Поиск участников по ФИО, логину или телефону..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              {memberSearch && (
                <button
                  onClick={() => setMemberSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {usersLoading ? (
              <p style={{ color: '#94a3b8' }}>Загрузка пользователей...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {filteredUsersForAdd.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>Пользователи не найдены</p>
                ) : (
                  filteredUsersForAdd.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{u.last_name} {u.first_name || u.name}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Логин: {u.email || u.login}</div>
                      </div>
                      {Number(u.team_id) === Number(selectedTeam.id) ? (
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>В команде ✓</span>
                      ) : (
                        <button
                          onClick={() => handleAddMember(u.id)}
                          className="btn btn-primary"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          <Plus size={14} /> Добавить
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>Закрыть</button>
            </div>
          </div>
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
            <p style={{ fontSize: '14px', color: '#475569' }}>Вы уверены, что хотите удалить эту команду? Все связанные данные будут удалены.</p>
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