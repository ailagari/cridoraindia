import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { PwaUpdateBar } from '@/components/PwaUpdateBar'
import '@/lib/pwaRegister'

function showBootError(message: string): void {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100vh;padding:1.25rem;font-family:Inter,system-ui,sans-serif;background:#000814;color:#e8e8e8;">
      <h1 style="font-size:1.1rem;margin:0 0 0.75rem;color:#d4af37;">Cridora failed to start</h1>
      <p style="margin:0;line-height:1.5;font-size:0.9rem;word-break:break-word;">${message}</p>
    </div>
  `
}

window.addEventListener('error', (event) => {
  const root = document.getElementById('root')
  if (!root || root.querySelector('.home-hero, .app-shell, .native-diag-bar')) return
  if (root.textContent?.includes('Loading Cridora')) {
    showBootError(event.message || 'Unknown startup error')
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const root = document.getElementById('root')
  if (!root || root.querySelector('.home-hero, .app-shell, .native-diag-bar')) return
  if (root.textContent?.includes('Loading Cridora')) {
    const reason = event.reason
    showBootError(reason instanceof Error ? reason.message : String(reason))
  }
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
  showBootError(error instanceof Error ? error.message : String(error))
}
