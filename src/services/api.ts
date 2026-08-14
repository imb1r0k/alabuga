import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Настройки сайта ──────────────────────────────────────────────────────────

export const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

export const updateSettings = async (settings: Record<string, string>) => {
  const response = await api.post('/settings', settings);
  return response.data;
};

// ─── Управление ботом ВК (Админка) ─────────────────────────────────────────────

export const getVkBotSettings = async () => {
  const response = await api.get('/admin/vk-bot/settings');
  return response.data;
};

export const saveVkBotSettings = async (settings: Record<string, string>) => {
  const response = await api.post('/admin/vk-bot/settings', settings);
  return response.data;
};

export const getVkBotTaskGroups = async () => {
  const response = await api.get('/admin/vk-bot/groups');
  return response.data;
};

export const saveVkBotTaskGroup = async (groupData: any) => {
  const response = await api.post('/admin/vk-bot/groups', groupData);
  return response.data;
};

export const deleteVkBotTaskGroup = async (id: number) => {
  const response = await api.post('/admin/vk-bot/groups', { action: 'delete', id });
  return response.data;
};

export const getVkBotTasks = async (groupId?: number) => {
  const url = groupId ? `/admin/vk-bot/tasks?group_id=${groupId}` : '/admin/vk-bot/tasks';
  const response = await api.get(url);
  return response.data;
};

export const saveVkBotTask = async (taskData: any) => {
  const response = await api.post('/admin/vk-bot/tasks', taskData);
  return response.data;
};

export const deleteVkBotTask = async (id: number) => {
  const response = await api.post('/admin/vk-bot/tasks', { action: 'delete', id });
  return response.data;
};

export const getVkBotReports = async (status: string = 'all') => {
  const response = await api.get(`/admin/vk-bot/reports?status=${status}`);
  return response.data;
};

export const updateVkBotReportStatus = async (reportId: number, status: 'approved' | 'rejected', rejectReason?: string) => {
  const response = await api.post('/admin/vk-bot/reports', { id: reportId, status, reject_reason: rejectReason });
  return response.data;
};

export const getVkBotTickets = async (groupId?: number) => {
  const url = groupId ? `/admin/vk-bot/tickets?group_id=${groupId}` : '/admin/vk-bot/tickets';
  const response = await api.get(url);
  return response.data;
};

// ─── Медиафайлы отчетов бота ВК ──────────────────────────────────────────────

export const getVkBotReportMedia = async (reportId: number) => {
  const response = await api.get(`/admin/vk-bot/reports/media?report_id=${reportId}`);
  return response.data;
};

// ─── Глобальные уведомления ─────────────────────────────────────────────────

export const getGlobalNotification = async () => {
  const response = await api.get('/get-global-notification');
  return response.data;
};

export const markGlobalNotificationViewed = async () => {
  const response = await api.post('/mark-notification-viewed');
  return response.data;
};

export const saveGlobalNotification = async (payload: {
  text: string;
  type: string;
  enabled: boolean;
}) => {
  const response = await api.post('/save-global-notification', payload);
  return response.data;
};

// ─── Статистика (Админка) ─────────────────────────────────────────────────────

export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

export const runAutoApproveBookings = async () => {
  const response = await api.post('/admin/auto-approve');
  return response.data;
};

// ─── Публичные данные для бронирования ───────────────────────────────────────

export const getMyBooking = async () => {
  const response = await api.get('/my-booking');
  return response.data;
};

export const cancelMyBooking = async () => {
  const response = await api.post('/cancel-booking');
  return response.data;
};

export const getPublicBuildings = async () => {
  const response = await api.get('/public/buildings');
  return response.data;
};

export const getPublicLayout = async (buildingId: number) => {
  const response = await api.get(`/public/layout?building_id=${buildingId}`);
  return response.data;
};

export const bookRoom = async (payload: any) => {
  const response = await api.post('/book', payload);
  return response.data;
};

export const autoBook = async (payload: any) => {
  const response = await api.post('/auto-book', payload);
  return response.data;
};

// ─── Экспорт и Очистка (Админка) ──────────────────────────────────────────────

export const getExportBookings = async () => {
  const response = await api.get('/admin/export/bookings');
  return response.data;
};

