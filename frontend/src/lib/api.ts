import { readStoredPublicLocale } from '@/i18n/engine'
import { isNativePlatform } from '@/lib/capacitorPlatform'

const rawBase = import.meta.env.VITE_API_BASE_URL ?? ''

export function getApiBaseUrl(): string {
  return rawBase.replace(/\/$/, '')
}

export function isNativeApiMisconfigured(): boolean {
  return isNativePlatform() && !getApiBaseUrl()
}

export function nativeApiConfigError(): string {
  return (
    'This app build has no API server configured. Rebuild the APK with VITE_API_BASE_URL ' +
    'in frontend/.env.production.local (same backend URL you use in the browser), then run npm run android:apk:debug.'
  )
}

export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path
  const base = getApiBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

function assertApiReachable(): void {
  if (isNativeApiMisconfigured()) {
    throw new Error(nativeApiConfigError())
  }
}

export function formatFetchError(err: unknown): string {
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) {
      const base = getApiBaseUrl()
      if (base) {
        return `Cannot reach the server (${base}). Check mobile data/Wi‑Fi and try again.`
      }
      return nativeApiConfigError()
    }
  }
  if (err instanceof Error && err.message) return err.message
  return 'Network request failed.'
}

export function getStoredAccess(): string | null {
  return localStorage.getItem('access_token')
}

export function getStoredRefresh(): string | null {
  return localStorage.getItem('refresh_token')
}

export function storeTokens(access: string, refresh: string): void {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

export function clearTokens(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('cridora_user')
}

type Json = Record<string, unknown>

function withLocaleHeaders(headers: Headers): Headers {
  const h = new Headers(headers)
  const locale = readStoredPublicLocale()
  h.set('Accept-Language', locale === 'ml' ? 'ml,en;q=0.9' : 'en,ml;q=0.8')
  h.set('X-Cridora-Locale', locale)
  return h
}

/** Public / unauthenticated JSON requests */
export async function apiFetch(
  path: string,
  init: RequestInit & { jsonBody?: Json } = {},
): Promise<Response> {
  assertApiReachable()
  const { jsonBody, headers, ...rest } = init
  const h = withLocaleHeaders(new Headers(headers))
  const body =
    jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body ?? undefined
  if (jsonBody !== undefined && !h.has('Content-Type')) {
    h.set('Content-Type', 'application/json')
  }
  try {
    return await fetch(apiUrl(path), { ...rest, body, headers: h })
  } catch (err) {
    throw new Error(formatFetchError(err))
  }
}

async function refreshTokens(): Promise<string | null> {
  const refresh = getStoredRefresh()
  if (!refresh) return null
  const refr = await fetch(apiUrl('/api/v1/auth/token/refresh/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  const data = (await refr.json().catch(() => ({}))) as {
    access?: string
    refresh?: string
  }
  if (!refr.ok || !data.access) {
    clearTokens()
    return null
  }
  storeTokens(data.access, data.refresh ?? refresh)
  return data.access
}

/** Authenticated requests with JWT refresh on 401 */
export async function authFetch(
  path: string,
  init: RequestInit & { jsonBody?: Json } = {},
): Promise<Response> {
  const { jsonBody, headers: hdr, ...rest } = init
  const body =
    jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body ?? undefined

  const makeHeaders = (access: string) => {
    const h = withLocaleHeaders(new Headers(hdr))
    if (jsonBody !== undefined && !h.has('Content-Type')) {
      h.set('Content-Type', 'application/json')
    }
    h.set('Authorization', `Bearer ${access}`)
    return h
  }

  assertApiReachable()

  const run = async (access: string) => {
    try {
      return await fetch(apiUrl(path), {
        ...rest,
        body,
        headers: makeHeaders(access),
      })
    } catch (err) {
      throw new Error(formatFetchError(err))
    }
  }

  let access = getStoredAccess()
  if (!access) {
    throw new Error('Not signed in')
  }
  let res = await run(access)
  if (res.status !== 401) {
    return res
  }
  const next = await refreshTokens()
  if (!next) {
    return res
  }
  return run(next)
}

export async function authUpload(
  path: string,
  formData: FormData,
  method = 'POST',
): Promise<Response> {
  const makeHeaders = (access: string) => {
    const h = new Headers()
    h.set('Authorization', `Bearer ${access}`)
    return h
  }
  const run = (access: string) =>
    fetch(apiUrl(path), { method, headers: makeHeaders(access), body: formData })

  let access = getStoredAccess()
  if (!access) {
    throw new Error('Not signed in')
  }
  let res = await run(access)
  if (res.status !== 401) {
    return res
  }
  const next = await refreshTokens()
  if (!next) {
    return res
  }
  return run(next)
}
