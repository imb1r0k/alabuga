// ... (весь существующий код, не изменяем, просто добавляем в конец)

// ─── Публичный профиль ───────────────────────────────────────────────────────

export const getPublicProfile = async (login: string) => {
  const response = await api.get(`/public-profile?login=${encodeURIComponent(login)}`);
  return response.data;
};

export default api;