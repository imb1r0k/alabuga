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

// ─── Глобальные уведомления ─────────────────────────────────────────────────

export const getGlobalNotification = async () => {
  const response = await api.get('/notifications/global');
  return response.data;
};

export const markGlobalNotificationViewed = async () => {
  const response = await api.post('/notifications/global/view');
  return response.data;
};

export const saveGlobalNotification = async (payload: {
  text: string;
  type: string;
  enabled: boolean;
}) => {
  const response = await api.post('/notifications/global', payload);
  return response.data;
};

// ─── Статистика (Админка) ─────────────────────────────────────────────────────

export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

// ─── Публичные данные для бронирования ───────────────────────────────────────

// Получить список корпусов (публично)
export const getMyBooking = async () => {
  const response = await api.get('/my-booking');
  return response.data;
};

export const getPublicBuildings = async () => {
  const response = await api.get('/public/buildings');
  return response.data;
};

// Получить макет корпуса (здание, этажи, комнаты с занятостью)
export const getPublicLayout = async (buildingId: number) => {
  const response = await api.get(`/public/layout?building_id=${buildingId}`);
  return response.data;
};

// Отправить заявку на бронирование (с входом или регистрацией)
export const bookRoom = async (payload: any) => {
  const response = await api.post('/book', payload);
  return response.data;
};

export const autoBook = async (payload: any) => {
  const response = await api.post('/auto-book', payload);
  return response.data;
};

// ─── Экспорт (Админка) ───────────────────────────────────────────────────────

export const getExportBookings = async () => {
  const response = await api.get('/admin/export/bookings');
  return response.data;
};

export const getExportLayouts = async () => {
  const response = await api.get('/admin/export/layouts');
  return response.data;
};

// ─── Очистка (Админка) ───────────────────────────────────────────────────────

export const archiveAllBookings = async () => {
  const response = await api.post('/admin/archive-bookings');
  return response.data;
};

export const archiveAllUsers = async () => {
  const response = await api.post('/admin/archive-users');
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

// ─── Команды ──────────────────────────────────────────────────────────────────

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

export const getAdminTeamCalendar = async (teamId: number) => {
  const response = await api.get(`/admin/teams/calendar?team_id=${teamId}`);
  return response.data;
};

export const addAdminTeamEvent = async (teamId: number, eventData: any) => {
  const response = await api.post('/admin/teams/calendar', { ...eventData, team_id: teamId });
  return response.data;
};

export const deleteAdminTeamEvent = async (id: number) => {
  const response = await api.post('/admin/teams/calendar', { action: 'delete', id });
  return response.data;
};

// ─── Профиль пользователя ──────────────────────────────────────────────────

export const getMyProfile = async () => {
  const response = await api.get('/profile');
  return response.data;
};

export const updateMyProfile = async (profileData: Record<string, string>) => {
  const response = await api.post('/profile', profileData);
  return response.data;
};

// ─── История моих бронирований ──────────────────────────────────────────────

export const getMyBookingHistory = async () => {
  const response = await api.get('/my-booking/history');
  return response.data;
};

// ─── Моя команда ────────────────────────────────────────────────────────────

export const getMyTeam = async () => {
  const response = await api.get('/team/my');
  return response.data;
};

// ─── Чат команды ────────────────────────────────────────────────────────────

export const getMyTeamChat = async () => {
  const response = await api.get('/team/chat');
  return response.data;
};

export const sendMyTeamMessage = async (message: string) => {
  const response = await api.post('/team/chat', { message });
  return response.data;
};

// ─── Календарь команды ──────────────────────────────────────────────────────

export const getMyTeamCalendar = async () => {
  const response = await api.get('/team/calendar');
  return response.data;
};