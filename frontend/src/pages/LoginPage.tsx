import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Text } from '@/components/ui'

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
    <AuthShell>
      <Card>
        <Text tone="faint" size="micro">Account</Text>
        <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>Welcome back</Heading>
        <form onSubmit={onSubmit} className="ds-form" style={{ marginTop: 'var(--sp-5)' }}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <Feedback>{error}</Feedback> : null}
          <Button type="submit" variant="primary" block loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          New here?{' '}
          <Link to="/signup">Create a customer account</Link> or{' '}
          <Link to="/jeweller/apply">apply as a jeweller</Link>.
        </p>
      </Card>
    </AuthShell>
  )
}
