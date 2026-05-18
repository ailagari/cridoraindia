import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
  const env = loadEnv(mode, process.cwd(), '')
  const isCapacitorBuild = env.VITE_CAPACITOR_BUILD === 'true'

  return {
    base: './',
    build: {
      /** Capacitor WebView fails to load module scripts tagged crossorigin. */
      modulePreload: false,
      /** Older Android WebViews (common on budget phones) — es2017 ≈ Chrome 58+. */
      target: isCapacitorBuild ? 'es2017' : 'modules',
    },
    plugins: [
      react(),
      stripCrossoriginForCapacitor(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Cridora India',
          short_name: 'Cridora',
          description: 'Gold savings, redemption, and verified jeweller infrastructure for India.',
          theme_color: '#000814',
          background_color: '#000814',
          display: 'standalone',
          id: '/',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png}'],
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
