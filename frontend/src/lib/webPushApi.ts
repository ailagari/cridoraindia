import { apiFetch, authFetch, getStoredAccess } from '@/lib/api'
import { readStoredPublicLocale, translate } from '@/i18n/engine'
import { CRIDORA_PUSH_RESUBSCRIBE_MESSAGE_TYPE, CRIDORA_SHOW_LOCAL_TRAY_MESSAGE_TYPE } from '@/lib/cridoraSwMessages'
import {
  claimNativePushForLoggedInUser,
  getNativePushActive,
  isNativeFcmEnabled,
  isNativePushPermissionDenied,
  nativePushNotificationsSupported,
  nativePushSetupHint,
  openNativeNotificationSettings,
  registerNativePushSubscription,
  showTrayNotification,
} from '@/lib/nativeNotifications'

export { openNativeNotificationSettings }

async function postPushSubscribe(jsonBody: Record<string, unknown>): Promise<Response> {
  const body = { ...jsonBody, preferred_locale: readStoredPublicLocale() }
  if (getStoredAccess()) {
    return authFetch('/api/v1/push/subscribe/', { method: 'POST', jsonBody: body })
  }
  return apiFetch('/api/v1/push/subscribe/', { method: 'POST', jsonBody: body })
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
  if (nativePushNotificationsSupported()) {
    const res = await apiFetch('/api/v1/push/native-status/', { cache: 'no-store' })
    const data = (await res.json().catch(() => ({}))) as { configured?: boolean }
    if (!res.ok) {
      return { configured: false, publicKey: null }
    }
    return { configured: Boolean(data.configured), publicKey: null }
  }
  const res = await apiFetch('/api/v1/push/vapid-public-key/', { cache: 'no-store' })
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
  if (nativePushNotificationsSupported()) return true
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

/** True when this device can attempt Web Push subscribe (blocks iOS Safari tab). */
export function canSubscribeWebPush(): boolean {
  if (nativePushNotificationsSupported()) return true
  if (!pushNotificationsSupported()) return false
  if (likelyIosMobile() && !displayModeStandalone()) return false
  return true
}

/** Browser Notification API permission, or null when unavailable (Capacitor WebView). */
export function browserNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return null
  return Notification.permission
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
  const nativeHint = nativePushSetupHint()
  if (nativeHint) return nativeHint
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

/** Guidance when permission was denied and the user must fix it in OS / browser settings. */
export function pushPermissionBlockedHint(): string | null {
  if (nativePushNotificationsSupported()) {
    return 'Notifications are blocked for Cridora. Open app settings and turn on Notifications.'
  }
  if (likelyIosMobile()) {
    if (displayModeStandalone()) {
      return 'Notifications are blocked. Open Settings → Notifications → Cridora and allow alerts.'
    }
    return 'On iPhone/iPad, install the app from Safari (Share → Add to Home Screen), then allow notifications when prompted.'
  }
  return 'Notifications are blocked. In Chrome or Edge: site settings → Notifications → Allow. You can also enable them in your system notification settings.'
}

/** Short label for how tray delivery works on this device (shown in the bell). */
export function getPushDeliveryLabel(): string {
  if (nativePushNotificationsSupported()) {
    if (isNativeFcmEnabled()) {
      return 'Android app · alerts appear in your phone notification tray.'
    }
    return 'Android app · tray alerts (enable server push via google-services.json for background delivery).'
  }
  if (likelyIosMobile()) {
    if (displayModeStandalone()) {
      return 'Installed app · Web Push to your notification tray (iOS 16.4+).'
    }
    return 'Add to Home Screen from Safari to enable tray alerts on iOS.'
  }
  return 'Browser / installed PWA · Web Push to your system notification tray.'
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

/** Show a one-time confirmation in the OS notification tray after the user enables alerts. */
export async function showTrayWelcomeNotification(): Promise<void> {
  const locale = readStoredPublicLocale()
  const title = translate(locale, 'notifications.trayWelcomeTitle')
  const body = translate(locale, 'notifications.trayWelcomeBody')
  const tag = 'cridora-tray-welcome'

  if (nativePushNotificationsSupported()) {
    await showTrayNotification({
      id: `welcome-${Date.now()}`,
      title,
      body,
      link_path: '/',
    })
    return
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (browserNotificationPermission() !== 'granted') return

  const reg = await refreshServiceWorkerRegistration()
  const iconHref = new URL('/icon-192.png', window.location.origin).href
  const notifyOpts = {
    body,
    icon: iconHref,
    badge: iconHref,
    tag,
    vibrate: [120, 60, 120],
    data: { url: '/', tag },
  } as NotificationOptions

  try {
    await reg.showNotification(title, notifyOpts)
    return
  } catch {
    /* iOS installed PWA often requires the service worker context */
  }

  const controller = navigator.serviceWorker.controller
  if (controller) {
    controller.postMessage({
      type: CRIDORA_SHOW_LOCAL_TRAY_MESSAGE_TYPE,
      title,
      body,
      tag,
      url: '/',
    })
  }
}

type RegisterPushOptions = {
  /** When true, shows a confirmation alert in the device tray after subscribe succeeds. */
  confirmTray?: boolean
}

export async function registerWebPushSubscription(options?: RegisterPushOptions): Promise<void> {
  if (nativePushNotificationsSupported()) {
    await registerNativePushSubscription()
    if (options?.confirmTray) {
      await showTrayWelcomeNotification()
    }
    return
  }
  if (!canSubscribeWebPush()) {
    const hint = pushSetupHint()
    throw new Error(hint ?? 'Tray notifications are not available on this device.')
  }
  const { configured, publicKey: pub } = await fetchWebPushServerStatus()
  if (!configured || !pub) {
    throw new Error(
      'Browser alerts are not turned on for this deployment yet (missing VAPID keys on the server). Your admin can add WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY.',
    )
  }
  if (typeof Notification === 'undefined') {
    throw new Error('Browser notifications are not available in this app shell.')
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
  if (options?.confirmTray) {
    await showTrayWelcomeNotification()
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
  if (nativePushNotificationsSupported()) {
    await claimNativePushForLoggedInUser()
    return
  }
  if (!getStoredAccess()) return
  if (!pushNotificationsSupported()) return
  if (browserNotificationPermission() !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const json = sub.toJSON() as Record<string, unknown>
  const res = await authFetch('/api/v1/push/subscribe/', { method: 'POST', jsonBody: json })
  if (!res.ok) return
}

export async function getBrowserPushActive(): Promise<boolean> {
  if (nativePushNotificationsSupported()) {
    return getNativePushActive()
  }
  if (!pushNotificationsSupported()) return false
  if (browserNotificationPermission() !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}

/** Whether notification permission is denied on this device (browser or native shell). */
export async function isPushPermissionDenied(): Promise<boolean> {
  if (nativePushNotificationsSupported()) {
    return isNativePushPermissionDenied()
  }
  return browserNotificationPermission() === 'denied'
}

/** Re-subscribe when the service worker reports subscription rotation. */
export function initWebPushResubscribeListener(): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => undefined
  }
  const onMessage = (event: MessageEvent) => {
    const t = event.data && typeof event.data === 'object' ? (event.data as { type?: string }).type : null
    if (t !== CRIDORA_PUSH_RESUBSCRIBE_MESSAGE_TYPE) return
    if (browserNotificationPermission() !== 'granted') return
    void registerWebPushSubscription().catch(() => undefined)
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}
