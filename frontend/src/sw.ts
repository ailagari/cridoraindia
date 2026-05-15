/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

import { CRIDORA_PUSH_REFRESH_MESSAGE_TYPE } from './lib/cridoraSwMessages'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown }

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

/** Required for vite-plugin-pwa / workbox-window “Refresh” (prompt mode). */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const t = event.data && typeof event.data === 'object' ? (event.data as { type?: string }).type : null
  if (t === 'SKIP_WAITING') {
    void self.skipWaiting()
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
}

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
    const text = event.data?.text()
    if (text) {
      data = { ...fallback, body: text }
    }
  }
  const title = (data.title || fallback.title || 'Cridora').trim() || 'Cridora'
  const bodyRaw = typeof data.body === 'string' ? data.body.trim() : ''
  const body = bodyRaw.length > 0 ? bodyRaw : 'Open Cridora for details.'
  const targetUrl = new URL(data.url || '/', self.location.origin).href
  const iconHref = new URL('/favicon.svg', self.location.origin).href
  const notifyOpts = {
    body,
    icon: iconHref,
    badge: iconHref,
    vibrate: [180, 80, 120],
    data: { url: targetUrl },
    tag: data.tag || fallback.tag,
  } as NotificationOptions
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, notifyOpts)
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
  const raw = event.notification.data?.url as string | undefined
  const targetUrl = new URL(raw || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
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
          return wc.focus().then(() => {
            if (typeof wc.navigate === 'function') {
              return wc.navigate(targetUrl)
            }
            return undefined
          })
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    }),
  )
})
