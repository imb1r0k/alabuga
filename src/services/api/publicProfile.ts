// ─── Публичный профиль ──────────────────────────────────────────────────────

import { api } from './client';

export const getPublicProfile = async (login: string) => {
  const response = await api.get(`/public/profile?login=${encodeURIComponent(login)}`);
  return response.data;
};
