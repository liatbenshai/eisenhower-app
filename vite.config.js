import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// VitePWA הוסר כדי למנוע בעיות עם Service Worker ורענון דף

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});

