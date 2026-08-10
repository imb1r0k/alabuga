import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import {
  getVkBotSettings,
  saveVkBotSettings,
  getVkBotTaskGroups,
  saveVkBotTaskGroup,
  deleteVkBotTaskGroup,
  getVkBotTasks,
  saveVkBotTask,
  deleteVkBotTask,
  getVkBotReports,
  updateVkBotReportStatus,
  getVkBotTickets,
} from '../../services/api';
import {
  Bot,
  Calendar,
  CheckCircle2,
  XCircle,
  Ticket,
  Settings2,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Award,
  Layers
} from 'lucide-react';

export const AdminVkBotPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'groups' | 'reports' | 'tickets' | 'settings'>('groups');

  // Настройки
  const [settings, setSettings] = useState<Record<string, string>>({
    vk_token: '',
    vk_group_id: '',
    welcome_text: '',
    success_text: '',
    draw_time: '18:00',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Группы заданий
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [showGroupModal, setShowAddGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ id: 0, title: '', start_date: '', end_date: '' });

  // Задания
  const [tasks, setTasks] = useState<any[]>([]);
  const [showTaskModal, setShowAddTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    id: 0,
    group_id: 0,
    title: '',
    description: '',
    difficulty: 'easy',
    task_type: 'other',
  });

  // Отчеты
  const [reports, setReports] = useState<any[]>([]);
  const [reportFilter, setReportFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectingReportId, setRejectingReportId] = useState<number | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Билеты
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketFilterGroup, setTicketFilterGroup] = useState<number | 'all'>('all');

  useEffect(() => {
    loadSettings();
    loadGroups();
    loadReports('pending');
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadTasks(selectedGroupId);
    }
  }, [selectedGroupId]);

  const loadSettings = async () => {
    try {
      const data = await getVkBotSettings();
      if (data) setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error(err);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await getVkBotTaskGroups();
      setGroups(data);
      if (data.length > 0 && !selectedGroupId) {
        setSelectedGroupId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTasks = async (gId: number) => {
    try {
      const data = await getVkBotTasks(gId);
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadReports = async (st: string) => {
    try {
      const data = await getVkBotReports(st);
      setReports(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTickets = async (gId?: number) => {
    try {
      const data = await getVkBotTickets(gId);
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Сохранение настроек
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveVkBotSettings(settings);
      showToast('Настройки бота ВК сохранены', 'success');
    } catch (err: any) {
      showToast('Ошибка сохранения: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Работа с группами заданий
  const handleOpenGroupModal = (group?: any) => {
    if (group) {
      setGroupForm({ id: group.id, title: group.title, start_date: group.start_date, end_date: group.end_date });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setGroupForm({ id: 0, title: 'Волна заданий', start_date: today, end_date: today });
    }
    setShowAddGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveVkBotTaskGroup(groupForm);
      setShowAddGroupModal(false);
      showToast('Группа заданий сохранена', 'success');
      loadGroups();
    } catch (err: any) {
      showToast('Ошибка сохранения группы: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!window.confirm('Удалить эту группу заданий со всеми связанными задачами?')) return;
    try {
      await deleteVkBotTaskGroup(id);
      showToast('Группа заданий удалена', 'success');
      loadGroups();
    } catch (err: any) {
      showToast('Ошибка удаления: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Работа с заданиями
  const handleOpenTaskModal = (task?: any) => {
    if (task) {
      setTaskForm({
        id: task.id,
        group_id: task.group_id,
        title: task.title,
        description: task.description,
        difficulty: task.difficulty,
        task_type: task.task_type || 'other',
      });
    } else {
      setTaskForm({
        id: 0,
        group_id: selectedGroupId || (groups[0]?.id || 0),
        title: '',
        description: '',
        difficulty: 'easy',
        task_type: 'repost',
      });
    }
    setShowAddTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveVkBotTask(taskForm);
      setShowAddTaskModal(false);
      showToast('Задание успешно сохранено', 'success');
      if (selectedGroupId) loadTasks(selectedGroupId);
    } catch (err: any) {
      showToast('Ошибка сохранения задания: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!window.confirm('Удалить это задание?')) return;
    try {
      await deleteVkBotTask(id);
      showToast('Задание удалено', 'success');
      if (selectedGroupId) loadTasks(selectedGroupId);
    } catch (err: any) {
      showToast('Ошибка удаления: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Принятие/Отклонение отчета
  const handleApproveReport = async (reportId: number) => {
    try {
      await updateVkBotReportStatus(reportId, 'approved');
      showToast('Отчет принят, баллы начислены!', 'success');
      loadReports(reportFilter);
      loadTickets();
    } catch (err: any) {
      showToast('Ошибка одобрения: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleRejectReport = async (reportId: number) => {
    try {
      await updateVkBotReportStatus(reportId, 'rejected', rejectReasonInput);
      setRejectingReportId(null);
      setRejectReasonInput('');
      showToast('Отчет отклонен', 'info');
      loadReports(reportFilter);
    } catch (err: any) {
      showToast('Ошибка отклонения: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    if (difficulty === 'easy') return { label: 'Простое (+10 б.)', bg: '#dcfce7', color: '#166534' };
    if (difficulty === 'medium') return { label: 'Среднее (+20 б.)', bg: '#fef9c3', color: '#854d0e' };
    return { label: 'Сложное (+30 б.)', bg: '#fee2e2', color: '#991b1b' };
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
            }}
          >
            <Bot size={30} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 800 }}>
              Управление Ботом ВКонтакте
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
              Планировщик заданий, проверка выполнения отчетов и выдача лотерейных билетов
            </p>
          </div>
        </div>

        {/* Навигационные вкладки */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { id: 'groups', label: 'Группы заданий и Планировщик', icon: Calendar },
            { id: 'reports', label: 'Проверка отчетов', icon: CheckCircle2 },
            { id: 'tickets', label: 'Билеты и Розыгрыш', icon: Ticket },
            { id: 'settings', label: 'Настройки бота и Тексты', icon: Settings2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  borderBottom: `3px solid ${isActive ? '#0284c7' : 'transparent'}`,
                  color: isActive ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ВКЛАДКА 1: ГРУППЫ ЗАДАНИЙ И ПЛАНИРОВЩИК */}
        {activeTab === 'groups' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Вольны и даты активности заданий</h3>
              <button className="btn btn-primary" onClick={() => handleOpenGroupModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Создать волну заданий
              </button>
            </div>

            {/* Карточки групп заданий */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {groups.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>Нет созданных групп заданий</p>
              ) : (
                groups.map((g) => {
                  const isActive = g.status === 'active';
                  const isFuture = g.status === 'future';
                  const bg = isActive ? '#ecfdf5' : isFuture ? '#eff6ff' : '#f8fafc';
                  const borderColor = isActive ? '#10b981' : isFuture ? '#3b82f6' : '#cbd5e1';

                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      style={{
                        backgroundColor: bg,
                        border: `2px solid ${selectedGroupId === g.id ? '#0284c7' : borderColor}`,
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        boxShadow: selectedGroupId === g.id ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          color: isActive ? '#065f46' : isFuture ? '#1e40af' : '#475569',
                          backgroundColor: isActive ? '#a7f3d0' : isFuture ? '#bfdbfe' : '#e2e8f0',
                        }}>
                          {isActive ? 'АКТИВНО СЕГОДНЯ' : isFuture ? 'БУДУЩЕЕ' : 'ЗАВЕРШЕНО'}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenGroupModal(g); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <Settings2 size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#0f172a' }}>{g.title}</h4>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#475569' }}>
                        📅 {g.start_date} — {g.end_date}
                      </p>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '8px' }}>
                        <span>Заданий: {g.tasks_count}</span>
                        <span>Выдано билетов: {g.tickets_issued}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Задания выбранной группы */}
            {selectedGroupId && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                    Задания группы «{groups.find((g) => g.id === selectedGroupId)?.title}»
                  </h3>
                  <button className="btn btn-primary" onClick={() => handleOpenTaskModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Добавить задание
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>В этой группе еще нет заданий</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tasks.map((t) => {
                      const diff = getDifficultyBadge(t.difficulty);
                      return (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{t.title}</strong>
                              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: diff.bg, color: diff.color }}>
                                {diff.label}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{t.description}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={() => handleOpenTaskModal(t)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                              Редактировать
                            </button>
                            <button className="btn btn-danger" onClick={() => handleDeleteTask(t.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 2: ПРОВЕРКА ОТЧЕТОВ */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Проверка высланных отчетов</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                  <button
                    key={st}
                    className={`btn ${reportFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setReportFilter(st); loadReports(st); }}
                    style={{ fontSize: '13px', padding: '6px 12px' }}
                  >
                    {st === 'pending' ? 'На рассмотрении' : st === 'approved' ? 'Принятые' : st === 'rejected' ? 'Отклоненные' : 'Все'}
                  </button>
                ))}
              </div>
            </div>

            {reports.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                Отчетов в этой категории пока нет
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.map((r) => {
                  const diff = getDifficultyBadge(r.difficulty);
                  return (
                    <div key={r.id} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                            {r.user_first_name} {r.user_last_name}
                          </strong>
                          <a
                            href={`https://vk.com/id${r.vk_id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginLeft: '8px', fontSize: '13px', color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            id{r.vk_id} <ExternalLink size={12} />
                          </a>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(r.created_at).toLocaleString('ru-RU')}
                        </span>
                      </div>

                      <div style={{ marginBottom: '10px', fontSize: '13px', color: '#334155' }}>
                        <span>Задание: <strong>{r.task_title}</strong></span>
                        <span style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: diff.bg, color: diff.color }}>
                          {diff.label}
                        </span>
                      </div>

                      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', marginBottom: '12px', wordBreak: 'break-all', fontSize: '14px', fontFamily: 'monospace' }}>
                        {r.submission_text}
                      </div>

                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {rejectingReportId === r.id ? (
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                              <input
                                type="text"
                                placeholder="Укажите причину отклонения..."
                                value={rejectReasonInput}
                                onChange={(e) => setRejectReasonInput(e.target.value)}
                                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                              />
                              <button className="btn btn-danger" onClick={() => handleRejectReport(r.id)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                                Подтвердить отклонение
                              </button>
                              <button className="btn btn-secondary" onClick={() => setRejectingReportId(null)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                                Отмена
                              </button>
                            </div>
                          ) : (
                            <>
                              <button className="btn btn-primary" onClick={() => handleApproveReport(r.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '13px', backgroundColor: '#16a34a' }}>
                                <Check size={16} /> Принять (+{r.points} баллов)
                              </button>
                              <button className="btn btn-danger" onClick={() => setRejectingReportId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '13px' }}>
                                <X size={16} /> Отклонить
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', fontWeight: 600, color: r.status === 'approved' ? '#16a34a' : '#dc2626' }}>
                          {r.status === 'approved' ? '✓ Принято (+ ' + r.points + ' б.)' : '✗ Отклонено (' + (r.reject_reason || 'без причины') + ')'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 3: БИЛЕТЫ И РОЗЫГРЫШ */}
        {activeTab === 'tickets' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Реестр выданных билетов</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Фильтр по волне:</span>
                <select
                  value={ticketFilterGroup}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setTicketFilterGroup(val);
                    loadTickets(val === 'all' ? undefined : val);
                  }}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="all">Все волны заданий</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card">
              {tickets.length === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                  В данной волне пока никто не получил лотерейный билет
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Номер билета</th>
                        <th style={{ padding: '10px' }}>Участник</th>
                        <th style={{ padding: '10px' }}>Волна заданий</th>
                        <th style={{ padding: '10px' }}>Баллы рейтинга</th>
                        <th style={{ padding: '10px' }}>Дата выдачи</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                            {t.ticket_number}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <a href={`https://vk.com/id${t.vk_id}`} target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}>
                              {t.first_name} {t.last_name}
                            </a>
                          </td>
                          <td style={{ padding: '10px' }}>{t.group_title}</td>
                          <td style={{ padding: '10px', fontWeight: 600, color: '#16a34a' }}>{t.total_points} б.</td>
                          <td style={{ padding: '10px', color: '#64748b', fontSize: '13px' }}>
                            {new Date(t.created_at).toLocaleString('ru-RU')}
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

        {/* ВКЛАДКА 4: НАСТРОЙКИ БОТА И ТЕКСТЫ */}
        {activeTab === 'settings' && (
          <div className="card">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#0f172a' }}>Настройки подключения и сообщений</h3>
            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="input-group">
                  <label>Ключ доступа сообщества VK (VK Token)</label>
                  <input
                    type="password"
                    value={settings.vk_token || ''}
                    onChange={(e) => setSettings({ ...settings, vk_token: e.target.value })}
                    placeholder="vk1.a.XXXX..."
                  />
                </div>
                <div className="input-group">
                  <label>ID сообщества VK (Group ID)</label>
                  <input
                    type="text"
                    value={settings.vk_group_id || ''}
                    onChange={(e) => setSettings({ ...settings, vk_group_id: e.target.value })}
                    placeholder="210000000"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Время проведения розыгрыша завтра (для сообщения с билетом)</label>
                <input
                  type="text"
                  value={settings.draw_time || '18:00'}
                  onChange={(e) => setSettings({ ...settings, draw_time: e.target.value })}
                  placeholder="18:00"
                />
              </div>

              <div className="input-group">
                <label>Приветственное сообщение бота</label>
                <textarea
                  value={settings.welcome_text || ''}
                  onChange={(e) => setSettings({ ...settings, welcome_text: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="input-group">
                <label>Сообщение при успешном выполнении ВСЕХ заданий волны</label>
                <textarea
                  value={settings.success_text || ''}
                  onChange={(e) => setSettings({ ...settings, success_text: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                {savingSettings ? 'Сохранение...' : 'Сохранить настройки бота'}
              </button>
            </form>
          </div>
        )}

        {/* МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ ГРУППЫ */}
        {showGroupModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '450px', width: '100%' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>
                {groupForm.id > 0 ? 'Редактировать группу заданий' : 'Новая волна заданий'}
              </h3>
              <form onSubmit={handleSaveGroup}>
                <div className="input-group">
                  <label>Название волны заданий</label>
                  <input
                    type="text"
                    value={groupForm.title}
                    onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                    placeholder="Например: Задания на 15 мая"
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Дата начала активности</label>
                  <input
                    type="date"
                    value={groupForm.start_date}
                    onChange={(e) => setGroupForm({ ...groupForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Дата окончания активности</label>
                  <input
                    type="date"
                    value={groupForm.end_date}
                    onChange={(e) => setGroupForm({ ...groupForm, end_date: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Сохранить</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddGroupModal(false)}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ ЗАДАНИЯ */}
        {showTaskModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>
                {taskForm.id > 0 ? 'Редактировать задание' : 'Новое задание'}
              </h3>
              <form onSubmit={handleSaveTask}>
                <div className="input-group">
                  <label>Название задания</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Например: Сделать репост записи"
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Описание и инструкция для участника</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={4}
                    placeholder="Перейдите по ссылке vk.com/wall... и сделайте репост, затем пришлите ссылку"
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group">
                    <label>Сложность</label>
                    <select
                      value={taskForm.difficulty}
                      onChange={(e) => setTaskForm({ ...taskForm, difficulty: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="easy">Простое (+10 б.)</option>
                      <option value="medium">Среднее (+20 б.)</option>
                      <option value="hard">Сложное (+30 б.)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Тип задания</label>
                    <select
                      value={taskForm.task_type}
                      onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="repost">Репост ссылки</option>
                      <option value="post">Пост</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Сохранить</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddTaskModal(false)}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};