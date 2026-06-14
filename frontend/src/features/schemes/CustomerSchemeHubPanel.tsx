import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Feedback, Input, PageHeader } from '@/components/ui'
import { DashSegmentPair, type DashSegmentItem } from '@/components/DashSegmentPair'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import {
  cancelSchemeContribution,
  createSchemeContribution,
  enrollCustomerScheme,
  fetchCustomerSchemeContributions,
  fetchCustomerSchemeEnrollments,
  fetchCustomerSchemeNetworkOfferings,
  quoteSchemeContribution,
  issueSchemeCounterOtp,
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
import { CustomerSchemeProgressCard } from './CustomerSchemeProgressCard'

const VISIBLE_STATUSES = new Set(['active', 'pending_admission', 'plan_month_complete'])

const PAYMENT_METHODS: DashSegmentItem[] = [
  { id: 'upi', label: 'Pay online (UPI)' },
  { id: 'counter', label: 'Pay at counter' },
]

const INFLIGHT_UPI_STATUSES = new Set([
  'pending_payment',
  'signal_received',
  'pending_review',
  'needs_manual_verification',
  'awaiting_utr_verify',
  'proof_rejected',
  'on_hold',
])

const UPI_PAYMENT_SECTION_ID = 'scheme-upi-payment-step'

function canPayEnrollment(e: SchemeEnrollmentDTO): boolean {
  return e.status === 'active' && e.payments_enabled
}

function resetPaymentState(setters: {
  setOtp: (v: string) => void
  setOtpExpiresAt: (v: string | null) => void
  setLastContribution: (v: SchemeContributionDTO | null) => void
  setActiveUpiContribution: (v: SchemeContributionDTO | null) => void
  setMsg: (v: string) => void
  setErr: (v: string) => void
}) {
  setters.setOtp('')
  setters.setOtpExpiresAt(null)
  setters.setLastContribution(null)
  setters.setActiveUpiContribution(null)
  setters.setMsg('')
  setters.setErr('')
}

function parseJewellerIdFromUrl(raw: string | null): number | '' {
  if (!raw?.trim()) return ''
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : ''
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
        <p className="dash-muted">
          {jewellerName} · {offering.flow_summary}
        </p>
        {offering.customer_facing_note ? (
          <p className="ds-field__hint" style={{ margin: '0.25rem 0 0' }}>
            {offering.customer_facing_note}
          </p>
        ) : null}
      </div>
      {enrolled ? (
        <span className="dash-muted">Joined</span>
      ) : (
        <Button size="sm" variant="primary" onClick={() => onJoin(offering.id)} disabled={busy}>
          Request to join
        </Button>
      )}
    </li>
  )
}

