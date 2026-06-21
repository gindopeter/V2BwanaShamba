import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    watch: {
      ignored: [
        '**/.local/**',
        '**/.cache/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/farm.db*',
      ],
    },
  },
  build: {
    outDir: 'dist/public',
    rollupOptions: {
      // The SPA ships as app.html so the static marketing landing can own
      // index.html (served at the root domain). Assets stay under /assets.
      input: path.resolve(__dirname, 'app.html'),
    },
  },
});
