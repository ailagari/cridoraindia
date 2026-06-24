import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { CAPACITOR_BOOT_SPLASH_HTML } from './src/lib/capacitorBootSplashHtml'

/** Shows glowing logo in index.html before the JS bundle parses (Android WebView). */
function injectCapacitorBootSplash(): Plugin {
  return {
    name: 'inject-capacitor-boot-splash',
    transformIndexHtml(html) {
      return html.replace(
        '<div id="root"></div>',
        `${CAPACITOR_BOOT_SPLASH_HTML}\n    <div id="root"></div>`,
      )
    },
  }
}

/** Capacitor Android WebView rejects module scripts with crossorigin on local assets. */
function stripCrossoriginForCapacitor(): Plugin {
  return {
    name: 'strip-crossorigin-for-capacitor',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/g, '')
    },
  }
}

export default defineConfig(({ mode }) => {
  const modeEnv = loadEnv(mode, process.cwd(), '')
  const productionEnv = mode === 'capacitor' ? loadEnv('production', process.cwd(), '') : {}
  const env = mode === 'capacitor' ? { ...productionEnv, ...modeEnv } : modeEnv
  const isCapacitorBuild = env.VITE_CAPACITOR_BUILD === 'true'
  const liveWebView = env.VITE_CAPACITOR_LIVE_WEBVIEW === 'true'
  const apiBase = (env.VITE_API_BASE_URL ?? '').trim()

  if (mode === 'capacitor' && isCapacitorBuild && !liveWebView && !apiBase) {
    throw new Error(
      'VITE_API_BASE_URL is required for Android APK builds. ' +
        'Set it in frontend/.env.production.local (use the same backend URL as the browser), ' +
        'then run: npm run android:apk:debug',
    )
  }

  const viteEnvDefines =
    mode === 'capacitor'
      ? Object.fromEntries(
          Object.entries(env)
            .filter(([key]) => key.startsWith('VITE_'))
            .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
        )
      : {}

  return {
    /** Relative base breaks BrowserRouter on hard refresh (e.g. /dashboard/admin → ./assets → 404). */
    base: isCapacitorBuild ? './' : '/',
    define: viteEnvDefines,
    build: {
      /** Capacitor WebView fails to load module scripts tagged crossorigin. */
      modulePreload: false,
      /** Older Android WebViews (common on budget phones) — es2017 ≈ Chrome 58+. */
      target: isCapacitorBuild ? 'es2017' : 'modules',
    },
    plugins: [
      react(),
      ...(isCapacitorBuild ? [injectCapacitorBootSplash()] : []),
      stripCrossoriginForCapacitor(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'og-preview.png', 'apple-touch-icon.png', 'icons/icon-192-mask.png', 'icons/icon-512-mask.png', 'offline.html'],
        manifest: {
          name: 'Cridora',
          short_name: 'Cridora',
          description: 'Digital gold portfolio, customer engagement & modernization platform for jewellers in India.',
          theme_color: '#07090f',
          background_color: '#07090f',
          display: 'standalone',
          id: '/',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-192-mask.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/icon-512-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          /** Do not precache index.html — stale shell after deploy references deleted hashed JS. */
          globPatterns: ['**/*.{js,css,ico,svg,png}'],
          globIgnores: ['**/index.html'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
  }
})