export const getExportLayouts = async () => {
  const response = await api.get('/admin/export/layouts');
  return response.data;
};

export const getExportUsers = async () => {
  const response = await api.get('/admin/export/users');
  return response.data;
};

export const archiveAllBookings = async () => {
  const response = await api.post('/admin/archive-bookings');
  return response.data;
};

export const archiveAllUsers = async () => {
  const response = await api.post('/admin/archive-users');
  return response.data;
};

export const clearAllTeamChats = async () => {
  const response = await api.post('/admin/teams/clear-all-chats');
  return response.data;
};

// ─── Пользователи (Админка) ───────────────────────────────────────────────────

export const getAdminUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const updateAdminUser = async (userData: any) => {
  const response = await api.post('/admin/users', userData);
  return response.data;
};

export const getUserDetails = async (id: number) => {
  const response = await api.get(`/admin/user-details?id=${id}`);
  return response.data;
};

// ─── Бронирования (Админка) ───────────────────────────────────────────────────

export const getAdminBookings = async () => {
  const response = await api.get('/admin/bookings');
  return response.data;
};

export const updateAdminBooking = async (bookingData: any) => {
  const response = await api.post('/admin/bookings', bookingData);
  return response.data;
};

export const getAllRooms = async () => {
  const response = await api.get('/admin/all-rooms');
  return response.data;
};

export const getRoomBookings = async (roomId: number) => {
  const response = await api.get(`/admin/room-bookings?room_id=${roomId}`);
  return response.data;
};

export const createManualBooking = async (payload: any) => {
  const response = await api.post('/admin/manual-booking', payload);
  return response.data;
};

// ─── Корпуса ──────────────────────────────────────────────────────────────────

export const getAdminBuildings = async () => {
  const response = await api.get('/admin/buildings');
  return response.data;
};

export const saveAdminBuilding = async (buildingData: any) => {
  const response = await api.post('/admin/buildings', buildingData);
  return response.data;
};

export const deleteAdminBuilding = async (id: number) => {
  const response = await api.post('/admin/buildings', { action: 'delete', id });
  return response.data;
};

// ─── Этажи ────────────────────────────────────────────────────────────────────

export const getAdminFloors = async (buildingId: number) => {
  const response = await api.get(`/admin/floors?building_id=${buildingId}`);
  return response.data;
};

export const saveAdminFloor = async (floorData: any) => {
  const response = await api.post('/admin/floors', floorData);
  return response.data;
};

export const deleteAdminFloor = async (id: number) => {
  const response = await api.post('/admin/floors', { action: 'delete', id });
  return response.data;
};

// ─── Комнаты ──────────────────────────────────────────────────────────────────

export const getAdminRooms = async (floorId: number) => {
  const response = await api.get(`/admin/rooms?floor_id=${floorId}`);
  return response.data;
};

export const saveAdminRoom = async (roomData: any) => {
  const response = await api.post('/admin/rooms', roomData);
  return response.data;
};

export const deleteAdminRoom = async (id: number) => {
  const response = await api.post('/admin/rooms', { action: 'delete', id });
  return response.data;
};

// ─── Команды (Админка) ────────────────────────────────────────────────────────

export const getAdminTeams = async () => {
  const response = await api.get('/admin/teams');
  return response.data;
};

export const saveAdminTeam = async (teamData: any) => {
  const response = await api.post('/admin/teams', teamData);
  return response.data;
};

export const deleteAdminTeam = async (id: number) => {
  const response = await api.post('/admin/teams/delete', { id });
  return response.data;
};

export const getAdminTeamMembers = async (teamId: number) => {
  const response = await api.get(`/admin/teams/members?team_id=${teamId}`);
  return response.data;
};

export const addAdminTeamMember = async (teamId: number, userId: number) => {
  const response = await api.post('/admin/teams/add-member', { team_id: teamId, user_id: userId });
  return response.data;
};

export const removeAdminTeamMember = async (teamId: number, userId: number) => {
  const response = await api.post('/admin/teams/remove-member', { team_id: teamId, user_id: userId });
  return response.data;
};

export const getAdminTeamChat = async (teamId: number) => {
  const response = await api.get(`/admin/teams/chat?team_id=${teamId}`);
  return response.data;
};

