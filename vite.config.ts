/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // The app registers the worker itself (src/app/pwa.ts) so it can show a
      // controlled "update available" prompt instead of reloading silently.
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: '/',
        name: 'NutriLedger',
        short_name: 'NutriLedger',
        description:
          'Nutrition, measured clearly. Offline-first food diary, energy calculator and progress tracker. Your records stay on your device.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#245B43',
        background_color: '#F7F7F2',
        lang: 'en',
        categories: ['health', 'fitness', 'food', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache only the built app shell: hashed JS/CSS, HTML, icons and fonts.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // SPA navigation fallback so every route opens offline once cached.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/assets\//, /^\/icons\//],
        cleanupOutdatedCaches: true,
        // Never skip waiting automatically: the user decides when to reload into
        // a new version, so an open tab never mixes old and new chunks.
        skipWaiting: false,
        // Claim the page on first install so lazy route chunks are served from
        // the precache even if the connection drops before the next reload.
        // Updates still wait for the user (skipWaiting: false).
        clientsClaim: true,
        // No runtimeCaching entries on purpose: Gemini API calls (a different
        // origin) are never intercepted or cached by the service worker.
        runtimeCaching: [],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Once the Workbox service worker controls the page, Chromium discards
    // <link rel="modulepreload"> hints for SW-served chunks ("cross-world
    // service worker resource mismatch"), wasting a network request per chunk
    // on every repeat visit and failing noisily offline. Chunks come from the
    // precache after the first visit, so preloading only helped visit one.
    modulePreload: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    testTimeout: 15000,
  },
});
