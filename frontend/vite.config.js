import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O sistema roda em www.admoema.com.br/biblioteca_digital/
export default defineConfig({
  plugins: [react()],
  base: '/biblioteca_digital/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Em desenvolvimento, redireciona /api para o PHP local:
    //   php -S localhost:8000 -t ../api ../api/index.php
    proxy: {
      '/biblioteca_digital/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace('/biblioteca_digital/api', '/api'),
      },
    },
  },
});
