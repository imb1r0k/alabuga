import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен к запросам автоматически
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Аутентификация и пользователь ─────────────────────────────────────────

export const loginUser = async (loginOrPhone: string, password: string) => {
  const isPhone = /^[0-9+\-() ]+$/.test(loginOrPhone);
  const payload: any = { password };
  if (isPhone) payload.phone = loginOrPhone;
  else payload.login = loginOrPhone;
  const response = await api.post('/login', payload);
  return response.data;
};

export const registerUser = async (userData: {
  last_name: string;
  first_name: string;
  phone: string;
  password: string;
  login?: string;
}) => {
  const response = await api.post('/register', userData);
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/logout', {}, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return response.data;
};

// ─── Настройки портала ─────────────────────────────────────────────────────

export const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

export const updateSettings = async (settings: Record<string, string>) => {
  const response = await api.post('/settings', settings);
  return response.data;
};

// ─── Глобальное уведомление ───────────────────────────────────────────────

export const getGlobalNotification = async () => {
  const response = await api.get('/global-notification');
  return response.data;
};

export const saveGlobalNotification = async (data: any) => {
  const response = await api.post('/global-notification', data);
  return response.data;
};

export const markGlobalNotificationViewed = async () => {
  const response = await api.post('/global-notification/viewed');
  return response.data;
};

// ─── Статистика для админки ───────────────────────────────────────────────

export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

// ─── Экспорт и архивирование ──────────────────────────────────────────────

export const getExportBookings = async () => {
  const response = await api.get('/admin/export/bookings');
  return response.data;
};

export const getExportLayouts = async () => {
  const response = await api.get('/admin/export/layouts');
  return response.data;
};

export const archiveAllBookings = async () => {
  const response = await api.post('/admin/archive/bookings');
  return response.data;
};

export const archiveAllUsers = async () => {
  const response = await api.post('/admin/archive/users');
  return response.data;
};

// ─── Управление корпусами, этажами, комнатами (админка) ──────────────────

export const getAdminBuildings = async () => {
  const response = await api.get('/admin/buildings');
  return response.data;
};

export const saveAdminBuilding = async (data: any) => {
  const response = await api.post('/admin/buildings', data);
  return response.data;
};

export const deleteAdminBuilding = async (id: number) => {
  const response = await api.delete(`/admin/buildings/${id}`);
  return response.data;
};

export const getAdminFloors = async (buildingId: number) => {
  const response = await api.get(`/admin/buildings/${buildingId}/floors`);
  return response.data;
};

export const saveAdminFloor = async (data: any) => {
  const response = await api.post('/admin/floors', data);
  return response.data;
};

export const deleteAdminFloor = async (id: number) => {
  const response = await api.delete(`/admin/floors/${id}`);
  return response.data;
};

export const getAdminRooms = async (floorId: number) => {
  const response = await api.get(`/admin/floors/${floorId}/rooms`);
  return response.data;
};

export const saveAdminRoom = async (data: any) => {
  const response = await api.post('/admin/rooms', data);
  return response.data;
};

export const deleteAdminRoom = async (id: number) => {
  const response = await api.delete(`/admin/rooms/${id}`);
  return response.data;
};

// ─── Бронирования (админка) ───────────────────────────────────────────────

export const getAdminBookings = async () => {
  const response = await api.get('/admin/bookings');
  return response.data;
};

export const getRoomBookings = async (roomId: number) => {
  const response = await api.get(`/rooms/${roomId}/bookings`);
  return response.data;
};

export const updateAdminBooking = async (data: any) => {
  const response = await api.post('/admin/bookings/update', data);
  return response.data;
};

export const getAllRooms = async () => {
  const response = await api.get('/admin/all-rooms');
  return response.data;
};

// ─── Пользователи (админка) ───────────────────────────────────────────────

export const getAdminUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const updateAdminUser = async (data: any) => {
  const response = await api.post('/admin/users/update', data);
  return response.data;
};

export const getUserDetails = async (userId: number) => {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data;
};

// ─── Команды (админка) ────────────────────────────────────────────────────

export const getAdminTeams = async () => {
  const response = await api.get('/admin/teams');
  return response.data;
};

export const saveAdminTeam = async (data: any) => {
  const response = await api.post('/admin/teams', data);
  return response.data;
};

export const deleteAdminTeam = async (id: number) => {
  const response = await api.delete(`/admin/teams/${id}`);
  return response.data;
};

export const getAdminTeamMembers = async (teamId: number) => {
  const response = await api.get(`/admin/teams/${teamId}/members`);
  return response.data;
};

export const addAdminTeamMember = async (teamId: number, userId: number) => {
  const response = await api.post(`/admin/teams/${teamId}/members`, { user_id: userId });
  return response.data;
};

export const removeAdminTeamMember = async (teamId: number, userId: number) => {
  const response = await api.delete(`/admin/teams/${teamId}/members/${userId}`);
  return response.data;
};

export const getAdminTeamChat = async (teamId: number) => {
  const response = await api.get(`/admin/teams/${teamId}/chat`);
  return response.data;
};

export const sendAdminTeamMessage = async (teamId: number, message: string) => {
  const response = await api.post(`/admin/teams/${teamId}/chat`, { message });
  return response.data;
};

export const getAdminTeamCalendar = async (teamId: number) => {
  const response = await api.get(`/admin/teams/${teamId}/calendar`);
  return response.data;
};

export const addAdminTeamEvent = async (teamId: number, eventData: any) => {
  const response = await api.post(`/admin/teams/${teamId}/calendar`, eventData);
  return response.data;
};

export const deleteAdminTeamEvent = async (eventId: number) => {
  const response = await api.delete(`/admin/teams/calendar/${eventId}`);
  return response.data;
};

// ─── Публичные данные для бронирования ────────────────────────────────────

export const getPublicBuildings = async () => {
  const response = await api.get('/public/buildings');
  return response.data;
};

export const getPublicLayout = async (buildingId: number) => {
  const response = await api.get(`/public/buildings/${buildingId}/layout`);
  return response.data;
};

export const getMyBooking = async () => {
  const response = await api.get('/my-booking');
  return response.data;
};

// ─── Бронирование комнаты (ручное и автоматическое) ──────────────────────

export const bookRoom = async (data: any) => {
  const response = await api.post('/book', data);
  return response.data;
};

export const autoBook = async (data: any) => {
  const response = await api.post('/auto-book', data);
  return response.data;
};

// ─── Личный кабинет пользователя ─────────────────────────────────────────

export const getMyBookings = async () => {
  const response = await api.get('/my-bookings');
  return response.data;
};

export const getMyTeam = async () => {
  const response = await api.get('/my-team');
  return response.data;
};

export const getMyTeamChat = async () => {
  const response = await api.get('/my-team/chat');
  return response.data;
};

export const sendMyTeamChatMessage = async (message: string) => {
  const response = await api.post('/my-team/chat', { message });
  return response.data;
};

export const getMyTeamCalendar = async () => {
  const response = await api.get('/my-team/calendar');
  return response.data;
};

export const updateMyProfile = async (profileData: {
  about?: string;
  social_vk?: string;
  social_max?: string;
  social_telegram?: string;
  social_instagram?: string;
}) => {
  const response = await api.post('/profile', profileData);
  return response.data;
};