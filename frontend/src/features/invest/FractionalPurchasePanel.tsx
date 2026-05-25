import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { FractionalJewellerPicker } from '@/features/invest/FractionalJewellerPicker'
import { CustomerFractionalOrdersTable } from '@/features/invest/CustomerFractionalOrdersTable'
import {
  knownFractionalJewellerIds,
  parseJewellerIdFromUrl,
  preferredPaidFractionalJewellerId,
  resolveKnownFractionalJewellers,
} from '@/features/invest/fractionalJewellerSelect'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { fetchGoldWallet, type GoldWalletDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatJewellerMetalRateAsOf } from '@/features/marketplace/productPricing'
import { Button, Card, CardHeader, Input } from '@/components/ui'
import { fetchPlatformFeatures, isFeatureEnabled } from '@/lib/platformFeatures'

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

const PAYMENT_METHODS = [
  { id: 'upi', label: 'Pay online (UPI)' },
  { id: 'counter', label: 'Pay at counter' },
] as const

const INFLIGHT_UPI_STATUSES = new Set([
  'pending_payment',
  'signal_received',
  'pending_review',
  'needs_manual_verification',
  'awaiting_utr_verify',
  'proof_rejected',
  'on_hold',
])

const RESUMABLE_UPI_STATUSES = new Set(['pending_payment', 'signal_received', 'proof_rejected'])

const UPI_PAYMENT_SECTION_ID = 'fractional-upi-payment-step'

