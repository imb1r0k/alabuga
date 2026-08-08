// (в конец файла, перед закрывающей скобкой модуля, добавляем)

// ─── Личный кабинет пользователя ─────────────────────────────────────────────

// История бронирований пользователя
export const getMyBookings = async () => {
  const response = await api.get('/my-bookings');
  return response.data;
};

// Данные команды пользователя
export const getMyTeam = async () => {
  const response = await api.get('/my-team');
  return response.data;
};

// Сообщения чата команды
export const getMyTeamChat = async () => {
  const response = await api.get('/my-team/chat');
  return response.data;
};

// Отправка сообщения в чат команды
export const sendMyTeamChatMessage = async (message: string) => {
  const response = await api.post('/my-team/chat', { message });
  return response.data;
};

// События календаря команды
export const getMyTeamCalendar = async () => {
  const response = await api.get('/my-team/calendar');
  return response.data;
};

// Обновление профиля (о себе, соцсети)
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