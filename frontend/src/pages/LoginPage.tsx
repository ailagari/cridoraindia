import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { dashboardLandingPath } from '@/lib/routes'
import { getApiBaseUrl, isNativeApiMisconfigured, nativeApiConfigError } from '@/lib/api'
import { isNativePlatform } from '@/lib/capacitorPlatform'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Text } from '@/components/ui'

export function LoginPage() {
  const { login, user, loading } = useAuth()
  const { t } = usePublicLocale()
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
      setError(err instanceof Error ? err.message : t('auth.signInFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <Card>
        <Text tone="faint" size="micro">{t('auth.account')}</Text>
        <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>{t('auth.welcomeBack')}</Heading>
        <Text tone="muted" size="sm" style={{ marginTop: 'var(--sp-3)', display: 'block' }}>
          {t('auth.loginSubheadline')}
        </Text>
        <Text tone="faint" size="micro" style={{ marginTop: 'var(--sp-2)', display: 'block' }}>
          {t('auth.loginTrustNote')}
        </Text>
        <form onSubmit={onSubmit} className="ds-form" style={{ marginTop: 'var(--sp-5)' }}>
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isNativeApiMisconfigured() ? <Feedback>{nativeApiConfigError()}</Feedback> : null}
          {error ? <Feedback>{error}</Feedback> : null}
          {isNativePlatform() && getApiBaseUrl() ? (
            <Text tone="faint" size="micro" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
              API: {getApiBaseUrl()}
            </Text>
          ) : null}
          <Button type="submit" variant="primary" block loading={busy} disabled={isNativeApiMisconfigured()}>
            {t('auth.signIn')}
          </Button>
        </form>
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          {t('auth.newHere')}{' '}
          <Link to="/signup">{t('auth.createCustomer')}</Link> or{' '}
          <Link to="/jeweller/apply">{t('auth.applyJewellerShort')}</Link>.
        </p>
      </Card>
    </AuthShell>
  )
}
