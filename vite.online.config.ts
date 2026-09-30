import path from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The online demo (docs/online/PLAN.md): a static client-only build of the
// viewer on the demo study. No server code, no API, no import. The local app
// is built by vite.config.ts and is never deployed.
export default defineConfig({
  root: 'online',
  // GitHub Pages serves the site under /<repository>/.
  base: process.env.OPENMRI_BASE || '/OpenMRI/',
  publicDir: 'public',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      // Only Focus over time uses it, and that panel is not offered online.
      'next/image': path.resolve(import.meta.dirname, 'online/next-image.tsx'),
    },
  },
  define: { 'import.meta.env.VITE_OPENMRI_ONLINE': JSON.stringify('1') },
  // NiiVue and its decoders are large by nature; they load once and cache.
  build: {
    outDir: '../dist-online',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
});