export function CustomerSchemeHubPanel() {
  const [params] = useSearchParams()
  const jewellerFromUrl = params.get('jeweller_id')

  const [featureReady, setFeatureReady] = useState(false)
  const [schemesEnabled, setSchemesEnabled] = useState(false)
  const [networkJewellers, setNetworkJewellers] = useState<SchemeNetworkJewellerDTO[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SchemeSearchResultDTO[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [enrollments, setEnrollments] = useState<SchemeEnrollmentDTO[]>([])
  const [selectedEnrollment, setSelectedEnrollment] = useState<SchemeEnrollmentDTO | null>(null)
  const [amount, setAmount] = useState('5000')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'counter'>('counter')
  const [quote, setQuote] = useState<Record<string, string> | null>(null)
  const [lastContribution, setLastContribution] = useState<SchemeContributionDTO | null>(null)
  const [activeUpiContribution, setActiveUpiContribution] = useState<SchemeContributionDTO | null>(null)
  const [otp, setOtp] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const urlJewellerHandled = useRef(false)

  const otpCountdown = useCounterOtpCountdown(otpExpiresAt)

  useEffect(() => {
    void fetchPlatformFeatures().then((f) => {
      setSchemesEnabled(isFeatureEnabled(f?.flags, 'golden_scheme'))
      setFeatureReady(true)
    })
  }, [])

  const reloadEnrollments = useCallback(async () => {
    const rows = await fetchCustomerSchemeEnrollments()
    const visible = rows.filter((r) => VISIBLE_STATUSES.has(r.status))
    setEnrollments(visible)
    setSelectedEnrollment((prev) => {
      if (prev && visible.some((r) => r.id === prev.id)) return prev
      const payable = visible.find((r) => canPayEnrollment(r))
      return payable ?? visible[0] ?? null
    })
  }, [])

  const reloadNetwork = useCallback(async () => {
    try {
      const data = await fetchCustomerSchemeNetworkOfferings()
      setNetworkJewellers(data.jewellers)
    } catch {
      setNetworkJewellers([])
    }
  }, [])

  const refreshInflightContributions = useCallback(async (enrollmentId: number) => {
    const rows = await fetchCustomerSchemeContributions(enrollmentId)
    const upiInflight = rows.find(
      (c) => c.payment_method === 'upi' && INFLIGHT_UPI_STATUSES.has(c.status),
    )
    const counterInflight = rows.find(
      (c) => c.payment_method === 'counter' && c.status === 'awaiting_counter',
    )
    setActiveUpiContribution(upiInflight ?? null)
    if (counterInflight) {
      setLastContribution(counterInflight)
      if (counterInflight.otp) setOtp(counterInflight.otp)
      if (counterInflight.otp_expires_at) setOtpExpiresAt(counterInflight.otp_expires_at)
    }
  }, [])

  useEffect(() => {
    void reloadEnrollments()
    void reloadNetwork()
  }, [reloadEnrollments, reloadNetwork])

  useEffect(() => {
    if (urlJewellerHandled.current || networkJewellers.length === 0) return
    const fromUrl = parseJewellerIdFromUrl(jewellerFromUrl)
    if (fromUrl && networkJewellers.some((j) => j.id === fromUrl)) {
      urlJewellerHandled.current = true
    }
  }, [networkJewellers, jewellerFromUrl])

  const enrolledOfferingIds = useMemo(
    () => new Set(enrollments.map((e) => e.offering.id)),
    [enrollments],
  )

  const payableEnrollments = useMemo(
    () => enrollments.filter((e) => canPayEnrollment(e)),
    [enrollments],
  )
  const pendingEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'pending_admission'),
    [enrollments],
  )
  const awaitingEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'plan_month_complete'),
    [enrollments],
  )

  useEffect(() => {
    if (!selectedEnrollment || !amount || !canPayEnrollment(selectedEnrollment)) {
      setQuote(null)
      return
    }
    void quoteSchemeContribution(selectedEnrollment.id, amount)
      .then(setQuote)
      .catch(() => setQuote(null))
  }, [selectedEnrollment, amount])

  useEffect(() => {
    if (!selectedEnrollment || !canPayEnrollment(selectedEnrollment)) return
    void refreshInflightContributions(selectedEnrollment.id)
  }, [selectedEnrollment, refreshInflightContributions])

  useLivePoll(() => {
    void reloadEnrollments()
    if (selectedEnrollment && canPayEnrollment(selectedEnrollment)) {
      void refreshInflightContributions(selectedEnrollment.id)
    }
  }, LIVE_BALANCE_POLL_MS, Boolean(selectedEnrollment))

  const selectEnrollment = (e: SchemeEnrollmentDTO) => {
    setSelectedEnrollment(e)
    resetPaymentState({
      setOtp,
      setOtpExpiresAt,
      setLastContribution,
      setActiveUpiContribution,
      setMsg,
      setErr,
    })
    if (canPayEnrollment(e)) void refreshInflightContributions(e.id)
  }

  const enroll = async (offeringId: number) => {
    setBusy(true)
    setErr('')
    try {
      const e = await enrollCustomerScheme(offeringId)
      selectEnrollment(e)
      await reloadEnrollments()
      setMsg(
        e.payments_enabled
          ? 'Joined scheme successfully.'
          : 'Join request sent. Your jeweller will add you before you can start paying.',
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not join scheme')
    } finally {
      setBusy(false)
    }
  }

  const runSearch = async () => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setErr('Enter at least 2 characters to search.')
      return
    }
    setSearchBusy(true)
    setErr('')
    try {
      const rows = await searchCustomerSchemeOfferings(q)
      setSearchResults(rows)
      if (rows.length === 0) setMsg('No schemes matched your search.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed')
      setSearchResults([])
    } finally {
      setSearchBusy(false)
    }
  }

  const createDeposit = async () => {
    if (!selectedEnrollment || !canPayEnrollment(selectedEnrollment)) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const c = await createSchemeContribution({
        enrollment_id: selectedEnrollment.id,
        amount_inr: amount,
        payment_method: paymentMethod,
      })
      if (paymentMethod === 'counter') {
        setLastContribution(c)
        setMsg('Deposit created. Generate an OTP and pay at the jeweller counter.')
      } else {
        setActiveUpiContribution(c)
        setMsg('Complete UPI payment below, then submit your UTR or screenshot.')
      }
      await reloadEnrollments()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Deposit failed')
    } finally {
      setBusy(false)
    }
  }

  const issueOtp = async () => {
    if (!lastContribution) return
    setBusy(true)
    setErr('')
    try {
      const withOtp = await issueSchemeCounterOtp(lastContribution.id)
      setOtp(withOtp.otp ?? '')
      setOtpExpiresAt(withOtp.otp_expires_at ?? null)
      setLastContribution(withOtp)
      setMsg('Show this OTP to the jeweller after paying at the counter.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not issue OTP')
    } finally {
      setBusy(false)
    }
  }

  const cancelCounterDeposit = async () => {
    if (!lastContribution) return
    setBusy(true)
    try {
      await cancelSchemeContribution(lastContribution.id)
      setLastContribution(null)
      setOtp('')
      setOtpExpiresAt(null)
      setMsg('Deposit cancelled.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  const renderEnrollmentGroup = (title: string, rows: SchemeEnrollmentDTO[]) => {
    if (rows.length === 0) return null
    return (
      <>
        <h3 className="dash-card-title" style={{ margin: '0.5rem 0' }}>
          {title}
        </h3>
        {rows.map((e) => (
          <CustomerSchemeProgressCard
            key={e.id}
            enrollment={e}
            active={selectedEnrollment?.id === e.id}
            onSelect={() => selectEnrollment(e)}
          />
        ))}
      </>
    )
  }

  if (!featureReady) {
    return (
      <div className="dash-panel-max">
        <p className="dash-muted">Loading schemes…</p>
      </div>
    )
  }

  if (!schemesEnabled) {
    return (
      <div className="dash-panel-max">
        <EmptyState
          title="Investment schemes unavailable"
          description="This feature is not enabled on the platform yet. Check back later or contact support."
        />
      </div>
    )
  }

  const showUpiStep =
    activeUpiContribution &&
    INFLIGHT_UPI_STATUSES.has(activeUpiContribution.status)

  const urlJewellerId = parseJewellerIdFromUrl(jewellerFromUrl)
  const sortedNetwork = [...networkJewellers].sort((a, b) => {
    if (urlJewellerId && a.id === urlJewellerId) return -1
    if (urlJewellerId && b.id === urlJewellerId) return 1
    if (a.role === 'primary') return -1
    if (b.role === 'primary') return 1
    return a.business_name.localeCompare(b.business_name, 'en')
  })

  return (
    <div className="dash-panel-max">
      <PageHeader
        eyebrow="Invest"
        title="Investment schemes"
        subtitle="Schemes from your primary and secondary jewellers. Request to join others — your jeweller must add you before you can pay."
      />

      {enrollments.length === 0 ? (
        <Card>
          <EmptyState
            title="No schemes yet"
            description="Browse schemes from your jewellers below or search other partners to request joining."
          />
        </Card>
      ) : (
        <>
          {renderEnrollmentGroup('Ready to pay', payableEnrollments)}
          {renderEnrollmentGroup('Waiting for jeweller approval', pendingEnrollments)}
          {renderEnrollmentGroup('Awaiting bonus or redemption', awaitingEnrollments)}
        </>
      )}

      <Card>
        <CardHeader title="Your jewellers' schemes" />
        <p className="dash-muted" style={{ marginTop: 0 }}>
          Primary and secondary jewellers where you hold gold or were onboarded.
        </p>
        {sortedNetwork.length === 0 ? (
          <EmptyState
            title="No linked jewellers"
            description="Set a primary jeweller in settings or buy fractional gold to see their schemes here. You can still search other jewellers below."
          />
        ) : (
          sortedNetwork.map((j) => {
            const available = j.offerings.filter(
              (o) => !enrolledOfferingIds.has(o.id) && o.status === 'active',
            )
            if (j.offerings.length === 0) return null
            return (
              <div key={j.id} style={{ marginTop: '1rem' }}>
                <h3 className="dash-card-title">
                  {j.business_name}
                  <span className="dash-muted" style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
                    {j.role === 'primary' ? 'Primary' : 'Secondary'}
                    {[j.city, j.state].filter(Boolean).length
                      ? ` · ${[j.city, j.state].filter(Boolean).join(', ')}`
                      : ''}
                  </span>
                </h3>
                <ul className="dash-list">
                  {available.map((o) => (
                    <OfferingJoinRow
                      key={o.id}
                      offering={o}
                      jewellerName={j.business_name}
                      enrolled={enrolledOfferingIds.has(o.id)}
                      busy={busy}
                      onJoin={(id) => void enroll(id)}
                    />
                  ))}
                  {available.length === 0 ? (
                    <p className="dash-muted">You have joined all active schemes from this jeweller.</p>
                  ) : null}
                </ul>
              </div>
            )
          })
        )}
      </Card>

      <Card>
        <CardHeader title="Search other jewellers" />
        <div className="ds-form ds-form--compact">
          <Input
            label="Search schemes or jewellers"
            placeholder="e.g. 11+1, Golden, Mumbai"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch()
            }}
          />
          <Button variant="secondary" onClick={() => void runSearch()} disabled={searchBusy}>
            {searchBusy ? 'Searching…' : 'Search'}
          </Button>
        </div>
        {searchResults.length > 0 ? (
          <ul className="dash-list" style={{ marginTop: '1rem' }}>
            {searchResults.map((row) => (
              <OfferingJoinRow
                key={row.offering.id}
                offering={row.offering}
                jewellerName={`${row.jeweller.business_name}${
                  row.jeweller.is_network_jeweller ? ' · Your jeweller' : ''
                }`}
                enrolled={enrolledOfferingIds.has(row.offering.id)}
                busy={busy}
                onJoin={(id) => void enroll(id)}
              />
            ))}
          </ul>
        ) : null}
      </Card>

      {selectedEnrollment?.status === 'pending_admission' ? (
        <Card>
          <p className="dash-muted" style={{ margin: 0 }}>
            You requested <strong>{selectedEnrollment.offering.display_name}</strong> at{' '}
            <strong>{selectedEnrollment.jeweller.business_name}</strong>. Ask your jeweller to add you
            from their Schemes desk (Cridora ID or phone) — deposits unlock after they admit you.
          </p>
        </Card>
      ) : null}

      {selectedEnrollment && canPayEnrollment(selectedEnrollment) ? (
        <Card>
          <CardHeader title={`Add deposit — ${selectedEnrollment.offering.display_name}`} />
          <div className="ds-form ds-form--compact">
            <Input
              label="Amount ₹"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {quote ? (
              <p className="ds-field__hint" style={{ margin: 0 }}>
                Total ₹{quote.total_inr}
                {quote.gold_grams && quote.gold_grams !== '0.000000' ? ` · ${quote.gold_grams} g gold` : ''}
                {quote.making_charge_inr && quote.making_charge_inr !== '0.00'
                  ? ` · MC ₹${quote.making_charge_inr}`
                  : ''}
              </p>
            ) : null}

            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend className="ds-field__label">Payment method</legend>
              <DashSegmentPair
                items={PAYMENT_METHODS}
                value={paymentMethod}
                onChange={(id) => setPaymentMethod(id as 'upi' | 'counter')}
                ariaLabel="Payment method"
              />
            </fieldset>

            <p className="ds-field__hint" style={{ margin: 0 }}>
              {paymentMethod === 'upi'
                ? 'Pay via GPay / PhonePe · paste UTR or upload screenshot after payment'
                : 'Pay at showroom · generate OTP and show it to the jeweller'}
            </p>

            {!showUpiStep && !lastContribution ? (
              <Button onClick={() => void createDeposit()} disabled={busy || !amount} variant="primary" block>
                Create deposit
              </Button>
            ) : null}

            {lastContribution && paymentMethod === 'counter' ? (
              <div className="dash-form-stack" style={{ marginTop: '0.5rem' }}>
                <p className="ds-field__hint" style={{ margin: 0 }}>
                  Reference: <strong>{lastContribution.reference}</strong> · ₹{lastContribution.amount_inr}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  block
                  disabled={busy || (Boolean(otp) && !otpCountdown.expired)}
                  onClick={() => void issueOtp()}
                >
                  {otp && !otpCountdown.expired ? 'OTP active — use timer below' : 'Generate verification OTP'}
                </Button>
                {otp ? (
                  <p className="ds-field__hint">
                    Counter OTP: <strong className="tabular">{otp}</strong>
                    {otpExpiresAt && !otpCountdown.expired ? ` · expires in ${otpCountdown.labelMmSs}` : null}
                  </p>
                ) : null}
                <Button type="button" variant="ghost" block disabled={busy} onClick={() => void cancelCounterDeposit()}>
                  Cancel deposit
                </Button>
              </div>
            ) : null}

            {showUpiStep && activeUpiContribution ? (
              <div id={UPI_PAYMENT_SECTION_ID}>
                <UpiPaymentStep
                  kind="scheme"
                  paymentId={activeUpiContribution.id}
                  busy={busy}
                  setBusy={setBusy}
                  sectionId={UPI_PAYMENT_SECTION_ID}
                  onSubmitted={() => {
                    void reloadEnrollments()
                    if (selectedEnrollment) void refreshInflightContributions(selectedEnrollment.id)
                  }}
                  onExpired={() => {
                    setActiveUpiContribution(null)
                    if (selectedEnrollment) void refreshInflightContributions(selectedEnrollment.id)
                  }}
                  onSuccess={(text) => setMsg(text)}
                  onError={(text) => setErr(text)}
                />
              </div>
            ) : null}
          </div>
        </Card>
      ) : selectedEnrollment?.status === 'plan_month_complete' ? (
        <Card>
          <p className="dash-muted">
            This scheme cycle is complete. Contact your jeweller for bonus confirmation and redemption.
          </p>
        </Card>
      ) : null}

      {msg ? <Feedback tone="success">{msg}</Feedback> : null}
      {err ? <Feedback tone="error">{err}</Feedback> : null}
    </div>
  )
}
