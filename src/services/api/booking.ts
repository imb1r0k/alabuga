// ─── Публичные данные и бронирование (корпуса, комнаты, заявки) ───────────────

import { api } from './client';

export const getMyBooking = async () => {
  const response = await api.get('/my-booking');
  return response.data;
};

export const cancelMyBooking = async () => {
  const response = await api.post('/cancel-booking');
  return response.data;
};

export const getMyBookingsHistory = async () => {
  const response = await api.get('/my-bookings');
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
