// ─── Моя команда ─────────────────────────────────────────────────────────────

import { api } from './client';

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
