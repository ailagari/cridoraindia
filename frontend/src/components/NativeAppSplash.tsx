import { useEffect, useRef, useState } from 'react'
import { CridoraLogo } from '@/components/CridoraLogo'
import { useAuth } from '@/context/AuthContext'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import '@/styles/native-app-splash.css'

const MIN_VISIBLE_MS = 1400
const FADE_MS = 450

function waitForWindowLoad(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true })
  })
}

/** Full-screen branded loader for Android while the WebView and session bootstrap. */
export function NativeAppSplash() {
  const { loading: authLoading } = useAuth()
  const authLoadingRef = useRef(authLoading)
  authLoadingRef.current = authLoading
  const [phase, setPhase] = useState<'visible' | 'exit' | 'hidden'>(
    isNativeAndroid() ? 'visible' : 'hidden',
  )

  useEffect(() => {
    if (!isNativeAndroid()) return

    let cancelled = false
    const started = Date.now()

    void (async () => {
      await waitForWindowLoad()
      while (!cancelled && authLoadingRef.current) {
        await new Promise((r) => setTimeout(r, 50))
      }
      const elapsed = Date.now() - started
      const delay = Math.max(0, MIN_VISIBLE_MS - elapsed)
      await new Promise((r) => setTimeout(r, delay))
      if (cancelled) return
      setPhase('exit')
      await new Promise((r) => setTimeout(r, FADE_MS))
      if (!cancelled) setPhase('hidden')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      className={`native-app-splash${phase === 'exit' ? ' native-app-splash--exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Cridora India"
    >
      <div className="native-app-splash__inner">
        <div className="native-app-splash__glow native-app-splash__glow--outer" aria-hidden />
        <div className="native-app-splash__glow" aria-hidden />
        <div className="native-app-splash__logo">
          <CridoraLogo size="lg" showWordmark={false} pulseGlow />
        </div>
        <p className="native-app-splash__wordmark">
          Cridora <span>India</span>
        </p>
      </div>
    </div>
  )
}
