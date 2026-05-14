import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

function formatApiErrorPayload(data: Record<string, unknown>): string {
  const detail = data.detail
  if (typeof detail === 'string' && detail) return detail
  const parts: string[] = []
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
    else if (typeof v === 'string' && v) parts.push(v)
  }
  return parts.join(' ') || 'Request failed.'
}

const STATES = [
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

export function JewellerBusinessProfilePanel() {
  const { refreshProfile } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [gstin, setGstin] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const res = await authFetch('/api/v1/auth/me/')
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      setError(formatApiErrorPayload(data))
      setLoaded(true)
      return
    }
    setBusinessName(typeof data.business_name === 'string' ? data.business_name : '')
    const g = typeof data.gstin === 'string' ? data.gstin : ''
    setGstin(g.toUpperCase())
    setShopAddress(typeof data.shop_address === 'string' ? data.shop_address : '')
    setCity(typeof data.city === 'string' ? data.city : '')
    setState(typeof data.state === 'string' ? data.state : '')
    setPincode(typeof data.pincode === 'string' ? data.pincode : '')
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    const g = gstin.trim().toUpperCase()
    if (g.length > 0 && g.length !== 15) {
      setError('GSTIN must be exactly 15 characters, or leave blank.')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/jeweller/business-profile/', {
        method: 'PATCH',
        jsonBody: {
          business_name: businessName.trim(),
          gstin: g,
          shop_address: shopAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        },
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        setError(formatApiErrorPayload(data))
        return
      }
      setMessage('Business profile saved.')
      await refreshProfile()
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="dash-panel-max">
        <p style={{ color: 'var(--text-muted)' }}>Loading business profile…</p>
      </div>
    )
  }

  return (
    <div className="dash-panel-max">
      <span className="pill">Business</span>
      <h2 className="dash-panel-title">Showroom &amp; GST details</h2>
      <p className="dash-panel-lead">
        Your registered business name and address appear on internal records and compliance review. Add your{' '}
        <strong style={{ color: 'var(--text)' }}>15-character GSTIN</strong> here when ready — it was not required at signup.
      </p>

      {message ? <p className="message-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <form className="card" onSubmit={onSubmit} style={{ marginTop: '1rem', padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
        <div className="field">
          <label htmlFor="bp-biz">Registered business / brand name</label>
          <input id="bp-biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="bp-gst">GSTIN (optional until you have it)</label>
          <input
            id="bp-gst"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            maxLength={15}
            placeholder="15-character GSTIN"
          />
        </div>
        <div className="field">
          <label htmlFor="bp-addr">Shop address</label>
          <textarea id="bp-addr" rows={3} value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="field">
            <label htmlFor="bp-city">City</label>
            <input id="bp-city" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="bp-state">State / UT</label>
            <select id="bp-state" value={state} onChange={(e) => setState(e.target.value)} required>
              <option value="">Select</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="bp-pin">PIN code</label>
          <input id="bp-pin" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save business profile'}
        </button>
      </form>
    </div>
  )
}
