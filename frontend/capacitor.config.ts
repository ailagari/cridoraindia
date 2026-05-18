import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { CapacitorConfig } from '@capacitor/cli'

function readProductionApiBase(): string {
  const envPath = join(process.cwd(), '.env.production.local')
  if (!existsSync(envPath)) return ''
  const match = readFileSync(envPath, 'utf8').match(/^VITE_API_BASE_URL=(.+)$/m)
  return match?.[1]?.trim().replace(/\/$/, '') ?? ''
}

const liveUrl = readProductionApiBase()
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
