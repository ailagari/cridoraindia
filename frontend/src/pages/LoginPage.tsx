import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'

export function LoginPage() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    navigate(dashboardLandingPath(user), { replace: true })
  }, [loading, user, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(email, password)
      navigate(dashboardLandingPath(u), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 440 }}>
      <div className="card">
        <span className="pill">Account · login</span>
        <h1 style={{ marginTop: '0.75rem', fontSize: 'clamp(1.35rem, 3vw, 1.65rem)' }}>Welcome back</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Use your email and password. KYC/KYB continue in your role dashboard (site admin handles approvals).
        </p>
        <form onSubmit={onSubmit} style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem' }}>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn--block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="form-footnote" style={{ marginTop: '1rem' }}>
          New here?{' '}
          <Link to="/signup">Create a customer account</Link> or{' '}
          <Link to="/jeweller/apply">apply as a jeweller</Link>.
        </p>
        <p className="form-footnote" style={{ marginTop: '0.65rem', fontSize: '0.85rem' }}>
          Site admins: sign in here with your <strong>email</strong> to open the app admin dashboard. Django staff UI is at{' '}
          <a href="/admin/">/admin/</a> (same host).
        </p>
      </div>
    </div>
  )
}
