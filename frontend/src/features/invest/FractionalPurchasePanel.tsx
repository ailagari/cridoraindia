import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  fractionalCreateOrder,
  fractionalIssueCounterOtp,
  fractionalListOrders,
  fractionalQuote,
  fetchFractionalCounterOtpPolicy,
  type FractionalPurchaseDTO,
  type FractionalQuoteDTO,
} from '@/lib/fractionalPurchaseApi'
import { FractionalUpiPayStep } from '@/features/invest/FractionalUpiPayStep'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { fetchGoldWallet } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatJewellerMetalRateAsOf } from '@/features/marketplace/productPricing'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatExpiry(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function FractionalPurchasePanel() {
  const narrow = usePublicLayoutMax767()
  const [params] = useSearchParams()
  const jewellerFromUrl = params.get('jeweller_id')

  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [jewellerId, setJewellerId] = useState<number | ''>('')
  const [inputMode, setInputMode] = useState<'by_total_inr' | 'by_grams'>('by_total_inr')
  const [inrInput, setInrInput] = useState('5000')
  const [gramsInput, setGramsInput] = useState('5')
  const [quote, setQuote] = useState<FractionalQuoteDTO | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<FractionalPurchaseDTO[]>([])
  const [orderMsg, setOrderMsg] = useState('')
  const [lastOrder, setLastOrder] = useState<FractionalPurchaseDTO | null>(null)
  const [balanceHint, setBalanceHint] = useState('')
  const [otpReveal, setOtpReveal] = useState<{ orderId: number; otp: string; expiresAt: string } | null>(null)
  const [otpPolicySeconds, setOtpPolicySeconds] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'counter'>('upi')
  const [successToast, setSuccessToast] = useState('')
  const [activeUpiOrder, setActiveUpiOrder] = useState<FractionalPurchaseDTO | null>(null)

  const otpCountdown = useCounterOtpCountdown(otpReveal?.expiresAt ?? null)

  useEffect(() => {
    if (!successToast) return
    const timer = window.setTimeout(() => setSuccessToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [successToast])

  const refreshOrders = useCallback(async () => {
    setOrders(await fractionalListOrders())
  }, [])

  useEffect(() => {
    void fetchVerifiedJewellers().then((list) => {
      const real = list.filter((j) => j.id > 0)
      setJewellers(real)
      setJewellerId((prev) => {
        if (jewellerFromUrl) {
          const id = Number.parseInt(jewellerFromUrl, 10)
          if (Number.isFinite(id) && id > 0) return id
        }
        if (prev !== '') return prev
        return real[0]?.id ?? ''
      })
    })
  }, [jewellerFromUrl])

  const refreshWalletHint = useCallback(async () => {
    if (busy) return
    const w = await fetchGoldWallet()
    if (w) setBalanceHint(w.balance_grams)
  }, [busy])

  useEffect(() => {
    void refreshOrders()
  }, [refreshOrders])

  useEffect(() => {
    void fetchFractionalCounterOtpPolicy().then((r) => {
      if (r.ok) setOtpPolicySeconds(r.otp_ttl_seconds)
    })
  }, [])

  useEffect(() => {
    const oid = otpReveal?.orderId
    if (oid == null) return
    const row = orders.find((x) => x.id === oid)
    if (row && row.status !== 'awaiting_counter') setOtpReveal(null)
  }, [orders, otpReveal?.orderId])

  useEffect(() => {
    if (!lastOrder || lastOrder.payment_method !== 'upi') return
    const row = orders.find((x) => x.id === lastOrder.id) ?? lastOrder
    if (row.status === 'completed' && lastOrder.status !== 'completed') {
      setSuccessToast(`${row.reference} completed — ${row.grams} g credited.`)
    }
    setLastOrder(row)
    if (row.payment_method === 'upi' && (row.status === 'pending_payment' || row.status === 'awaiting_utr_verify')) {
      setActiveUpiOrder(row)
    } else if (row.status === 'completed') {
      setActiveUpiOrder(null)
    }
  }, [orders, lastOrder])

  useEffect(() => {
    if (!activeUpiOrder) return
    const row = orders.find((x) => x.id === activeUpiOrder.id)
    if (row) setActiveUpiOrder(row)
  }, [orders, activeUpiOrder?.id])

  useLivePoll(refreshOrders, LIVE_BALANCE_POLL_MS, !busy)
  useLivePoll(refreshWalletHint, LIVE_BALANCE_POLL_MS, !busy)

  const runQuote = async () => {
    setQuoteErr('')
    setQuote(null)
    if (jewellerId === '') {
      setQuoteErr('Choose a jeweller.')
      return
    }
    setBusy(true)
    try {
      const out =
        inputMode === 'by_grams'
          ? await fractionalQuote({
              jeweller_id: jewellerId,
              mode: 'by_grams',
              grams: gramsInput.trim(),
            })
          : await fractionalQuote({
              jeweller_id: jewellerId,
              mode: 'by_total_inr',
              total_inr: inrInput.trim(),
            })
      if (!out.ok) {
        setQuoteErr(out.detail)
        return
      }
      setQuote(out.data)
    } finally {
      setBusy(false)
    }
  }

  const submitOrder = async () => {
    setOrderMsg('')
    setLastOrder(null)
    setOtpReveal(null)
    setActiveUpiOrder(null)
    if (!quote || jewellerId === '') {
      setOrderMsg('Update the live quote first.')
      return
    }
    setBusy(true)
    try {
      const out = await fractionalCreateOrder({
        jeweller_id: jewellerId,
        payment_method: paymentMethod,
        mode: inputMode === 'by_grams' ? 'by_grams' : 'by_total_inr',
        grams: inputMode === 'by_grams' ? gramsInput.trim() : undefined,
        total_inr: inputMode === 'by_total_inr' ? inrInput.trim() : undefined,
        customer_note: note.trim(),
      })
      if (!out.ok) {
        setOrderMsg(out.detail)
        return
      }
      setLastOrder(out.data)
      if (out.data.payment_method === 'upi') {
        setActiveUpiOrder(out.data)
        setOrderMsg(
          `Order ${out.data.reference} created. Pay ₹${formatInr(out.data.total_inr)} to the jeweller via UPI, then paste your UTR below.`,
        )
      } else {
        setOrderMsg(
          `Order ${out.data.reference} created. Pay ₹${formatInr(out.data.total_inr)} at the jeweller counter (cash or their QR/UPI). Then tap Generate OTP and show the code to the jeweller — they enter it under Purchases to credit your gold.`,
        )
      }
      await refreshOrders()
      const w = await fetchGoldWallet()
      if (w) setBalanceHint(w.balance_grams)
    } finally {
      setBusy(false)
    }
  }

  const issueOtp = async (orderId: number) => {
    setOrderMsg('')
    setBusy(true)
    try {
      const out = await fractionalIssueCounterOtp(orderId)
      if (!out.ok) {
        setOrderMsg(out.detail)
        setOtpReveal(null)
        return
      }
      setOtpReveal({
        orderId: out.data.id,
        otp: out.data.otp,
        expiresAt: out.data.otp_expires_at,
      })
      if (typeof out.data.otp_ttl_seconds === 'number' && Number.isFinite(out.data.otp_ttl_seconds)) {
        setOtpPolicySeconds(out.data.otp_ttl_seconds)
      }
    } finally {
      setBusy(false)
      await refreshOrders()
    }
  }

  return (
    <div className="dash-panel-max fractional-buy-panel">
      <p className="dash-panel-lead">
        Buy fractional gold at the selected jeweller&apos;s metal rate. Pay online via the jeweller&apos;s UPI (paste UTR
        after payment) or at the showroom counter (OTP verification).
      </p>

      <p className="fractional-buy-live-rate" aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        Quotes always use <strong>your jeweller&apos;s rate</strong>, not a generic platform headline. Use <strong>Show live
        quote</strong> to refresh ₹/g and see when that rate was last updated.
      </p>

      {otpPolicySeconds != null ? (
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }} aria-live="polite">
          Counter OTP codes stay valid for about <strong className="tabular">{Math.round(otpPolicySeconds / 60)}</strong>{' '}
          minutes ({otpPolicySeconds}s); platform admins set this window.
        </p>
      ) : null}

      <div className="card" style={{ marginBottom: '1.25rem', maxWidth: 560 }}>
        <div className="dash-form-stack">
          <div className="field">
            <label htmlFor="frac-jeweller">Jeweller</label>
            <select
              id="frac-jeweller"
              value={jewellerId === '' ? '' : String(jewellerId)}
              onChange={(e) => {
                const v = e.target.value
                setJewellerId(v === '' ? '' : Number.parseInt(v, 10))
                setQuote(null)
              }}
            >
              <option value="">Select verified jeweller</option>
              {jewellers.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.business_name} · {j.city}
                </option>
              ))}
            </select>
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="fractional-buy-legend">Quote basis</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', lineHeight: 1.45 }}>
                <input
                  type="radio"
                  name="frac-mode"
                  checked={inputMode === 'by_total_inr'}
                  onChange={() => {
                    setInputMode('by_total_inr')
                    setQuote(null)
                  }}
                />
                <span style={{ fontSize: '0.875rem' }}>Amount to pay (incl. GST)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', lineHeight: 1.45 }}>
                <input
                  type="radio"
                  name="frac-mode"
                  checked={inputMode === 'by_grams'}
                  onChange={() => {
                    setInputMode('by_grams')
                    setQuote(null)
                  }}
                />
                <span style={{ fontSize: '0.875rem' }}>Gold quantity (grams)</span>
              </label>
            </div>
          </fieldset>

          {inputMode === 'by_total_inr' ? (
            <div className="field">
              <label htmlFor="frac-inr">Total payable (₹)</label>
              <input
                id="frac-inr"
                type="text"
                inputMode="decimal"
                value={inrInput}
                onChange={(e) => setInrInput(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="frac-g">Gold (grams)</label>
              <input
                id="frac-g"
                type="text"
                inputMode="decimal"
                value={gramsInput}
                onChange={(e) => setGramsInput(e.target.value)}
              />
            </div>
          )}

          <button type="button" className="btn btn-ghost btn--block" disabled={busy} onClick={() => void runQuote()}>
            Show live quote
          </button>
          {quoteErr ? <p className="form-error">{quoteErr}</p> : null}

          {quote ? (
            <div
              style={{
                padding: '1rem',
                borderRadius: 12,
                border: '1px solid var(--border-soft)',
                background: 'var(--veil-35)',
                fontSize: '0.88rem',
              }}
            >
              <p style={{ margin: '0 0 0.65rem', fontWeight: 800, color: 'var(--gold-light)', fontSize: '0.95rem' }}>
                Live quote
              </p>
              <div className="fractional-buy-quote-stack">
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  Jeweller metal rate (22K live market incl. their default markup):{' '}
                  <strong className="tabular">₹{formatInr(quote.metal_rate_inr_per_gram)}/g</strong>
                </p>
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Rate last updated:{' '}
                  <strong>{formatJewellerMetalRateAsOf(quote.jeweller_metal_rate_last_updated_at) ?? '—'}</strong>
                </p>
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  Gold weight: <strong className="tabular">{quote.grams} g</strong>
                </p>
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  Gold value (pre-GST): <strong className="tabular">₹{formatInr(quote.gold_value_inr_pre_gst)}</strong>
                </p>
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  GST ({quote.gst_percent}%): <strong className="tabular">₹{formatInr(quote.gst_inr)}</strong>
                </p>
                <p className="fractional-buy-quote-row fractional-buy-quote-total" style={{ fontWeight: 800 }}>
                  Total payable: <span className="tabular">₹{formatInr(quote.total_inr)}</span>
                </p>
              </div>
            </div>
          ) : null}

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="fractional-buy-legend">Payment method</legend>
            <div
              className={narrow ? 'gold-transfer-mobile__segments' : ''}
              style={narrow ? undefined : { display: 'flex', flexWrap: 'wrap', gap: '1rem' }}
              role="tablist"
              aria-label="Payment method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={paymentMethod === 'upi'}
                className={narrow ? `dash-mobile-segment-btn${paymentMethod === 'upi' ? ' dash-mobile-segment-btn--active' : ''}` : undefined}
                style={narrow ? undefined : { font: 'inherit', cursor: 'pointer' }}
                onClick={() => setPaymentMethod('upi')}
              >
                {narrow ? (
                  <span className="dash-mobile-segment-btn__label">Pay online (UPI)</span>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="frac-pay" checked={paymentMethod === 'upi'} readOnly />
                    Pay online (UPI)
                  </label>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={paymentMethod === 'counter'}
                className={
                  narrow ? `dash-mobile-segment-btn${paymentMethod === 'counter' ? ' dash-mobile-segment-btn--active' : ''}` : undefined
                }
                style={narrow ? undefined : { font: 'inherit', cursor: 'pointer' }}
                onClick={() => setPaymentMethod('counter')}
              >
                {narrow ? (
                  <span className="dash-mobile-segment-btn__label">Pay at counter</span>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="frac-pay" checked={paymentMethod === 'counter'} readOnly />
                    Pay at counter
                  </label>
                )}
              </button>
            </div>
          </fieldset>

          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {paymentMethod === 'upi' ? (
              <>
                Pay the jeweller directly in GPay / PhonePe, then paste the <strong>UPI reference</strong> from your receipt.
                The jeweller confirms before gold is credited.
              </>
            ) : (
              <>
                Pay at the showroom, then generate an in-app <strong>OTP</strong> for the jeweller to verify under Purchases.
              </>
            )}
          </p>

          <div className="field">
            <label htmlFor="frac-note">Reference note (optional)</label>
            <input
              id="frac-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Receipt id"
            />
          </div>

          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={busy || !quote}
            onClick={() => void submitOrder()}
          >
            Place order
          </button>

          {orderMsg ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>{orderMsg}</p> : null}

          {activeUpiOrder &&
          (activeUpiOrder.status === 'pending_payment' ||
            activeUpiOrder.status === 'awaiting_utr_verify' ||
            activeUpiOrder.status === 'completed') ? (
            <FractionalUpiPayStep
              order={activeUpiOrder}
              busy={busy}
              setBusy={setBusy}
              onUpdated={async () => {
                await refreshOrders()
                const w = await fetchGoldWallet()
                if (w) setBalanceHint(w.balance_grams)
              }}
              onSuccess={(msg) => setSuccessToast(msg)}
            />
          ) : null}

          {lastOrder && lastOrder.payment_method === 'counter' && lastOrder.status === 'awaiting_counter' ? (
            <div className="dash-form-stack" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary btn--block"
                disabled={busy || (otpReveal?.orderId === lastOrder.id && !otpCountdown.expired)}
                onClick={() => void issueOtp(lastOrder.id)}
              >
                {otpReveal?.orderId === lastOrder.id && otpCountdown.expired
                  ? 'Generate new verification OTP'
                  : otpReveal?.orderId === lastOrder.id && !otpCountdown.expired
                    ? 'OTP active — use timer below'
                    : 'Generate verification OTP'}
              </button>
            </div>
          ) : null}

          {otpReveal ? (
            <div
              style={{
                marginTop: '0.65rem',
                padding: '1rem',
                borderRadius: 12,
                border: '1px solid var(--gold-muted, #b8860b)',
                background: 'var(--veil-35)',
                opacity: otpCountdown.expired ? 0.65 : 1,
              }}
              role="status"
              aria-live="polite"
            >
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                Order #{otpReveal.orderId} · Show this to the jeweller
              </p>
              <p
                className="tabular"
                style={{
                  margin: '0 0 0.5rem',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.25em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {otpReveal.otp}
              </p>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', color: otpCountdown.expired ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>
                {otpCountdown.expired
                  ? 'This OTP has expired.'
                  : `Time remaining ${otpCountdown.labelMmSs} · expires ${formatExpiry(otpReveal.expiresAt)}`}
              </p>
              <button
                type="button"
                className="btn btn-primary btn--block"
                style={{ marginTop: '0.65rem' }}
                disabled={busy || !otpCountdown.expired}
                onClick={() => void issueOtp(otpReveal.orderId)}
              >
                {otpCountdown.expired ? 'Generate new OTP' : 'Regenerate OTP after expiry'}
              </button>
            </div>
          ) : null}

          {balanceHint ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Wallet balance after last action: <strong className="tabular">{balanceHint} g</strong>
            </p>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Recent fractional orders</h3>
        {orders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No orders yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
            {orders.map((o) => (
              <li
                key={o.id}
                className="fractional-order-li"
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--veil)',
                  fontSize: '0.82rem',
                }}
              >
                <div className="fractional-order-li-head">
                  <strong>{o.reference}</strong>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{o.jeweller.business_name}</span>
                </div>
                <p className="fractional-order-li-meta">
                  <span className="tabular">{o.grams} g</span>
                  <span aria-hidden="true"> · </span>
                  <span className="tabular">₹{formatInr(o.total_inr)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{o.payment_method}</span>
                </p>
                <p className="fractional-order-li-meta fractional-order-li-status" style={{ margin: '0 0 0.5rem' }}>
                  {o.status.replace(/_/g, ' ')}
                </p>
                {o.status === 'awaiting_counter' ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn--block"
                    style={{ marginTop: '0.25rem' }}
                    disabled={busy || (otpReveal?.orderId === o.id && !otpCountdown.expired)}
                    onClick={() => void issueOtp(o.id)}
                  >
                    {otpReveal?.orderId === o.id && otpCountdown.expired
                      ? 'Generate new OTP'
                      : otpReveal?.orderId === o.id && !otpCountdown.expired
                        ? 'OTP active'
                        : 'Generate OTP'}
                  </button>
                ) : null}
                {o.payment_method === 'upi' && o.status === 'pending_payment' ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn--block"
                    style={{ marginTop: '0.25rem' }}
                    disabled={busy}
                    onClick={() => {
                      setActiveUpiOrder(o)
                      setLastOrder(o)
                      setOrderMsg(`Continue payment for ${o.reference}.`)
                    }}
                  >
                    Continue UPI payment
                  </button>
                ) : null}
                {o.payment_method === 'upi' && o.status === 'awaiting_utr_verify' ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn--block"
                    style={{ marginTop: '0.25rem' }}
                    disabled={busy}
                    onClick={() => {
                      setActiveUpiOrder(o)
                      setLastOrder(o)
                    }}
                  >
                    View UTR status
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {successToast ? (
        <div className="gold-transfer-mobile-toast fractional-buy-toast" role="status" aria-live="polite">
          {successToast}
        </div>
      ) : null}
    </div>
  )
}
