import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform() || import.meta.env.VITE_CAPACITOR_BUILD === 'true'

let reloadScheduled = false

function scheduleSilentReload(): void {
  if (reloadScheduled) return
  reloadScheduled = true
  window.location.reload()
}

async function noopPwaUpdate(_reloadPage?: boolean): Promise<void> {}

let applyPwaUpdateImpl: (reloadPage?: boolean) => Promise<void> = noopPwaUpdate
let pwaInitStarted = false

function ensurePwaRegistered(): void {
  if (isNative || pwaInitStarted) return
  pwaInitStarted = true

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      scheduleSilentReload()
    })
  }

  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      applyPwaUpdateImpl = registerSW({
        immediate: true,
        onNeedRefresh() {
          void applyPwaUpdateImpl(true)
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