import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import {
  getMyBooking,
  getMyBookingHistory,
  getMyProfile,
  updateMyProfile,
  getMyTeam,
  getMyTeamChat,
  sendMyTeamMessage,
  getMyTeamCalendar,
} from '../services/api';
import {
  User,
  Clock,
  MessageSquare,
  Calendar,
  Users,
  Send,
  Edit3,
  Save,
  XCircle,
  CheckCircle2,
  MapPin,
  Shield,
  Phone,
  AtSign,
  Globe,
  LogIn,
  Upload,
} from 'lucide-react';

// ─── Вспомогательный компонент статуса брони ────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Ожидает', bg: '#fff3cd', color: '#856404' },
    approved: { label: 'Одобрено', bg: '#d4edda', color: '#155724' },
    approved_bot: { label: 'Одобрено ботом', bg: '#d1ecf1', color: '#0c5460' },
    rejected: { label: 'Отклонено', bg: '#f8d7da', color: '#721c24' },
    archived: { label: 'В архиве', bg: '#e2e3e5', color: '#383d41' },
  };
  const s = map[status] || { label: status, bg: '#e2e3e5', color: '#383d41' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: s.bg,
      color: s.color,
    }}>
      {s.label}
    </span>
  );
};

// ─── Компонент сообщения чата ────────────────────────────────────────────────

