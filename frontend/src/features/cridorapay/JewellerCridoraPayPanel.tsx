import { useCallback, useEffect, useRef, useState } from 'react'
import {
  jewellerCridoraPayCreate,
  jewellerCridoraPayList,
  jewellerCridoraPayMarkCashPaid,
  jewellerCridoraPayMarkUpiPaid,
  jewellerCridoraPayResendNotify,
  jewellerCridoraPayVerifyVaultOtp,
  type CridoraPayBillDTO,
} from '@/lib/cridorapayApi'
import { jewellerLookupCustomer } from '@/lib/personalHoldingsApi'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

const OTP_LEN = 6

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatExpiryShort(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(s: string): string {
  if (s === 'awaiting_customer') return 'Awaiting customer'
  if (s === 'upi_pending') return 'UPI pending'
  if (s === 'vault_otp_pending') return 'Vault OTP'
  if (s === 'cash_pending') return 'Cash due'
  if (s === 'completed') return 'Done'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'expired') return 'Expired'
  return s
}

function CustomerOtpExpiryHint({ expiresAt }: { expiresAt?: string | null }) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt ?? null)
  if (expiresAt == null || expiresAt === '') {
    return (
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
        No OTP yet — customer opens CridoraPay and taps Generate OTP.
      </p>
    )
  }
  return (
    <p
      style={{
        margin: '0.35rem 0 0',
        fontSize: '0.72rem',
        color: expired ? 'var(--danger)' : 'var(--text-muted)',
        fontWeight: expired ? 700 : 400,
      }}
    >
      {expired
        ? 'OTP expired — customer must generate a new code.'
        : `OTP valid ${labelMmSs} remaining · ends ${formatExpiryShort(expiresAt)}`}
    </p>
  )
}

