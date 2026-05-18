/** @param {string} name */
function fail(name) {
  console.error(`\n[android:check] Missing ${name}.`)
  console.error('  Copy frontend/.env.production.local.example → frontend/.env.production.local')
  console.error('  Set VITE_API_BASE_URL to your live backend URL, then rebuild.\n')
  process.exit(1)
}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(root, '..', '.env.production.local')
const examplePath = path.join(root, '..', '.env.production.local.example')

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath)
    console.log('[android:check] Created .env.production.local from example.')
  } else {
    fail('.env.production.local')
  }
}

const envText = fs.readFileSync(envPath, 'utf8')
const match = envText.match(/^VITE_API_BASE_URL=(.+)$/m)
const apiBase = match?.[1]?.trim() ?? ''

if (!apiBase || apiBase.includes('your-service')) {
  fail('VITE_API_BASE_URL in .env.production.local')
}

console.log(`[android:check] API base: ${apiBase}`)
if (apiBase.includes('cridora.in') && !apiBase.includes('railway.app')) {
  console.warn('[android:check] Using cridora.in — if blank on device, set Railway URL in .env.production.local')
}
console.log('[android:check] Capacitor will load live site:', apiBase || '(bundled dist only)')

const localProps = path.join(root, '..', 'android', 'local.properties')
if (!fs.existsSync(localProps)) {
  console.warn('[android:check] android/local.properties missing — Gradle needs sdk.dir (see local.properties.example).')
}
