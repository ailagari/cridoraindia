import { apiFetch, authFetch } from '@/lib/api'

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
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    await existing.unsubscribe()
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(pub),
  })
  const json = sub.toJSON()
  const res = await authFetch('/api/v1/push/subscribe/', {
    method: 'POST',
    jsonBody: json as Record<string, unknown>,
  })
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
  const res = await authFetch('/api/v1/push/unsubscribe/', {
    method: 'POST',
    jsonBody: { endpoint },
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail ?? `Unsubscribe failed (${res.status})`)
  }
  await sub.unsubscribe()
}

export async function getBrowserPushActive(): Promise<boolean> {
  if (!pushNotificationsSupported()) return false
  if (Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}
