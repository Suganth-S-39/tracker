import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Brand colors for the manifest only (the OS title bar and splash screen). In-app colors live in
// src/styles/tokens.css.
const MANIFEST_THEME_COLOR = '#F5F5F7';
const MANIFEST_BACKGROUND_COLOR = '#F5F5F7';

/**
 * The security headers vercel.json sends on every response, for `vite preview`, so the CSP
 * end-to-end test and Lighthouse run against the real policy. Only the Supabase origin is swapped
 * for the one this build talks to (local Supabase is plain http, so upgrade-insecure-requests is
 * dropped for it).
 */
function productionHeaders(supabaseUrl: string | undefined): Record<string, string> {
  type Rule = { source: string; headers: { key: string; value: string }[] };
  const { headers: rules } = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: Rule[] };
  const headers = Object.fromEntries((rules.find((rule) => rule.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]));
  const csp = headers['Content-Security-Policy'];
  if (csp && supabaseUrl) {
    const origin = new URL(supabaseUrl).origin;
    const swapped = csp.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, origin);
    headers['Content-Security-Policy'] = origin.startsWith('http:') ? swapped.replace(/;\s*upgrade-insecure-requests/, '') : swapped;
  }
  return headers;
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The "Update available" prompt (phase 5) asks before activating a new version.
      registerType: 'prompt',
      // Registered from app code in phase 5, together with the update prompt.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Tracker',
        short_name: 'Tracker',
        description: 'Track income, expenses, budgets and IOUs.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: MANIFEST_THEME_COLOR,
        background_color: MANIFEST_BACKGROUND_COLOR,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Data is never cached and writes are never queued (spec section 9).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  preview: {
    port: 4173,
    strictPort: true,
    headers: productionHeaders(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL),
  },
}));
