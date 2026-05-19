import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { authFetch, apiFetch, getStoredAccess } from '@/lib/api'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import type { AppNotification } from '@/lib/mockNotifications'

const CHANNEL_ID = 'cridora-alerts'
const CHANNEL_NAME = 'Cridora alerts'
const TRAY_NOTIFIED_KEY = 'cridora_tray_notified_ids_v1'

/** Use FCM when the native plugin exists unless explicitly disabled at build time. */
function isFcmEnabled(): boolean {
  if (!isNativeAndroid() || !Capacitor.isPluginAvailable('PushNotifications')) return false
  return import.meta.env.VITE_FCM_ENABLED !== 'false'
}

let bridgeReady = false
let pushListenersAttached = false
let navigateHandler: ((path: string) => void) | null = null
let lastFcmToken: string | null = null
const notifiedIds = loadNotifiedIds()

function loadNotifiedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TRAY_NOTIFIED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function persistNotifiedIds(): void {
  try {
    sessionStorage.setItem(TRAY_NOTIFIED_KEY, JSON.stringify([...notifiedIds]))
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
  if (!isFcmEnabled()) return false
  try {
    const status = await PushNotifications.requestPermissions()
    return status.receive === 'granted'
  } catch {
    return false
  }
}

async function postNativeSubscribe(token: string): Promise<void> {
  const jsonBody = { token, platform: 'android' }
  const res = getStoredAccess()
    ? await authFetch('/api/v1/push/native-subscribe/', { method: 'POST', jsonBody })
    : await apiFetch('/api/v1/push/native-subscribe/', { method: 'POST', jsonBody })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(body.detail ?? `Native subscribe failed (${res.status})`)
  }
}

async function registerFcmToken(): Promise<void> {
  if (!isFcmEnabled()) return
  await PushNotifications.register()
}

async function ensureFcmRegistered(): Promise<void> {
  if (!isFcmEnabled()) return
  if (!(await localPermissionGranted())) return
  await requestPushPermission()
  try {
    await registerFcmToken()
  } catch {
    /* google-services.json missing or FCM misconfigured */
  }
}

function attachPushListeners(): void {
  if (!isFcmEnabled() || pushListenersAttached) return
  pushListenersAttached = true

  PushNotifications.addListener('registration', (token) => {
    lastFcmToken = token.value
    void postNativeSubscribe(token.value).catch(() => {
      /* retry on next login via claimNativePushForLoggedInUser */
    })
  })

  PushNotifications.addListener('registrationError', () => {
    /* FCM misconfigured */
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const title = notification.title ?? 'Cridora'
    const body = notification.body ?? 'Open Cridora for details.'
    const url =
      typeof notification.data?.url === 'string' ? notification.data.url : '/'
    const image =
      typeof notification.data?.image === 'string' ? notification.data.image : undefined
    void showTrayNotification({
      id: `push-${Date.now()}`,
      title,
      body,
      link_path: url,
      image_url: image,
    })
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url =
      typeof action.notification.data?.url === 'string'
        ? action.notification.data.url
        : '/'
    navigateHandler?.(url)
  })
}

function attachLocalTapListener(): void {
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const url =
      typeof action.notification.extra?.url === 'string'
        ? action.notification.extra.url
        : '/'
    navigateHandler?.(url)
  })
}

export function setNativeNotificationNavigator(navigate: (path: string) => void): void {
  navigateHandler = navigate
}

export async function initNativeNotificationBridge(): Promise<void> {
  if (!isNativeAndroid() || bridgeReady) return
  bridgeReady = true
  try {
    await ensureAndroidChannel()
    attachLocalTapListener()
    if (isFcmEnabled()) {
      attachPushListeners()
      void ensureFcmRegistered()
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
  const localOk = await requestLocalPermission()
  if (!localOk) {
    throw new Error('Notification permission was not granted.')
  }
  await ensureFcmRegistered()
}

export async function getNativePushActive(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  return localPermissionGranted()
}

export async function claimNativePushForLoggedInUser(): Promise<void> {
  if (!isNativeAndroid() || !getStoredAccess()) return
  if (!(await localPermissionGranted())) return
  await initNativeNotificationBridge()
  if (lastFcmToken) {
    await postNativeSubscribe(lastFcmToken).catch(() => {
      /* FCM may re-fire registration after ensureFcmRegistered */
    })
  }
  await ensureFcmRegistered()
}

export async function showTrayNotification(item: {
  id: string
  title: string
  body: string
  link_path?: string
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
          extra: { url: item.link_path ?? '/', ...(hasImage ? { image: imageUrl } : {}) },
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

export function notifyBellFeedUpdates(prev: AppNotification[], next: AppNotification[]): void {
  if (!isNativeAndroid()) return
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
  if (isFcmEnabled()) {
    return 'Tap Enable in the bell to allow tray alerts and register for server pushes (FCM).'
  }
  return 'Tap Enable in the bell to allow tray alerts. Add google-services.json and rebuild for server pushes.'
}

export function nativePushNotificationsSupported(): boolean {
  return isNativeAndroid() && Capacitor.isPluginAvailable('LocalNotifications')
}
