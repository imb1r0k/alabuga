import { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  History, 
  Users, 
  MessageSquare, 
  CalendarDays, 
  Pencil, 
  Save, 
  X, 
  Send,
  UserCheck,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { Skeleton } from '../components/Skeleton';
import { 
  getMyBookings, 
  getMyTeam, 
  getMyTeamChat, 
  sendMyTeamChatMessage, 
  getMyTeamCalendar, 
  updateMyProfile 
} from '../services/api';

type Tab = 'profile' | 'team' | 'history' | 'chat' | 'calendar';

const DashboardPage = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  // Табы
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Редактирование профиля
  const [isEditing, setIsEditing] = useState(false);
  const [about, setAbout] = useState('');
  const [socialVk, setSocialVk] = useState('');
  const [socialMax, setSocialMax] = useState('');
  const [socialTelegram, setSocialTelegram] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // История бронирований
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Команда
  const [teamData, setTeamData] = useState<any>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Чат
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Календарь
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Загрузка данных при смене таба
  useEffect(() => {
    if (activeTab === 'profile') {
      // Заполняем поля из user
      setAbout(user?.about || '');
      setSocialVk(user?.social_vk || '');
      setSocialMax(user?.social_max || '');
      setSocialTelegram(user?.social_telegram || '');
      setSocialInstagram(user?.social_instagram || '');
    } else if (activeTab === 'history') {
      loadBookings();
    } else if (activeTab === 'team') {
      loadTeam();
    } else if (activeTab === 'chat') {
      loadChat();
    } else if (activeTab === 'calendar') {
      loadCalendar();
    }
  }, [activeTab, user?.id]);

  // Автообновление чата каждые 5 секунд
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const interval = setInterval(loadChat, 5000);
    return () => clearInterval(interval);
  }, [activeTab, user?.team_id]);

  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const data = await getMyBookings();
      setBookings(data);
    } catch (err) {
      console.error(err);
      showToast('Ошибка загрузки истории бронирований', 'error');
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadTeam = async () => {
    setLoadingTeam(true);
    try {
      const data = await getMyTeam();
      setTeamData(data);
    } catch (err) {
      console.error(err);
      showToast('Ошибка загрузки данных команды', 'error');
    } finally {
      setLoadingTeam(false);
    }
  };

  const loadChat = useCallback(async () => {
    try {
      const messages = await getMyTeamChat();
      setChatMessages(messages);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadCalendar = async () => {
    setLoadingCalendar(true);
    try {
      const events = await getMyTeamCalendar();
      setCalendarEvents(events);
    } catch (err) {
      console.error(err);
      showToast('Ошибка загрузки календаря', 'error');
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
    setAbout(user?.about || '');
    setSocialVk(user?.social_vk || '');
    setSocialMax(user?.social_max || '');
    setSocialTelegram(user?.social_telegram || '');
    setSocialInstagram(user?.social_instagram || '');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateMyProfile({
        about,
        social_vk: socialVk,
        social_max: socialMax,
        social_telegram: socialTelegram,
        social_instagram: socialInstagram,
      });
      await refreshUser(); // обновляем user в контексте
      setIsEditing(false);
      showToast('Профиль обновлён', 'success');
    } catch (err: any) {
      showToast('Ошибка: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await sendMyTeamChatMessage(chatInput.trim());
      setChatInput('');
      await loadChat();
      showToast('Сообщение отправлено', 'success');
    } catch (err: any) {
      showToast('Ошибка отправки: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Статус брони
  const getStatusBadge = (status: string) => {
    let color = '#f59e0b';
    let label = 'Ожидает';
    let icon = <Clock size={14} />;
    if (status === 'approved') {
      color = '#16a34a';
      label = 'Одобрено';
      icon = <CheckCircle2 size={14} />;
    } else if (status === 'approved_bot') {
      color = '#0891b2';
      label = 'Одобрено ботом';
      icon = <CheckCircle2 size={14} />;
    } else if (status === 'rejected') {
      color = '#ef4444';
      label = 'Отклонено';
      icon = <XCircle size={14} />;
    } else if (status === 'archived') {
      color = '#6b7280';
      label = 'В архиве';
      icon = <AlertCircle size={14} />;
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', backgroundColor: `${color}15`, color, fontWeight: 600, fontSize: '12px' }}>
        {icon} {label}
      </span>
    );
  };

  // Рендер таба
  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* Панель аккаунта */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', color: '#0284c7' }}>
                    {user?.last_name?.[0] || user?.first_name?.[0] || 'U'}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>
                      {user?.last_name} {user?.first_name}
                    </h2>
                    <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                      Логин: <strong>{user?.login}</strong> · Телефон: <strong>{user?.phone}</strong>
                    </div>
                    <div style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '12px', color: '#475569', marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <UserCheck size={14} /> Роль: {user?.role}
                    </div>
                  </div>
                </div>
                {!isEditing && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleEditProfile}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Pencil size={16} /> Редактировать профиль
                  </button>
                )}
              </div>

              {/* Редактирование */}
              {isEditing && (
                <form onSubmit={handleSaveProfile} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#0f172a' }}>Редактирование профиля</h3>
                  
                  <div className="input-group">
                    <label>О себе</label>
                    <textarea
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      rows={4}
                      placeholder="Расскажите немного о себе (увлечения, опыт, интересы)"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' }}>
                    <div className="input-group">
                      <label>ВКонтакте</label>
                      <input
                        type="text"
                        value={socialVk}
                        onChange={(e) => setSocialVk(e.target.value)}
                        placeholder="https://vk.com/username"
                      />
                    </div>
                    <div className="input-group">
                      <label>Max</label>
                      <input
                        type="text"
                        value={socialMax}
                        onChange={(e) => setSocialMax(e.target.value)}
                        placeholder="@username"
                      />
                    </div>
                    <div className="input-group">
                      <label>Telegram</label>
                      <input
                        type="text"
                        value={socialTelegram}
                        onChange={(e) => setSocialTelegram(e.target.value)}
                        placeholder="@username"
                      />
                    </div>
                    <div className="input-group">
                      <label>Instagram</label>
                      <input
                        type="text"
                        value={socialInstagram}
                        onChange={(e) => setSocialInstagram(e.target.value)}
                        placeholder="@username"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                      <Save size={16} /> {savingProfile ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                      <X size={16} /> Отмена
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Информация профиля */}
            {!isEditing && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>Обо мне</h3>
                {about ? (
                  <p style={{ color: '#334155', fontSize: '15px', lineHeight: '1.7' }}>{about}</p>
                ) : (
                  <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Расскажите о себе, нажав «Редактировать профиль».</p>
                )}

                {(socialVk || socialMax || socialTelegram || socialInstagram) && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '15px', color: '#0f172a', marginBottom: '12px' }}>Социальные сети</h4>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {socialVk && <a href={socialVk.startsWith('http') ? socialVk : `https://${socialVk}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '13px' }}>VK</a>}
                      {socialMax && <span className="btn btn-secondary" style={{ fontSize: '13px' }}>Max</span>}
                      {socialTelegram && <a href={`https://t.me/${socialTelegram.replace('@', '')}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '13px' }}>Telegram</a>}
                      {socialInstagram && <a href={`https://instagram.com/${socialInstagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '13px' }}>Instagram</a>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'history':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>История бронирований</h2>
            {loadingBookings ? (
              <Skeleton width="100%" height={300} />
            ) : bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px' }}>
                <p style={{ color: '#94a3b8', fontSize: '16px' }}>У вас пока нет бронирований.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.map((b) => (
                  <div key={b.id} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{b.building_name} — Комната {b.room_number}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Этаж {b.floor_number} · Дата: {new Date(b.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div>{getStatusBadge(b.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'team':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>Моя команда</h2>
            {loadingTeam ? (
              <Skeleton width="100%" height={300} />
            ) : !teamData?.team ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px' }}>
                <p style={{ color: '#94a3b8', fontSize: '16px' }}>Вы не состоите в команде.</p>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>{teamData.team.name}</h3>
                {teamData.team.description && <p style={{ color: '#64748b', marginBottom: '16px' }}>{teamData.team.description}</p>}
                <h4 style={{ fontSize: '16px', color: '#334155', marginBottom: '12px' }}>Участники ({teamData.members.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {teamData.members.map((m: any) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: m.role === 'admin' || m.role === 'moderator' ? '#fde68a' : '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: m.role === 'admin' || m.role === 'moderator' ? '#92400e' : '#0284c7' }}>
                        {m.last_name?.[0] || 'У'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>{m.last_name} {m.first_name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Логин: {m.login}</div>
                      </div>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: m.member_role === 'captain' ? '#fef3c7' : '#f1f5f9', color: m.member_role === 'captain' ? '#92400e' : '#475569', fontWeight: 600 }}>
                        {m.member_role === 'captain' ? 'Капитан' : m.role === 'admin' || m.role === 'moderator' ? 'Куратор' : 'Участник'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'chat':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>Командный чат</h2>
            {!teamData?.team ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px' }}>
                <p style={{ color: '#94a3b8' }}>Вы не состоите в команде, чат недоступен.</p>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '500px' }}>
                {/* Сообщения */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
                  {chatMessages.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8' }}>Сообщений пока нет</p>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMine = msg.role === user?.role && msg.last_name === user?.last_name; // упрощённая проверка – лучше использовать user_id, но в API его нет
                      return (
                        <div key={msg.id} style={{ marginBottom: '12px', display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          <div style={{ maxWidth: '70%', backgroundColor: isMine ? '#dbeafe' : '#f1f5f9', borderRadius: '12px', padding: '8px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ color: '#0f172a' }}>{msg.last_name} {msg.first_name}</strong>
                              {msg.is_curator && (
                                <span style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>куратор</span>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>{msg.message}</p>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* Форма отправки */}
                <form onSubmit={handleSendMessage} style={{ padding: '12px', display: 'flex', gap: '8px', backgroundColor: '#f8fafc' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Введите сообщение..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={18} />
                  </button>
                </form>
              </div>
            )}
          </div>
        );

      case 'calendar':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>Календарь событий команды</h2>
            {loadingCalendar ? (
              <Skeleton width="100%" height={300} />
            ) : !teamData?.team ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px' }}>
                <p style={{ color: '#94a3b8' }}>Вы не состоите в команде, календарь недоступен.</p>
              </div>
            ) : calendarEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px' }}>
                <p style={{ color: '#94a3b8' }}>Событий пока нет</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {calendarEvents.map((ev) => {
                  const eventDate = new Date(ev.event_date);
                  const day = eventDate.getDate();
                  const month = eventDate.toLocaleString('ru', { month: 'short' });
                  return (
                    <div key={ev.id} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '16px' }}>
                      <div style={{ minWidth: '60px', height: '60px', borderRadius: '12px', backgroundColor: '#e0f2fe', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: 1 }}>{day}</span>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase' }}>{month}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{ev.title}</h4>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          Время: {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {ev.description && <p style={{ fontSize: '14px', color: '#334155', marginTop: '8px' }}>{ev.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container" style={{ padding: '32px 24px', maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>Личный кабинет</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Добро пожаловать, {user?.first_name}!</p>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>
        {([
          { key: 'profile', label: 'Профиль', icon: <User size={18} /> },
          { key: 'team', label: 'Моя команда', icon: <Users size={18} /> },
          { key: 'history', label: 'История бронирований', icon: <History size={18} /> },
          { key: 'chat', label: 'Чат', icon: <MessageSquare size={18} /> },
          { key: 'calendar', label: 'Календарь', icon: <CalendarDays size={18} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#fff' : '#334155',
              backgroundColor: activeTab === tab.key ? '#0284c7' : '#f1f5f9',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Контент вкладки */}
      {renderTabContent()}
    </div>
  );
};

export default DashboardPage;