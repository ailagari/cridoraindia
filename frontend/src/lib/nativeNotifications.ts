import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { authFetch, apiFetch, getStoredAccess } from '@/lib/api'
import { readStoredPublicLocale } from '@/i18n/engine'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import { fetchPushDeviceStatus, isDeviceStatusDeliverable } from '@/lib/pushDeviceStatus'
import type { AppNotification } from '@/lib/mockNotifications'
import type { NotificationTapPayload } from '@/lib/notificationTapTargets'

const CHANNEL_ID = 'cridora-alerts'
const CHANNEL_NAME = 'Cridora alerts'
const TRAY_NOTIFIED_KEY = 'cridora_tray_notified_ids_v1'
const TRAY_NOTIFIED_MAX = 200

/** Use FCM when the native plugin exists unless explicitly disabled at build time. */
export function isNativeFcmEnabled(): boolean {
  if (!isNativeAndroid() || !Capacitor.isPluginAvailable('PushNotifications')) return false
  return import.meta.env.VITE_FCM_ENABLED !== 'false'
}

let bridgeReady = false
let pushListenersAttached = false
let navigateHandler: ((target: string | NotificationTapPayload) => void) | null = null
let lastFcmToken: string | null = null
let tokenWaiters: Array<(token: string) => void> = []
const notifiedIds = loadNotifiedIds()

function loadNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(TRAY_NOTIFIED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    const ids = parsed.filter((x): x is string => typeof x === 'string')
    return new Set(ids.slice(-TRAY_NOTIFIED_MAX))
  } catch {
    return new Set()
  }
}

function persistNotifiedIds(): void {
  try {
    const ids = [...notifiedIds].slice(-TRAY_NOTIFIED_MAX)
    localStorage.setItem(TRAY_NOTIFIED_KEY, JSON.stringify(ids))
  } catch {
    /* private mode / quota */
  }
}

function notificationIdForItem(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return (hash % 2_000_000_000) + 1
}

async function ensureAndroidChannel(): Promise<void> {
  if (!isNativeAndroid()) return
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: CHANNEL_NAME,
    description: 'Bell alerts and account updates from Cridora',
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: 'default',
  })
}

async function pushPermissionGranted(): Promise<boolean> {
  if (!isNativeFcmEnabled()) return false
  try {
    const status = await PushNotifications.checkPermissions()
    return status.receive === 'granted'
  } catch {
    return false
  }
}

async function localPermissionGranted(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  try {
    const status = await LocalNotifications.checkPermissions()
    return status.display === 'granted'
  } catch {
    return false
  }
}

async function requestLocalPermission(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  try {
    const status = await LocalNotifications.requestPermissions()
    return status.display === 'granted'
  } catch {
    return false
  }
}

async function requestPushPermission(): Promise<boolean> {
  if (!isNativeFcmEnabled()) return false
  try {
    const status = await PushNotifications.requestPermissions()
    return status.receive === 'granted'
  } catch {
    return false
  }
}

async function postNativeSubscribe(token: string): Promise<void> {
  const jsonBody = { token, platform: 'android', preferred_locale: readStoredPublicLocale() }
  const res = getStoredAccess()
    ? await authFetch('/api/v1/push/native-subscribe/', { method: 'POST', jsonBody })
    : await apiFetch('/api/v1/push/native-subscribe/', { method: 'POST', jsonBody })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(body.detail ?? `Native subscribe failed (${res.status})`)
  }
}

function resolveFcmListenerToken(): void {
  for (const waiter of tokenWaiters) {
    if (lastFcmToken) waiter(lastFcmToken)
  }
  tokenWaiters = []
}

function waitForFcmToken(timeoutMs = 12_000): Promise<string | null> {
  if (lastFcmToken) return Promise.resolve(lastFcmToken)
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      tokenWaiters = tokenWaiters.filter((w) => w !== onToken)
      resolve(lastFcmToken)
    }, timeoutMs)
    const onToken = (token: string) => {
      window.clearTimeout(timer)
      resolve(token)
    }
    tokenWaiters.push(onToken)
  })
}

async function registerFcmToken(): Promise<void> {
  if (!isNativeFcmEnabled()) return
  await PushNotifications.register()
}

async function ensureFcmRegistered(): Promise<void> {
  if (!isNativeFcmEnabled()) return
  if (!(await pushPermissionGranted())) return
  await registerFcmToken()
  const token = await waitForFcmToken()
  if (token) {
    await postNativeSubscribe(token).catch(() => {
      /* retried on login via claimNativePushForLoggedInUser */
    })
  }
}

