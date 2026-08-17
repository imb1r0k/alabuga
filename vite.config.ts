import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig({
  plugins: [dyadComponentTagger(), react()],
  server: {
    host: true,
    port: 32111,
    proxy: {
      '/api': {
        target: 'http://imb1r0kya2.temp.swtest.ru',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});