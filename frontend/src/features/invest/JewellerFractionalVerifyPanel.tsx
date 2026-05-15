import { useCallback, useEffect, useRef, useState } from 'react'
import {
  jewellerFractionalPending,
  jewellerFractionalVerify,
  type JewellerFractionalPendingRow,
} from '@/lib/fractionalPurchaseApi'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

type VerifiedReceipt = {
  reference: string
  grams: string
  totalInr: string
  customerLabel: string
}

const OTP_LEN = 6

function formatExpiryShort(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function CustomerOtpExpiryHint({ expiresAt }: { expiresAt?: string | null }) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt ?? null)
  if (expiresAt == null || expiresAt === '') {
    return (
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
        No OTP issued yet — customer taps Generate OTP after paying.
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

export function JewellerFractionalVerifyPanel() {
  const [rows, setRows] = useState<JewellerFractionalPendingRow[]>([])
  const [verifiedReceipt, setVerifiedReceipt] = useState<VerifiedReceipt | null>(null)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [otpByOrderId, setOtpByOrderId] = useState<Record<number, string>>({})
  const successRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setErr('')
    setRows(await jewellerFractionalPending())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  useEffect(() => {
    if (verifiedReceipt && successRef.current) {
      successRef.current.focus()
    }
  }, [verifiedReceipt])

  const verify = async (id: number) => {
    const otp = (otpByOrderId[id] ?? '').trim()
    if (otp.length !== OTP_LEN) {
      setErr(`Enter all ${OTP_LEN} digits from the customer’s app.`)
      return
    }
    const row = rows.find((r) => r.id === id)
    const customerLabel = row ? row.customer.name || row.customer.email : 'Customer'

    setBusyId(id)
    setErr('')
    try {
      const out = await jewellerFractionalVerify(id, otp)
      if (!out.ok) {
        setErr(out.detail)
        return
      }
      setVerifiedReceipt({
        reference: out.data.reference,
        grams: out.data.grams,
        totalInr: out.data.total_inr,
        customerLabel,
      })
      setOtpByOrderId((m) => {
        const next = { ...m }
        delete next[id]
        return next
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dash-panel-max jeweller-counter-verify-panel">
      <p className="dash-panel-lead">
        When a customer pays at your counter, they generate a <strong>6-digit OTP</strong> in their Cridora app after paying.
        Enter that code below — when it matches, their gold is credited and a matching <strong>custodial liability</strong> is
        recorded on your ledger.
      </p>

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh queue
        </button>
      </div>

      {verifiedReceipt ? (
        <div
          ref={successRef}
          tabIndex={-1}
          className="admin-dash-form-success admin-dash-form-success--block"
          style={{
            maxWidth: '42rem',
            padding: '1rem 1.15rem',
            marginBottom: '1.25rem',
            outline: 'none',
            boxShadow: '0 0 0 2px var(--success-ring)',
          }}
          role="status"
          aria-live="polite"
          aria-label="Payment verified successfully"
        >
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.25)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.25rem',
              }}
            >
              ✓
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)' }}>Payment verified</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.45 }}>
                Order <strong className="tabular">{verifiedReceipt.reference}</strong> —{' '}
                <strong className="tabular">{verifiedReceipt.customerLabel}</strong> has been credited{' '}
                <strong className="tabular">{verifiedReceipt.grams} g</strong> for{' '}
                <strong className="tabular">₹{formatInr(verifiedReceipt.totalInr)}</strong> (incl. GST). Custodial liability
                updated on your books.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: '0.65rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setVerifiedReceipt(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="form-error" style={{ marginBottom: '1rem', maxWidth: '42rem' }} role="alert">
          {err}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No counter payments awaiting OTP verification.</p>
      ) : (
        <div className="jeweller-purchases-wrap">
          <table className="jeweller-purchases-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Metal &amp; total</th>
                <th scope="col">Order</th>
                <th scope="col">Verify OTP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const otp = otpByOrderId[r.id] ?? ''
                const otpComplete = otp.length === OTP_LEN
                return (
                  <tr key={r.id}>
                    <td data-label="Customer">
                      <div className="jeweller-purchases-customer-stack">
                        <strong className="jeweller-purchases-customer-name">
                          {r.customer.name || r.customer.email}
                        </strong>
                        <span className="jeweller-purchases-customer-email">{r.customer.email}</span>
                        {r.customer.cridora_member_id ? (
                          <span className="jeweller-purchases-member">
                            Member ID{' '}
                            <strong className="tabular">{r.customer.cridora_member_id}</strong>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Metal & total">
                      <div className="jeweller-purchases-metal-stack">
                        <span>
                          <strong className="tabular">{r.grams} g</strong>
                        </span>
                        <span>
                          <strong className="tabular">₹{formatInr(r.total_inr)}</strong> total (incl. GST)
                        </span>
                      </div>
                    </td>
                    <td data-label="Order">
                      <div className="jeweller-purchases-order-stack">
                        <span className="jeweller-purchases-order-ref">
                          <strong className="tabular">{r.reference}</strong>
                        </span>
                        <span className="jeweller-purchases-order-rate">
                          rate ₹{formatInr(r.metal_rate_inr_per_gram)}/g (22K metal)
                        </span>
                        {r.customer_note ? (
                          <span className="jeweller-purchases-note">Note: {r.customer_note}</span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Verify OTP" className="jeweller-purchases-otp-cell">
                      <div className="jeweller-purchases-otp-stack">
                        <p className="jeweller-purchases-otp-lead">
                          Ask them to open <strong>Buy gold</strong> and tap <strong>Generate OTP</strong> after payment.
                          Enter the {OTP_LEN}-digit code exactly as shown.
                        </p>
                        <label htmlFor={`otp-${r.id}`} className="sr-only">
                          6-digit OTP for order {r.reference}
                        </label>
                        <input
                          id={`otp-${r.id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="one-time-code"
                          maxLength={OTP_LEN}
                          className="tabular jeweller-purchases-otp-input"
                          style={{
                            border: otpComplete ? '2px solid var(--success)' : '1px solid var(--border-soft)',
                          }}
                          value={otp}
                          onChange={(e) => {
                            setErr('')
                            setOtpByOrderId((m) => ({
                              ...m,
                              [r.id]: e.target.value.replace(/\D/g, '').slice(0, OTP_LEN),
                            }))
                          }}
                          placeholder="······"
                          aria-describedby={`otp-hint-${r.id}`}
                        />
                        <p id={`otp-hint-${r.id}`} className="jeweller-purchases-otp-count">
                          {otp.length}/{OTP_LEN} digits
                        </p>
                        <CustomerOtpExpiryHint expiresAt={r.otp_expires_at} />
                        <button
                          type="button"
                          className="btn btn-primary jeweller-purchases-verify-btn"
                          disabled={busyId != null || !otpComplete}
                          onClick={() => void verify(r.id)}
                        >
                          {busyId === r.id ? 'Verifying…' : 'Verify OTP & credit gold'}
                        </button>
                      </div>
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
