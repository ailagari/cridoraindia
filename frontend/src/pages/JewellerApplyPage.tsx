import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

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
  const [gstin, setGstin] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user?.user_type === 'jeweller') {
      navigate('/dashboard/jeweller?section=prof_kyb', { replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div className="container page">
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  if (user?.user_type === 'jeweller') {
    return null
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await registerJeweller({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        business_name: businessName,
        gstin: gstin.toUpperCase(),
        shop_address: shopAddress,
        city,
        state,
        pincode,
      })
      navigate('/dashboard/jeweller?section=prof_kyb', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 560 }}>
      <div className="card">
        <span className="pill">Jeweller KYB · apply</span>
        <h1 style={{ marginTop: '0.75rem', fontSize: 'clamp(1.35rem, 3vw, 1.65rem)' }}>
          Jeweller KYB application
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Tell us about your firm. After account creation you will upload GST registration, trade
          licence, Shop &amp; Establishment, BIS hallmarking (if applicable), and proprietor or
          partner identity proofs — aligned with typical Indian jewellery business compliance.
        </p>
        <form onSubmit={onSubmit} style={{ marginTop: '1.25rem', display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="jfn">First name</label>
              <input id="jfn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="jln">Last name</label>
              <input id="jln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="jemail">Work email</label>
            <input
              id="jemail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="jphone">Mobile</label>
            <input id="jphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="jpw">Password</label>
            <input
              id="jpw"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="biz">Registered business / brand name</label>
            <input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="gstin">15-character GSTIN</label>
            <input
              id="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength={15}
              minLength={15}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="addr">Shop address</label>
            <textarea
              id="addr"
              rows={3}
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="state">State / UT</label>
              <select id="state" value={state} onChange={(e) => setState(e.target.value)} required>
                <option value="">Select</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pin">PIN code</label>
            <input id="pin" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn--block" disabled={busy}>
            {busy ? 'Submitting…' : 'Create account & continue to documents'}
          </button>
        </form>
        <p className="form-footnote" style={{ marginTop: '1rem' }}>
          Retail customer? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
