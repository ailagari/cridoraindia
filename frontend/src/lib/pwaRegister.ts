import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform() || import.meta.env.VITE_CAPACITOR_BUILD === 'true'

const listeners = new Set<() => void>()

export function onPwaNeedRefresh(cb: () => void): () => void {
  if (isNative) return () => {}
  listeners.add(cb)
  return () => listeners.delete(cb)
}

async function noopPwaUpdate(_reloadPage?: boolean): Promise<void> {}

let applyPwaUpdateImpl: (reloadPage?: boolean) => Promise<void> = noopPwaUpdate
let pwaInitStarted = false

function ensurePwaRegistered(): void {
  if (isNative || pwaInitStarted) return
  pwaInitStarted = true
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      applyPwaUpdateImpl = registerSW({
        onNeedRefresh() {
          listeners.forEach((fn) => fn())
        },
        onOfflineReady() {},
      })
    })
    .catch(() => {
      pwaInitStarted = false
    })
}

if (!isNative) {
  ensurePwaRegistered()
}

/** Call after a new service worker is ready; pass `true` to reload clients. */
export async function applyPwaUpdate(reloadPage?: boolean): Promise<void> {
  if (isNative) return
  ensurePwaRegistered()
  await applyPwaUpdateImpl(reloadPage)
}
