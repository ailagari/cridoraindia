import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  customerCridoraPayAccept,
  customerCridoraPayIssueVaultOtp,
  customerCridoraPayList,
  customerCridoraPayQuote,
  type CridoraPayBillDTO,
  type CridoraPayQuote,
} from '@/lib/cridorapayApi'
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
  if (s === 'awaiting_customer') return 'Review & pay'
  if (s === 'upi_pending') return 'Pay by UPI'
  if (s === 'vault_otp_pending') return 'Vault OTP'
  if (s === 'cash_pending') return 'Pay balance at counter'
  if (s === 'completed') return 'Complete'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'expired') return 'Expired'
  return s
}

function OtpLive({ otp, expiresAt }: { otp: string; expiresAt: string }) {
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

type PayMode = 'vault' | 'upi'

export function CustomerCridoraPayPanel() {
  const { user } = useAuth()
  const [rows, setRows] = useState<CridoraPayBillDTO[]>([])
  const [msg, setMsg] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [listBusy, setListBusy] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [payModeById, setPayModeById] = useState<Record<number, PayMode>>({})
  const [vaultGramsById, setVaultGramsById] = useState<Record<number, string>>({})
  const [quoteById, setQuoteById] = useState<Record<number, CridoraPayQuote>>({})
  const [otpReveal, setOtpReveal] = useState<{ billId: number; otp: string; expiresAt: string } | null>(null)
  const [otpPolicySeconds, setOtpPolicySeconds] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoadErr('')
    setListBusy(true)
    try {
      const out = await customerCridoraPayList('all')
      if (!out.ok) {
        setLoadErr(out.detail)
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

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null && !listBusy)

  useEffect(() => {
    void fetchFractionalCounterOtpPolicy().then((p) => {
      if (p.ok) setOtpPolicySeconds(p.otp_ttl_seconds)
    })
  }, [])

  const refreshQuote = async (bill: CridoraPayBillDTO, vaultGrams?: string) => {
    const vg = vaultGrams ?? vaultGramsById[bill.id] ?? bill.quote.vault_grams_max
    const out = await customerCridoraPayQuote(bill.id, vg)
    if (out.ok) {
      setQuoteById((m) => ({ ...m, [bill.id]: out.data }))
    }
  }

  useEffect(() => {
    for (const r of rows) {
      if (r.status === 'awaiting_customer') {
        void refreshQuote(r)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const accept = async (bill: CridoraPayBillDTO) => {
    setMsg('')
    setBusyId(bill.id)
    const mode = payModeById[bill.id] ?? 'vault'
    const quote = quoteById[bill.id] ?? bill.quote
    try {
      const body =
        mode === 'upi'
          ? { payment_method: 'upi' as const }
          : {
              payment_method: 'vault' as const,
              vault_grams: vaultGramsById[bill.id] ?? quote.vault_grams_max,
              expected_vault_grams_chosen: quote.vault_grams_chosen,
              expected_cash_payable_inr: quote.cash_payable_inr,
            }
      const out = await customerCridoraPayAccept(bill.id, body)
      if (!out.ok) {
        setMsg(out.detail)
        if (out.quote) setQuoteById((m) => ({ ...m, [bill.id]: out.quote! }))
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const issueOtp = async (billId: number) => {
    setMsg('')
    setBusyId(billId)
    try {
      const out = await customerCridoraPayIssueVaultOtp(billId)
      if (!out.ok) {
        setMsg(out.detail)
        setOtpReveal(null)
        return
      }
      if (out.data.otp && out.data.otp_expires_at) {
        setOtpReveal({ billId: out.data.id, otp: out.data.otp, expiresAt: out.data.otp_expires_at })
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const kycVerified = user?.kyc_status === 'verified'

  return (
    <div className="dash-panel-max">
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>CridoraPay</h2>
      <p className="dash-panel-lead">
        Review bills from partner jewellers, confirm weight and total, then pay with <strong>vault gold</strong> at that shop
        or <strong>UPI</strong> outside the app. Completed purchases are saved as one entry in your Gold Records.
      </p>

      {otpPolicySeconds != null ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Vault OTP codes stay valid about <strong className="tabular">{Math.round(otpPolicySeconds / 60)}</strong> minutes.
        </p>
      ) : null}

      {!kycVerified ? (
        <p className="form-error" role="alert">
          Complete KYC before paying with CridoraPay.{' '}
          <Link to="/userdashboard?section=profile_kyc">Open KYC</Link>
        </p>
      ) : null}

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="btn btn-ghost" disabled={listBusy} onClick={() => void load()}>
          {listBusy ? 'Loading…' : 'Retry'}
        </button>
      </div>

      {loadErr ? (
        <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">
          {loadErr}
        </p>
      ) : null}

      {msg ? (
        <p className="form-error" style={{ marginBottom: '1rem' }} role="alert">
          {msg}
        </p>
      ) : null}

      {!loadErr && rows.length === 0 && !listBusy ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No CridoraPay bills yet. Ask the jeweller to send a bill to your Cridora member ID, then tap Retry.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rows.map((r) => {
            const quote = quoteById[r.id] ?? r.quote
            const mode = payModeById[r.id] ?? 'vault'
            const vaultAvail = Number.parseFloat(quote?.vault_grams_available ?? '0')
            const canVault = vaultAvail > 0
            return (
              <article key={r.id} className="pf-card pf-card--lift pf-card--wide">
                <header className="pf-card__head">
                  <h3 className="pf-card__title">{r.title}</h3>
                  <p className="pf-card__meta">
                    {r.reference} · {r.jeweller.business_name} · {statusLabel(r.status)}
                  </p>
                </header>
                <div style={{ padding: '0 1rem 1rem', fontSize: '0.9rem' }}>
                  <p style={{ margin: '0 0 0.5rem' }}>
                    <strong className="tabular">{r.weight_grams} g</strong> · Invoice{' '}
                    <strong className="tabular">₹{formatInr(r.total_inr)}</strong>
                  </p>
                  {r.jeweller_note ? (
                    <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {r.jeweller_note}
                    </p>
                  ) : null}

                  {r.status === 'awaiting_customer' && quote ? (
                    <>
                      <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Vault at this jeweller:{' '}
                        <strong className="tabular">{quote.vault_grams_available} g</strong>
                        {canVault ? (
                          <>
                            {' '}
                            (up to <strong className="tabular">{quote.vault_grams_max} g</strong> on this bill)
                          </>
                        ) : null}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          className={mode === 'vault' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                          disabled={!canVault}
                          onClick={() => setPayModeById((m) => ({ ...m, [r.id]: 'vault' }))}
                        >
                          Pay with vault
                        </button>
                        <button
                          type="button"
                          className={mode === 'upi' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                          onClick={() => setPayModeById((m) => ({ ...m, [r.id]: 'upi' }))}
                        >
                          Pay by UPI
                        </button>
                      </div>
                      {mode === 'vault' && canVault ? (
                        <label className="pf-vault-field" style={{ maxWidth: 280, marginBottom: '0.65rem' }}>
                          <span>Vault grams to use</span>
                          <input
                            className="input tabular"
                            value={vaultGramsById[r.id] ?? quote.vault_grams_max}
                            onChange={(e) => {
                              setVaultGramsById((m) => ({ ...m, [r.id]: e.target.value }))
                              void refreshQuote(r, e.target.value)
                            }}
                          />
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Vault credit ₹{formatInr(quote.vault_inr_applied)} · Balance ₹
                            {formatInr(quote.cash_payable_inr)}
                          </span>
                        </label>
                      ) : null}
                      {mode === 'upi' ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                          You will pay ₹{formatInr(r.total_inr)} via UPI outside the app after confirming.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!kycVerified || busyId === r.id || (mode === 'vault' && !canVault)}
                        onClick={() => void accept(r)}
                      >
                        Confirm payment choice
                      </button>
                    </>
                  ) : null}

                  {r.status === 'upi_pending' ? (
                    <div style={{ fontSize: '0.88rem' }}>
                      <p style={{ margin: '0 0 0.5rem' }}>
                        Pay <strong className="tabular">₹{formatInr(r.cash_payable_inr || r.total_inr)}</strong> to:
                      </p>
                      <p className="tabular" style={{ fontWeight: 700 }}>
                        {r.payee_upi_vpa || '—'}
                      </p>
                      {r.payment_note ? (
                        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }}>
                          Note: <strong>{r.payment_note}</strong>
                        </p>
                      ) : null}
                      <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)' }}>
                        After paying, ask the jeweller to mark the bill paid in their dashboard.
                      </p>
                    </div>
                  ) : null}

                  {r.status === 'vault_otp_pending' ? (
                    <div>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem' }}>
                        Vault: <strong className="tabular">{r.vault_grams_chosen} g</strong>
                        {Number.parseFloat(r.cash_payable_inr) > 0 ? (
                          <>
                            {' '}
                            · Cash due after OTP: <strong className="tabular">₹{formatInr(r.cash_payable_inr)}</strong>
                          </>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === r.id}
                        onClick={() => void issueOtp(r.id)}
                      >
                        Generate OTP for jeweller
                      </button>
                      {otpReveal != null && otpReveal.billId === r.id ? (
                        <OtpLive otp={otpReveal.otp} expiresAt={otpReveal.expiresAt} />
                      ) : null}
                    </div>
                  ) : null}

                  {r.status === 'cash_pending' ? (
                    <p style={{ color: 'var(--gold-light)', fontWeight: 650 }}>
                      Pay ₹{formatInr(r.cash_payable_inr)} at the counter. Jeweller will mark complete.
                    </p>
                  ) : null}

                  {r.status === 'expired' || r.status === 'cancelled' ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      This bill is no longer active. Ask the jeweller to send a new one if needed.
                    </p>
                  ) : null}

                  {r.status === 'completed' ? (
                    <p style={{ color: 'var(--success)', fontWeight: 650 }}>
                      Recorded in Gold Records
                      {r.personal_holding_id ? ` (holding #${r.personal_holding_id})` : ''}.
                    </p>
                  ) : null}

                  {r.status === 'awaiting_customer' && !quote ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Could not load vault quote — tap Retry above.
                    </p>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
