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