export const sendAdminTeamMessage = async (teamId: number, message: string) => {
  const response = await api.post('/admin/teams/chat', { team_id: teamId, message });
  return response.data;
};

export const clearAdminTeamChat = async (teamId: number) => {
  const response = await api.post('/admin/teams/clear-chat', { team_id: teamId });
  return response.data;
};

export const deleteAdminTeamMessage = async (messageId: number) => {
  const response = await api.post('/admin/teams/delete-message', { message_id: messageId });
  return response.data;
};

export const getAdminTeamCalendar = async (teamId: number) => {
  const response = await api.get(`/admin/teams/calendar?team_id=${teamId}`);
  return response.data;
};

export const addAdminTeamEvent = async (teamId: number, eventData: any, imageFile?: File | null) => {
  if (imageFile) {
    const formData = new FormData();
    formData.append('team_id', String(teamId));
    formData.append('title', eventData.title || '');
    if (eventData.event_date) formData.append('event_date', eventData.event_date);
    if (eventData.description) formData.append('description', eventData.description);
    if (eventData.image_url) formData.append('image_url', eventData.image_url);
    formData.append('image', imageFile);

    const response = await api.post('/admin/teams/calendar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  const response = await api.post('/admin/teams/calendar', { ...eventData, team_id: teamId });
  return response.data;
};

export const deleteAdminTeamEvent = async (id: number) => {
  const response = await api.post('/admin/teams/calendar', { action: 'delete', id });
  return response.data;
};

// ─── Профиль пользователя (личный кабинет) ────────────────────────────────────

export const getMyProfile = async () => {
  const response = await api.get('/profile');
  return response.data;
};

export const updateMyProfile = async (profileData: Record<string, string>) => {
  const response = await api.post('/profile', profileData);
  return response.data;
};

// ─── Мои бронирования (история) ───────────────────────────────────────────────

export const getMyBookingsHistory = async () => {
  const response = await api.get('/my-bookings');
  return response.data;
};

// ─── Моя команда ──────────────────────────────────────────────────────────────

export const getMyTeam = async () => {
  const response = await api.get('/my-team');
  return response.data;
};

export const getMyTeamChat = async () => {
  const response = await api.get('/my-team/chat');
  return response.data;
};

export const sendMyTeamMessage = async (message: string) => {
  const response = await api.post('/my-team/chat', { message });
  return response.data;
};

export const getMyTeamCalendar = async () => {
  const response = await api.get('/my-team/calendar');
  return response.data;
};

// ─── Публичный профиль ───────────────────────────────────────────────────────

export const getPublicProfile = async (login: string) => {
  const response = await api.get(`/public/profile?login=${encodeURIComponent(login)}`);
  return response.data;
};

// ─── Рассылка бота ВК ────────────────────────────────────────────────────────

export const sendVkBotBroadcast = async (message: string, recipients: 'all' | 'active' | 'ticket_holders') => {
  const response = await api.post('/admin/vk-bot/broadcast', { message, recipients });
  return response.data;
};

// ─── Статистика бота ВК ─────────────────────────────────────────────────────

export const getVkBotStats = async () => {
  const response = await api.get('/admin/vk-bot/stats');
  return response.data;
};

// ─── Экспорт данных бота ВК ─────────────────────────────────────────────────

export const exportVkBotData = async (type: 'reports' | 'tickets') => {
  const response = await api.get(`/admin/vk-bot/export?type=${type}`);
  return response.data;
};

// ─── Заявки пользователей (через бота) ─────────────────────────────────────

export const getAdminRequests = async (status?: string) => {
  const url = status ? `/admin/requests?status=${status}` : '/admin/requests';
  const response = await api.get(url);
  return response.data;
};

export const updateRequestStatus = async (id: number, status: string, resolutionText?: string) => {
  const response = await api.post('/admin/requests', { id, status, resolution_text: resolutionText });
  return response.data;
};

export const getRequestMessages = async (requestId: number) => {
  const response = await api.get(`/admin/requests/messages?request_id=${requestId}`);
  return response.data;
};

export const sendRequestMessage = async (requestId: number, message: string) => {
  const response = await api.post('/admin/requests/messages', { request_id: requestId, message });
  return response.data;
};