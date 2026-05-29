import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { dashboardLandingPath } from '@/lib/routes'
import { fetchJewellerReferralPreview } from '@/lib/jewellerReferralApi'
import { AuthShell } from '@/layouts/auth-shell'
import { Button, Card, Feedback, Heading, Input, Spinner, Text } from '@/components/ui'

function parseJewellerIdParam(raw: string | null): number | null {
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function SignupPage() {
  const { user, loading, registerCustomer } = useAuth()
  const { t } = usePublicLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [referralPreview, setReferralPreview] = useState('')
  const [referralPreviewErr, setReferralPreviewErr] = useState('')
  const [error, setError] = useState('')
  const [referralWarning, setReferralWarning] = useState('')
  const [busy, setBusy] = useState(false)

  const jewellerIdFromUrl = useMemo(
    () => parseJewellerIdParam(searchParams.get('jeweller')),
    [searchParams],
  )

  useEffect(() => {
    const ref = (searchParams.get('ref') || '').trim()
    if (ref) {
      const digits = ref.replace(/\D/g, '').slice(0, 6)
      if (digits) setReferralCode(digits.padStart(6, '0'))
    }
  }, [searchParams])

  useEffect(() => {
    const digits = referralCode.replace(/\D/g, '')
    if (digits.length !== 6) {
      setReferralPreview('')
      setReferralPreviewErr('')
      return
    }
    const padded = digits.padStart(6, '0')
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetchJewellerReferralPreview(padded).then((p) => {
        if (cancelled) return
        if (!p) {
          setReferralPreview('')
          setReferralPreviewErr('Referral code not found — you can still sign up.')
          return
        }
        const place = [p.city, p.state].filter(Boolean).join(', ')
        setReferralPreviewErr('')
        setReferralPreview(
          place ? `Primary jeweller: ${p.business_name} · ${place}` : `Primary jeweller: ${p.business_name}`,
        )
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [referralCode])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setReferralWarning('')
    setBusy(true)
    try {
      const payload: Record<string, string> = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
      }
      const refDigits = referralCode.replace(/\D/g, '')
      if (refDigits.length > 0) {
        payload.referral_code = refDigits.padStart(6, '0')
      } else if (jewellerIdFromUrl != null) {
        payload.onboarding_jeweller_id = String(jewellerIdFromUrl)
      }
      const { user: u, referralWarning: warn } = await registerCustomer(payload)
      if (warn) setReferralWarning(warn)
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
            label="Jeweller referral code (optional)"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="6 digits from your jeweller"
            value={referralCode}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
              setReferralCode(digits)
            }}
          />
          {referralPreview ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>{referralPreview}</p>
          ) : null}
          {referralPreviewErr ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{referralPreviewErr}</p>
          ) : null}
          {jewellerIdFromUrl != null && referralCode.replace(/\D/g, '').length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              You are joining via a jeweller invite link.
            </p>
          ) : null}
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
          {referralWarning ? <Feedback>{referralWarning}</Feedback> : null}
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
