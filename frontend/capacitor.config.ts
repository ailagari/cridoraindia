import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { CapacitorConfig } from '@capacitor/cli'

function readEnvFile(filename: string): Record<string, string> {
  const envPath = join(process.cwd(), filename)
  if (!existsSync(envPath)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

function readProductionApiBase(): string {
  return readEnvFile('.env.production.local').VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
}

const capacitorEnv = readEnvFile('.env.capacitor')
const useLiveWebView = capacitorEnv.VITE_CAPACITOR_LIVE_WEBVIEW === 'true'
const liveUrl = useLiveWebView ? readProductionApiBase() : ''
const liveHost = liveUrl ? new URL(liveUrl).hostname : ''

const config: CapacitorConfig = {
  appId: 'in.cridora.app',
  appName: 'Cridora India',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#000814',
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_cridora',
      iconColor: '#D4AF37',
    },
  },
  server: {
    androidScheme: 'https',
    ...(liveUrl
      ? {
          url: liveUrl,
          cleartext: false,
          allowNavigation: [liveHost],
        }
      : {}),
  },
}

export default config
