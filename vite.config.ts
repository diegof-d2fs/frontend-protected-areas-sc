import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// SDD docs/SDD.md — seção 3.7 (proxy de dev, nunca CORS na API) e
// seção 5.2 (build de produção sem sourcemap, sem console/debugger residual).
// `esbuild.drop` só se aplica ao build de produção (command === 'build') — em dev
// queremos console.log disponível para depuração.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    sourcemap: false,
  },
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
}))
