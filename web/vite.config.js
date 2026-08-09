import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Necesario para abrir la app desde el celular en la misma red.
    port: 5173,
    proxy: {
      // En desarrollo el frontend habla con el backend sin CORS ni URLs absolutas.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
