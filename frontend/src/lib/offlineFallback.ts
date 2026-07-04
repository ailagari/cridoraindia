/** Standalone offline / maintenance shell served by the service worker. */
export const OFFLINE_PAGE_URL = '/offline.html'

/** Direct Railway host — use when custom domain (Cloudflare) routing fails. */
export const RAILWAY_PUBLIC_ORIGIN = 'https://cridoraindia-production.up.railway.app'

/** HTTP statuses that mean the origin is down — show maintenance shell instead. */
export const MAINTENANCE_STATUS_CODES = new Set([502, 503, 504, 521, 522, 523])

export function isNavigationRequest(request: Request): boolean {
  return request.mode === 'navigate'
}

export function shouldShowMaintenancePage(response: Response): boolean {
  return MAINTENANCE_STATUS_CODES.has(response.status)
}
