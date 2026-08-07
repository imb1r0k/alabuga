import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Все запросы, начинающиеся с /api, будут перенаправляться
      '/api': {
        target: 'http://imb1r0kya2.temp.swtest.ru',
        changeOrigin: true,    // Важно для корректной работы CORS
        secure: false,         // Если на новом хостинге нет HTTPS
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Опционально

        },
      },
    },
  },
);