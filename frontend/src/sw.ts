/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

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
  const targetUrl = new URL(data.url || '/', self.location.origin).href
  event.waitUntil(
    self.registration.showNotification(data.title || fallback.title!, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: targetUrl },
      tag: data.tag || fallback.tag,
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const raw = event.notification.data?.url as string | undefined
  const targetUrl = new URL(raw || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
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
