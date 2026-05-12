import { registerSW } from 'virtual:pwa-register'

const listeners = new Set<() => void>()

export function onPwaNeedRefresh(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Call after a new service worker is ready; pass `true` to reload clients. */
export const applyPwaUpdate: (reloadPage?: boolean) => Promise<void> = registerSW({
  onNeedRefresh() {
    listeners.forEach((fn) => fn())
  },
  onOfflineReady() {},
})
