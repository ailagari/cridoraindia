import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Input } from '@/components/ui'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { MobileDashboardCancelButton } from '@/features/dashboard/MobileDashboardCancelButton'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  cancelSchemeContribution,
  createSchemeContribution,
  enrollCustomerScheme,
  fetchCustomerSchemeContributions,
  fetchCustomerSchemeEnrollments,
  fetchCustomerSchemeNetworkOfferings,
  issueSchemeCounterOtp,
  quoteSchemeContribution,
  searchCustomerSchemeOfferings,
  type SchemeContributionDTO,
  type SchemeEnrollmentDTO,
  type SchemeNetworkJewellerDTO,
  type SchemeOfferingDTO,
  type SchemeSearchResultDTO,
} from '@/lib/schemesApi'
import { fetchPlatformFeatures, isFeatureEnabled } from '@/lib/platformFeatures'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { SchemeEnrollmentPicker } from './SchemeEnrollmentPicker'

const VISIBLE_STATUSES = new Set(['active', 'pending_admission', 'plan_month_complete'])

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

const UPI_PAYMENT_SECTION_ID = 'scheme-upi-payment-step'

function canPayEnrollment(e: SchemeEnrollmentDTO): boolean {
  return e.status === 'active' && e.payments_enabled
}

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function OfferingJoinRow({
  offering,
  jewellerName,
  enrolled,
  busy,
  onJoin,
}: {
  offering: SchemeOfferingDTO
  jewellerName: string
  enrolled: boolean
  busy: boolean
  onJoin: (offeringId: number) => void
}) {
  return (
    <li className="dash-list-item">
      <div>
        <strong>{offering.display_name}</strong>
        <p className="dash-muted" style={{ margin: '0.2rem 0 0' }}>
          {jewellerName}
        </p>
      </div>
      {enrolled ? (
        <span className="dash-muted">Joined</span>
      ) : (
        <Button size="sm" variant="primary" onClick={() => onJoin(offering.id)} disabled={busy}>
          Request join
        </Button>
      )}
    </li>
  )
}

