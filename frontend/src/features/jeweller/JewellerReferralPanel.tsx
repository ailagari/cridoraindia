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

export function JewellerReferralPanel() {
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

  if (!loaded) {
    return (
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading referral code…</p>
      </div>
    )
  }

  const verified = user?.kyc_status === 'verified'

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
