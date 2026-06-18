import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // dev convenience: proxy API + engine to the backend
      '/api': 'http://localhost:3000',
      '/main': 'http://localhost:3000',
    },
  },
});
