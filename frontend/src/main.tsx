import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { PwaUpdateBar } from '@/components/PwaUpdateBar'
import { applyDocumentLocale, readStoredPublicLocale } from '@/i18n/engine'
import { OFFLINE_PAGE_URL } from '@/lib/offlineFallback'
import '@/lib/pwaRegister'
import { initPlatformShellClasses } from '@/lib/platformShell'

initPlatformShellClasses()
applyDocumentLocale(readStoredPublicLocale())

const STALE_CHUNK_RELOAD_KEY = 'cridora-stale-chunk-reload'

function isStaleAssetBootError(message: string): boolean {
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|error loading dynamically imported module|404.*\.js/i.test(
    message,
  )
}

/** Client-side bootstrap failures — use branded shell, not raw error text. */
function showBootFailure(message: string): void {
  console.error('[Cridora boot]', message)
  if (isStaleAssetBootError(message)) {
    try {
      if (!sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1')
        window.location.reload()
        return
      }
    } catch {
      /* private mode */
    }
  }
  try {
    sessionStorage.setItem(
      'cridora-offline-return',
      window.location.pathname + window.location.search,
    )
  } catch {
    /* private mode */
  }
  window.location.replace(`${OFFLINE_PAGE_URL}?mode=maintenance&boot=1`)
}

function rootStillEmpty(): boolean {
  const root = document.getElementById('root')
  if (!root) return false
  if (root.querySelector('.home-hero, .app-shell, .native-diag-bar')) return false
  return root.childElementCount === 0
}

window.addEventListener('error', (event) => {
  if (!rootStillEmpty()) return
  showBootFailure(event.message || 'Unknown startup error')
})

window.addEventListener('unhandledrejection', (event) => {
  if (!rootStillEmpty()) return
  const reason = event.reason
  showBootFailure(reason instanceof Error ? reason.message : String(reason))
})

function BootShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY)
    } catch {
      /* private mode */
    }
  }, [])
  return (
    <StrictMode>
      {children}
      <PwaUpdateBar />
    </StrictMode>
  )
}

try {
  const mount = document.getElementById('root')
  if (!mount) {
    throw new Error('Missing #root element in index.html')
  }
  createRoot(mount).render(
    <BootShell>
      <App />
    </BootShell>,
  )
} catch (error: unknown) {
  showBootFailure(error instanceof Error ? error.message : String(error))
}
