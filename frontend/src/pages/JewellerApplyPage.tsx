import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
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

export function JewellerApplyPage() {
  const { user, loading, registerJeweller } = useAuth()
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
    <AuthShell maxWidth={560}>
      <Card>
        <Text tone="faint" size="micro">Jeweller KYB</Text>
        <Heading level={1} style={{ marginTop: 'var(--sp-2)' }}>Apply to join</Heading>
        <form onSubmit={onSubmit} className="ds-form" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="ds-field-row">
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <Input
            label="Work email"
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
            Create account
          </Button>
        </form>
        <p className="form-footnote" style={{ marginTop: 'var(--sp-4)' }}>
          Retail customer? <Link to="/signup">Sign up</Link>
        </p>
      </Card>
    </AuthShell>
  )
}
