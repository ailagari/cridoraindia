import { useState } from 'react'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { settlementOtpIssue, settlementOtpVerify } from '@/lib/adminTreasuryApi'

const OTP_LEN = 6

type Props = {
  paymentId: number
  role: 'admin' | 'jeweller'
  amountInr?: string
  busy?: boolean
  onBusyChange?: (v: boolean) => void
  onIssued?: () => void
  onError?: (message: string) => void
}

export function SettlementOtpPayerStep({
  paymentId,
  role,
  amountInr,
  busy = false,
  onBusyChange,
  onIssued,
  onError,
}: Props) {
  const [otp, setOtp] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const countdown = useCounterOtpCountdown(expiresAt)

  const issue = async () => {
    onBusyChange?.(true)
    setErr('')
    const out = await settlementOtpIssue(paymentId, role)
    onBusyChange?.(false)
    if (!out.ok) {
      setErr(out.detail)
      onError?.(out.detail)
      return
    }
    setOtp(out.data.otp ?? null)
    setExpiresAt(out.data.expires_at ?? out.data.otp_expires_at ?? null)
    onIssued?.()
  }

  return (
    <div className="dash-stat-card" style={{ maxWidth: '24rem' }}>
      <span className="dash-stat-card__label">Offline settlement OTP</span>
      {amountInr ? (
        <p style={{ margin: '0.35rem 0', fontSize: '0.9rem' }}>
          Amount: <strong className="tabular">₹{amountInr}</strong>
        </p>
      ) : null}
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        After paying offline, generate a code and share it with the receiver to confirm receipt.
      </p>
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      {otp ? (
        <div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Share this code</p>
          <p className="tabular" style={{ margin: '0.35rem 0', fontSize: '1.75rem', letterSpacing: '0.2em' }}>
            {otp}
          </p>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            Expires in <strong>{countdown.labelMmSs}</strong>
            {countdown.expired ? ' (expired — regenerate)' : ''}
          </p>
          <button type="button" className="btn btn-ghost" style={{ marginTop: '0.75rem' }} disabled={busy} onClick={() => void issue()}>
            Regenerate OTP
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void issue()}>
          Generate OTP
        </button>
      )}
    </div>
  )
}

export function SettlementOtpVerifyInput({
  paymentId,
  role,
  reference,
  busy = false,
  onBusyChange,
  onDone,
  onError,
}: {
  paymentId: number
  role: 'admin' | 'jeweller'
  reference?: string
  busy?: boolean
  onBusyChange?: (v: boolean) => void
  onDone?: (message: string) => void
  onError?: (message: string) => void
}) {
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')

  const verify = async () => {
    const cleaned = otp.trim().replace(/\s/g, '')
    if (cleaned.length !== OTP_LEN) {
      setErr(`Enter all ${OTP_LEN} digits from the payer.`)
      return
    }
    onBusyChange?.(true)
    setErr('')
    const out = await settlementOtpVerify(paymentId, cleaned, role)
    onBusyChange?.(false)
    if (!out.ok) {
      setErr(out.detail)
      onError?.(out.detail)
      return
    }
    setOtp('')
    onDone?.(`Verified ${reference ?? 'payment'}.`)
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '16rem' }}>
      <label>
        OTP from payer
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LEN}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LEN))}
        />
      </label>
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void verify()}>
        Verify OTP
      </button>
    </div>
  )
}