export function JewellerCridoraPayPanel() {
  const [rows, setRows] = useState<CridoraPayBillDTO[]>([])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [otpById, setOtpById] = useState<Record<number, string>>({})
  const [formMsg, setFormMsg] = useState('')
  const [memberId, setMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerLabel, setCustomerLabel] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [totalInr, setTotalInr] = useState('')
  const [title, setTitle] = useState('Shop purchase')
  const [note, setNote] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const successRef = useRef<HTMLDivElement | null>(null)
  const [doneBanner, setDoneBanner] = useState<{ reference: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setErr('')
    setListBusy(true)
    try {
      const out = await jewellerCridoraPayList('open')
      if (!out.ok) {
        setErr(out.detail)
        setRows([])
        return
      }
      setRows(out.results)
    } finally {
      setListBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null && !formBusy && !listBusy)

  const resendNotify = async (id: number) => {
    setResendMsg('')
    setErr('')
    setBusyId(id)
    try {
      const out = await jewellerCridoraPayResendNotify(id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setResendMsg(`Reminder sent to customer for ${out.data.reference}.`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const runLookup = async () => {
    setLookupErr('')
    const r = await jewellerLookupCustomer({
      cridora_member_id: memberId.trim() || undefined,
      phone: phone.trim() || undefined,
    })
    if (!r.found || !r.customer) {
      setLookupErr(r.detail ?? 'Customer not found.')
      setCustomerId(null)
      setCustomerLabel('')
      return
    }
    setCustomerId(r.customer.id)
    setCustomerLabel(`${r.customer.label} · ${r.customer.cridora_member_id}`)
  }

  const createBill = async () => {
    setFormMsg('')
    setErr('')
    if (customerId == null) {
      setFormMsg('Look up a verified customer first.')
      return
    }
    if (!weightGrams.trim() || !totalInr.trim()) {
      setFormMsg('Enter gold weight (g) and total bill amount (₹).')
      return
    }
    setFormBusy(true)
    try {
      const out = await jewellerCridoraPayCreate({
        customer_id: customerId,
        weight_grams: weightGrams.trim(),
        total_inr: totalInr.trim(),
        title: title.trim() || undefined,
        jeweller_note: note.trim() || undefined,
      })
      if (!out.ok) {
        setFormMsg(out.detail)
        return
      }
      setFormMsg(
        `Bill ${out.data.reference} sent. Customer reviews in CridoraPay and chooses vault or UPI.`,
      )
      setWeightGrams('')
      setTotalInr('')
      setNote('')
      await load()
    } finally {
      setFormBusy(false)
    }
  }

  const verifyOtp = async (id: number) => {
    const otp = (otpById[id] ?? '').trim()
    if (otp.length !== OTP_LEN) {
      setErr(`Enter all ${OTP_LEN} digits from the customer’s app.`)
      return
    }
    setBusyId(id)
    setErr('')
    try {
      const out = await jewellerCridoraPayVerifyVaultOtp(id, otp)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setDoneBanner({ reference: out.data.reference, label: out.data.customer?.name || 'Customer' })
      setOtpById((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const markUpiPaid = async (id: number) => {
    setBusyId(id)
    setErr('')
    try {
      const out = await jewellerCridoraPayMarkUpiPaid(id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setDoneBanner({ reference: out.data.reference, label: out.data.customer?.name || 'Customer' })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const markCashPaid = async (id: number) => {
    setBusyId(id)
    setErr('')
    try {
      const out = await jewellerCridoraPayMarkCashPaid(id)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setDoneBanner({ reference: out.data.reference, label: out.data.customer?.name || 'Customer' })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    if (doneBanner && successRef.current) {
      successRef.current.focus()
    }
  }, [doneBanner])

  return (
    <div className="dash-panel-max jeweller-counter-verify-panel">
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>CridoraPay</h2>
      <p className="dash-panel-lead">
        Raise a counter bill with the customer&apos;s Cridora ID, weight, and invoice total. They confirm in the app and pay
        with <strong>vault gold</strong> (OTP) or <strong>UPI</strong> outside Cridora. Completed purchases appear as one{' '}
        <strong>personal holding</strong> in their Gold Records.
      </p>

      {doneBanner ? (
        <div
          ref={successRef}
          tabIndex={-1}
          className="pf-card pf-card--lift"
          style={{ marginBottom: '1rem', padding: '1rem', borderColor: 'var(--success)' }}
        >
          <strong>Purchase recorded — {doneBanner.reference}</strong>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }}>{doneBanner.label}</p>
        </div>
      ) : null}

      <article className="pf-card pf-card--lift pf-card--wide" style={{ marginBottom: '1.25rem', maxWidth: 640 }}>
        <header className="pf-card__head">
          <h3 className="pf-card__title">New bill</h3>
        </header>
        <div style={{ padding: '0 1rem 1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <label className="pf-vault-field" style={{ flex: '1 1 160px' }}>
              <span>Cridora member ID</span>
              <input className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="CRI…" />
            </label>
            <label className="pf-vault-field" style={{ flex: '1 1 160px' }}>
              <span>Phone</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void runLookup()} disabled={formBusy}>
              Find customer
            </button>
          </div>
          {lookupErr ? <p className="form-error">{lookupErr}</p> : null}
          {customerId != null ? (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', fontWeight: 650, color: 'var(--gold-light)' }}>
              {customerLabel}
            </p>
          ) : null}
          <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.85rem' }}>
            <label className="pf-vault-field">
              <span>Title (optional)</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="pf-vault-field">
              <span>Gold weight (g)</span>
              <input className="input tabular" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} />
            </label>
            <label className="pf-vault-field">
              <span>Total bill (₹)</span>
              <input className="input tabular" value={totalInr} onChange={(e) => setTotalInr(e.target.value)} />
            </label>
            <label className="pf-vault-field">
              <span>Note (optional)</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '0.85rem' }}
            disabled={formBusy}
            onClick={() => void createBill()}
          >
            Send bill to customer
          </button>
          {formMsg ? <p style={{ margin: '0.75rem 0 0', fontSize: '0.88rem' }}>{formMsg}</p> : null}
        </div>
      </article>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', margin: 0 }}>Open bills</h3>
        <button type="button" className="btn btn-ghost btn-sm" disabled={listBusy} onClick={() => void load()}>
          {listBusy ? 'Retrying…' : 'Retry'}
        </button>
      </div>
      {resendMsg ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: 'var(--success)' }}>{resendMsg}</p>
      ) : null}
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No open CridoraPay bills.</p>
      ) : (
        <div className="jeweller-purchases-wrap">
          <table className="jeweller-purchases-table">
            <thead>
              <tr>
                <th scope="col">Bill</th>
                <th scope="col">Customer</th>
                <th scope="col">Amount</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = r.customer?.name || r.customer?.email || '—'
                return (
                  <tr key={r.id}>
                    <td data-label="Bill">
                      <strong className="tabular">{r.reference}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{statusLabel(r.status)}</div>
                    </td>
                    <td data-label="Customer">{label}</td>
                    <td data-label="Amount" className="tabular">
                      ₹{formatInr(r.total_inr)} · {r.weight_grams} g
                      {Number.parseFloat(r.cash_payable_inr) > 0 && r.status === 'cash_pending' ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--gold-light)' }}>
                          Cash due ₹{formatInr(r.cash_payable_inr)}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Action">
                      {r.status === 'vault_otp_pending' ? (
                        <div>
                          <input
                            className="input tabular"
                            inputMode="numeric"
                            maxLength={OTP_LEN}
                            placeholder="6-digit OTP"
                            value={otpById[r.id] ?? ''}
                            onChange={(e) =>
                              setOtpById((m) => ({ ...m, [r.id]: e.target.value.replace(/\D/g, '').slice(0, OTP_LEN) }))
                            }
                            style={{ maxWidth: 140, marginBottom: 6 }}
                          />
                          <CustomerOtpExpiryHint expiresAt={r.otp_expires_at} />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: 6 }}
                            disabled={busyId === r.id}
                            onClick={() => void verifyOtp(r.id)}
                          >
                            Verify vault OTP
                          </button>
                        </div>
                      ) : null}
                      {r.status === 'upi_pending' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === r.id}
                          onClick={() => void markUpiPaid(r.id)}
                        >
                          Mark UPI paid
                        </button>
                      ) : null}
                      {r.status === 'cash_pending' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === r.id}
                          onClick={() => void markCashPaid(r.id)}
                        >
                          Mark cash paid
                        </button>
                      ) : null}
                      {r.status === 'awaiting_customer' ? (
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Waiting for customer</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busyId === r.id || listBusy}
                            onClick={() => void resendNotify(r.id)}
                          >
                            Notify customer again
                          </button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
