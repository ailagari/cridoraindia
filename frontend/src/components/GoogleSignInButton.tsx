import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { Feedback } from '@/components/ui'

type GoogleSignInButtonProps = {
  onCredential: (idToken: string) => void | Promise<void>
  disabled?: boolean
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.dataset.googleGsi = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google script failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function GoogleSignInButton({ onCredential, disabled, text = 'continue_with' }: GoogleSignInButtonProps) {
  const { t } = usePublicLocale()
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const callbackRef = useRef(onCredential)
  callbackRef.current = onCredential

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const envClientId = (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined)?.trim()
        let clientId = envClientId || ''
        if (!clientId) {
          const res = await apiFetch('/api/v1/auth/google/config/')
          const data = (await res.json().catch(() => ({}))) as { client_id?: string | null }
          clientId = (data.client_id || '').trim()
        }
        if (!clientId) {
          if (!cancelled) setReady(false)
          return
        }
        await loadGoogleScript()
        if (cancelled || !hostRef.current) return
        window.google!.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => {
            const token = resp?.credential
            if (token) void callbackRef.current(token)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        hostRef.current.innerHTML = ''
        window.google!.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          width: 320,
          shape: 'rectangular',
        })
        if (!cancelled) setReady(true)
      } catch {
        if (!cancelled) setError(t('auth.googleUnavailable'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t, text])

  if (error) return <Feedback>{error}</Feedback>
  if (!ready && !error) return null

  return (
    <div className="google-signin-wrap" style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
      <div ref={hostRef} aria-hidden={disabled} style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} />
    </div>
  )
}
