import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoldDepositsTable } from '@/features/invest/GoldDepositsTable'
import {
  customerGoldDepositIssueOtp,
  customerGoldDepositList,
} from '@/lib/goldDepositApi'
import { fetchFractionalCounterOtpPolicy } from '@/lib/fractionalPurchaseApi'
import { useAuth } from '@/context/AuthContext'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

export function CustomerGoldDepositPanel() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Awaited<ReturnType<typeof customerGoldDepositList>>>([])
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
          Refresh
        </button>
      </div>

      {msg ? (
        <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">
          {msg}
        </p>
      ) : null}

      <GoldDepositsTable
        role="customer"
        rows={rows}
        busyId={busyId}
        kycVerified={kycVerified}
        otpReveal={otpReveal}
        onIssueOtp={(id) => void issue(id)}
      />
    </div>
  )
}
