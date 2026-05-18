import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'in.cridora.app',
  appName: 'Cridora India',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#000814',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