function attachPushListeners(): void {
  if (!isNativeFcmEnabled() || pushListenersAttached) return
  pushListenersAttached = true

  PushNotifications.addListener('registration', (token) => {
    lastFcmToken = token.value
    resolveFcmListenerToken()
    void postNativeSubscribe(token.value).catch(() => {
      /* retry on next login via claimNativePushForLoggedInUser */
    })
  })

  PushNotifications.addListener('registrationError', () => {
    resolveFcmListenerToken()
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    if (document.visibilityState !== 'visible') {
      return
    }
    const tag =
      typeof notification.data?.tag === 'string' ? notification.data.tag : 'cridora-default'
    const stableId =
      typeof notification.data?.id === 'string' ? notification.data.id : tag
    const title =
      typeof notification.data?.title === 'string' && notification.data.title.trim()
        ? notification.data.title.trim()
        : (notification.title ?? 'Cridora')
    const body =
      typeof notification.data?.body === 'string' && notification.data.body.trim()
        ? notification.data.body.trim()
        : (notification.body ?? 'Open Cridora for details.')
    const urlGuest =
      typeof notification.data?.url_guest === 'string' ? notification.data.url_guest : undefined
    const urlAuth =
      typeof notification.data?.url_authenticated === 'string'
        ? notification.data.url_authenticated
        : undefined
    const url =
      typeof notification.data?.url === 'string' ? notification.data.url : '/'
    const image =
      typeof notification.data?.image === 'string' ? notification.data.image : undefined
    void showTrayNotification({
      id: stableId,
      title,
      body,
      link_path: url,
      url_guest: urlGuest,
      url_authenticated: urlAuth,
      image_url: image,
    })
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data ?? {}
    navigateHandler?.({
      url: typeof data.url === 'string' ? data.url : '/',
      url_guest: typeof data.url_guest === 'string' ? data.url_guest : undefined,
      url_authenticated:
        typeof data.url_authenticated === 'string' ? data.url_authenticated : undefined,
    })
  })
}

function attachLocalTapListener(): void {
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action.notification.extra ?? {}
    navigateHandler?.({
      url: typeof extra.url === 'string' ? extra.url : '/',
      url_guest: typeof extra.url_guest === 'string' ? extra.url_guest : undefined,
      url_authenticated:
        typeof extra.url_authenticated === 'string' ? extra.url_authenticated : undefined,
    })
  })
}

export function setNativeNotificationNavigator(
  navigate: (target: string | NotificationTapPayload) => void,
): void {
  navigateHandler = navigate
}

export async function initNativeNotificationBridge(): Promise<void> {
  if (!isNativeAndroid() || bridgeReady) return
  bridgeReady = true
  try {
    await ensureAndroidChannel()
    attachLocalTapListener()
    if (isNativeFcmEnabled()) {
      attachPushListeners()
      if (await pushPermissionGranted()) {
        void ensureFcmRegistered()
      }
    }
  } catch {
    bridgeReady = false
  }
}

export async function registerNativePushSubscription(): Promise<void> {
  if (!isNativeAndroid()) {
    throw new Error('Native push is only available in the Android app.')
  }
  await initNativeNotificationBridge()

  if (isNativeFcmEnabled()) {
    const pushOk = await requestPushPermission()
    if (!pushOk) {
      throw new Error('Push permission was not granted.')
    }
    await registerFcmToken()
    const token = await waitForFcmToken()
    if (!token) {
      throw new Error(
        'Could not register this device for server push. Rebuild the app with google-services.json or try again.',
      )
    }
    await postNativeSubscribe(token)
    await requestLocalPermission()
    return
  }

  const localOk = await requestLocalPermission()
  if (!localOk) {
    throw new Error('Notification permission was not granted.')
  }
}

export function getNativeFcmToken(): string | null {
  return lastFcmToken
}

/** True when the user granted tray permission locally (FCM and/or local notifications). */
export async function hasNativeTrayPermission(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  if (isNativeFcmEnabled()) {
    if (await pushPermissionGranted()) return true
  }
  return localPermissionGranted()
}

export async function getNativePushActive(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  if (!isNativeFcmEnabled()) {
    return localPermissionGranted()
  }
  if (!(await pushPermissionGranted())) return false
  const token = lastFcmToken
  if (!token) return false
  const status = await fetchPushDeviceStatus({ token })
  return isDeviceStatusDeliverable(status)
}

export async function claimNativePushForLoggedInUser(): Promise<void> {
  if (!isNativeAndroid() || !getStoredAccess()) return
  await initNativeNotificationBridge()
  if (isNativeFcmEnabled()) {
    if (!(await pushPermissionGranted())) return
    if (lastFcmToken) {
      await postNativeSubscribe(lastFcmToken).catch(() => {
        /* token may refresh via registration listener */
      })
      return
    }
    await ensureFcmRegistered()
    return
  }
  if (!(await localPermissionGranted())) return
}

