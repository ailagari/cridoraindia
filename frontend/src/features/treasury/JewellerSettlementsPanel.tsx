import { useCallback, useEffect, useState } from 'react'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { UpiProofReviewActions } from '@/features/upi/UpiProofReviewActions'
import {
  SettlementOtpPayerStep,
  SettlementOtpVerifyInput,
} from '@/features/treasury/SettlementOtpSteps'
import {
  jewellerTreasuryPaymentInitiate,
  jewellerTreasuryPayments,
  jewellerTreasurySummary,
  type JewellerSettlementSummary,
  type SettlementPaymentRow,
} from '@/lib/adminTreasuryApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

type PayMethod = 'upi' | 'otp'

export function JewellerSettlementsPanel() {
  const [summary, setSummary] = useState<JewellerSettlementSummary | null>(null)
  const [payments, setPayments] = useState<SettlementPaymentRow[]>([])
  const [payMethod, setPayMethod] = useState<PayMethod>('upi')
  const [activePaymentId, setActivePaymentId] = useState<number | null>(null)
  const [activeAmount, setActiveAmount] = useState('')
  const [activeMethod, setActiveMethod] = useState<PayMethod>('upi')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const [sumOut, payOut] = await Promise.all([jewellerTreasurySummary(), jewellerTreasuryPayments()])
    if (sumOut.ok) {
      setSummary(sumOut.data)
      const active = sumOut.data.active_payment
      if (active && (active.status === 'pending_proof' || active.status === 'submitted')) {
        setActivePaymentId(active.id)
        setActiveAmount(active.amount_inr)
        setActiveMethod(active.payment_method)
      } else {
        setActivePaymentId(null)
      }
    } else {
      setErr(sumOut.detail)
    }
    if (payOut.ok) setPayments(payOut.results)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busy)

  const startPayment = async () => {
    if (!summary || summary.direction !== 'pay') return
    setBusy(true)
    setErr('')
    setMsg('')
    const out = await jewellerTreasuryPaymentInitiate({ payment_method: payMethod })
    setBusy(false)
    if (!out.ok) {
      setErr(out.detail)
      return
    }
    setActivePaymentId(out.data.id)
    setActiveAmount(out.data.amount_inr)
    setActiveMethod(out.data.payment_method)
    setMsg(`Settlement payment SET-${out.data.id} started.`)
    await load()
  }

  const incomingOtp = payments.filter(
    (p) =>
      p.direction === 'platform_to_jeweller' &&
      p.payment_method === 'otp' &&
      p.status === 'submitted' &&
      !p.otp_verified,
  )
  const incomingUpi = payments.filter(
    (p) =>
      p.direction === 'platform_to_jeweller' &&
      p.payment_method === 'upi' &&
      p.status === 'submitted',
  )

  const directionLabel =
    summary?.direction === 'pay'
      ? 'You owe Cridora'
      : summary?.direction === 'receive'
        ? 'Cridora owes you'
        : 'Settled up'

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Platform fee settlement — pay Cridora via UPI or offline OTP, and confirm incoming platform payouts.
      </p>

      {summary ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="dash-stat-card">
            <span className="dash-stat-card__label">{directionLabel}</span>
            <strong className="tabular">
              ₹
              {formatInr(
                summary.direction === 'receive' ? summary.net_credit_inr : summary.net_payable_inr,
              )}
            </strong>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-card__label">Fees accrued</span>
            <strong className="tabular">₹{formatInr(summary.fees_accrued_inr)}</strong>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-card__label">In flight</span>
            <strong className="tabular">₹{formatInr(summary.in_flight_inr)}</strong>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? <p className="form-success">{msg}</p> : null}

      {summary?.direction === 'pay' && !activePaymentId ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Pay net amount</h3>
          <DashSegmentPair
            items={[
              { id: 'upi', label: 'UPI' },
              { id: 'otp', label: 'Offline OTP' },
            ]}
            value={payMethod}
            onChange={(id) => setPayMethod(id as PayMethod)}
            ariaLabel="Settlement payment method"
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '0.75rem' }}
            disabled={busy || Number.parseFloat(summary.net_payable_inr) <= 0}
            onClick={() => void startPayment()}
          >
            Pay ₹{formatInr(summary.net_payable_inr)}
          </button>
        </section>
      ) : null}

      {activePaymentId && activeMethod === 'upi' ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>UPI payment</h3>
          <UpiPaymentStep
            kind="settlement"
            paymentId={activePaymentId}
            busy={busy}
            setBusy={setBusy}
            onSubmitted={() => void load()}
            onSuccess={(m) => setMsg(m)}
            onError={(m) => setErr(m)}
          />
        </section>
      ) : null}

      {activePaymentId && activeMethod === 'otp' ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Offline payment OTP</h3>
          <SettlementOtpPayerStep
            paymentId={activePaymentId}
            role="jeweller"
            amountInr={activeAmount}
            busy={busy}
            onBusyChange={setBusy}
            onIssued={() => {
              setMsg('OTP generated — share with Cridora admin.')
              void load()
            }}
            onError={(m) => setErr(m)}
          />
        </section>
      ) : null}

      {incomingUpi.length > 0 || incomingOtp.length > 0 ? (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Incoming platform payouts</h3>
          {incomingUpi.map((p) => (
            <div key={p.id} style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                SET-{p.id} · ₹{formatInr(p.amount_inr)} · UPI
              </p>
              <UpiProofReviewActions
                kind="settlement"
                paymentId={p.id}
                reference={`SET-${p.id}`}
                amountInr={p.amount_inr}
                upiUtr={p.upi_utr || p.utr}
                proofFileUrl={p.proof_file_url || p.receipt_url}
                busy={busy}
                onBusyChange={setBusy}
                onDone={(m) => {
                  setMsg(m)
                  void load()
                }}
                onError={(m) => setErr(m)}
              />
            </div>
          ))}
          {incomingOtp.map((p) => (
            <div key={p.id} style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                SET-{p.id} · ₹{formatInr(p.amount_inr)} · OTP
              </p>
              <SettlementOtpVerifyInput
                paymentId={p.id}
                role="jeweller"
                reference={`SET-${p.id}`}
                busy={busy}
                onBusyChange={setBusy}
                onDone={(m) => {
                  setMsg(m)
                  void load()
                }}
                onError={(m) => setErr(m)}
              />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
