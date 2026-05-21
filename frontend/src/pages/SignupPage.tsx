import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { dashboardLandingPath } from '@/lib/routes'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Spinner, Text } from '@/components/ui'

export function SignupPage() {
  const { user, loading, registerCustomer } = useAuth()
  const { t } = usePublicLocale()
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
      setError(err instanceof Error ? err.message : t('auth.registrationFailed'))
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
        <Text tone="faint" size="micro">{t('auth.onboarding')}</Text>
        <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>{t('auth.joinTitle')}</Heading>
        <Text tone="muted" size="sm" style={{ marginTop: 'var(--sp-3)', display: 'block' }}>
          {t('auth.signupSubheadline')}
        </Text>
        <ul
          style={{
            margin: 'var(--sp-3) 0 0',
            paddingLeft: '1.1rem',
            color: 'var(--text-muted)',
            fontSize: '0.88rem',
            lineHeight: 1.55,
          }}
        >
          {(['auth.signupBenefit1', 'auth.signupBenefit2', 'auth.signupBenefit3', 'auth.signupBenefit4', 'auth.signupBenefit5'] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <form onSubmit={onSubmit} className="ds-form" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="ds-field-row">
            <Input label={t('auth.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label={t('auth.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input label={t('auth.mobile')} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <Feedback>{error}</Feedback> : null}
          <Button type="submit" variant="primary" block loading={busy}>
            {t('auth.signUp')}
          </Button>
        </form>
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          {t('auth.jewellerPrompt')} <Link to="/jeweller/apply">{t('auth.applyKyb')}</Link> ·{' '}
          <Link to="/login">{t('nav.login')}</Link>
        </p>
      </Card>
    </AuthShell>
  )
}
