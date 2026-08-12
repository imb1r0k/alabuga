// ─── VK Бот (админка) ─────────────────────────────────────────────────────────

import { api } from './client';

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

export const updateVkBotReportStatus = async (
  reportId: number,
  status: 'approved' | 'rejected',
  rejectReason?: string,
) => {
  const response = await api.post('/admin/vk-bot/reports', { id: reportId, status, reject_reason: rejectReason });
  return response.data;
};

export const getVkBotTickets = async (groupId?: number) => {
  const url = groupId ? `/admin/vk-bot/tickets?group_id=${groupId}` : '/admin/vk-bot/tickets';
  const response = await api.get(url);
  return response.data;
};

export const getVkBotReportMedia = async (reportId: number) => {
  const response = await api.get(`/admin/vk-bot/reports/media?report_id=${reportId}`);
  return response.data;
};

export const sendVkBotBroadcast = async (message: string, recipients: 'all' | 'active' | 'ticket_holders') => {
  const response = await api.post('/admin/vk-bot/broadcast', { message, recipients });
  return response.data;
};

export const getVkBotStats = async () => {
  const response = await api.get('/admin/vk-bot/stats');
  return response.data;
};

export const exportVkBotData = async (type: 'reports' | 'tickets') => {
  const response = await api.get(`/admin/vk-bot/export?type=${type}`);
  return response.data;
};
