import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    // Progressive Web App layer: generates a Workbox service worker that
    // precaches the built app shell so the game opens offline, and keeps
    // clients on the latest deploy automatically.
    VitePWA({
      // Ship the newest build to every open client without a manual cache
      // clear — the SW updates itself and reloads on next navigation.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // The hand-authored public/manifest.webmanifest (linked from index.html)
      // stays the single source of truth — the plugin only builds the service
      // worker, it does NOT generate or inject a second manifest.
      manifest: false,
      // Precache the static brand/icon assets that live in public/ alongside
      // the hashed build output (globPatterns already covers hashed JS/CSS).
      includeAssets: [
        'icons/*.png',
        'icons/*.svg',
        'social-preview.png',
        'manifest.webmanifest',
      ],
      workbox: {
        // App shell: every hashed build asset + the entry HTML. Precaching
        // these is what lets the game boot with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // SPA fallback: any offline navigation resolves to the cached shell.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Runtime-cache the Google Fonts stylesheet + font files so the
        // Space Grotesk face survives offline after the first online visit
        // (the app degrades to a system font without it, but this keeps the
        // installed look intact). Never touches Supabase/API traffic.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Let the service worker run under `vite dev` too, so offline behaviour
      // can be verified without a separate production build.
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  resolve: {
    // Force a single React instance so Vite's dep pre-bundling doesn't hand
    // @vercel/analytics/react its own copy (causes "Invalid hook call").
    dedupe: ['react', 'react-dom'],
    alias: {
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  },
})
