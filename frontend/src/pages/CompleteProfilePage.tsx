import { type FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { customerOnboardingLandingPath } from '@/lib/routes'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Spinner, Text } from '@/components/ui'

export function CompleteProfilePage() {
  const { user, loading, completeProfile } = useAuth()
  const { t } = usePublicLocale()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name || '')
    setLastName(user.last_name || '')
    setPhone(user.phone || '')
  }, [user])

  if (loading) {
    return (
      <AuthShell>
        <Spinner />
      </AuthShell>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.user_type !== 'customer') {
    return <Navigate to="/" replace />
  }

  if (user.profile_complete) {
    return <Navigate to={customerOnboardingLandingPath()} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await completeProfile({ first_name: firstName, last_name: lastName, phone })
      navigate(customerOnboardingLandingPath(), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.profileUpdateFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell maxWidth={480}>
      <Card>
        <Text tone="faint" size="micro">{t('auth.onboarding')}</Text>
        <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>
          {t('auth.completeProfileTitle')}
        </Heading>
        <Text tone="muted" size="sm" style={{ marginTop: 'var(--sp-3)', display: 'block' }}>
          {t('auth.completeProfileSubheadline')}
        </Text>
        <form onSubmit={onSubmit} className="ds-form" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="ds-field-row">
            <Input
              label={t('auth.firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label={t('auth.lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            label={t('auth.mobile')}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {error ? <Feedback>{error}</Feedback> : null}
          <Button type="submit" variant="primary" block loading={busy}>
            {t('auth.continue')}
          </Button>
        </form>
      </Card>
    </AuthShell>
  )
}
