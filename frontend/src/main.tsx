import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { PwaUpdateBar } from '@/components/PwaUpdateBar'
import { applyDocumentLocale, readStoredPublicLocale } from '@/i18n/engine'
import { OFFLINE_PAGE_URL } from '@/lib/offlineFallback'
import '@/lib/pwaRegister'
import { initPlatformShellClasses } from '@/lib/platformShell'

initPlatformShellClasses()
applyDocumentLocale(readStoredPublicLocale())

/** Client-side bootstrap failures — use branded shell, not raw error text. */
function showBootFailure(message: string): void {
  console.error('[Cridora boot]', message)
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
