import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { authFetch, apiFetch, getStoredAccess } from '@/lib/api'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import type { AppNotification } from '@/lib/mockNotifications'

const CHANNEL_ID = 'cridora-alerts'
const CHANNEL_NAME = 'Cridora alerts'

let bridgeReady = false
let navigateHandler: ((path: string) => void) | null = null
const notifiedIds = new Set<string>()

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
  const status = await LocalNotifications.checkPermissions()
  return status.display === 'granted'
}

async function requestLocalPermission(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  const status = await LocalNotifications.requestPermissions()
  return status.display === 'granted'
}

async function pushPermissionGranted(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  const status = await PushNotifications.checkPermissions()
  return status.receive === 'granted'
}

async function requestPushPermission(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  const status = await PushNotifications.requestPermissions()
  return status.receive === 'granted'
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
  if (!isNativeAndroid()) return
  await PushNotifications.register()
}

function attachPushListeners(): void {
  PushNotifications.addListener('registration', (token) => {
    void postNativeSubscribe(token.value).catch(() => {
      /* retry on next login */
    })
  })

  PushNotifications.addListener('registrationError', () => {
    /* FCM may be unconfigured; local notifications still work */
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const title = notification.title ?? 'Cridora'
    const body = notification.body ?? 'Open Cridora for details.'
    const url =
      typeof notification.data?.url === 'string' ? notification.data.url : '/'
    void showTrayNotification({
      id: `push-${Date.now()}`,
      title,
      body,
      link_path: url,
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
  await ensureAndroidChannel()
  attachPushListeners()
  attachLocalTapListener()
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      void LocalNotifications.removeAllDeliveredNotifications()
    }
  })
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
  const pushOk = await requestPushPermission()
  if (pushOk) {
    await registerFcmToken()
  }
}

export async function getNativePushActive(): Promise<boolean> {
  if (!isNativeAndroid()) return false
  return localPermissionGranted()
}

export async function claimNativePushForLoggedInUser(): Promise<void> {
  if (!isNativeAndroid() || !getStoredAccess()) return
  if (!(await localPermissionGranted())) return
  await initNativeNotificationBridge()
  if (await pushPermissionGranted()) {
    await registerFcmToken()
  }
}

export async function showTrayNotification(item: {
  id: string
  title: string
  body: string
  link_path?: string
}): Promise<void> {
  if (!isNativeAndroid()) return
  if (!(await localPermissionGranted())) return
  if (notifiedIds.has(item.id)) return
  notifiedIds.add(item.id)
  await ensureAndroidChannel()
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationIdForItem(item.id),
        title: item.title,
        body: item.body,
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_cridora',
        iconColor: '#D4AF37',
        extra: { url: item.link_path ?? '/' },
      },
    ],
  })
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
  return 'Android app alerts appear in your notification tray. Allow notifications when prompted.'
}

export function nativePushNotificationsSupported(): boolean {
  return isNativeAndroid() && Capacitor.isPluginAvailable('LocalNotifications')
}
