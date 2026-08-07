// ... (весь существующий код)

// Команды
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