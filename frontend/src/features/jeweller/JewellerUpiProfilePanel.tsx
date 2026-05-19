import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import { fetchJewellerUpiProfile, updateJewellerUpiProfile } from '@/lib/fractionalPurchaseApi'

export function JewellerUpiProfilePanel() {
  const [loaded, setLoaded] = useState(false)
  const [upiVpa, setUpiVpa] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const out = await fetchJewellerUpiProfile()
    if (!out.ok) {
      setError(out.detail)
      setLoaded(true)
      return
    }
    setUpiVpa(out.data.upi_vpa)
    setDisplayName(out.data.upi_display_name)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    setBusy(true)
    try {
      const out = await updateJewellerUpiProfile({
        upi_vpa: upiVpa.trim(),
        upi_display_name: displayName.trim(),
      })
      if (!out.ok) {
        setError(out.detail)
        return
      }
      setUpiVpa(out.data.upi_vpa)
      setDisplayName(out.data.upi_display_name)
      setMessage(out.data.configured ? 'Online UPI enabled for fractional purchases.' : 'UPI ID cleared.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading UPI settings…</p>
      </div>
    )
  }

  return (
    <form
      className="card fractional-jeweller-upi-profile"
      onSubmit={onSubmit}
      style={{ marginBottom: '1.25rem', padding: '1.25rem', display: 'grid', gap: '0.85rem' }}
    >
      <h2 className="dash-panel-title" style={{ margin: 0, fontSize: '1.05rem' }}>
        Online UPI (fractional gold)
      </h2>
      <p className="dash-panel-lead" style={{ margin: 0 }}>
        Customers pay you directly via GPay / PhonePe using this UPI ID. They paste the UTR from their receipt; you
        confirm under <strong>Ops → Purchase → Online UPI</strong>.
      </p>
      <div className="field">
        <label htmlFor="jeweller-upi-vpa">UPI ID (VPA)</label>
        <input
          id="jeweller-upi-vpa"
          value={upiVpa}
          onChange={(e) => setUpiVpa(e.target.value)}
          placeholder="shopname@okicici"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="jeweller-upi-display">Payee name on UPI apps (optional)</label>
        <input
          id="jeweller-upi-display"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your showroom name"
        />
      </div>
      <FormSubmitFoot error={error} success={message}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save UPI settings'}
        </button>
      </FormSubmitFoot>
    </form>
  )
}
