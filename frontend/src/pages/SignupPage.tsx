import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function SignupPage() {
  const { user, loading, registerCustomer } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading || !user || user.user_type !== 'customer') return
    navigate('/userdashboard?section=profile_kyc', { replace: true })
  }, [loading, user, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await registerCustomer({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      navigate('/userdashboard?section=profile_kyc', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 480 }}>
      <div className="card">
        <span className="pill">Customer onboarding</span>
        <h1 style={{ marginTop: '0.75rem', fontSize: 'clamp(1.35rem, 3vw, 1.65rem)' }}>
          Create your customer account
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Next step: upload Aadhaar, PAN, and your bank details for KYC verification.
        </p>
        <form onSubmit={onSubmit} style={{ marginTop: '1.25rem', display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="fn">First name</label>
              <input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ln">Last name</label>
              <input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Mobile (optional)</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pw">Password (min 8 characters)</label>
            <input
              id="pw"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn--block" disabled={busy}>
            {busy ? 'Creating…' : 'Continue to KYC'}
          </button>
        </form>
        <p className="form-footnote" style={{ marginTop: '1rem' }}>
          Jeweller? <Link to="/jeweller/apply">Start KYB application</Link> · Already registered?{' '}
          <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