export function FractionalPurchasePanel() {
  const [params] = useSearchParams()
  const jewellerFromUrl = params.get('jeweller_id')

  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [walletLoaded, setWalletLoaded] = useState(false)
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [jewellerInitDone, setJewellerInitDone] = useState(false)
  const userPickedJewellerRef = useRef(false)
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
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean> | null>(null)
  const narrow = usePublicLayoutMax767()
  const upiPaymentRef = useRef<HTMLDivElement>(null)

  const fractionalUpiEnabled = isFeatureEnabled(featureFlags, 'fractional_upi_reconciliation')
  const fractionalCounterEnabled = isFeatureEnabled(featureFlags, 'fractional_counter')
  const paymentMethods = useMemo(() => {
    return PAYMENT_METHODS.filter((m) => {
      if (m.id === 'upi') return fractionalUpiEnabled
      if (m.id === 'counter') return fractionalCounterEnabled
      return true
    })
  }, [fractionalUpiEnabled, fractionalCounterEnabled])

  const otpCountdown = useCounterOtpCountdown(otpReveal?.expiresAt ?? null)

  useEffect(() => {
    void fetchPlatformFeatures().then((p) => setFeatureFlags(p?.flags ?? null))
  }, [])

  useEffect(() => {
    if (paymentMethods.length === 0) return
    if (!paymentMethods.some((m) => m.id === paymentMethod)) {
      setPaymentMethod(paymentMethods[0].id as 'upi' | 'counter')
    }
  }, [paymentMethods, paymentMethod])

  useEffect(() => {
    if (!successToast) return
    const timer = window.setTimeout(() => setSuccessToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [successToast])

  const refreshOrders = useCallback(async () => {
    setOrders(await fractionalListOrders())
    setOrdersLoaded(true)
  }, [])

  useEffect(() => {
    void fetchVerifiedJewellers().then((list) => {
      setJewellers(list.filter((j) => j.id > 0))
      setCatalogLoaded(true)
    })
    void fetchGoldWallet().then((w) => {
      setWallet(w)
      setWalletLoaded(true)
      if (w) setBalanceHint(w.balance_grams)
    })
  }, [])

  const knownJewellerIds = useMemo(() => knownFractionalJewellerIds(orders, wallet), [orders, wallet])
  const knownJewellers = useMemo(
    () => resolveKnownFractionalJewellers(jewellers, orders, knownJewellerIds),
    [jewellers, orders, knownJewellerIds],
  )
  const defaultKnownJewellerId = useMemo(
    () => preferredPaidFractionalJewellerId(orders, wallet, knownJewellerIds),
    [orders, wallet, knownJewellerIds],
  )

  useEffect(() => {
    if (!catalogLoaded || !walletLoaded || !ordersLoaded || jewellerInitDone) return
    if (userPickedJewellerRef.current) {
      setJewellerInitDone(true)
      return
    }
    const urlId = parseJewellerIdFromUrl(jewellerFromUrl)
    if (urlId != null && jewellers.some((j) => j.id === urlId)) {
      setJewellerId(urlId)
      setJewellerInitDone(true)
      return
    }
    if (knownJewellerIds.length > 0) {
      const preferred = preferredPaidFractionalJewellerId(orders, wallet, knownJewellerIds)
      if (preferred != null) setJewellerId(preferred)
    }
    setJewellerInitDone(true)
  }, [
    catalogLoaded,
    jewellerFromUrl,
    jewellerInitDone,
    jewellers,
    knownJewellerIds,
    orders,
    ordersLoaded,
    wallet,
    walletLoaded,
  ])

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
    if (!lastOrder) return
    const row = orders.find((x) => x.id === lastOrder.id) ?? lastOrder
    if (row.status === 'completed' && lastOrder.status !== 'completed') {
      setSuccessToast(`${row.reference} completed — ${row.grams} g credited.`)
      setOtpReveal(null)
      void refreshWalletHint()
    }
    setLastOrder(row)
    if (row.payment_method === 'upi' && INFLIGHT_UPI_STATUSES.has(row.status)) {
      setActiveUpiOrder(row)
    } else if (row.status === 'completed' || row.status === 'cancelled') {
      setActiveUpiOrder(null)
    }
  }, [lastOrder, orders, refreshWalletHint])

  useEffect(() => {
    const oid = otpReveal?.orderId
    if (oid == null) return
    const row = orders.find((x) => x.id === oid)
    if (row?.status === 'completed') {
      setOtpReveal(null)
      if (lastOrder?.id !== oid) {
        setSuccessToast(`${row.reference} completed — ${row.grams} g credited.`)
      }
      void refreshWalletHint()
    }
  }, [lastOrder?.id, orders, otpReveal?.orderId, refreshWalletHint])

  useEffect(() => {
    if (!activeUpiOrder) return
    const row = orders.find((x) => x.id === activeUpiOrder.id)
    if (row) setActiveUpiOrder(row)
  }, [orders, activeUpiOrder?.id])

  useEffect(() => {
    if (!ordersLoaded || activeUpiOrder) return
    const pending = orders.find(
      (o) => o.payment_method === 'upi' && RESUMABLE_UPI_STATUSES.has(o.status),
    )
    if (pending) setActiveUpiOrder(pending)
  }, [activeUpiOrder, orders, ordersLoaded])

  const resumeUpiOrder = useMemo(
    () =>
      orders.find(
        (o) => o.payment_method === 'upi' && RESUMABLE_UPI_STATUSES.has(o.status),
      ) ?? null,
    [orders],
  )

  const resumePaymentCountdown = useCounterOtpCountdown(resumeUpiOrder?.payment_expires_at ?? null)

  const scrollToUpiPayment = useCallback(() => {
    if (resumeUpiOrder && (!activeUpiOrder || activeUpiOrder.id !== resumeUpiOrder.id)) {
      setActiveUpiOrder(resumeUpiOrder)
    }
    window.requestAnimationFrame(() => {
      const target =
        upiPaymentRef.current ?? document.getElementById(UPI_PAYMENT_SECTION_ID)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [activeUpiOrder, resumeUpiOrder])

  useLivePoll(refreshOrders, LIVE_BALANCE_POLL_MS, !busy)
  useLivePoll(refreshWalletHint, LIVE_BALANCE_POLL_MS, !busy)

  const runQuote = useCallback(async () => {
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
  }, [gramsInput, inrInput, inputMode, jewellerId])

  const refreshLiveQuote = useCallback(async () => {
    if (busy || jewellerId === '' || quote == null) return
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
    if (out.ok) setQuote(out.data)
  }, [busy, gramsInput, inrInput, inputMode, jewellerId, quote])

  useLivePoll(refreshLiveQuote, LIVE_BALANCE_POLL_MS, !busy && quote != null && jewellerId !== '')

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
        setOrderMsg(`${out.data.reference} · Pay ₹${formatInr(out.data.total_inr)} via UPI, then paste UTR below.`)
      } else {
        setOrderMsg(`${out.data.reference} · Pay ₹${formatInr(out.data.total_inr)} at counter, then tap Generate OTP.`)
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
      <div className="page-header page-header--compact">
        <div className="page-header__text">
          <h1 className="page-header__title">Buy gold</h1>
          <p className="page-header__sub">At Cridora live rate · UPI or counter</p>
        </div>
        {otpPolicySeconds != null ? (
          <span className="badge badge--neutral" title="Counter OTP validity">
            OTP {Math.round(otpPolicySeconds / 60)} min
          </span>
        ) : null}
      </div>

      <Card style={{ marginBottom: 'var(--sp-5)', maxWidth: 560 }}>
        <div className="ds-form">
          <FractionalJewellerPicker
            allJewellers={jewellers}
            knownJewellers={knownJewellers}
            defaultKnownJewellerId={defaultKnownJewellerId}
            jewellerId={jewellerId}
            disabled={busy}
            onJewellerChange={(id) => {
              userPickedJewellerRef.current = true
              setJewellerId(id)
              setQuote(null)
            }}
          />

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
            <Input label="Total payable (₹)" type="text" inputMode="decimal" value={inrInput} onChange={(e) => setInrInput(e.target.value)} mono />
          ) : (
            <Input label="Gold (grams)" type="text" inputMode="decimal" value={gramsInput} onChange={(e) => setGramsInput(e.target.value)} mono />
          )}

          <Button type="button" variant="secondary" block disabled={busy} onClick={() => void runQuote()}>
            Show live quote
          </Button>
          {quoteErr ? <p className="ds-feedback ds-feedback--error" role="alert">{quoteErr}</p> : null}

          {quote ? (
            <Card tone="flat">
              <p style={{ margin: '0 0 var(--sp-3)', fontWeight: 600, color: 'var(--gold-light)', fontSize: 'var(--ts-h3)' }}>
                Live quote
              </p>
              <div className="fractional-buy-quote-stack">
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  Rate/g <strong className="tabular">₹{formatInr(quote.metal_rate_inr_per_gram)}</strong>
                  <span style={{ fontSize: 'var(--ts-caption)', marginLeft: 6 }}>
                    · updated{' '}
                    {formatJewellerMetalRateAsOf(
                      quote.metal_rate_last_updated_at ?? quote.jeweller_metal_rate_last_updated_at,
                    ) ?? '—'}
                  </span>
                </p>
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  Weight <strong className="tabular">{quote.grams} g</strong>
                </p>
                <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                  GST ({quote.gst_percent}%) <strong className="tabular">₹{formatInr(quote.gst_inr)}</strong>
                </p>
                <p className="fractional-buy-quote-row fractional-buy-quote-total" style={{ fontWeight: 800 }}>
                  Total <span className="tabular">₹{formatInr(quote.total_inr)}</span>
                </p>
              </div>
            </Card>
          ) : null}

          {paymentMethods.length > 0 ? (
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="fractional-buy-legend">Payment method</legend>
              <DashSegmentPair
                items={paymentMethods}
                value={paymentMethod}
                onChange={(id) => setPaymentMethod(id as 'upi' | 'counter')}
                ariaLabel="Payment method"
                className="fractional-buy-payment-segments"
              />
            </fieldset>
          ) : null}

          <p style={{ margin: 0, fontSize: 'var(--ts-caption)', color: 'var(--text-faint)', lineHeight: 1.4 }}>
            {paymentMethod === 'upi'
              ? 'Pay via GPay / PhonePe · paste UTR after payment'
              : 'Pay at showroom · show OTP to jeweller'}
          </p>

          <Input label="Reference note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Receipt id" />

          <Button
            type="button"
            variant="primary"
            block
            disabled={busy || !quote}
            onClick={() => void submitOrder()}
          >
            Place order
          </Button>

          {orderMsg ? <p className="ds-feedback ds-feedback--success" role="status">{orderMsg}</p> : null}

          {activeUpiOrder && INFLIGHT_UPI_STATUSES.has(activeUpiOrder.status) ? (
            <div ref={upiPaymentRef}>
              <UpiPaymentStep
                kind="fractional"
                paymentId={activeUpiOrder.id}
                busy={busy}
                setBusy={setBusy}
                sectionId={UPI_PAYMENT_SECTION_ID}
                onSubmitted={() => void refreshOrders()}
                onExpired={() => {
                  setActiveUpiOrder(null)
                  void refreshOrders()
                }}
                onSuccess={(msg) => setSuccessToast(msg)}
                onError={(msg) => setOrderMsg(msg)}
              />
            </div>
          ) : null}

          {lastOrder && lastOrder.payment_method === 'counter' && lastOrder.status === 'awaiting_counter' ? (
            <div className="dash-form-stack" style={{ marginTop: '0.5rem' }}>
              <Button
                type="button"
                variant="primary"
                block
                disabled={busy || (otpReveal?.orderId === lastOrder.id && !otpCountdown.expired)}
                onClick={() => void issueOtp(lastOrder.id)}
              >
                {otpReveal?.orderId === lastOrder.id && otpCountdown.expired
                  ? 'Generate new verification OTP'
                  : otpReveal?.orderId === lastOrder.id && !otpCountdown.expired
                    ? 'OTP active — use timer below'
                    : 'Generate verification OTP'}
              </Button>
            </div>
          ) : null}

          {otpReveal ? (
            <Card
              tone="accent"
              style={{ opacity: otpCountdown.expired ? 0.65 : 1, border: '1px solid var(--gold-line-20)' }}
              role="status"
              aria-live="polite"
            >
              <p style={{ margin: '0 0 var(--sp-2)', fontSize: 'var(--ts-caption)', color: 'var(--text-muted)', fontWeight: 500 }}>
                #{otpReveal.orderId} · Show to jeweller
              </p>
              <p className="tabular" style={{ margin: '0 0 var(--sp-2)', fontSize: 'var(--ts-display)', fontWeight: 700, letterSpacing: '0.25em' }}>
                {otpReveal.otp}
              </p>
              <p style={{ margin: '0 0 var(--sp-3)', fontSize: 'var(--ts-caption)', color: otpCountdown.expired ? 'var(--danger)' : 'var(--text-muted)' }}>
                {otpCountdown.expired ? 'Expired' : `${otpCountdown.labelMmSs} remaining`}
              </p>
              <Button
                type="button"
                variant="primary"
                block
                disabled={busy || !otpCountdown.expired}
                onClick={() => void issueOtp(otpReveal.orderId)}
              >
                {otpCountdown.expired ? 'New OTP' : 'Active'}
              </Button>
            </Card>
          ) : null}

          {balanceHint ? (
            <p style={{ margin: 0, fontSize: 'var(--ts-caption)', color: 'var(--text-muted)' }}>
              Wallet <strong className="tabular">{balanceHint} g</strong>
            </p>
          ) : null}
        </div>
      </Card>

      <Card style={{ maxWidth: 960 }}>
        <CardHeader title="Orders" />
        {orders.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', margin: 0, fontSize: 'var(--ts-sm)' }}>No orders yet.</p>
        ) : (
          <CustomerFractionalOrdersTable
            orders={orders}
            busy={busy}
            setBusy={setBusy}
            otpRevealOrderId={otpReveal?.orderId ?? null}
            otpCountdownExpired={otpCountdown.expired}
            onIssueOtp={(id) => void issueOtp(id)}
            onRefreshOrders={refreshOrders}
            onSuccess={(msg) => setSuccessToast(msg)}
          />
        )}
      </Card>

      {successToast ? (
        <div className="gold-transfer-mobile-toast fractional-buy-toast" role="status" aria-live="polite">
          {successToast}
        </div>
      ) : null}

      {narrow && resumeUpiOrder && !resumePaymentCountdown.expired ? (
        <div className="upi-continue-payment-bar" role="region" aria-label="Pending UPI payment">
          <div className="upi-continue-payment-bar__copy">
            <p className="upi-continue-payment-bar__title">{resumeUpiOrder.reference}</p>
            <p className="upi-continue-payment-bar__meta tabular">
              ₹{formatInr(resumeUpiOrder.total_inr)} · {resumePaymentCountdown.labelMmSs} left
            </p>
          </div>
          <Button type="button" variant="primary" disabled={busy} onClick={scrollToUpiPayment}>
            Continue payment
          </Button>
        </div>
      ) : null}
    </div>
  )
}
