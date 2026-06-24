import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { dashboardLandingPath, postAuthLandingPath } from '@/lib/routes'
import { getApiBaseUrl, isNativeApiMisconfigured, nativeApiConfigError } from '@/lib/api'
import { isNativePlatform } from '@/lib/capacitorPlatform'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Text } from '@/components/ui'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'

export function LoginPage() {
  const { login, loginWithGoogle, user, loading } = useAuth()
  const { t } = usePublicLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = useMemo(() => {
    const next = new URLSearchParams(location.search).get('next')
    if (next && next.startsWith('/')) return next
    const from = (location.state as { from?: { pathname: string; search?: string; hash?: string } } | null)
      ?.from
    if (from?.pathname) {
      return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
    }
    return null
  }, [location.search, location.state])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    navigate(returnPath ?? dashboardLandingPath(user), { replace: true })
  }, [loading, user, navigate, returnPath])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(email, password, rememberMe)
      navigate(returnPath ?? dashboardLandingPath(u), { replace: true })
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
          <label className="ds-checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>{t('auth.rememberMe')}</span>
          </label>
          {isNativeApiMisconfigured() ? <Feedback>{nativeApiConfigError()}</Feedback> : null}
          {error ? <Feedback>{error}</Feedback> : null}
          {isNativePlatform() && getApiBaseUrl() ? (
            <Text tone="faint" size="micro" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
              API: {getApiBaseUrl()}
            </Text>
          ) : null}
          <Button type="submit" variant="primary" block loading={busy} disabled={isNativeApiMisconfigured() || googleBusy}>
            {t('auth.signIn')}
          </Button>
        </form>
        <GoogleSignInButton
          disabled={busy || googleBusy}
          text="signin_with"
          onCredential={async (token) => {
            setError('')
            setGoogleBusy(true)
            try {
              const { user: u } = await loginWithGoogle(token)
              navigate(returnPath ?? postAuthLandingPath(u), { replace: true })
            } catch (err) {
              setError(err instanceof Error ? err.message : t('auth.signInFailed'))
            } finally {
              setGoogleBusy(false)
            }
          }}
        />
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          {t('auth.newHere')}{' '}
          <Link to="/signup">{t('auth.createCustomer')}</Link> or{' '}
          <Link to="/jeweller/apply">{t('auth.applyJewellerShort')}</Link>.
        </p>
      </Card>
    </AuthShell>
  )
}
