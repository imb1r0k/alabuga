// ─── Глобальные уведомления ─────────────────────────────────────────────────

import { api } from './client';

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
