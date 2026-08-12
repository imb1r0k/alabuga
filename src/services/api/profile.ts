// ─── Личный профиль (личный кабинет) ─────────────────────────────────────────

import { api } from './client';

export const getMyProfile = async () => {
  const response = await api.get('/profile');
  return response.data;
};

export const updateMyProfile = async (profileData: Record<string, string>) => {
  const response = await api.post('/profile', profileData);
  return response.data;
};
