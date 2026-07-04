/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'

import {
  CRIDORA_PUSH_REFRESH_MESSAGE_TYPE,
  CRIDORA_PUSH_RESUBSCRIBE_MESSAGE_TYPE,
  CRIDORA_SHOW_LOCAL_TRAY_MESSAGE_TYPE,
} from './lib/cridoraSwMessages'
import {
  isNavigationRequest,
  OFFLINE_PAGE_URL,
  shouldShowMaintenancePage,
} from './lib/offlineFallback'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown }

const NAVIGATION_TIMEOUT_MS = 12000

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

async function serveOfflineShell(): Promise<Response> {
  const cached = await matchPrecache(OFFLINE_PAGE_URL)
  if (cached) return cached
  return Response.error()
}

/** Navigation: network-first with offline / maintenance shell when origin is unreachable. */
registerRoute(
  ({ request }) => isNavigationRequest(request) && !request.url.includes(OFFLINE_PAGE_URL),
  async ({ request }) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS)
      const response = await fetch(request, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (shouldShowMaintenancePage(response)) {
        const offline = await serveOfflineShell()
        if (offline.type !== 'error') return offline
      }
      return response
    } catch {
      const offline = await serveOfflineShell()
      if (offline.type !== 'error') return offline
      throw new Error('offline shell missing from precache')
    }
  },
)

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const offline = await serveOfflineShell()
    if (offline.type !== 'error') return offline
  }
  return Response.error()
})

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting())
})

/** Required for vite-plugin-pwa / workbox-window update flow. */
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
  url_guest?: string
  url_authenticated?: string
  tag?: string
  image?: string
  id?: string
}

function relativeInAppPath(raw: string | undefined, fallback = '/'): string {
  const value = (raw || fallback).trim() || fallback
  try {
    const u = new URL(value, self.location.origin)
    return `${u.pathname}${u.search}${u.hash}` || '/'
  } catch {
    return value.startsWith('/') ? value : `/${value}`
  }
}

function notificationTapResolverUrl(guestPath: string, authPath: string): string {
  const g = encodeURIComponent(guestPath)
  const a = encodeURIComponent(authPath)
  return new URL(`/notification-tap?g=${g}&a=${a}`, self.location.origin).href
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
  const guestPath = relativeInAppPath(data.url_guest, data.url || '/')
  const authPath = relativeInAppPath(data.url_authenticated, data.url || guestPath)
  const targetUrl = notificationTapResolverUrl(guestPath, authPath)
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
    data: {
      url: targetUrl,
      url_guest: guestPath,
      url_authenticated: authPath,
      tag,
      notification_id: notificationId,
    },
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
  const nd = event.notification.data as
    | { url?: string; url_guest?: string; url_authenticated?: string; tag?: string; notification_id?: string }
    | undefined
  const guestPath = relativeInAppPath(nd?.url_guest, nd?.url || '/')
  const authPath = relativeInAppPath(nd?.url_authenticated, nd?.url || guestPath)
  const targetUrl = notificationTapResolverUrl(guestPath, authPath)
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
