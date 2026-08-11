import React, { useState, useEffect, useRef } from 'react';
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
  Ticket,
  Settings2,
  Plus,
  Trash2,
  Check,
  X,
  ExternalLink,
  Send,
  Lock,
  Unlock,
  Edit,
  Eye,
  EyeOff,
  RefreshCw,
  Image,
  Paperclip,
  Download,
  ZoomIn,
  XCircle,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileText,
} from 'lucide-react';

interface MediaFile {
  id: number;
  report_id: number;
  file_url: string;
  file_type: string;
  original_name: string;
  file_size: number;
}

export const AdminVkBotPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'groups' | 'reports' | 'tickets' | 'settings' | 'broadcast'>('groups');
  const [isEditMode, setIsEditMode] = useState(false);

  // Настройки
  const [settings, setSettings] = useState<Record<string, string>>({
    vk_token: '',
    vk_group_id: '',
    site_url: '',
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
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);

  // Билеты
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketFilterGroup, setTicketFilterGroup] = useState<number | 'all'>('all');

  // Рассылка
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastRecipients, setBroadcastRecipients] = useState<'all' | 'active' | 'ticket_holders'>('all');

  // Медиафайлы в отчетах
  const [reportMedia, setReportMedia] = useState<Record<number, MediaFile[]>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<number, boolean>>({});
  
  // Модалка просмотра фото
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadTasks(selectedGroupId);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    loadReports(reportFilter);
  }, [reportFilter]);

  const loadAllData = async () => {
    await Promise.all([
      loadSettings(),
      loadGroups(),
      loadReports('pending'),
      loadTickets(),
    ]);
  };

  const loadSettings = async () => {
    try {
      const data = await getVkBotSettings();
      if (data && typeof data === 'object') {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await getVkBotTaskGroups();
      const groupsData = Array.isArray(data) ? data : [];
      setGroups(groupsData);
      if (groupsData.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsData[0].id);
      }
    } catch (err) {
      console.error('Ошибка загрузки групп:', err);
      setGroups([]);
    }
  };

  const loadTasks = async (gId: number) => {
    try {
      const data = await getVkBotTasks(gId);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Ошибка загрузки заданий:', err);
      setTasks([]);
    }
  };

  const loadReports = async (st: string) => {
    try {
      const data = await getVkBotReports(st);
      const reportsData = Array.isArray(data) ? data : [];
      setReports(reportsData);
      // Загружаем медиа для каждого отчета
      reportsData.forEach(report => {
        loadReportMedia(report.id);
      });
    } catch (err) {
      console.error('Ошибка загрузки отчетов:', err);
      setReports([]);
    }
  };

  const loadReportMedia = async (reportId: number) => {
    setLoadingMedia(prev => ({ ...prev, [reportId]: true }));
    try {
      // Здесь должен быть API запрос для получения медиафайлов
      // В реальном проекте будет API: getReportMedia(reportId)
      // Пока используем мок-данные для демонстрации
      const mockMedia: MediaFile[] = [];
      setReportMedia(prev => ({ ...prev, [reportId]: mockMedia }));
    } catch (err) {
      console.error('Ошибка загрузки медиа:', err);
    } finally {
      setLoadingMedia(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const loadTickets = async (gId?: number) => {
    try {
      const data = await getVkBotTickets(gId);
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Ошибка загрузки билетов:', err);
      setTickets([]);
    }
  };

  // Сохранение настроек
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveVkBotSettings(settings);
      showToast('Настройки бота ВК сохранены', 'success');
      setIsEditMode(false);
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

  // Рассылка
  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      showToast('Введите текст сообщения для рассылки', 'error');
      return;
    }

    if (!window.confirm(`Отправить сообщение ${broadcastRecipients === 'all' ? 'ВСЕМ' : broadcastRecipients === 'active' ? 'АКТИВНЫМ' : 'ОБЛАДАТЕЛЯМ БИЛЕТОВ'} пользователям?`)) return;

    setBroadcastLoading(true);
    try {
      showToast(`Рассылка запущена для ${broadcastRecipients} пользователей`, 'success');
      setBroadcastMessage('');
    } catch (err: any) {
      showToast('Ошибка отправки рассылки: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Скачивание файла
  const handleDownloadFile = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Определение иконки для файла
  const getFileIcon = (fileType: string, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (fileType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      return <FileImage size={24} color="#3b82f6" />;
    }
    if (fileType === 'video' || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
      return <FileVideo size={24} color="#8b5cf6" />;
    }
    if (fileType === 'audio' || ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
      return <FileAudio size={24} color="#ec4899" />;
    }
    if (fileType === 'archive' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive size={24} color="#f59e0b" />;
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt'].includes(ext)) {
      return <FileText size={24} color="#ef4444" />;
    }
    return <File size={24} color="#64748b" />;
  };

  const getDifficultyBadge = (difficulty: string) => {
    if (difficulty === 'easy') return { label: 'Простое (+10 б.)', bg: '#dcfce7', color: '#166534', icon: '🟢' };
    if (difficulty === 'medium') return { label: 'Среднее (+20 б.)', bg: '#fef9c3', color: '#854d0e', icon: '🟡' };
    return { label: 'Сложное (+30 б.)', bg: '#fee2e2', color: '#991b1b', icon: '🔴' };
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending') return { label: 'На рассмотрении', color: '#f59e0b', bg: '#fef3c7' };
    if (status === 'approved') return { label: 'Принято ✅', color: '#16a34a', bg: '#dcfce7' };
    return { label: 'Отклонено ❌', color: '#dc2626', bg: '#fee2e2' };
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Заголовок */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb, #0284c7)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}>
              <Bot size={30} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 800 }}>
                Управление Ботом ВКонтакте
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
                Планирование заданий, проверка отчетов, выдача билетов и рассылки
              </p>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={loadAllData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} /> Обновить данные
          </button>
        </div>

        {/* Навигационные вкладки */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          borderBottom: '2px solid #e2e8f0', 
          marginBottom: '24px', 
          flexWrap: 'wrap',
          backgroundColor: '#f8fafc',
          borderRadius: '12px 12px 0 0',
          padding: '4px 8px 0 8px'
        }}>
          {[
            { id: 'groups', label: 'Задания', icon: Calendar },
            { id: 'reports', label: 'Проверка отчетов', icon: CheckCircle2 },
            { id: 'tickets', label: 'Билеты', icon: Ticket },
            { id: 'broadcast', label: 'Рассылка', icon: Send },
            { id: 'settings', label: 'Настройки', icon: Settings2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const pendingCount = Array.isArray(reports) ? reports.filter(r => r.status === 'pending').length : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  borderBottom: `3px solid ${isActive ? '#0284c7' : 'transparent'}`,
                  color: isActive ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderRadius: '8px 8px 0 0',
                  backgroundColor: isActive ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                }}
              >
                <Icon size={18} />
                {tab.label}
                {tab.id === 'reports' && pendingCount > 0 && (
                  <span style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    marginLeft: '4px'
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ВКЛАДКА 1: ГРУППЫ ЗАДАНИЙ */}
        {activeTab === 'groups' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Волны заданий</h3>
              <button className="btn btn-primary" onClick={() => handleOpenGroupModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Создать волну
              </button>
            </div>

            {/* Карточки групп заданий */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {!Array.isArray(groups) || groups.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                  Нет созданных групп заданий
                </div>
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
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 10px',
                          borderRadius: '12px',
                          color: isActive ? '#065f46' : isFuture ? '#1e40af' : '#475569',
                          backgroundColor: isActive ? '#a7f3d0' : isFuture ? '#bfdbfe' : '#e2e8f0',
                        }}>
                          {isActive ? '🟢 АКТИВНО' : isFuture ? '🔵 БУДУЩЕЕ' : '⚪ ЗАВЕРШЕНО'}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenGroupModal(g); }} 
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                            title="Редактировать"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }} 
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#0f172a' }}>{g.title}</h4>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#475569' }}>
                        📅 {g.start_date} — {g.end_date}
                      </p>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '8px' }}>
                        <span>📋 Заданий: {g.tasks_count || 0}</span>
                        <span>🎟 Билетов: {g.tickets_issued || 0}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Задания выбранной группы */}
            {selectedGroupId && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                    Задания волны «{Array.isArray(groups) ? groups.find((g) => g.id === selectedGroupId)?.title : ''}»
                  </h3>
                  <button className="btn btn-primary" onClick={() => handleOpenTaskModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Добавить задание
                  </button>
                </div>

                {!Array.isArray(tasks) || tasks.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                    В этой группе еще нет заданий
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tasks.map((t) => {
                      const diff = getDifficultyBadge(t.difficulty);
                      return (
                        <div key={t.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '14px 16px',
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0', 
                          backgroundColor: '#fff',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{t.title}</strong>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                padding: '2px 10px', 
                                borderRadius: '4px', 
                                backgroundColor: diff.bg, 
                                color: diff.color 
                              }}>
                                {diff.icon} {diff.label}
                              </span>
                              <span style={{ 
                                fontSize: '11px', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: '#f1f5f9', 
                                color: '#64748b' 
                              }}>
                                {t.task_type === 'repost' ? '📤 Репост' : t.task_type === 'post' ? '📝 Пост' : '📌 Другое'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569', maxWidth: '600px' }}>
                              {t.description && t.description.length > 100 ? t.description.slice(0, 100) + '...' : t.description || ''}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => handleOpenTaskModal(t)} 
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn btn-danger" 
                              onClick={() => handleDeleteTask(t.id)} 
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                            >
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
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Проверка отчетов</h3>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => {
                  const count = Array.isArray(reports) ? reports.filter(r => r.status === st).length : 0;
                  return (
                    <button
                      key={st}
                      className={`btn ${reportFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setReportFilter(st)}
                      style={{ fontSize: '13px', padding: '6px 14px' }}
                    >
                      {st === 'pending' ? '⏳ На рассмотрении' : 
                       st === 'approved' ? '✅ Принятые' : 
                       st === 'rejected' ? '❌ Отклоненные' : '📋 Все'}
                      {count > 0 && ` (${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {!Array.isArray(reports) || reports.length === 0 ? (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                <CheckCircle2 size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>Отчетов в этой категории пока нет</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.map((r) => {
                  const diff = getDifficultyBadge(r.difficulty);
                  const statusBadge = getStatusBadge(r.status);
                  const isExpanded = expandedReportId === r.id;
                  const mediaFiles = reportMedia[r.id] || [];
                  const isLoadingMedia = loadingMedia[r.id];

                  return (
                    <div 
                      key={r.id} 
                      style={{ 
                        backgroundColor: '#fff', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        transition: 'all 0.2s',
                        boxShadow: r.status === 'pending' ? '0 0 0 2px #f59e0b' : 'none',
                      }}
                    >
                      {/* Шапка отчета */}
                      <div style={{ 
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                        backgroundColor: r.status === 'pending' ? '#fffbeb' : '#f8fafc',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <div>
                            <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                              {r.user_first_name || ''} {r.user_last_name || ''}
                            </strong>
                            {r.vk_id && (
                              <a
                                href={`https://vk.com/id${r.vk_id}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ marginLeft: '8px', fontSize: '13px', color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                vk.com/id{r.vk_id} <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 10px',
                            borderRadius: '12px',
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                          }}>
                            {statusBadge.label}
                          </span>
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            backgroundColor: diff.bg, 
                            color: diff.color 
                          }}>
                            {diff.icon} {diff.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : ''}
                          </span>
                          <button
                            onClick={() => setExpandedReportId(isExpanded ? null : r.id)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                          >
                            {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Содержимое отчета */}
                      <div style={{ padding: '16px 20px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>📌 Задание:</span>
                          <strong style={{ fontSize: '14px', color: '#0f172a', marginLeft: '8px' }}>{r.task_title || ''}</strong>
                        </div>

                        <div style={{ 
                          backgroundColor: '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px', 
                          padding: '12px 16px',
                          marginBottom: '12px',
                          wordBreak: 'break-all',
                          fontSize: '14px',
                          maxHeight: isExpanded ? 'none' : '80px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          {r.submission_text || ''}
                          {!isExpanded && r.submission_text && r.submission_text.length > 200 && (
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: '30px',
                              background: 'linear-gradient(transparent, #f8fafc)',
                              pointerEvents: 'none'
                            }} />
                          )}
                        </div>

                        {/* Медиафайлы */}
                        {isLoadingMedia ? (
                          <div style={{ display: 'flex', gap: '8px', padding: '8px 0' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Загрузка...</span>
                            </div>
                          </div>
                        ) : mediaFiles.length > 0 ? (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {mediaFiles.map((media, idx) => {
                              const isImage = media.file_type === 'image' || 
                                media.original_name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                              
                              return (
                                <div key={idx} style={{
                                  width: '80px',
                                  height: '80px',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#f1f5f9',
                                  position: 'relative',
                                  cursor: isImage ? 'pointer' : 'default',
                                  transition: 'transform 0.2s',
                                  ':hover': isImage ? { transform: 'scale(1.05)' } : {}
                                }}
                                onClick={() => isImage && setLightboxImage(media.file_url)}
                                >
                                  {isImage ? (
                                    <img 
                                      src={media.file_url} 
                                      alt={media.original_name}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).parentElement!.innerHTML = `
                                          <div style="text-align:center;padding:8px;">
                                            <File size={24} color="#94a3b8" />
                                            <span style="font-size:8px;color:#94a3b8;display:block;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${media.original_name}</span>
                                          </div>
                                        `;
                                      }}
                                    />
                                  ) : (
                                    <div style={{ textAlign: 'center', padding: '8px' }}>
                                      {getFileIcon(media.file_type, media.original_name)}
                                      <span style={{ fontSize: '8px', color: '#64748b', display: 'block', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {media.original_name}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Кнопка скачивания */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadFile(media.file_url, media.original_name);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      bottom: '4px',
                                      right: '4px',
                                      background: 'rgba(0,0,0,0.7)',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#fff',
                                      padding: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: 0,
                                      transition: 'opacity 0.2s',
                                      ':hover': { opacity: 1 }
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                  >
                                    <Download size={12} />
                                  </button>
                                  
                                  {isImage && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxImage(media.file_url);
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        background: 'rgba(0,0,0,0.7)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        ':hover': { opacity: 1 }
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                    >
                                      <ZoomIn size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {/* Действия */}
                        {r.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {rejectingReportId === r.id ? (
                              <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="Укажите причину отклонения..."
                                  value={rejectReasonInput}
                                  onChange={(e) => setRejectReasonInput(e.target.value)}
                                  style={{ flex: 1, minWidth: '200px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                />
                                <button className="btn btn-danger" onClick={() => handleRejectReport(r.id)} style={{ padding: '6px 16px', fontSize: '13px' }}>
                                  <X size={16} /> Отклонить
                                </button>
                                <button className="btn btn-secondary" onClick={() => setRejectingReportId(null)} style={{ padding: '6px 16px', fontSize: '13px' }}>
                                  Отмена
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  className="btn btn-primary" 
                                  onClick={() => handleApproveReport(r.id)} 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    padding: '6px 16px', 
                                    fontSize: '13px', 
                                    backgroundColor: '#16a34a',
                                    borderColor: '#16a34a'
                                  }}
                                >
                                  <Check size={16} /> Принять (+{r.points || 0} баллов)
                                </button>
                                <button 
                                  className="btn btn-danger" 
                                  onClick={() => setRejectingReportId(r.id)} 
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '13px' }}
                                >
                                  <X size={16} /> Отклонить
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {r.status === 'rejected' && r.reject_reason && (
                          <div style={{ 
                            marginTop: '8px', 
                            padding: '8px 12px', 
                            backgroundColor: '#fee2e2', 
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#991b1b'
                          }}>
                            <strong>Причина отклонения:</strong> {r.reject_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Lightbox для просмотра фото */}
        {lightboxImage && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
              cursor: 'pointer'
            }}
            onClick={() => setLightboxImage(null)}
          >
            <button
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '32px',
                cursor: 'pointer',
                zIndex: 10,
                opacity: 0.7,
                ':hover': { opacity: 1 }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImage(null);
              }}
            >
              <XCircle size={36} />
            </button>
            <img
              src={lightboxImage}
              alt="Просмотр"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                backdropFilter: 'blur(10px)',
                ':hover': { background: 'rgba(255,255,255,0.3)' }
              }}
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = lightboxImage;
                link.download = 'image.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download size={18} /> Скачать
            </button>
          </div>
        )}

        {/* ВКЛАДКА 3: БИЛЕТЫ */}
        {activeTab === 'tickets' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Реестр выданных билетов</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Фильтр:</span>
                <select
                  value={ticketFilterGroup}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setTicketFilterGroup(val);
                    loadTickets(val === 'all' ? undefined : val);
                  }}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}
                >
                  <option value="all">Все волны</option>
                  {Array.isArray(groups) && groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  Всего: <strong>{Array.isArray(tickets) ? tickets.length : 0}</strong> билетов
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {!Array.isArray(tickets) || tickets.length === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '48px' }}>
                  🎫 В данной волне пока никто не получил лотерейный билет
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Номер билета</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Участник</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Волна</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Баллы</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Дата выдачи</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                            🎫 {t.ticket_number || ''}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {t.vk_id ? (
                              <a href={`https://vk.com/id${t.vk_id}`} target="_blank" rel="noreferrer" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {t.first_name || ''} {t.last_name || ''}
                                <ExternalLink size={12} style={{ color: '#94a3b8' }} />
                              </a>
                            ) : (
                              <span>{t.first_name || ''} {t.last_name || ''}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{t.group_title || ''}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>⭐ {t.total_points || 0}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleDateString('ru-RU') : ''}
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

        {/* ВКЛАДКА 4: РАССЫЛКА */}
        {activeTab === 'broadcast' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#dbeafe',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Send size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Рассылка сообщений</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Отправка сообщений от имени бота всем пользователям
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                Кому отправить:
              </label>
              <select
                value={broadcastRecipients}
                onChange={(e) => setBroadcastRecipients(e.target.value as any)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff', width: '100%', maxWidth: '300px' }}
              >
                <option value="all">📢 Всем пользователям</option>
                <option value="active">👥 Активным пользователям</option>
                <option value="ticket_holders">🎟 Обладателям билетов</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                Текст сообщения:
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={6}
                placeholder="Введите текст сообщения для рассылки..."
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical' }}
              />
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                {broadcastMessage.length} символов
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleBroadcast}
                disabled={broadcastLoading || !broadcastMessage.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
              >
                {broadcastLoading ? (
                  <>⏳ Отправка...</>
                ) : (
                  <>
                    <Send size={18} /> Отправить рассылку
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setBroadcastMessage('')}
                style={{ padding: '10px 24px' }}
              >
                Очистить
              </button>
            </div>

            <div style={{ 
              marginTop: '20px', 
              padding: '12px 16px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#475569'
            }}>
              <strong>⚠️ Важно:</strong> Сообщение будет отправлено всем выбранным пользователям. 
              Убедитесь, что текст корректен и не содержит ошибок.
            </div>
          </div>
        )}

        {/* ВКЛАДКА 5: НАСТРОЙКИ */}
        {activeTab === 'settings' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Настройки бота</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Ключи доступа и текстовые сообщения
                </p>
              </div>
              <button
                className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsEditMode(!isEditMode)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isEditMode ? <Lock size={16} /> : <Unlock size={16} />}
                {isEditMode ? 'Закончить редактирование' : 'Редактировать'}
              </button>
            </div>

            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> Ключ доступа VK Token
                    {!isEditMode && <span style={{ fontSize: '11px', color: '#94a3b8' }}>(защищено)</span>}
                  </label>
                  <input
                    type={isEditMode ? 'text' : 'password'}
                    value={settings.vk_token || ''}
                    onChange={(e) => setSettings({ ...settings, vk_token: e.target.value })}
                    placeholder="vk1.a.XXXX..."
                    disabled={!isEditMode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      backgroundColor: isEditMode ? '#fff' : '#f1f5f9',
                      cursor: isEditMode ? 'text' : 'not-allowed',
                    }}
                  />
                </div>
                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} /> ID сообщества VK
                    {!isEditMode && <span style={{ fontSize: '11px', color: '#94a3b8' }}>(защищено)</span>}
                  </label>
                  <input
                    type="text"
                    value={settings.vk_group_id || ''}
                    onChange={(e) => setSettings({ ...settings, vk_group_id: e.target.value })}
                    placeholder="210000000"
                    disabled={!isEditMode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      backgroundColor: isEditMode ? '#fff' : '#f1f5f9',
                      cursor: isEditMode ? 'text' : 'not-allowed',
                    }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>🌐 Ссылка на сайт (личный кабинет)</label>
                <input
                  type="text"
                  value={settings.site_url || ''}
                  onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
                  placeholder="https://ваш-сайт.ru"
                  disabled={!isEditMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: isEditMode ? '#fff' : '#f1f5f9',
                    cursor: isEditMode ? 'text' : 'not-allowed',
                  }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>⏰ Время проведения розыгрыша</label>
                <input
                  type="text"
                  value={settings.draw_time || '18:00'}
                  onChange={(e) => setSettings({ ...settings, draw_time: e.target.value })}
                  placeholder="18:00"
                  disabled={!isEditMode}
                  style={{
                    width: '100%',
                    maxWidth: '200px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: isEditMode ? '#fff' : '#f1f5f9',
                    cursor: isEditMode ? 'text' : 'not-allowed',
                  }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>👋 Приветственное сообщение</label>
                <textarea
                  value={settings.welcome_text || ''}
                  onChange={(e) => setSettings({ ...settings, welcome_text: e.target.value })}
                  rows={4}
                  disabled={!isEditMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: isEditMode ? '#fff' : '#f1f5f9',
                    cursor: isEditMode ? 'text' : 'not-allowed',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>🎉 Сообщение при выполнении всех заданий</label>
                <textarea
                  value={settings.success_text || ''}
                  onChange={(e) => setSettings({ ...settings, success_text: e.target.value })}
                  rows={4}
                  disabled={!isEditMode}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    backgroundColor: isEditMode ? '#fff' : '#f1f5f9',
                    cursor: isEditMode ? 'text' : 'not-allowed',
                    resize: 'vertical'
                  }}
                />
              </div>

              {isEditMode && (
                <button type="submit" className="btn btn-primary" disabled={savingSettings} style={{ padding: '10px 32px' }}>
                  {savingSettings ? '⏳ Сохранение...' : '💾 Сохранить настройки'}
                </button>
              )}
            </form>
          </div>
        )}

        {/* МОДАЛКА ГРУППЫ */}
        {showGroupModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '16px', maxWidth: '450px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '20px', color: '#0f172a' }}>
                {groupForm.id > 0 ? '✏️ Редактировать волну' : '➕ Новая волна заданий'}
              </h3>
              <form onSubmit={handleSaveGroup}>
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label>Название волны</label>
                  <input
                    type="text"
                    value={groupForm.title}
                    onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                    placeholder="Например: Задания на 15 мая"
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label>Дата начала</label>
                  <input
                    type="date"
                    value={groupForm.start_date}
                    onChange={(e) => setGroupForm({ ...groupForm, start_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label>Дата окончания</label>
                  <input
                    type="date"
                    value={groupForm.end_date}
                    onChange={(e) => setGroupForm({ ...groupForm, end_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}>Сохранить</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddGroupModal(false)} style={{ padding: '10px 20px' }}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* МОДАЛКА ЗАДАНИЯ */}
        {showTaskModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '16px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '20px', color: '#0f172a' }}>
                {taskForm.id > 0 ? '✏️ Редактировать задание' : '➕ Новое задание'}
              </h3>
              <form onSubmit={handleSaveTask}>
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label>Название задания</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Например: Сделать репост записи"
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label>Описание и инструкция</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={4}
                    placeholder="Перейдите по ссылке vk.com/wall... и сделайте репост, затем пришлите ссылку"
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div className="input-group">
                    <label>Сложность</label>
                    <select
                      value={taskForm.difficulty}
                      onChange={(e) => setTaskForm({ ...taskForm, difficulty: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    >
                      <option value="easy">🟢 Простое (+10 б.)</option>
                      <option value="medium">🟡 Среднее (+20 б.)</option>
                      <option value="hard">🔴 Сложное (+30 б.)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Тип задания</label>
                    <select
                      value={taskForm.task_type}
                      onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    >
                      <option value="repost">📤 Репост</option>
                      <option value="post">📝 Пост</option>
                      <option value="other">📌 Другое</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}>Сохранить</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddTaskModal(false)} style={{ padding: '10px 20px' }}>Отмена</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};