/**
 * Register FCM for background tray delivery (app closed / phone locked).
 * Call after login with promptIfNeeded to request permission once.
 */
export async function ensureNativeBackgroundPush(options?: { promptIfNeeded?: boolean }): Promise<void> {
  if (!isNativeAndroid()) return
  await initNativeNotificationBridge()
  if (await getNativePushActive()) return
  if (await isNativePushPermissionDenied()) return

  if (isNativeFcmEnabled()) {
    if (await pushPermissionGranted()) {
      await ensureFcmRegistered()
      return
    }
    if (options?.promptIfNeeded) {
      try {
        await registerNativePushSubscription()
      } catch {
        /* user can enable from the bell */
      }
    }
    return
  }

  if (options?.promptIfNeeded) {
    try {
      await registerNativePushSubscription()
    } catch {
      /* foreground-only fallback without google-services */
    }
  }
}

/** Mark feed ids as already shown (avoids duplicate local tray on first poll). */
export function seedTrayNotifiedIds(ids: string[]): void {
  if (!isNativeAndroid() || ids.length === 0) return
  let changed = false
  for (const id of ids) {
    if (!notifiedIds.has(id)) {
      notifiedIds.add(id)
      changed = true
    }
  }
  if (changed) persistNotifiedIds()
}

export async function showTrayNotification(item: {
  id: string
  title: string
  body: string
  link_path?: string
  url_guest?: string
  url_authenticated?: string
  image_url?: string
}): Promise<void> {
  if (!isNativeAndroid()) return
  if (!(await localPermissionGranted())) return
  if (notifiedIds.has(item.id)) return
  notifiedIds.add(item.id)
  persistNotifiedIds()
  try {
    await ensureAndroidChannel()
    const imageUrl = item.image_url?.trim()
    const hasImage = Boolean(imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')))
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdForItem(item.id),
          title: item.title,
          body: item.body,
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_cridora',
          iconColor: '#D4AF37',
          schedule: { at: new Date(Date.now() + 300) },
          extra: {
            url: item.link_path ?? '/',
            ...(item.url_guest ? { url_guest: item.url_guest } : {}),
            ...(item.url_authenticated ? { url_authenticated: item.url_authenticated } : {}),
            ...(hasImage ? { image: imageUrl } : {}),
          },
          ...(hasImage
            ? {
                largeIcon: imageUrl,
                attachments: [{ id: 'push-image', url: imageUrl! }],
              }
            : {}),
        },
      ],
    })
  } catch {
    notifiedIds.delete(item.id)
    persistNotifiedIds()
  }
}

/**
 * Local tray fallback when FCM is unavailable (no google-services).
 * When FCM is enabled, server push handles background/killed delivery.
 */
export function notifyBellFeedUpdates(prev: AppNotification[], next: AppNotification[]): void {
  if (!isNativeAndroid() || isNativeFcmEnabled()) return
  const prevIds = new Set(prev.map((x) => x.id))
  const freshUnread = next.filter((x) => !x.read && !prevIds.has(x.id))
  for (const item of freshUnread) {
    void showTrayNotification({
      id: item.id,
      title: item.title,
      body: item.body,
      link_path: item.link_path,
    })
  }
}

export function nativePushSetupHint(): string | null {
  if (!isNativeAndroid()) return null
  if (isNativeFcmEnabled()) {
    return 'Tap Enable to allow push alerts — gold rate broadcasts and account updates arrive even when the app is closed.'
  }
  return 'Tap Enable for tray alerts. Add google-services.json and rebuild for server pushes when the app is closed.'
}

export function nativePushNotificationsSupported(): boolean {
  return isNativeAndroid() && Capacitor.isPluginAvailable('LocalNotifications')
}

/** True when the user has permanently denied notification permission on the native shell. */
export async function isNativePushPermissionDenied(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  try {
    if (isNativeFcmEnabled()) {
      const status = await PushNotifications.checkPermissions()
      return status.receive === 'denied'
    }
    const status = await LocalNotifications.checkPermissions()
    return status.display === 'denied'
  } catch {
    return false
  }
}

/**
 * Opens Android application settings (user can enable Notifications for Cridora).
 * Uses package: URI (supported from the Capacitor WebView on Android).
 */
export async function openNativeNotificationSettings(): Promise<boolean> {
  if (!isNativeAndroid() || !Capacitor.isPluginAvailable('App')) return false
  try {
    const { id } = await App.getInfo()
    window.location.href = `package:${id}`
    return true
  } catch {
    return false
  }
}
