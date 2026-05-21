import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'
import { dashboardLandingPath } from '@/lib/routes'
import { AuthShell } from '@/layouts/auth-shell'
import {
  Button,
  Card,
  Feedback,
  Heading,
  Input,
  Select,
  Spinner,
  Text,
  Textarea,
} from '@/components/ui'

const states = [
  'Andhra Pradesh',
  'Delhi',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
  'Other',
]

const REQUIREMENTS: MessageKey[] = [
  'apply.requirement1',
  'apply.requirement2',
  'apply.requirement3',
  'apply.requirement4',
]

const BENEFITS: MessageKey[] = [
  'apply.benefit1',
  'apply.benefit2',
  'apply.benefit3',
  'apply.benefit4',
  'apply.benefit5',
  'apply.benefit6',
]

export function JewellerApplyPage() {
  const { user, loading, registerJeweller } = useAuth()
  const { t } = usePublicLocale()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await registerJeweller({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        business_name: businessName,
        shop_address: shopAddress,
        city,
        state,
        pincode,
      })
      navigate(dashboardLandingPath(u), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AuthShell maxWidth={560}>
        <Spinner />
      </AuthShell>
    )
  }
  if (user) {
    return <Navigate to={dashboardLandingPath(user)} replace />
  }

  return (
    <AuthShell maxWidth={720}>
      <div style={{ display: 'grid', gap: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
        <div>
          <Text tone="faint" size="micro">{t('apply.eyebrow')}</Text>
          <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>{t('apply.heroTitle')}</Heading>
          <Text tone="muted" size="sm" style={{ marginTop: 'var(--sp-3)', display: 'block', lineHeight: 1.55 }}>
            {t('apply.heroLead')}
          </Text>
        </div>

        <Card>
          <Heading level={2} style={{ marginTop: 0, fontSize: '1.15rem' }}>{t('apply.requirementsTitle')}</Heading>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {REQUIREMENTS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <Heading level={2} style={{ marginTop: 0, fontSize: '1.15rem' }}>{t('apply.benefitsTitle')}</Heading>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {BENEFITS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <Text tone="muted" size="sm" style={{ lineHeight: 1.55, display: 'block' }}>
            {t('apply.trustBody')}
          </Text>
        </Card>
      </div>

      <Card>
        <Text tone="faint" size="micro">{t('apply.formEyebrow')}</Text>
        <Heading level={2} style={{ marginTop: 'var(--sp-2)', fontSize: '1.25rem' }}>{t('apply.formTitle')}</Heading>
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
          <Input
            label="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
          <Textarea
            label="Shop address"
            rows={3}
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
            required
          />
          <div className="ds-field-row">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
            <Select label="State / UT" value={state} onChange={(e) => setState(e.target.value)} required>
              <option value="">Select</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <Input label="PIN code" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
          {error ? <Feedback>{error}</Feedback> : null}
          <Button type="submit" variant="primary" block loading={busy}>
            {t('apply.finalCta')}
          </Button>
        </form>
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          {t('apply.retailPrompt')} <Link to="/signup">{t('apply.signUpLink')}</Link>
        </p>
      </Card>
    </AuthShell>
  )
}
