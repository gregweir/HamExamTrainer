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
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache = the app shell, every SHIPPED bank's chunk (the bank data
        // rides the entry chunks) and every figure emitted into dist (today:
        // us-tech's). PARKED banks are deliberately absent from the build.
        globPatterns: ['**/*.{js,css,html,ico,jpg,png,svg,woff2}'],
        // Guard against a stray oversized asset ballooning the precache.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Offline navigations to any /trainer/ subpath fall back to the shell.
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    // IndexedDB is absent in happy-dom: fake-indexeddb implements it for tests.
    setupFiles: ['fake-indexeddb/auto'],
  },
});
