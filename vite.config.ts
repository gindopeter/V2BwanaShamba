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
  },
});
