/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/trainer/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Tartanleaf Ham Exam Trainer',
        short_name: 'Ham Trainer',
        description:
          'Offline-first study trainer for US and Canadian amateur radio license exams, by Tartanleaf.',
        start_url: '/trainer/',
        scope: '/trainer/',
        display: 'standalone',
        background_color: '#F4EFE5',
        theme_color: '#2F5E5B',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,jpg,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
