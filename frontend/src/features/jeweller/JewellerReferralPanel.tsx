import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type MeReferral = {
  jeweller_referral_code?: string
  kyc_status?: string
  business_name?: string
}

function signupLinkFor(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/signup?ref=${encodeURIComponent(code)}`
}

type Props = {
  /** Compact strip for portfolio overview; full card for profile and customer base. */
  variant?: 'full' | 'compact'
}

export function JewellerReferralPanel({ variant = 'full' }: Props) {
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  const load = useCallback(async () => {
    const res = await authFetch('/api/v1/auth/me/')
    const data = (await res.json().catch(() => ({}))) as MeReferral
    const raw = typeof data.jeweller_referral_code === 'string' ? data.jeweller_referral_code : ''
    setCode(raw.trim())
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signupLink = useMemo(() => (code ? signupLinkFor(code) : ''), [code])

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg(`${label} copied`)
      window.setTimeout(() => setCopyMsg(''), 2500)
    } catch {
      setCopyMsg('Copy failed — select and copy manually')
    }
  }

  const verified = user?.kyc_status === 'verified'

  if (!loaded) {
    return variant === 'compact' ? null : (
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading referral code…</p>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
            CUSTOMER REFERRAL CODE
          </p>
          {!verified ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Issued after KYB verification is approved.
            </p>
          ) : code ? (
            <p className="tabular" style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.18em' }}>
              {code}
            </p>
          ) : (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Referral code is being assigned — refresh shortly.
            </p>
          )}
        </div>
        {verified && code ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void copyText(code, 'Code')}>
              Copy code
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyText(signupLink, 'Signup link')}>
              Copy signup link
            </button>
          </div>
        ) : null}
        {copyMsg ? (
          <p style={{ margin: 0, width: '100%', fontSize: '0.82rem', color: 'var(--success)' }}>{copyMsg}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <span className="pill">Customer onboarding</span>
      <h2 className="dash-panel-title" style={{ marginTop: '0.5rem' }}>
        Your referral code
      </h2>
      <p className="dash-panel-lead" style={{ marginBottom: '1rem' }}>
        New customers can enter this 6-digit code when they sign up. They get you as their{' '}
        <strong style={{ color: 'var(--text)' }}>primary jeweller</strong> until they change it later.
      </p>
      {!verified ? (
        <p className="form-error" role="alert">
          Your referral code is issued after KYB verification is approved.
        </p>
      ) : code ? (
        <>
          <p
            className="tabular"
            style={{
              margin: '0 0 0.75rem',
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '0.2em',
            }}
          >
            {code}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => void copyText(code, 'Code')}>
              Copy code
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void copyText(signupLink, 'Signup link')}
            >
              Copy signup link
            </button>
          </div>
          {signupLink ? (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {signupLink}
            </p>
          ) : null}
          {copyMsg ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--success)' }}>{copyMsg}</p>
          ) : null}
        </>
      ) : (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Referral code is being assigned — refresh this page in a moment.
        </p>
      )}
    </div>
  )
}