export function CustomerSchemeHubPanel() {
  const [params] = useSearchParams()
  const jewellerFromUrl = params.get('jeweller_id')
  const narrow = usePublicLayoutMax767()
  const upiPaymentRef = useRef<HTMLDivElement>(null)

  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean> | null>(null)
  const [featureReady, setFeatureReady] = useState(false)
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [networkJewellers, setNetworkJewellers] = useState<SchemeNetworkJewellerDTO[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SchemeSearchResultDTO[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [enrollments, setEnrollments] = useState<SchemeEnrollmentDTO[]>([])
  const [contributions, setContributions] = useState<SchemeContributionDTO[]>([])
  const [selectedEnrollment, setSelectedEnrollment] = useState<SchemeEnrollmentDTO | null>(null)
  const [amount, setAmount] = useState('5000')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'counter'>('upi')
  const [quote, setQuote] = useState<Record<string, string> | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [depositMsg, setDepositMsg] = useState('')
  const [lastContribution, setLastContribution] = useState<SchemeContributionDTO | null>(null)
  const [activeUpiContribution, setActiveUpiContribution] = useState<SchemeContributionDTO | null>(null)
  const [otpReveal, setOtpReveal] = useState<{ contributionId: number; otp: string; expiresAt: string } | null>(null)
  const [successToast, setSuccessToast] = useState('')
  const [busy, setBusy] = useState(false)

  const schemesEnabled = isFeatureEnabled(featureFlags, 'golden_scheme')
  const fractionalUpiEnabled = isFeatureEnabled(featureFlags, 'fractional_upi_reconciliation')
  const fractionalCounterEnabled = isFeatureEnabled(featureFlags, 'fractional_counter')

  const paymentMethods = useMemo(() => {
    return PAYMENT_METHODS.filter((m) => {
      if (m.id === 'upi') return fractionalUpiEnabled
      if (m.id === 'counter') return fractionalCounterEnabled
      return true
    })
  }, [fractionalCounterEnabled, fractionalUpiEnabled])

  const otpCountdown = useCounterOtpCountdown(otpReveal?.expiresAt ?? null)

  useEffect(() => {
    void fetchPlatformFeatures().then((f) => {
      setFeatureFlags(f?.flags ?? null)
      setFeatureReady(true)
    })
    void fetchVerifiedJewellers().then((list) => setJewellers(list.filter((j) => j.id > 0)))
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

  const reloadEnrollments = useCallback(async () => {
    const rows = await fetchCustomerSchemeEnrollments()
    const visible = rows.filter((r) => VISIBLE_STATUSES.has(r.status))
    setEnrollments(visible)
    setSelectedEnrollment((prev) => {
      if (prev && visible.some((r) => r.id === prev.id)) {
        return visible.find((r) => r.id === prev!.id) ?? prev
      }
      return visible.find((r) => canPayEnrollment(r)) ?? visible[0] ?? null
    })
  }, [])

  const reloadContributions = useCallback(async () => {
    const rows = await fetchCustomerSchemeContributions()
    setContributions(rows)
    const upiInflight = rows.find(
      (c) => c.payment_method === 'upi' && INFLIGHT_UPI_STATUSES.has(c.status),
    )
    const counterInflight = rows.find(
      (c) => c.payment_method === 'counter' && c.status === 'awaiting_counter',
    )
    setActiveUpiContribution(upiInflight ?? null)
    if (counterInflight) {
      setLastContribution(counterInflight)
      if (counterInflight.otp && counterInflight.otp_expires_at) {
        setOtpReveal({
          contributionId: counterInflight.id,
          otp: counterInflight.otp,
          expiresAt: counterInflight.otp_expires_at,
        })
      }
    }
  }, [])

  const reloadNetwork = useCallback(async () => {
    try {
      const data = await fetchCustomerSchemeNetworkOfferings()
      setNetworkJewellers(data.jewellers)
      if (data.jewellers.length === 0 && enrollments.length === 0) setJoinOpen(true)
    } catch {
      setNetworkJewellers([])
    }
  }, [enrollments.length])

  useEffect(() => {
    void reloadEnrollments()
    void reloadNetwork()
    void reloadContributions()
  }, [reloadContributions, reloadEnrollments, reloadNetwork])

  const payableEnrollments = useMemo(
    () => enrollments.filter((e) => canPayEnrollment(e)),
    [enrollments],
  )
  const pendingEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'pending_admission'),
    [enrollments],
  )

  const enrolledOfferingIds = useMemo(
    () => new Set(enrollments.map((e) => e.offering.id)),
    [enrollments],
  )

  const resumeUpiContribution = useMemo(
    () =>
      contributions.find(
        (c) => c.payment_method === 'upi' && RESUMABLE_UPI_STATUSES.has(c.status),
      ) ?? null,
    [contributions],
  )

  const resumePaymentCountdown = useCounterOtpCountdown(resumeUpiContribution?.payment_expires_at ?? null)

  const runQuote = useCallback(async () => {
    setQuoteErr('')
    setQuote(null)
    if (!selectedEnrollment || !canPayEnrollment(selectedEnrollment)) {
      setQuoteErr('Choose a scheme you can pay into.')
      return
    }
    const amt = amount.trim()
    if (!amt) {
      setQuoteErr('Enter deposit amount.')
      return
    }
    setBusy(true)
    try {
      const q = await quoteSchemeContribution(selectedEnrollment.id, amt)
      setQuote(q)
    } catch (e) {
      setQuoteErr(e instanceof Error ? e.message : 'Quote failed')
    } finally {
      setBusy(false)
    }
  }, [amount, selectedEnrollment])

  const refreshLiveQuote = useCallback(async () => {
    if (busy || !selectedEnrollment || !canPayEnrollment(selectedEnrollment) || quote == null) return
    const amt = amount.trim()
    if (!amt) return
    try {
      const q = await quoteSchemeContribution(selectedEnrollment.id, amt)
      setQuote(q)
    } catch {
      /* keep last quote */
    }
  }, [amount, busy, quote, selectedEnrollment])

  useLivePoll(() => {
    void reloadEnrollments()
    void reloadContributions()
  }, LIVE_BALANCE_POLL_MS, !busy)

  useLivePoll(refreshLiveQuote, LIVE_BALANCE_POLL_MS, !busy && quote != null && selectedEnrollment != null)

  const selectEnrollment = (e: SchemeEnrollmentDTO) => {
    setSelectedEnrollment(e)
    setQuote(null)
    setQuoteErr('')
    setDepositMsg('')
    setLastContribution(null)
    setActiveUpiContribution(null)
    setOtpReveal(null)
  }

  const enroll = async (offeringId: number) => {
    setBusy(true)
    setDepositMsg('')
    try {
      const e = await enrollCustomerScheme(offeringId)
      selectEnrollment(e)
      await reloadEnrollments()
      setSuccessToast(
        e.payments_enabled
          ? 'Joined scheme — you can deposit now.'
          : 'Join request sent. Your jeweller will enable payments.',
      )
      if (!e.payments_enabled) setJoinOpen(false)
    } catch (e) {
      setDepositMsg(e instanceof Error ? e.message : 'Could not join scheme')
    } finally {
      setBusy(false)
    }
  }

  const runSearch = async () => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setDepositMsg('Enter at least 2 characters to search.')
      return
    }
    setSearchBusy(true)
    setDepositMsg('')
    try {
      setSearchResults(await searchCustomerSchemeOfferings(q))
    } catch (e) {
      setDepositMsg(e instanceof Error ? e.message : 'Search failed')
      setSearchResults([])
    } finally {
      setSearchBusy(false)
    }
  }

  const placeDeposit = async () => {
    setDepositMsg('')
    if (!selectedEnrollment || !canPayEnrollment(selectedEnrollment) || !quote) {
      setDepositMsg('Show a live quote first.')
      return
    }
    setBusy(true)
    try {
      const c = await createSchemeContribution({
        enrollment_id: selectedEnrollment.id,
        amount_inr: amount,
        payment_method: paymentMethod,
      })
      setLastContribution(c)
      setOtpReveal(null)
      if (paymentMethod === 'upi') {
        setActiveUpiContribution(c)
        setDepositMsg(`${c.reference} · Pay ₹${formatInr(c.amount_inr)} via UPI, then paste UTR below.`)
      } else {
        setDepositMsg(`${c.reference} · Pay ₹${formatInr(c.amount_inr)} at counter, then tap Generate OTP.`)
      }
      await reloadEnrollments()
      await reloadContributions()
    } catch (e) {
      setDepositMsg(e instanceof Error ? e.message : 'Deposit failed')
    } finally {
      setBusy(false)
    }
  }

  const issueOtp = async (contributionId: number) => {
    setDepositMsg('')
    setBusy(true)
    try {
      const withOtp = await issueSchemeCounterOtp(contributionId)
      if (withOtp.otp && withOtp.otp_expires_at) {
        setOtpReveal({
          contributionId: withOtp.id,
          otp: withOtp.otp,
          expiresAt: withOtp.otp_expires_at,
        })
      }
      setLastContribution(withOtp)
    } catch (e) {
      setDepositMsg(e instanceof Error ? e.message : 'Could not issue OTP')
      setOtpReveal(null)
    } finally {
      setBusy(false)
      await reloadContributions()
    }
  }

  const cancelCounterDeposit = async (contribution: SchemeContributionDTO) => {
    setBusy(true)
    try {
      await cancelSchemeContribution(contribution.id)
      setLastContribution(null)
      setOtpReveal(null)
      setSuccessToast('Deposit cancelled.')
      await reloadContributions()
    } catch (e) {
      setDepositMsg(e instanceof Error ? e.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  const scrollToUpiPayment = useCallback(() => {
    if (resumeUpiContribution && (!activeUpiContribution || activeUpiContribution.id !== resumeUpiContribution.id)) {
      setActiveUpiContribution(resumeUpiContribution)
    }
    window.requestAnimationFrame(() => {
      const target = upiPaymentRef.current ?? document.getElementById(UPI_PAYMENT_SECTION_ID)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [activeUpiContribution, resumeUpiContribution])

  if (!featureReady) {
    return (
      <div className="dash-panel-max fractional-buy-panel">
        <p className="dash-muted">Loading schemes…</p>
      </div>
    )
  }

  if (!schemesEnabled) {
    return (
      <div className="dash-panel-max fractional-buy-panel">
        <EmptyState
          title="Investment schemes unavailable"
          description="This feature is not enabled on the platform yet."
        />
      </div>
    )
  }

  const showUpiStep =
    activeUpiContribution && INFLIGHT_UPI_STATUSES.has(activeUpiContribution.status)

  const urlJewellerId = jewellerFromUrl ? Number.parseInt(jewellerFromUrl, 10) : null
  const sortedNetwork = [...networkJewellers].sort((a, b) => {
    if (urlJewellerId && a.id === urlJewellerId) return -1
    if (urlJewellerId && b.id === urlJewellerId) return 1
    if (a.role === 'primary') return -1
    if (b.role === 'primary') return 1
    return a.business_name.localeCompare(b.business_name, 'en')
  })

  return (
    <div className="dash-panel-max fractional-buy-panel">
      <div className="page-header page-header--compact">
        <div className="page-header__text">
          <h1 className="page-header__title">Scheme deposit</h1>
          <p className="page-header__sub">Pay into your jeweller savings scheme · UPI or counter</p>
        </div>
      </div>

      <Card style={{ marginBottom: 'var(--sp-5)', maxWidth: 560 }}>
        <div className="ds-form">
          <SchemeEnrollmentPicker
            enrollments={payableEnrollments}
            selected={selectedEnrollment && canPayEnrollment(selectedEnrollment) ? selectedEnrollment : null}
            storefronts={jewellers}
            disabled={busy}
            onSelect={selectEnrollment}
          />

          {selectedEnrollment && canPayEnrollment(selectedEnrollment) ? (
            <>
              <Input
                label="Deposit amount (₹)"
                type="text"
                inputMode="decimal"
                value={amount}
                mono
                disabled={busy}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setQuote(null)
                }}
              />

              <Button type="button" variant="secondary" block disabled={busy} onClick={() => void runQuote()}>
                Show live quote
              </Button>
              {quoteErr ? (
                <p className="ds-feedback ds-feedback--error" role="alert">
                  {quoteErr}
                </p>
              ) : null}

              {quote ? (
                <Card tone="flat">
                  <p style={{ margin: '0 0 var(--sp-3)', fontWeight: 600, color: 'var(--gold-light)', fontSize: 'var(--ts-h3)' }}>
                    Live quote
                  </p>
                  <div className="fractional-buy-quote-stack">
                    {quote.metal_rate_inr_per_gram && quote.metal_rate_inr_per_gram !== '0' ? (
                      <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                        Rate/g <strong className="tabular">₹{formatInr(quote.metal_rate_inr_per_gram)}</strong>
                      </p>
                    ) : null}
                    {quote.gold_grams && quote.gold_grams !== '0.000000' ? (
                      <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                        Gold <strong className="tabular">{quote.gold_grams} g</strong>
                      </p>
                    ) : null}
                    {quote.gst_inr && quote.gst_inr !== '0.00' ? (
                      <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                        GST ({quote.gst_percent ?? '0'}%) <strong className="tabular">₹{formatInr(quote.gst_inr)}</strong>
                      </p>
                    ) : null}
                    {quote.making_charge_inr && quote.making_charge_inr !== '0.00' ? (
                      <p className="fractional-buy-quote-row" style={{ color: 'var(--text-muted)' }}>
                        Making charge <strong className="tabular">₹{formatInr(quote.making_charge_inr)}</strong>
                      </p>
                    ) : null}
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

              {!showUpiStep && !(lastContribution?.status === 'awaiting_counter') ? (
                <Button type="button" variant="primary" block disabled={busy || !quote} onClick={() => void placeDeposit()}>
                  Place deposit
                </Button>
              ) : null}

              {depositMsg ? (
                <p className="ds-feedback ds-feedback--success" role="status">
                  {depositMsg}
                </p>
              ) : null}

              {showUpiStep && activeUpiContribution ? (
                <div ref={upiPaymentRef} id={UPI_PAYMENT_SECTION_ID}>
                  <UpiPaymentStep
                    kind="scheme"
                    paymentId={activeUpiContribution.id}
                    busy={busy}
                    setBusy={setBusy}
                    sectionId={UPI_PAYMENT_SECTION_ID}
                    onSubmitted={() => {
                      void reloadEnrollments()
                      void reloadContributions()
                    }}
                    onExpired={() => {
                      setActiveUpiContribution(null)
                      void reloadContributions()
                    }}
                    onSuccess={(text) => setSuccessToast(text)}
                    onError={(text) => setDepositMsg(text)}
                  />
                </div>
              ) : null}

              {lastContribution?.payment_method === 'counter' && lastContribution.status === 'awaiting_counter' ? (
                <div className="dash-form-stack" style={{ marginTop: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="primary"
                    block
                    disabled={busy || (otpReveal?.contributionId === lastContribution.id && !otpCountdown.expired)}
                    onClick={() => void issueOtp(lastContribution.id)}
                  >
                    {otpReveal?.contributionId === lastContribution.id && otpCountdown.expired
                      ? 'Generate new verification OTP'
                      : otpReveal?.contributionId === lastContribution.id && !otpCountdown.expired
                        ? 'OTP active — use timer below'
                        : 'Generate verification OTP'}
                  </Button>
                  <MobileDashboardCancelButton
                    block
                    busy={busy}
                    label="Cancel deposit"
                    confirmMessage="Cancel this counter deposit? You can place a new one later."
                    onCancel={() => void cancelCounterDeposit(lastContribution)}
                  />
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
                    Show to jeweller
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
                    onClick={() => void issueOtp(otpReveal.contributionId)}
                  >
                    {otpCountdown.expired ? 'New OTP' : 'Active'}
                  </Button>
                </Card>
              ) : null}
            </>
          ) : payableEnrollments.length === 0 ? (
            <Button type="button" variant="secondary" block onClick={() => setJoinOpen(true)}>
              Find a scheme to join
            </Button>
          ) : null}
        </div>
      </Card>

      {pendingEnrollments.length > 0 ? (
        <Card style={{ marginBottom: 'var(--sp-5)', maxWidth: 560 }}>
          <CardHeader title="Awaiting jeweller" />
          <ul className="dash-list" style={{ margin: 0 }}>
            {pendingEnrollments.map((e) => (
              <li key={e.id} className="dash-list-item">
                <div>
                  <strong>{e.offering.display_name}</strong>
                  <p className="dash-muted" style={{ margin: '0.2rem 0 0' }}>
                    {e.jeweller.business_name} — ask them to add you from Schemes desk
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card style={{ maxWidth: 560 }}>
        <button
          type="button"
          className="scheme-join-toggle"
          aria-expanded={joinOpen}
          onClick={() => setJoinOpen((v) => !v)}
        >
          <span className="scheme-join-toggle__title">Join a scheme</span>
          <span className="scheme-join-toggle__hint">{joinOpen ? 'Hide' : 'Your jewellers & search'}</span>
        </button>

        {joinOpen ? (
          <div className="scheme-join-body">
            {sortedNetwork.length === 0 ? (
              <p className="dash-muted" style={{ margin: '0 0 var(--sp-4)' }}>
                Set a primary jeweller or buy fractional gold to see partner schemes here.
              </p>
            ) : (
              sortedNetwork.map((j) => {
                const available = j.offerings.filter(
                  (o) => !enrolledOfferingIds.has(o.id) && o.status === 'active',
                )
                if (available.length === 0) return null
                return (
                  <div key={j.id} style={{ marginBottom: 'var(--sp-4)' }}>
                    <p className="fractional-jeweller-known__label">
                      {j.business_name}
                      <span className="dash-muted"> · {j.role === 'primary' ? 'Primary' : 'Secondary'}</span>
                    </p>
                    <ul className="dash-list">
                      {available.map((o) => (
                        <OfferingJoinRow
                          key={o.id}
                          offering={o}
                          jewellerName={j.business_name}
                          enrolled={false}
                          busy={busy}
                          onJoin={(id) => void enroll(id)}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })
            )}

            <div className="ds-form ds-form--compact" style={{ marginTop: 'var(--sp-3)' }}>
              <Input
                label="Search other jewellers"
                placeholder="Scheme name, jeweller, city…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runSearch()
                }}
              />
              <Button variant="secondary" block onClick={() => void runSearch()} disabled={searchBusy}>
                {searchBusy ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <ul className="dash-list" style={{ marginTop: 'var(--sp-3)' }}>
                {searchResults.map((row) => (
                  <OfferingJoinRow
                    key={row.offering.id}
                    offering={row.offering}
                    jewellerName={row.jeweller.business_name}
                    enrolled={enrolledOfferingIds.has(row.offering.id)}
                    busy={busy}
                    onJoin={(id) => void enroll(id)}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Card>

      {successToast ? (
        <div className="gold-transfer-mobile-toast fractional-buy-toast" role="status" aria-live="polite">
          {successToast}
        </div>
      ) : null}

      {narrow && resumeUpiContribution && !resumePaymentCountdown.expired ? (
        <div className="upi-continue-payment-bar" role="region" aria-label="Pending UPI payment">
          <div className="upi-continue-payment-bar__copy">
            <p className="upi-continue-payment-bar__title">{resumeUpiContribution.reference}</p>
            <p className="upi-continue-payment-bar__meta tabular">
              ₹{formatInr(resumeUpiContribution.amount_inr)} · {resumePaymentCountdown.labelMmSs} left
            </p>
          </div>
          <div className="upi-continue-payment-bar__actions">
            <Button type="button" variant="primary" disabled={busy} onClick={scrollToUpiPayment}>
              Continue payment
            </Button>
            <MobileDashboardCancelButton
              block
              busy={busy}
              label="Cancel payment"
              confirmMessage="Cancel this payment? You can start a new one later."
              onCancel={async () => {
                if (!resumeUpiContribution) return
                setBusy(true)
                try {
                  await cancelSchemeContribution(resumeUpiContribution.id)
                  setActiveUpiContribution(null)
                  setSuccessToast('Payment cancelled.')
                  await reloadContributions()
                } catch (e) {
                  setDepositMsg(e instanceof Error ? e.message : 'Cancel failed')
                } finally {
                  setBusy(false)
                }
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
