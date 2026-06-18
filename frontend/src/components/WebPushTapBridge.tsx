import { useWebPushTapBridge } from '@/hooks/useWebPushTapBridge'

/** Listens for service worker notification tap messages (Web Push / PWA). */
export function WebPushTapBridge() {
  useWebPushTapBridge()
  return null
}
