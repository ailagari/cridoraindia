import { apiFetch, authFetch, getStoredAccess } from '@/lib/api'

async function postPushSubscribe(jsonBody: Record<string, unknown>): Promise<Response> {
  if (getStoredAccess()) {
    return authFetch('/api/v1/push/subscribe/', { method: 'POST', jsonBody })
  }
  return apiFetch('/api/v1/push/subscribe/', { method: 'POST', jsonBody })
}

async function postPushUnsubscribe(endpoint: string): Promise<Response> {
  const jsonBody = { endpoint }
  if (getStoredAccess()) {
    return authFetch('/api/v1/push/unsubscribe/', { method: 'POST', jsonBody })
  }
  return apiFetch('/api/v1/push/unsubscribe/', { method: 'POST', jsonBody })
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type WebPushServerStatus = {
  configured: boolean
  publicKey: string | null
}

export async function fetchWebPushServerStatus(): Promise<WebPushServerStatus> {
  const res = await apiFetch('/api/v1/push/vapid-public-key/')
  const data = (await res.json().catch(() => ({}))) as {
    public_key?: string | null
    configured?: boolean
  }
  if (!res.ok) {
    return { configured: false, publicKey: null }
  }
  const publicKey = data.public_key ?? null
  const configured = Boolean(data.configured && publicKey)
  return { configured, publicKey }
}

export function pushNotificationsSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iPad/iPhone/iPod (excludes desktop Safari). */
export function likelyIosMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}

/** True when the PWA runs full-screen from Add to Home Screen (or similar). */
export function displayModeStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mqStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
  const mqFullscreen = window.matchMedia?.('(display-mode: fullscreen)')?.matches
  const safariStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mqStandalone || mqFullscreen || safariStandalone)
}

/**
 * Short guidance when Push API is unavailable or unlikely to work (helps iOS Add-to-HS flow).
 */
export function pushSetupHint(): string | null {
  if (typeof window === 'undefined') return null
  if (!window.isSecureContext) {
    return 'Open Cridora over HTTPS — insecure origins cannot receive push notifications.'
  }
  if (!pushNotificationsSupported() && likelyIosMobile()) {
    if (!displayModeStandalone()) {
      return 'On iPhone/iPad: open this site in Safari → Share → Add to Home Screen, then launch Cridora from the home screen icon (not the Safari tab). Web Push works only from that installed app on iOS 16.4+.'
    }
    return 'This installed app needs iOS / iPadOS 16.4 or newer for Web Push. Update the device, then tap Enable again.'
  }
  if (!pushNotificationsSupported()) {
    return 'This browser does not support Web Push. On Android use current Chrome or Edge (not a restricted WebView). Avoid private/incognito mode when subscribing.'
  }
  return null
}

async function refreshServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const reg =
    (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
  try {
    await reg.update()
  } catch {
    /* ignore transient network errors */
  }
  return navigator.serviceWorker.ready
}

export async function registerWebPushSubscription(): Promise<void> {
  const { configured, publicKey: pub } = await fetchWebPushServerStatus()
  if (!configured || !pub) {
    throw new Error(
      'Browser alerts are not turned on for this deployment yet (missing VAPID keys on the server). Your admin can add WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY.',
    )
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }
  const reg = await refreshServiceWorkerRegistration()
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    await existing.unsubscribe()
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(pub),
  })
  const json = sub.toJSON()
  const res = await postPushSubscribe(json as Record<string, unknown>)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail ?? `Subscribe failed (${res.status})`)
  }
}

export async function unregisterWebPushSubscription(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  const res = await postPushUnsubscribe(endpoint)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail ?? `Unsubscribe failed (${res.status})`)
  }
  await sub.unsubscribe()
}

/** Associate the current browser Push subscription with the logged-in account (after sign-in). */
export async function claimPushSubscriptionForLoggedInUser(): Promise<void> {
  if (!getStoredAccess()) return
  if (!pushNotificationsSupported()) return
  if (Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const json = sub.toJSON() as Record<string, unknown>
  const res = await authFetch('/api/v1/push/subscribe/', { method: 'POST', jsonBody: json })
  if (!res.ok) return
}

export async function getBrowserPushActive(): Promise<boolean> {
  if (!pushNotificationsSupported()) return false
  if (Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}