const ChatMessage: React.FC<{ msg: any; isOwn: boolean }> = ({ msg, isOwn }) => {
  const isAdmin = msg.user_role === 'admin' || msg.user_role === 'moderator';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isOwn ? 'row-reverse' : 'row',
      gap: '10px',
      marginBottom: '12px',
      alignItems: 'flex-end',
    }}>
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        backgroundColor: isAdmin ? '#7c3aed' : '#0284c7',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 'bold',
        flexShrink: 0,
      }}>
        {(msg.last_name?.[0] || msg.first_name?.[0] || '?').toUpperCase()}
      </div>
      <div style={{
        maxWidth: '75%',
        backgroundColor: isOwn ? '#0284c7' : (isAdmin ? '#f3e8ff' : '#f1f5f9'),
        color: isOwn ? '#fff' : '#1e293b',
        borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '10px 14px',
        fontSize: '13px',
        lineHeight: 1.5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: isOwn ? 'rgba(255,255,255,0.9)' : (isAdmin ? '#6b21a8' : '#475569'),
        }}>
          {msg.last_name} {msg.first_name}
          {isAdmin && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              fontWeight: 700,
              backgroundColor: '#7c3aed',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: '4px',
            }}>
              <Shield size={10} /> Куратор
            </span>
          )}
        </div>
        <div style={{ wordBreak: 'break-word' }}>{msg.message}</div>
        <div style={{
          fontSize: '10px',
          marginTop: '4px',
          opacity: 0.7,
          color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748b',
        }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

// ─── Основная страница ───────────────────────────────────────────────────────

export const DashboardPage = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  // ─── Состояния ─────────────────────────────────────────────────────────────
  const [myBooking, setMyBooking] = useState<any>(null);
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [myTeam, setMyTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    about: '',
    vk: '',
    tg: '',
    instagram: '',
    whatsapp: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'chat' | 'calendar'>('profile');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Загрузка данных ──────────────────────────────────────────────────────

  const loadBooking = useCallback(async () => {
    try {
      const data = await getMyBooking();
      if (data?.booking && data.booking.status !== 'archived') {
        setMyBooking(data.booking);
      } else {
        setMyBooking(null);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getMyBookingHistory();
      setBookingHistory(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      setProfile(data);
      setProfileForm({
        about: data.about || '',
        vk: data.vk || '',
        tg: data.tg || '',
        instagram: data.instagram || '',
        whatsapp: data.whatsapp || '',
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    try {
      const data = await getMyTeam();
      setMyTeam(data.team);
      setTeamMembers(data.members);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadChat = useCallback(async () => {
    if (!myTeam) return;
    try {
      const data = await getMyTeamChat();
      setChatMessages(data);
    } catch (err) {
      console.error(err);
    }
  }, [myTeam]);

  const loadCalendar = useCallback(async () => {
    if (!myTeam) return;
    setCalendarLoading(true);
    try {
      const data = await getMyTeamCalendar();
      setCalendarEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  }, [myTeam]);

  // Первоначальная загрузка
  useEffect(() => {
    if (!isAuthenticated) return;
    setBookingLoading(true);
    Promise.all([loadBooking(), loadHistory(), loadProfile(), loadTeam()])
      .catch(console.error)
      .finally(() => setBookingLoading(false));
  }, [isAuthenticated, loadBooking, loadHistory, loadProfile, loadTeam]);

  // После загрузки команды — подгружаем чат и календарь
  useEffect(() => {
    if (myTeam) {
      loadChat();
      loadCalendar();
    }
  }, [myTeam, loadChat, loadCalendar]);

  // Опрос чата каждые 5 секунд
  useEffect(() => {
    if (!myTeam || activeTab !== 'chat') return;
    const timer = setInterval(loadChat, 5000);
    return () => clearInterval(timer);
  }, [myTeam, activeTab, loadChat]);

  // Скролл вниз чата при новых сообщениях
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── Обработчики ──────────────────────────────────────────────────────────

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await updateMyProfile(profileForm);
      setEditingProfile(false);
      showToast('Профиль сохранён!', 'success');
      loadProfile();
    } catch (err: any) {
      showToast('Ошибка: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput('');
    try {
      await sendMyTeamMessage(text);
      loadChat();
    } catch (err: any) {
      showToast('Ошибка отправки: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // ─── Если не авторизован ──────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <LogIn size={40} color="#0284c7" style={{ marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '12px', color: '#333' }}>
            Требуется авторизация
          </h2>
          <p style={{ color: '#666' }}>
            Для доступа к личному кабинету необходимо войти в систему.
          </p>
        </div>
      </div>
    );
  }

  // ─── Загрузка ─────────────────────────────────────────────────────────────

  if (authLoading || bookingLoading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card">
          <Skeleton width="200px" height="28px" className="mb-4" />
          <Skeleton count={4} gap="16px" height="20px" />
        </div>
      </div>
    );
  }

  // ─── Рендер ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Верхняя панель с ФИО */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#0284c7',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 'bold',
          }}>
            {user?.last_name?.[0] || user?.first_name?.[0] || 'U'}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              {user?.last_name} {user?.first_name || user?.name}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AtSign size={14} /> {user?.login}
              {user?.role !== 'user' && (
                <span style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}>
                  {user?.role === 'admin' ? 'Администратор' : 'Модератор'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Статус бронирования (текущее) */}
        {myBooking && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {myBooking.status === 'approved' || myBooking.status === 'approved_bot' ? (
                <CheckCircle2 size={28} color="#16a34a" />
              ) : myBooking.status === 'rejected' ? (
                <XCircle size={28} color="#ef4444" />
              ) : (
                <Clock size={28} color="#f59e0b" />
              )}
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>Текущее бронирование</div>
                <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                  <MapPin size={14} style={{ verticalAlign: 'text-top', marginRight: '4px' }} />
                  {myBooking.building_name} — Этаж {myBooking.floor_number} — Комната №{myBooking.room_number}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <StatusBadge status={myBooking.status} />
              {myBooking.status === 'rejected' && myBooking.comment && (
                <span style={{ fontSize: '13px', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '4px 8px', borderRadius: '6px' }}>
                  {myBooking.comment}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Вкладки */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          backgroundColor: '#f1f5f9',
          borderRadius: '10px',
          padding: '4px',
        }}>
          {[
            { key: 'profile', label: 'Профиль', icon: User },
            { key: 'team', label: 'Команда', icon: Users },
            { key: 'chat', label: 'Чат', icon: MessageSquare },
            { key: 'calendar', label: 'Календарь', icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0284c7' : '#64748b',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '14px',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Профиль */}
        {activeTab === 'profile' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>О себе</h3>
              {!editingProfile ? (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <Edit3 size={16} /> Редактировать профиль
                </button>
              ) : null}
            </div>

            {editingProfile ? (
              <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>Расскажите о себе</label>
                  <textarea
                    value={profileForm.about}
                    onChange={(e) => setProfileForm({ ...profileForm, about: e.target.value })}
                    rows={4}
                    placeholder="Напишите немного о себе, своих интересах..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>VK</label>
                    <input
                      type="text"
                      value={profileForm.vk}
                      onChange={(e) => setProfileForm({ ...profileForm, vk: e.target.value })}
                      placeholder="https://vk.com/..."
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>Telegram</label>
                    <input
                      type="text"
                      value={profileForm.tg}
                      onChange={(e) => setProfileForm({ ...profileForm, tg: e.target.value })}
                      placeholder="https://t.me/..."
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>Instagram</label>
                    <input
                      type="text"
                      value={profileForm.instagram}
                      onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })}
                      placeholder="https://instagram.com/..."
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block', marginBottom: '4px' }}>WhatsApp</label>
                    <input
                      type="text"
                      value={profileForm.whatsapp}
                      onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
                      placeholder="https://wa.me/..."
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={profileSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={16} /> {profileSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(false)} disabled={profileSaving}>
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {profile?.about ? (
                  <p style={{ color: '#1e293b', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {profile.about}
                  </p>
                ) : (
                  <p style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: '20px' }}>
                    Расскажите немного о себе, нажав «Редактировать профиль».
                  </p>
                )}

                {profile?.vk || profile?.tg || profile?.instagram || profile?.whatsapp ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {profile.vk && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
                        <Globe size={16} color="#0284c7" />
                        <a href={profile.vk} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '13px' }}>VK</a>
                      </div>
                    )}
                    {profile.tg && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
                        <Send size={16} color="#0284c7" />
                        <a href={profile.tg} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '13px' }}>Telegram</a>
                      </div>
                    )}
                    {profile.instagram && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
                        <Upload size={16} color="#e11d48" />
                        <a href={profile.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '13px' }}>Instagram</a>
                      </div>
                    )}
                    {profile.whatsapp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
                        <Phone size={16} color="#16a34a" />
                        <a href={profile.whatsapp} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '13px' }}>WhatsApp</a>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* История бронирований */}
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '24px', paddingTop: '20px' }}>
              <h4 style={{ marginBottom: '16px', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#0284c7" />
                История бронирований
              </h4>

              {bookingHistory.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>У вас пока нет бронирований.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#475569' }}>Дата</th>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#475569' }}>Корпус</th>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#475569' }}>Этаж</th>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#475569' }}>Комната</th>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#475569' }}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingHistory.map((b) => (
                        <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '10px', fontWeight: 500 }}>{b.building_name}</td>
                          <td style={{ padding: '10px' }}>{b.floor_number}</td>
                          <td style={{ padding: '10px' }}>№{b.room_number}</td>
                          <td style={{ padding: '10px' }}>
                            <StatusBadge status={b.status} />
                            {b.status === 'rejected' && b.comment && (
                              <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>{b.comment}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Команда */}
        {activeTab === 'team' && (
          <div>
            {!myTeam ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <Users size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#64748b' }}>Вы пока не состоите в команде.</p>
              </div>
            ) : (
              <div>
                {/* Информация о команде */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>{myTeam.name}</h3>
                  {myTeam.description && <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0' }}>{myTeam.description}</p>}
                </div>

                {/* Участники */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#0284c7" />
                    Участники команды ({teamMembers.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamMembers.map((m) => {
                      const isCaptain = m.team_role === 'captain';
                      const isAdmin = m.global_role === 'admin' || m.global_role === 'moderator';
                      return (
                        <div key={m.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          backgroundColor: isCaptain ? '#f0f9ff' : '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: isCaptain ? '#0284c7' : (isAdmin ? '#7c3aed' : '#cbd5e1'),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            flexShrink: 0,
                          }}>
                            {(m.last_name?.[0] || m.first_name?.[0] || '?').toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                              {m.last_name} {m.first_name || m.name}
                              {isCaptain && (
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '11px',
                                  backgroundColor: '#0284c7',
                                  color: '#fff',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                }}>
                                  Капитан
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{m.login}</div>
                          </div>
                          {m.phone && (
                            <a href={`tel:${m.phone}`} style={{ color: '#0284c7', fontSize: '13px', textDecoration: 'none' }}>{m.phone}</a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Чат */}
        {activeTab === 'chat' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', height: '500px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} color="#0284c7" />
              {myTeam?.name ? `Чат команды «${myTeam.name}»` : 'Чат команды'}
            </h3>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#fafafa', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <MessageSquare size={32} style={{ marginBottom: '8px' }} />
                  <p>Сообщений пока нет. Напишите первое!</p>
                </div>
              ) : (
                <div>
                  {chatMessages.map((msg) => (
                    <ChatMessage key={msg.id} msg={msg} isOwn={msg.last_name === user?.last_name && msg.first_name === user?.first_name} />
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Введите сообщение..."
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={18} />
                Отправить
              </button>
            </form>
          </div>
        )}

        {/* Календарь */}
        {activeTab === 'calendar' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#0284c7" />
              {myTeam?.name ? `Календарь команды «${myTeam.name}»` : 'Календарь команды'}
            </h3>

            {calendarLoading ? (
              <Skeleton width="100%" height={120} />
            ) : !myTeam ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Вы не состоите в команде.</p>
            ) : calendarEvents.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Событий пока нет.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {calendarEvents.map((ev) => (
                  <div key={ev.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    borderLeft: '4px solid #0284c7',
                  }}>
                    <div style={{
                      minWidth: '60px',
                      textAlign: 'center',
                      backgroundColor: '#e0f2fe',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>
                        {new Date(ev.event_date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(ev.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{ev.title}</div>
                      {ev.description && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{ev.description}</div>}
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        Создал: {ev.first_name} {ev.last_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};