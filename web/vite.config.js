import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // No cargar el .env del servidor ni exponer archivos fuera de web/.
  envDir: false,
  server: {
    fs: { strict: true, allow: [import.meta.dirname] },
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
});
