/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

import {
  CRIDORA_PUSH_REFRESH_MESSAGE_TYPE,
  CRIDORA_PUSH_RESUBSCRIBE_MESSAGE_TYPE,
  CRIDORA_SHOW_LOCAL_TRAY_MESSAGE_TYPE,
} from './lib/cridoraSwMessages'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown }

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

/** Required for vite-plugin-pwa / workbox-window “Refresh” (prompt mode). */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : null
  const t = data?.type
  if (t === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }
  if (t === CRIDORA_SHOW_LOCAL_TRAY_MESSAGE_TYPE) {
    const title = typeof data?.title === 'string' ? data.title.trim() : 'Cridora'
    const body =
      typeof data?.body === 'string' && data.body.trim()
        ? data.body.trim()
        : 'Open Cridora for details.'
    const tag = typeof data?.tag === 'string' ? data.tag : 'cridora-local-tray'
    const url = typeof data?.url === 'string' ? data.url : '/'
    const iconHref = new URL('/icon-192.png', self.location.origin).href
    const targetUrl = new URL(url, self.location.origin).href
    event.waitUntil(
      self.registration.showNotification(title || 'Cridora', {
        body,
        icon: iconHref,
        badge: iconHref,
        tag,
        vibrate: [120, 60, 120],
        renotify: true,
        requireInteraction: false,
        data: { url: targetUrl, tag },
      } as NotificationOptions),
    )
  }
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim())
})

type PushPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
  image?: string
  id?: string
}

async function postTrayAck(body: Record<string, string>): Promise<void> {
  try {
    await fetch('/api/v1/push/ack/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    /* analytics only */
  }
}

self.addEventListener('pushsubscriptionchange', (event: Event) => {
  const ev = event as ExtendableEvent
  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const payload = { type: CRIDORA_PUSH_RESUBSCRIBE_MESSAGE_TYPE }
      for (const c of clientList) {
        try {
          c.postMessage(payload)
        } catch {
          /* ignore */
        }
      }
    }),
  )
})

self.addEventListener('push', (event: PushEvent) => {
  const fallback: PushPayload = {
    title: 'Cridora',
    body: '',
    url: '/',
    tag: 'cridora-default',
  }
  let data: PushPayload = { ...fallback }
  try {
    if (event.data) {
      const parsed = event.data.json() as PushPayload
      data = { ...fallback, ...parsed }
    }
  } catch {
    try {
      const text = event.data?.text()
      if (text) {
        data = { ...fallback, body: text }
      }
    } catch {
      /* use fallback payload */
    }
  }
  const title = (data.title || fallback.title || 'Cridora').trim() || 'Cridora'
  const bodyRaw = typeof data.body === 'string' ? data.body.trim() : ''
  const body = bodyRaw.length > 0 ? bodyRaw : 'Open Cridora for details.'
  const targetUrl = new URL(data.url || '/', self.location.origin).href
  const iconHref = new URL('/icon-192.png', self.location.origin).href
  const imageRaw = typeof data.image === 'string' ? data.image.trim() : ''
  const imageHref =
    imageRaw.startsWith('http://') || imageRaw.startsWith('https://')
      ? imageRaw
      : imageRaw.startsWith('/')
        ? new URL(imageRaw, self.location.origin).href
        : null
  const tag = data.tag || fallback.tag || 'cridora-default'
  const notificationId = typeof data.id === 'string' ? data.id : ''
  const notifyOpts = {
    body,
    icon: imageHref || iconHref,
    badge: iconHref,
    vibrate: [180, 80, 120],
    renotify: true,
    requireInteraction: false,
    data: { url: targetUrl, tag, notification_id: notificationId },
    tag,
    ...(imageHref ? { image: imageHref } : {}),
  } as NotificationOptions
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, notifyOpts)
      } catch {
        await self.registration.showNotification('Cridora', {
          body: 'Open Cridora for details.',
          icon: iconHref,
          badge: iconHref,
          tag: 'cridora-fallback',
          data: { url: targetUrl, tag: 'cridora-fallback' },
        } as NotificationOptions)
      }
      if (notificationId) {
        await postTrayAck({
          event: 'tray_delivered',
          notification_id: notificationId,
          tag,
        })
      }
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const payload = { type: CRIDORA_PUSH_REFRESH_MESSAGE_TYPE }
      for (const c of clientList) {
        try {
          c.postMessage(payload)
        } catch {
          /* ignore */
        }
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const nd = event.notification.data as { url?: string; tag?: string; notification_id?: string } | undefined
  const raw = nd?.url
  const targetUrl = new URL(raw || '/', self.location.origin).href
  const tag = typeof nd?.tag === 'string' ? nd.tag : ''
  const notificationId = typeof nd?.notification_id === 'string' ? nd.notification_id : ''
  event.waitUntil(
    (async () => {
      if (notificationId) {
        await postTrayAck({
          event: 'tray_clicked',
          notification_id: notificationId,
          tag: tag || 'cridora-default',
        })
      }
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const payload = { type: CRIDORA_PUSH_REFRESH_MESSAGE_TYPE }
      for (const c of clientList) {
        try {
          c.postMessage(payload)
        } catch {
          /* ignore */
        }
      }
      for (const c of clientList) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          const wc = c as WindowClient & { navigate?: (u: string) => Promise<unknown> }
          await wc.focus()
          if (typeof wc.navigate === 'function') {
            await wc.navigate(targetUrl)
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
