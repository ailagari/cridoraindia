import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Spinner, Text } from '@/components/ui'

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await registerCustomer({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      navigate(dashboardLandingPath(u), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AuthShell>
        <Spinner />
      </AuthShell>
    )
  }
  if (user) {
    return <Navigate to={dashboardLandingPath(user)} replace />
  }

  return (
    <AuthShell maxWidth={480}>
      <Card>
        <Text tone="faint" size="micro">Customer onboarding</Text>
        <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>Create account</Heading>
        <form onSubmit={onSubmit} className="ds-form" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="ds-field-row">
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input label="Mobile" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <Feedback>{error}</Feedback> : null}
          <Button type="submit" variant="primary" block loading={busy}>
            Sign up
          </Button>
        </form>
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          Jeweller? <Link to="/jeweller/apply">Apply for KYB</Link> · <Link to="/login">Login</Link>
        </p>
      </Card>
    </AuthShell>
  )
}
