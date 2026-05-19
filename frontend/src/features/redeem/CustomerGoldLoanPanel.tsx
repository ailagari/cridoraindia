import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchGoldLoanOutstanding,
  fetchGoldLoanVaultRates,
  postGoldLoanCompare,
  postGoldLoanConfirm,
  postGoldLoanOtpRegenerate,
  postGoldLoanQuote,
  type GoldLoanCompareDTO,
  type GoldLoanOfferDTO,
  type GoldLoanOutstandingDTO,
  type GoldLoanQuoteDTO,
  type GoldLoanVaultRateDTO,
} from '@/lib/goldLoanApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function eligibleOffers(data: GoldLoanCompareDTO): GoldLoanOfferDTO[] {
  return data.offers.filter((o) => o.eligible_for_request === 'true')
}

export function CustomerGoldLoanPanel() {
  const [vaultRates, setVaultRates] = useState<GoldLoanVaultRateDTO[]>([])
  const [gramsInput, setGramsInput] = useState('')
  const [compare, setCompare] = useState<GoldLoanCompareDTO | null>(null)
  const [selectedJewellerId, setSelectedJewellerId] = useState<number | null>(null)
  const [quote, setQuote] = useState<GoldLoanQuoteDTO | null>(null)
  const [outstanding, setOutstanding] = useState<GoldLoanOutstandingDTO[]>([])
  const [actionErr, setActionErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyRegen, setBusyRegen] = useState(false)
  const [otpBanner, setOtpBanner] = useState<{ code: string; expiresAt: string; loanId: number } | null>(
    null,
  )
  const compareSeq = useRef(0)

  function loanStatusHint(st: string): string {
    if (st === 'pending_jeweller') return 'awaiting jeweller'
    if (st === 'accepted_awaiting_otp') return 'jeweller accepted — share OTP after cash'
    return st.replace(/_/g, ' ')
  }

  const refreshVaultRates = useCallback(async () => {
    setVaultRates((await fetchGoldLoanVaultRates()) ?? [])
  }, [])

  const refreshOutstanding = useCallback(async () => {
    setOutstanding((await fetchGoldLoanOutstanding()) ?? [])
  }, [])

  useEffect(() => {
    void refreshVaultRates()
    void refreshOutstanding()
  }, [refreshVaultRates, refreshOutstanding])

  useLivePoll(refreshVaultRates, LIVE_BALANCE_POLL_MS, true)

  const runQuote = useCallback(async (jewellerId: number, grams: string) => {
    setBusy(true)
    setActionErr('')
    const { data, detail } = await postGoldLoanQuote(jewellerId, grams)
    setBusy(false)
    if (!data) {
      setActionErr(detail)
      setQuote(null)
      return
    }
    setQuote(data)
    setSelectedJewellerId(jewellerId)
  }, [])

  const applyCompareResult = useCallback(
    async (data: GoldLoanCompareDTO) => {
      setCompare(data)
      if (data.vault_rates?.length) {
        setVaultRates(data.vault_rates)
      }
      const eligible = eligibleOffers(data)
      if (eligible.length === 0) {
        setQuote(null)
        setSelectedJewellerId(null)
        return
      }
      if (data.skip_compare === 'true' && data.auto_selected_jeweller_id) {
        const jid = Number.parseInt(data.auto_selected_jeweller_id, 10)
        await runQuote(jid, data.grams)
        return
      }
      const first = eligible[0]
      setSelectedJewellerId(Number.parseInt(first.jeweller_id, 10))
      setQuote(null)
    },
    [runQuote],
  )

  const runCompare = useCallback(
    async (grams: string) => {
      const seq = ++compareSeq.current
      setBusy(true)
      setActionErr('')
      setSuccessMsg('')
      setQuote(null)
      setCompare(null)
      setSelectedJewellerId(null)
      const { data, detail } = await postGoldLoanCompare(grams)
      if (seq !== compareSeq.current) return
      setBusy(false)
      if (!data) {
        setActionErr(detail)
        return
      }
      await applyCompareResult(data)
    },
    [applyCompareResult],
  )

  useEffect(() => {
    const g = gramsInput.trim()
    if (!g || parseG(g) <= 0) {
      setCompare(null)
      setQuote(null)
      setSelectedJewellerId(null)
      return
    }
    const t = window.setTimeout(() => {
      void runCompare(g)
    }, 450)
    return () => window.clearTimeout(t)
  }, [gramsInput, runCompare])

  const onSelectOffer = (offer: GoldLoanOfferDTO) => {
    void runQuote(Number.parseInt(offer.jeweller_id, 10), offer.grams)
  }

  const onConfirm = async () => {
    if (!selectedJewellerId || !compare) return
    setBusy(true)
    setActionErr('')
    const out = await postGoldLoanConfirm(selectedJewellerId, compare.grams)
    setBusy(false)
    if (!out.ok) {
      setActionErr(out.detail)
      return
    }
    setSuccessMsg(out.detail)
    if (out.otp_code && out.loan.id) {
      setOtpBanner({
        code: out.otp_code,
        expiresAt: out.otp_expires_at ?? '',
        loanId: out.loan.id,
      })
    }
    setQuote(null)
    setCompare(null)
    setGramsInput('')
    void refreshOutstanding()
    void refreshVaultRates()
  }

  const runRegenerate = async (loanId: number) => {
    setBusyRegen(true)
    setActionErr('')
    const out = await postGoldLoanOtpRegenerate(loanId)
    setBusyRegen(false)
    if (!out.ok) {
      setActionErr(out.detail)
      return
    }
    setOtpBanner({ code: out.otp_code, expiresAt: out.otp_expires_at, loanId })
    setSuccessMsg('New OTP issued. Previous code is invalid.')
  }

  const showOtpBlock =
    otpBanner != null &&
    outstanding.some(
      (o) =>
        o.id === otpBanner.loanId &&
        (o.status === 'pending_jeweller' || o.status === 'accepted_awaiting_otp'),
    )

  const displayRates = useMemo(() => {
    if (compare?.vault_rates?.length) return compare.vault_rates
    return vaultRates
  }, [compare, vaultRates])

  const showCompareList =
    compare != null && compare.skip_compare !== 'true' && eligibleOffers(compare).length > 1

  const singleJewellerQuote =
    compare != null && compare.skip_compare === 'true' && quote != null

  return (
    <div className="dash-panel-max">
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55, marginTop: 0 }}>
        Borrow only against <strong>your vault gold</strong> at jewellers where you hold fractional or deposit
        grams. Loan ₹/g is shown per vault custodian; offers update when you enter grams.
      </p>

      {actionErr ? <p className="form-error">{actionErr}</p> : null}
      {successMsg ? (
        <p style={{ color: 'var(--success)', fontSize: '0.88rem' }}>{successMsg}</p>
      ) : null}

      <div className="card" style={{ padding: '1rem', borderRadius: 16, marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Your vault holdings &amp; loan rates</h3>
        {displayRates.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No custodied fractional or deposit gold yet.{' '}
            <Link to="/userdashboard?section=invest_fractional">Buy fractional gold</Link> or{' '}
            <Link to="/userdashboard?section=invest_deposit">deposit physical gold</Link> first.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {displayRates.map((v) => (
              <div
                key={v.jeweller_id}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.9rem' }}>
                    {v.jeweller_label}
                    {v.is_primary_custodian === 'true' ? ' (primary)' : ' (secondary)'}
                  </strong>
                  <span className="tabular" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {parseG(v.eligible_vault_balance_grams).toFixed(3)} g eligible
                  </span>
                </div>
                {v.loan_available === 'true' ? (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Metal ₹{fmtInr(v.reference_metal_inr_per_gram)}/g · {v.ltv_percent}% LTV →{' '}
                    <strong style={{ color: 'var(--gold-light)' }}>
                      net loan ₹{fmtInr(v.net_loan_inr_per_gram)}/g
                    </strong>{' '}
                    <span style={{ opacity: 0.85 }}>
                      (gross ₹{fmtInr(v.gross_loan_inr_per_gram)}/g before {v.processing_fee_percent}% fee)
                    </span>
                  </p>
                ) : (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {v.loan_unavailable_reason || 'Loan not available at this jeweller.'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="field">
        <span>Grams to pledge</span>
        <input
          inputMode="decimal"
          value={gramsInput}
          onChange={(e) => setGramsInput(e.target.value)}
          placeholder="e.g. 10"
        />
      </label>

      {busy && gramsInput.trim() ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Calculating loan for your vault jewellers…
        </p>
      ) : null}

      {compare ? (
        <div style={{ marginTop: '1.25rem' }}>
          {eligibleOffers(compare).length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              None of your vault jewellers can offer a loan for this amount. Try fewer grams or ask your jeweller
              to enable loans and set a loan %.
            </p>
          ) : null}

          {showCompareList ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>Compare offers</p>
              {eligibleOffers(compare).map((o) => (
                <button
                  key={o.jeweller_id}
                  type="button"
                  className="card"
                  style={{
                    textAlign: 'left',
                    padding: '0.85rem 1rem',
                    borderRadius: 14,
                    cursor: 'pointer',
                    border:
                      selectedJewellerId === Number.parseInt(o.jeweller_id, 10)
                        ? '1px solid var(--gold-light)'
                        : '1px solid var(--border-soft)',
                    background:
                      selectedJewellerId === Number.parseInt(o.jeweller_id, 10)
                        ? 'var(--gold-shine-12)'
                        : 'var(--veil)',
                  }}
                  onClick={() => onSelectOffer(o)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>
                      {o.jeweller_label}
                      {o.is_primary_custodian === 'true' ? ' · primary' : ''}
                    </strong>
                    <span className="tabular" style={{ fontWeight: 800, color: 'var(--gold-light)' }}>
                      ₹{fmtInr(o.net_disbursement_inr)} net
                    </span>
                  </div>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ₹{fmtInr(o.net_loan_inr_per_gram ?? '0')}/g net · {o.ltv_percent}% LTV · fee ₹
                    {fmtInr(o.processing_fee_inr)}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {quote && (showCompareList || singleJewellerQuote) ? (
            <div className="card" style={{ marginTop: '1rem', padding: '1rem', borderRadius: 16 }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>
                {singleJewellerQuote ? 'Your loan offer' : 'Quote'} — {quote.jeweller_label}
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                ₹{fmtInr(quote.net_loan_inr_per_gram ?? '0')}/g net · collateral ₹
                {fmtInr(quote.collateral_value_inr)} ({quote.grams} g) → you receive ₹
                {fmtInr(quote.net_disbursement_inr)} after {quote.processing_fee_percent}% processing fee.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '0.85rem' }}
                disabled={busy}
                onClick={() => void onConfirm()}
              >
                Submit loan request
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {(outstanding.length > 0 || showOtpBlock) ? (
        <div
          className="card"
          style={{
            marginTop: '1.5rem',
            padding: '1rem 1.15rem',
            borderRadius: 16,
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Open loan requests</h3>
          {otpBanner && showOtpBlock ? (
            <div style={{ marginBottom: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Settlement OTP (share only after you receive cash){' '}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.68rem', padding: '0.2rem 0.45rem', marginLeft: '0.35rem' }}
                  disabled={busyRegen}
                  onClick={() => void runRegenerate(otpBanner.loanId)}
                >
                  {busyRegen ? '…' : 'Regenerate OTP'}
                </button>
              </p>
              <p
                className="tabular"
                style={{
                  margin: '0.35rem 0 0',
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: 'var(--gold-light)',
                }}
              >
                {otpBanner.code}
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                Expires{' '}
                {otpBanner.expiresAt
                  ? new Date(otpBanner.expiresAt).toLocaleString('en-IN')
                  : '—'}
              </p>
            </div>
          ) : null}
          {outstanding.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {outstanding.map((r) => (
                <li key={r.id} style={{ marginBottom: '0.35rem' }}>
                  <strong className="tabular">{r.reference}</strong> · {r.jeweller_label} ·{' '}
                  <span className="tabular">{r.grams} g</span> · ₹{fmtInr(r.net_disbursement_inr)} ·{' '}
                  <span style={{ color: 'var(--text)' }}>{loanStatusHint(r.status)}</span>
                  {r.status === 'pending_jeweller' && !showOtpBlock ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', marginLeft: '0.35rem' }}
                      disabled={busyRegen}
                      onClick={() => void runRegenerate(r.id)}
                    >
                      Get OTP
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
