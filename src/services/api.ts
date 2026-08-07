import axios from 'axios';

const API_URL = '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const getSettings = async () => {
  try {
    const response = await api.get('/settings');
    return response.data;
  } catch (error) {
    return { site_title: 'Алабуга - форум 2025' };
  }
};

export const updateSettings = async (siteTitle: string) => {
  const response = await api.post('/settings', { site_title: siteTitle });
  return response.data;
};