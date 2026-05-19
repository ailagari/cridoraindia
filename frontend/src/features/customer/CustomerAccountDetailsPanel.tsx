import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import { useAuth } from '@/context/AuthContext'
import {
  fetchCustomerMeDetails,
  patchCustomerPersonalProfile,
  type CustomerMeDetailsDTO,
} from '@/lib/customerAccountApi'
import {
  fetchCustomerPayoutUpiProfile,
  updateCustomerPayoutUpiProfile,
} from '@/lib/goldTransferApi'

function kycTone(status: string): 'ok' | 'bad' | 'wait' {
  if (status === 'verified') return 'ok'
  if (status === 'rejected') return 'bad'
  return 'wait'
}

function maskAccountNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 4) return '••••'
  return `•••• ${digits.slice(-4)}`
}

function displayName(me: CustomerMeDetailsDTO | null): string {
  if (!me) return '—'
  const n = `${me.first_name} ${me.last_name}`.trim()
  return n || '—'
}

export function CustomerAccountDetailsPanel() {
  const { user, refreshProfile } = useAuth()
  const [me, setMe] = useState<CustomerMeDetailsDTO | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [payoutUpi, setPayoutUpi] = useState('')
  const [payoutLoaded, setPayoutLoaded] = useState(false)
  const [payoutMessage, setPayoutMessage] = useState('')
  const [payoutError, setPayoutError] = useState('')
  const [payoutBusy, setPayoutBusy] = useState(false)

  const load = useCallback(async () => {
    setProfileError('')
    const out = await fetchCustomerMeDetails()
    if (!out.ok) {
      setProfileError(out.detail)
      setLoaded(true)
      setPayoutLoaded(true)
      return
    }
    setMe(out.data)
    setFirstName(out.data.first_name)
    setLastName(out.data.last_name)
    setPhone(out.data.phone)
    setLoaded(true)
    const kycOk = out.data.kyc_status === 'verified'
    if (kycOk) {
      const upi = await fetchCustomerPayoutUpiProfile()
      if (upi.ok) setPayoutUpi(upi.data.payout_upi_vpa)
      else setPayoutError(upi.detail)
    }
    setPayoutLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kycStatus = me?.kyc_status ?? user?.kyc_status ?? 'pending'
  const tone = kycTone(kycStatus)
  const kycVerified = kycStatus === 'verified'

  const memberId = useMemo(() => {
    const id = me?.cridora_member_id?.trim()
    return id || '—'
  }, [me?.cridora_member_id])

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileMessage('')
    setProfileError('')
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (!fn || !ln) {
      setProfileError('First and last name are required.')
      return
    }
    setProfileBusy(true)
    try {
      const out = await patchCustomerPersonalProfile({
        first_name: fn,
        last_name: ln,
        phone: phone.trim(),
      })
      if (!out.ok) {
        setProfileError(out.detail)
        return
      }
      setMe(out.data)
      setProfileMessage('Personal details saved.')
      await refreshProfile()
    } finally {
      setProfileBusy(false)
    }
  }

  const onSavePayoutUpi = async (e: FormEvent) => {
    e.preventDefault()
    setPayoutMessage('')
    setPayoutError('')
    setPayoutBusy(true)
    try {
      const out = await updateCustomerPayoutUpiProfile({ payout_upi_vpa: payoutUpi.trim() })
      if (!out.ok) {
        setPayoutError(out.detail)
        return
      }
      setPayoutUpi(out.data.payout_upi_vpa)
      setPayoutMessage(
        out.data.configured
          ? 'Payout UPI saved for cash sellbacks.'
          : 'Payout UPI cleared.',
      )
    } finally {
      setPayoutBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="dash-panel-max">
        <p style={{ color: 'var(--text-muted)' }}>Loading account details…</p>
      </div>
    )
  }

  const bank = me?.bank_account

  return (
    <div className="dash-panel-max account-details">
      <span className="pill">Your account</span>
      <h2 className="dash-panel-title">Account details</h2>
      <p className="dash-panel-lead">
        Manage your contact information and payout settings. Your sign-in email is fixed; update your name and phone
        here.
      </p>

      <div className="kyc-stat-grid" style={{ marginTop: '1rem' }}>
        <div className={`kyc-stat kyc-stat--${tone}`}>
          <span className="kyc-stat__eyebrow">KYC status</span>
          <p className="kyc-stat__value">
            <span className={`kyc-pill kyc-pill--${tone}`}>{kycStatus}</span>
          </p>
          <p className="kyc-stat__sub">
            {kycVerified ? 'Full platform access' : 'Complete verification for payouts'}
          </p>
        </div>
        <div className="kyc-stat kyc-stat--gold">
          <span className="kyc-stat__eyebrow">Cridora member ID</span>
          <p className="kyc-stat__value" style={{ fontSize: '0.95rem', wordBreak: 'break-all' }}>
            {memberId}
          </p>
          <p className="kyc-stat__sub">Shown on transfers &amp; records</p>
        </div>
        <div className="kyc-stat kyc-stat--violet">
          <span className="kyc-stat__eyebrow">Sign-in email</span>
          <p className="kyc-stat__value" style={{ fontSize: '0.92rem', wordBreak: 'break-all' }}>
            {me?.email ?? user?.email ?? '—'}
          </p>
          <p className="kyc-stat__sub">Contact support to change email</p>
        </div>
      </div>

      <div className="card account-details__card">
        <h3 className="account-details__heading">Profile summary</h3>
        <dl className="account-details__dl">
          <div>
            <dt>Display name</dt>
            <dd>{displayName(me)}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{me?.phone?.trim() ? me.phone : 'Not set'}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>Customer (saver)</dd>
          </div>
        </dl>
      </div>

      <form
        className="card account-details__card"
        onSubmit={(e) => void onSaveProfile(e)}
        style={{ display: 'grid', gap: '0.85rem' }}
      >
        <h3 className="account-details__heading">Personal details</h3>
        <p className="dash-panel-lead" style={{ margin: 0 }}>
          Used on sellback receipts, KYC records, and jeweller-facing labels.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label className="field">
            <span>First name</span>
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Mobile number</span>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+91 98765 43210"
          />
        </label>
        <FormSubmitFoot error={profileError} success={profileMessage}>
          <button type="submit" className="btn btn-primary" disabled={profileBusy}>
            {profileBusy ? 'Saving…' : 'Save personal details'}
          </button>
        </FormSubmitFoot>
      </form>

      {bank ? (
        <div className="card account-details__card">
          <h3 className="account-details__heading">Linked bank (KYC)</h3>
          <p className="dash-panel-lead" style={{ margin: 0 }}>
            Bank details from your KYC submission. To update, use the KYC section.
          </p>
          <dl className="account-details__dl">
            <div>
              <dt>Account holder</dt>
              <dd>{bank.account_holder_name || '—'}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{maskAccountNumber(bank.account_number)}</dd>
            </div>
            <div>
              <dt>IFSC</dt>
              <dd>{bank.ifsc_code || '—'}</dd>
            </div>
            <div>
              <dt>Bank</dt>
              <dd>
                {[bank.bank_name, bank.branch].filter(Boolean).join(' · ') || '—'}
              </dd>
            </div>
            <div>
              <dt>Review status</dt>
              <dd>{bank.status || '—'}</dd>
            </div>
          </dl>
          <Link className="btn btn-ghost btn-sm" to="/userdashboard?section=profile_kyc">
            Open KYC
          </Link>
        </div>
      ) : null}

      <form
        className="card account-details__card"
        onSubmit={(e) => void onSavePayoutUpi(e)}
        style={{ display: 'grid', gap: '0.85rem' }}
      >
        <h3 className="account-details__heading">Cash sellback payout UPI</h3>
        {!kycVerified ? (
          <p className="dash-panel-lead" style={{ margin: 0 }}>
            Complete verified KYC before saving a payout UPI ID.{' '}
            <Link to="/userdashboard?section=profile_kyc">Go to KYC</Link>
          </p>
        ) : (
          <p className="dash-panel-lead" style={{ margin: 0 }}>
            Jewellers pay you here when you sell gold for cash online. You can also enter a one-time UPI ID during
            sellback.
          </p>
        )}
        <label className="field">
          <span>Your UPI ID (receive payout)</span>
          <input
            className="input"
            value={payoutUpi}
            onChange={(e) => setPayoutUpi(e.target.value)}
            placeholder="yourname@okhdfcbank"
            autoComplete="off"
            disabled={!kycVerified || !payoutLoaded}
          />
        </label>
        <FormSubmitFoot error={payoutError} success={payoutMessage}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!kycVerified || !payoutLoaded || payoutBusy}
          >
            {payoutBusy ? 'Saving…' : 'Save payout UPI'}
          </button>
        </FormSubmitFoot>
      </form>

      <nav className="account-details__links" aria-label="Related account settings">
        <Link className="btn btn-ghost btn-sm" to="/userdashboard?section=profile_security">
          Password &amp; security
        </Link>
        <Link className="btn btn-ghost btn-sm" to="/userdashboard?section=profile_kyc">
          KYC &amp; documents
        </Link>
        <Link className="btn btn-ghost btn-sm" to="/userdashboard?section=profile_cridora_id">
          Cridora ID &amp; QR
        </Link>
      </nav>
    </div>
  )
}
