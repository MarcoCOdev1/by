import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: { middlewareMode: true, hmr: { path: '/vite-hmr' } },
  test: { environment: 'jsdom', include: ['**/*.test.{js,jsx}'], setupFiles: ['./test-setup.js'], maxWorkers: 1 }
});
