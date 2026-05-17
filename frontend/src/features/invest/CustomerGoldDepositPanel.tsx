import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  customerGoldDepositIssueOtp,
  customerGoldDepositList,
  type GoldDepositIntakeDTO,
} from '@/lib/goldDepositApi'
import { fetchFractionalCounterOtpPolicy } from '@/lib/fractionalPurchaseApi'
import { useAuth } from '@/context/AuthContext'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function statusLabel(s: string): string {
  if (s === 'awaiting_customer_otp') return 'Awaiting your OTP'
  if (s === 'completed') return 'Credited'
  if (s === 'cancelled') return 'Cancelled'
  return s
}

function OtpLive({
  otp,
  expiresAt,
}: {
  otp: string
  expiresAt: string
}) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt)
  return (
    <div
      style={{
        marginTop: '0.75rem',
        padding: '0.85rem 1rem',
        borderRadius: 12,
        border: '1px solid var(--border-soft)',
        background: 'rgba(0, 8, 20, 0.35)',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
        Show this code only to your jeweller
      </p>
      <p
        className="tabular"
        style={{
          margin: '0.35rem 0 0',
          fontSize: '1.65rem',
          fontWeight: 800,
          letterSpacing: '0.2em',
          color: expired ? 'var(--danger)' : 'var(--gold-light)',
        }}
      >
        {otp}
      </p>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: expired ? 'var(--danger)' : 'var(--text-muted)' }}>
        {expired ? 'Expired — generate a new code.' : `Valid ${labelMmSs}`}
      </p>
    </div>
  )
}

export function CustomerGoldDepositPanel() {
  const { user } = useAuth()
  const [rows, setRows] = useState<GoldDepositIntakeDTO[]>([])
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [otpReveal, setOtpReveal] = useState<{ intakeId: number; otp: string; expiresAt: string } | null>(
    null,
  )
  const [otpPolicySeconds, setOtpPolicySeconds] = useState<number | null>(null)

  const load = useCallback(async () => {
    setRows(await customerGoldDepositList())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  useEffect(() => {
    void fetchFractionalCounterOtpPolicy().then((p) => {
      if (p.ok) setOtpPolicySeconds(p.otp_ttl_seconds)
    })
  }, [])

  const issue = async (intakeId: number) => {
    setMsg('')
    setBusyId(intakeId)
    try {
      const out = await customerGoldDepositIssueOtp(intakeId)
      if (!out.ok) {
        setMsg(out.detail)
        setOtpReveal(null)
        return
      }
      if (out.data.otp && out.data.otp_expires_at) {
        setOtpReveal({ intakeId: out.data.id, otp: out.data.otp, expiresAt: out.data.otp_expires_at })
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const kycVerified = user?.kyc_status === 'verified'

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        <strong>Gold deposit</strong> converts verified physical gold at a partner jeweller into <strong>deposit-class</strong>{' '}
        vault grams on Cridora. The showroom records weight and purity; you confirm with a one-time code (same OTP window as
        counter buys). Funds are not moved in-app — this flow credits digital grams only.
      </p>

      {otpPolicySeconds != null ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          OTP codes stay valid about <strong className="tabular">{Math.round(otpPolicySeconds / 60)}</strong> minutes.
        </p>
      ) : null}

      {!kycVerified ? (
        <p className="form-error" role="alert">
          Complete KYC before confirming a deposit.{' '}
          <Link to="/userdashboard?section=profile_kyc">Open KYC</Link>
        </p>
      ) : null}

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link className="btn btn-ghost" to="/userdashboard?section=shop_jewellers">
          Browse jewellers
        </Link>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh list
        </button>
      </div>

      {msg ? (
        <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">
          {msg}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No deposit intakes yet. When a jeweller creates one for you, it appears here.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {rows.map((r) => (
            <article key={r.id} className="pf-card pf-card--lift" style={{ maxWidth: 560 }}>
              <header className="pf-card__head" style={{ paddingBottom: '0.5rem' }}>
                <div>
                  <h3 className="pf-card__title">{r.reference}</h3>
                  <p className="pf-card__meta">
                    {r.jeweller.business_name}
                    {r.jeweller.city ? ` · ${r.jeweller.city}` : ''} · {statusLabel(r.status)}
                  </p>
                </div>
              </header>
              <div style={{ padding: '0 1rem 1rem' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <strong className="tabular">{r.grams} g</strong> · purity {r.purity_karat} · est. value{' '}
                  <strong className="tabular">₹{formatInr(r.estimated_value_inr)}</strong> @ ref. ₹
                  {formatInr(r.reference_metal_inr_per_gram)}/g
                </p>
                {r.jeweller_note ? (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Note from jeweller: {r.jeweller_note}
                  </p>
                ) : null}
                {r.status === 'awaiting_customer_otp' && kycVerified ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: '0.85rem' }}
                    disabled={busyId != null}
                    onClick={() => void issue(r.id)}
                  >
                    {busyId === r.id ? 'Generating…' : 'Generate OTP for jeweller'}
                  </button>
                ) : null}
                {otpReveal && otpReveal.intakeId === r.id ? (
                  <OtpLive otp={otpReveal.otp} expiresAt={otpReveal.expiresAt} />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
