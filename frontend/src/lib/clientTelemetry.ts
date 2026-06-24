import { apiFetch, authFetch, getStoredAccess } from '@/lib/api'
import { displayModeStandalone } from '@/lib/webPushApi'
import { isNativePlatform } from '@/lib/capacitorPlatform'
import { readStoredPublicLocale } from '@/i18n/engine'

const CLIENT_ID_KEY = 'cridora_client_id'

function randomClientId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY)
    if (existing && existing.length >= 8) return existing
    const next = randomClientId()
    localStorage.setItem(CLIENT_ID_KEY, next)
    return next
  } catch {
    return randomClientId()
  }
}

export function detectClientSurface(): 'browser' | 'pwa' | 'native_android' | 'native_ios' {
  if (isNativePlatform()) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    if (/iPhone|iPad|iPod/i.test(ua)) return 'native_ios'
    return 'native_android'
  }
  if (displayModeStandalone()) return 'pwa'
  return 'browser'
}

export function readPushPermission(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  const p = Notification.permission
  if (p === 'granted' || p === 'denied' || p === 'default') return p
  return 'default'
}

export async function postClientHeartbeat(opts?: { pushRegistered?: boolean }): Promise<void> {
  const client_id = getOrCreateClientId()
  const jsonBody = {
    client_id,
    surface: detectClientSurface(),
    push_permission: readPushPermission(),
    push_registered: Boolean(opts?.pushRegistered),
    preferred_locale: readStoredPublicLocale(),
  }
  const fetcher = getStoredAccess() ? authFetch : apiFetch
  await fetcher('/api/v1/client/heartbeat/', { method: 'POST', jsonBody }).catch(() => undefined)
}

export async function postPwaInstalled(): Promise<void> {
  const client_id = getOrCreateClientId()
  const fetcher = getStoredAccess() ? authFetch : apiFetch
  await fetcher('/api/v1/client/pwa-installed/', {
    method: 'POST',
    jsonBody: { client_id },
  }).catch(() => undefined)
}
