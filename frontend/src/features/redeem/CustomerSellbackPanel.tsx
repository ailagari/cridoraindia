import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCustomerPayoutUpiProfile,
  fetchGoldWallet,
  fetchSellbackOutstanding,
  postGoldSellbackConfirm,
  postGoldSellbackQuote,
  postSellbackOtpRegenerate,
  type GoldWalletDTO,
  type SellbackOutstandingDTO,
  type SellbackQuoteDTO,
} from '@/lib/goldTransferApi'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { UpiProofReviewActions } from '@/features/upi/UpiProofReviewActions'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { fetchPlatformFeatures, isFeatureEnabled } from '@/lib/platformFeatures'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function normalizeCashInr(raw: string): string | null {
  const n = Number.parseFloat(raw.trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return n.toFixed(2)
}

function statusHint(st: string, paymentMethod?: string): string {
  if (st === 'pending_jeweller') {
    return paymentMethod === 'upi'
      ? 'Waiting for jeweller to accept your UPI payout request.'
      : 'Waiting for jeweller to accept or reject.'
  }
  if (st === 'accepted_awaiting_otp') {
    return paymentMethod === 'upi'
      ? 'Jeweller accepted — awaiting UPI payout to your account.'
      : 'Jeweller accepted — receive cash at the showroom, then share your OTP when they call you.'
  }
  if (st === 'awaiting_utr_verify' || st === 'pending_review') {
    return 'Review jeweller payout proof below (UTR / screenshot).'
  }
  if (st === 'proof_rejected') return 'Jeweller must re-upload payout proof.'
  if (st === 'on_hold') return 'On hold — visit jeweller in person.'
  return st
}

const PAYOUT_METHODS = [
  { id: 'cash', label: 'Cash at counter' },
  { id: 'upi', label: 'UPI payout' },
] as const

export function CustomerSellbackPanel() {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [jewellerId, setJewellerId] = useState<number | null>(null)
  const [inputMode, setInputMode] = useState<'grams' | 'cash'>('grams')
  const [gramsInput, setGramsInput] = useState('')
  const [cashInput, setCashInput] = useState('')
  const [quote, setQuote] = useState<SellbackQuoteDTO | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [confirmErr, setConfirmErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busyQuote, setBusyQuote] = useState(false)
  const [busyConfirm, setBusyConfirm] = useState(false)
  const [outstanding, setOutstanding] = useState<SellbackOutstandingDTO[]>([])
  const [otpBanner, setOtpBanner] = useState<{ code: string; expiresAt: string; sellbackId: number } | null>(null)
  const [busyRegen, setBusyRegen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash')
  const [payoutUpiVpa, setPayoutUpiVpa] = useState('')
  const [busyUpi, setBusyUpi] = useState(false)
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean> | null>(null)

  const sellbackUpiEnabled = isFeatureEnabled(featureFlags, 'sellback_upi')

  const refreshWallet = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load wallet.')
      setWallet(null)
      return
    }
    setWallet(w)
  }, [])

  const refreshOutstanding = useCallback(async () => {
    const rows = await fetchSellbackOutstanding()
    setOutstanding(rows ?? [])
  }, [])

  useEffect(() => {
    void fetchPlatformFeatures().then((p) => setFeatureFlags(p?.flags ?? null))
  }, [])

  useEffect(() => {
    if (!sellbackUpiEnabled && paymentMethod === 'upi') {
      setPaymentMethod('cash')
    }
  }, [sellbackUpiEnabled, paymentMethod])

  useEffect(() => {
    if (!sellbackUpiEnabled) return
    void fetchCustomerPayoutUpiProfile().then((out) => {
      if (out.ok && out.data.payout_upi_vpa) setPayoutUpiVpa(out.data.payout_upi_vpa)
    })
  }, [sellbackUpiEnabled])

  useEffect(() => {
    void refreshWallet()
    void refreshOutstanding()
  }, [refreshWallet, refreshOutstanding])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)
  useLivePoll(refreshOutstanding, LIVE_BALANCE_POLL_MS, true)

  const vaultOpts = useMemo(() => {
    const rows = wallet?.vaults ?? []
    return rows.filter((v) => parseG(v.fractional_grams) > 0)
  }, [wallet])

  useEffect(() => {
    if (jewellerId != null) return
    if (vaultOpts.length === 0) return
    setJewellerId(vaultOpts[0].custodian_id)
  }, [vaultOpts, jewellerId])

  const selectedVault = useMemo(() => {
    if (jewellerId == null) return undefined
    return vaultOpts.find((v) => v.custodian_id === jewellerId)
  }, [vaultOpts, jewellerId])

  const clearQuote = () => {
    setQuote(null)
    setQuoteErr('')
    setConfirmErr('')
    setSuccessMsg('')
  }

  const onGramsChange = (v: string) => {
    setGramsInput(v)
    clearQuote()
  }

  const onCashChange = (v: string) => {
    setCashInput(v)
    clearQuote()
  }

  const onJewellerChange = (id: number) => {
    setJewellerId(id)
    clearQuote()
  }

  const switchMode = (m: 'grams' | 'cash') => {
    setInputMode(m)
    clearQuote()
  }

  const quoteFresh = useMemo(() => {
    if (quote == null || jewellerId == null || quote.jeweller_id !== jewellerId) return false
    if (quote.quote_input_mode === 'grams') {
      return gramsInput.trim() === quote.grams
    }
    const nc = normalizeCashInr(cashInput)
    return nc != null && quote.requested_cash_inr === nc
  }, [quote, jewellerId, gramsInput, cashInput])

  const runQuote = async () => {
    if (jewellerId == null) {
      setQuoteErr('Pick a jeweller vault.')
      return
    }
    setBusyQuote(true)
    setQuoteErr('')
    setConfirmErr('')
    setSuccessMsg('')
    const out =
      inputMode === 'grams'
        ? await postGoldSellbackQuote(jewellerId, { grams: gramsInput.trim() })
        : await postGoldSellbackQuote(jewellerId, { cash_inr: cashInput.trim() })
    setBusyQuote(false)
    if (!out.ok) {
      setQuote(null)
      setQuoteErr(out.detail)
      return
    }
    setQuote(out.data)
  }

  const runConfirm = async () => {
    if (jewellerId == null || !quote || !quoteFresh) return
    if (paymentMethod === 'upi' && !payoutUpiVpa.trim()) {
      setConfirmErr('Enter your UPI ID to receive the payout.')
      return
    }
    setBusyConfirm(true)
    setConfirmErr('')
    setSuccessMsg('')
    const out = await postGoldSellbackConfirm(jewellerId, quote.grams, {
      payment_method: paymentMethod,
      payout_upi_vpa: payoutUpiVpa.trim(),
    })
    setBusyConfirm(false)
    if (!out.ok) {
      setConfirmErr(out.detail)
      return
    }
    const jl = quote.jeweller_label
    const buyRate = quote.buyback_inr_per_gram
    setWallet(out.wallet)
    setQuote(null)
    setGramsInput('')
    setCashInput('')
    setSuccessMsg(out.detail)
    if (out.otp_code && out.sellback?.id != null) {
      setOtpBanner({
        code: out.otp_code,
        expiresAt: out.otp_expires_at ?? '',
        sellbackId: out.sellback.id,
      })
      setOutstanding((prev) => {
        const row: SellbackOutstandingDTO = {
          id: out.sellback!.id,
          reference: out.sellback!.reference,
          status: out.sellback!.status,
          payment_method: out.sellback!.payment_method,
          payout_upi_vpa: out.sellback!.payout_upi_vpa,
          jeweller_label: jl,
          grams: out.sellback!.grams,
          cash_estimate_inr: out.sellback!.cash_estimate_inr,
          buyback_inr_per_gram: buyRate,
          otp_expires_at: out.otp_expires_at ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        return [row, ...prev.filter((p) => p.id !== out.sellback!.id)]
      })
    } else if (out.sellback?.id != null) {
      setOutstanding((prev) => {
        const row: SellbackOutstandingDTO = {
          id: out.sellback!.id,
          reference: out.sellback!.reference,
          status: out.sellback!.status,
          payment_method: out.sellback!.payment_method,
          payout_upi_vpa: out.sellback!.payout_upi_vpa,
          jeweller_label: jl,
          grams: out.sellback!.grams,
          cash_estimate_inr: out.sellback!.cash_estimate_inr,
          buyback_inr_per_gram: buyRate,
          otp_expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        return [row, ...prev.filter((p) => p.id !== out.sellback!.id)]
      })
    }
    void refreshOutstanding()
    void refreshWallet()
  }

  const runRegenerate = async (sellbackId: number) => {
    setBusyRegen(true)
    setConfirmErr('')
    const out = await postSellbackOtpRegenerate(sellbackId)
    setBusyRegen(false)
    if (!out.ok) {
      setConfirmErr(out.detail)
      return
    }
    setOtpBanner({
      code: out.otp_code,
      expiresAt: out.otp_expires_at,
      sellbackId,
    })
    setSuccessMsg('New OTP issued. Previous code is invalid.')
  }

  const showOtpBlock =
    otpBanner != null &&
    outstanding.some(
      (o) =>
        o.id === otpBanner.sellbackId &&
        o.payment_method === 'cash' &&
        (o.status === 'pending_jeweller' || o.status === 'accepted_awaiting_otp'),
    )

  const upiReviewRows = outstanding.filter(
    (o) =>
      o.payment_method === 'upi' &&
      (o.status === 'pending_review' || o.status === 'awaiting_utr_verify'),
  )

  return (
    <div className="dash-panel-max pf-scope">
      <h2 className="dash-panel-title">Cash sellback</h2>
      <p className="dash-panel-lead">
        Sell vault gold back to your <strong>custodian jeweller</strong> at their buyback ₹/g.{' '}
        <strong>Cash at counter</strong> uses OTP settlement — share the code only after you receive cash at the
        showroom.
        {sellbackUpiEnabled
          ? ' You can also choose UPI payout (jeweller pays your UPI ID; you confirm receipt).'
          : null}
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {(outstanding.length > 0 || showOtpBlock || upiReviewRows.length > 0) && (
        <div
          className="card"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 16,
            marginBottom: '1rem',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Dashboard · active sellback</h3>
          {otpBanner && showOtpBlock ? (
            <div style={{ marginBottom: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Settlement OTP (share only after you receive cash){' '}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.68rem', padding: '0.2rem 0.45rem', marginLeft: '0.35rem' }}
                  disabled={
                    busyRegen ||
                    outstanding.some((o) => o.id === otpBanner.sellbackId && o.status !== 'pending_jeweller')
                  }
                  onClick={() => void runRegenerate(otpBanner.sellbackId)}
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
                Expires {otpBanner.expiresAt ? new Date(otpBanner.expiresAt).toLocaleString('en-IN') : '—'}
              </p>
            </div>
          ) : null}
          {sellbackUpiEnabled
            ? upiReviewRows.map((o) => (
                <UpiProofReviewActions
                  key={o.id}
                  kind="sellback"
                  paymentId={o.id}
                  reference={o.reference}
                  amountInr={o.cash_estimate_inr}
                  upiUtr={o.upi_utr}
                  busy={busyUpi}
                  onBusyChange={setBusyUpi}
                  onDone={async (msg) => {
                    setSuccessMsg(msg)
                    await refreshOutstanding()
                    await refreshWallet()
                  }}
                  onError={(detail) => setLoadErr(detail)}
                />
              ))
            : null}
          {outstanding.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {outstanding.map((o) => (
                <li key={o.id} style={{ marginBottom: '0.35rem' }}>
                  <strong className="tabular">{o.reference}</strong> · {o.jeweller_label} ·{' '}
                  <span className="tabular">{o.grams} g</span> · est. ₹{fmtInr(o.cash_estimate_inr)} ·{' '}
                  <span style={{ color: 'var(--text)' }}>{statusHint(o.status, o.payment_method)}</span>
                  {o.status === 'pending_jeweller' && !showOtpBlock ? (
                    <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem' }}>
                      Open this page after confirming to see your OTP, or regenerate while still pending.
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>No pending sellback queue.</p>
          )}
        </div>
      )}

      {vaultOpts.length === 0 && !loadErr ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No vaulted balance to sell back yet. Complete a fractional purchase first.
        </p>
      ) : (
        <div className="card" style={{ padding: '1.15rem 1.25rem', borderRadius: 18, maxWidth: 520 }}>
          <label htmlFor="sellback-vault" style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-faint)' }}>
            Vault (custodian)
          </label>
          <select
            id="sellback-vault"
            style={{
              width: '100%',
              marginTop: '0.35rem',
              padding: '0.55rem 0.65rem',
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'var(--veil)',
              color: 'var(--text)',
              fontFamily: 'var(--font)',
            }}
            value={jewellerId ?? ''}
            onChange={(e) => onJewellerChange(Number.parseInt(e.target.value, 10))}
          >
            {vaultOpts.map((v) => (
              <option key={v.custodian_id} value={v.custodian_id}>
                {v.custodian_label || `Jeweller #${v.custodian_id}`} · {parseG(v.fractional_grams).toFixed(4)} g
              </option>
            ))}
          </select>

          {selectedVault ? (
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Available <strong className="tabular">{selectedVault.fractional_grams} g</strong> at this custodian.
            </p>
          ) : null}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${inputMode === 'grams' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => switchMode('grams')}
            >
              By gold (grams)
            </button>
            <button
              type="button"
              className={`btn ${inputMode === 'cash' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => switchMode('cash')}
            >
              By cash (₹)
            </button>
          </div>

          {sellbackUpiEnabled ? (
            <fieldset style={{ border: 'none', padding: 0, margin: '1rem 0 0' }}>
              <legend className="fractional-buy-legend">Payout method</legend>
              <DashSegmentPair
                items={[...PAYOUT_METHODS]}
                value={paymentMethod}
                onChange={(id) => setPaymentMethod(id as 'cash' | 'upi')}
                ariaLabel="Payout method"
                className="fractional-buy-payment-segments"
              />
            </fieldset>
          ) : null}

          {sellbackUpiEnabled && paymentMethod === 'upi' ? (
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="sellback-payout-upi">Your UPI ID (receive payout)</label>
              <input
                id="sellback-payout-upi"
                value={payoutUpiVpa}
                onChange={(e) => setPayoutUpiVpa(e.target.value)}
                placeholder="yourname@okhdfcbank"
                autoComplete="off"
              />
            </div>
          ) : null}

          {inputMode === 'grams' ? (
            <>
              <label
                htmlFor="sellback-grams"
                style={{ display: 'block', marginTop: '1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-faint)' }}
              >
                Grams to sell back
              </label>
              <input
                id="sellback-grams"
                type="text"
                inputMode="decimal"
                className="tabular"
                style={{
                  width: '100%',
                  marginTop: '0.35rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font)',
                }}
                value={gramsInput}
                onChange={(e) => onGramsChange(e.target.value)}
                placeholder="e.g. 0.5"
              />
            </>
          ) : (
            <>
              <label
                htmlFor="sellback-cash"
                style={{ display: 'block', marginTop: '1rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-faint)' }}
              >
                Cash you want (₹, indicative at buyback ₹/g)
              </label>
              <input
                id="sellback-cash"
                type="text"
                inputMode="decimal"
                className="tabular"
                style={{
                  width: '100%',
                  marginTop: '0.35rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font)',
                }}
                value={cashInput}
                onChange={(e) => onCashChange(e.target.value)}
                placeholder="e.g. 50000"
              />
            </>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" disabled={busyQuote || jewellerId == null} onClick={() => void runQuote()}>
              {busyQuote ? 'Pricing…' : 'Get quote'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyConfirm || !quoteFresh}
              onClick={() => void runConfirm()}
            >
              {busyConfirm ? 'Submitting…' : 'Confirm sellback'}
            </button>
          </div>

          {quoteErr ? (
            <p className="form-error" style={{ marginTop: '0.85rem' }} role="alert">
              {quoteErr}
            </p>
          ) : null}
          {confirmErr ? (
            <p className="form-error" style={{ marginTop: '0.85rem' }} role="alert">
              {confirmErr}
            </p>
          ) : null}
          {successMsg ? (
            <p style={{ marginTop: '0.85rem', color: 'var(--success)', fontWeight: 600 }} role="status">
              {successMsg}
            </p>
          ) : null}

          {quote ? (
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-soft)',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                display: 'grid',
                gap: '0.35rem',
              }}
            >
              <p style={{ margin: 0 }}>
                Indicative buyback{' '}
                <strong className="tabular" style={{ color: 'var(--text)' }}>
                  ₹{fmtInr(quote.buyback_inr_per_gram)}
                </strong>
                /g · reference metal ₹{fmtInr(quote.reference_metal_inr_per_gram)}/g
              </p>
              <p style={{ margin: 0 }}>
                Estimated cash{' '}
                <strong className="tabular" style={{ color: 'var(--gold-light)' }}>
                  ₹{fmtInr(quote.cash_estimate_inr)}
                </strong>{' '}
                for <strong className="tabular">{quote.grams} g</strong>
                {quote.quote_input_mode === 'cash_inr' && quote.requested_cash_inr ? (
                  <span>
                    {' '}
                    (from ₹{fmtInr(quote.requested_cash_inr)} target)
                  </span>
                ) : null}
              </p>
              {quote.minimum_redeemable_grams ? (
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Minimum redeemable configured by jeweller:{' '}
                  <strong className="tabular">{quote.minimum_redeemable_grams} g</strong>
                </p>
              ) : null}
              {!quoteFresh ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Inputs changed — get a fresh quote before confirming.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
