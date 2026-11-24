import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api é encaminhado para o backend (porta 3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL || `http://localhost:${process.env.API_PORT || 3000}`, changeOrigin: true },
    },
  },
});
