import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 32111,
    proxy: {
      '/api': {
        target: 'http://imb1r0kya2.temp.swtest.ru',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
    historyApiFallback: true, // разрешаем клиентскую маршрутизацию
  },
});