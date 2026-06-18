/** Preset in-app paths admins can pick for notification tap targets. */

export type NotificationTapPreset = {
  id: string
  label: string
  path: string
}

export const NOTIFICATION_TAP_PRESETS: NotificationTapPreset[] = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'gold_rates_kerala', label: 'Gold rates (Kerala)', path: '/gold-rates/kerala' },
  { id: 'gold_rates_india', label: 'Gold rates (India)', path: '/gold-rates/india' },
  { id: 'gold_calculator', label: 'Gold calculator', path: '/gold-calculator' },
  { id: 'marketplace', label: 'Marketplace', path: '/marketplace' },
  { id: 'portfolio', label: 'Portfolio (signed-in)', path: '/userdashboard?section=portfolio_overview' },
  { id: 'login', label: 'Login', path: '/login' },
]

const AUTH_REQUIRED_PREFIXES = ['/userdashboard', '/dashboard/']

export function pathRequiresAuth(path: string): boolean {
  const p = (path || '/').trim()
  if (!p.startsWith('/')) return false
  return AUTH_REQUIRED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}`))
}

export type NotificationTapPayload = {
  url?: string
  url_guest?: string
  url_authenticated?: string
}

export function resolveNotificationTapTarget(
  payload: NotificationTapPayload,
  isAuthenticated: boolean,
): string {
  const fallback = (payload.url || '/').trim() || '/'
  const guest = (payload.url_guest || fallback).trim() || fallback
  const auth = (payload.url_authenticated || fallback).trim() || fallback
  let target = isAuthenticated ? auth : guest

  if (!isAuthenticated && pathRequiresAuth(target)) {
    const next = encodeURIComponent(target)
    return `/login?next=${next}`
  }

  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const u = new URL(target)
      target = `${u.pathname}${u.search}${u.hash}`
    } catch {
      target = fallback
    }
  }

  if (!target.startsWith('/')) {
    target = `/${target}`
  }

  return target
}

export function presetIdForPath(path: string): string {
  const normalized = (path || '').trim()
  const match = NOTIFICATION_TAP_PRESETS.find((p) => p.path === normalized)
  return match?.id ?? 'custom'
}

export function pathForPresetId(id: string, customPath: string): string {
  if (id === 'custom') return customPath.trim() || '/'
  const preset = NOTIFICATION_TAP_PRESETS.find((p) => p.id === id)
  return preset?.path ?? (customPath.trim() || '/')
}

export function notificationTapRedirectPath(guest: string, authenticated: string): string {
  const g = encodeURIComponent(guest || '/')
  const a = encodeURIComponent(authenticated || guest || '/')
  return `/notification-tap?g=${g}&a=${a}`
}

export function parseNotificationTapSearch(search: string): { guest: string; authenticated: string } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const guest = decodeURIComponent(params.get('g') || '/')
  const authenticated = decodeURIComponent(params.get('a') || guest)
  return { guest, authenticated }
}
