import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Feedback, Input, PageHeader, Select } from '@/components/ui'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  cancelSchemeContribution,
  createSchemeContribution,
  enrollCustomerScheme,
  fetchCustomerSchemeContributions,
  fetchCustomerSchemeEnrollments,
  fetchCustomerSchemeOfferings,
  issueSchemeCounterOtp,
  quoteSchemeContribution,
  type SchemeContributionDTO,
  type SchemeEnrollmentDTO,
  type SchemeOfferingDTO,
} from '@/lib/schemesApi'
import { fetchPlatformFeatures, isFeatureEnabled } from '@/lib/platformFeatures'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { CustomerSchemeProgressCard } from './CustomerSchemeProgressCard'

const VISIBLE_STATUSES = new Set(['active', 'plan_month_complete'])

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

const UPI_PAYMENT_SECTION_ID = 'scheme-upi-payment-step'

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

export function CustomerSchemeHubPanel() {
  const [params] = useSearchParams()
  const jewellerFromUrl = params.get('jeweller_id')

  const [featureReady, setFeatureReady] = useState(false)
  const [schemesEnabled, setSchemesEnabled] = useState(false)
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [jewellerId, setJewellerId] = useState<number | ''>('')
  const [jewellerInitDone, setJewellerInitDone] = useState(false)
  const userPickedJewellerRef = useRef(false)
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
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

  const otpCountdown = useCounterOtpCountdown(otpExpiresAt)

  useEffect(() => {
    void fetchPlatformFeatures().then((f) => {
      setSchemesEnabled(isFeatureEnabled(f, 'golden_scheme'))
      setFeatureReady(true)
    })
  }, [])

  const reloadEnrollments = useCallback(async () => {
    const rows = await fetchCustomerSchemeEnrollments()
    const visible = rows.filter((r) => VISIBLE_STATUSES.has(r.status))
    setEnrollments(visible)
    setSelectedEnrollment((prev) => {
      if (prev && visible.some((r) => r.id === prev.id)) return prev
      return visible[0] ?? null
    })
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
    void fetchVerifiedJewellers().then(setJewellers)
    void reloadEnrollments()
  }, [reloadEnrollments])

  useEffect(() => {
    if (jewellerInitDone || jewellers.length === 0) return
    const fromUrl = parseJewellerIdFromUrl(jewellerFromUrl)
    if (fromUrl && jewellers.some((j) => j.id === fromUrl)) {
      setJewellerId(fromUrl)
    }
    setJewellerInitDone(true)
  }, [jewellers, jewellerFromUrl, jewellerInitDone])

  const enrolledOfferingIds = useMemo(
    () => new Set(enrollments.map((e) => e.offering.id)),
    [enrollments],
  )

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'active'),
    [enrollments],
  )
  const awaitingEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'plan_month_complete'),
    [enrollments],
  )

  const availableOfferings = useMemo(
    () => offerings.filter((o) => !enrolledOfferingIds.has(o.id) && o.status === 'active'),
    [offerings, enrolledOfferingIds],
  )

  useEffect(() => {
    if (!jewellerId) {
      setOfferings([])
      return
    }
    void fetchCustomerSchemeOfferings(jewellerId)
      .then(setOfferings)
      .catch(() => setOfferings([]))
  }, [jewellerId])

  useEffect(() => {
    if (!selectedEnrollment || !amount || selectedEnrollment.status !== 'active') {
      setQuote(null)
      return
    }
    void quoteSchemeContribution(selectedEnrollment.id, amount)
      .then(setQuote)
      .catch(() => setQuote(null))
  }, [selectedEnrollment, amount])

  useEffect(() => {
    if (!selectedEnrollment || selectedEnrollment.status !== 'active') return
    void refreshInflightContributions(selectedEnrollment.id)
  }, [selectedEnrollment, refreshInflightContributions])

  useLivePoll(() => {
    void reloadEnrollments()
    if (selectedEnrollment?.status === 'active') {
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
    if (e.status === 'active') void refreshInflightContributions(e.id)
  }

  const enroll = async (offeringId: number) => {
    setBusy(true)
    setErr('')
    try {
      const e = await enrollCustomerScheme(offeringId)
      selectEnrollment(e)
      await reloadEnrollments()
      setMsg('Joined scheme successfully.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not join scheme')
    } finally {
      setBusy(false)
    }
  }

  const createDeposit = async () => {
    if (!selectedEnrollment || selectedEnrollment.status !== 'active') return
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

  return (
    <div className="dash-panel-max">
      <PageHeader
        eyebrow="Invest"
        title="Investment schemes"
        subtitle="Join a jeweller scheme and deposit anytime — same counter OTP and UPI flow as fractional gold purchases."
      />

      {enrollments.length === 0 ? (
        <Card>
          <EmptyState
            title="No schemes yet"
            description="Pick a jeweller below and join an available scheme to start saving."
          />
        </Card>
      ) : (
        <>
          {renderEnrollmentGroup('Active schemes', activeEnrollments)}
          {renderEnrollmentGroup('Awaiting bonus or redemption', awaitingEnrollments)}
        </>
      )}

      <Card>
        <CardHeader title="Join a scheme" />
        <div className="ds-form ds-form--compact">
          <Select
            label="Jeweller"
            value={jewellerId === '' ? '' : String(jewellerId)}
            onChange={(e) => {
              userPickedJewellerRef.current = true
              setJewellerId(e.target.value ? Number(e.target.value) : '')
            }}
          >
            <option value="">Select jeweller</option>
            {jewellers.map((j) => (
              <option key={j.id} value={j.id}>
                {j.business_name || `Jeweller #${j.id}`}
              </option>
            ))}
          </Select>
        </div>
        {jewellerId ? (
          <ul className="dash-list" style={{ marginTop: '1rem' }}>
            {availableOfferings.map((o) => (
              <li key={o.id} className="dash-list-item">
                <div>
                  <strong>{o.display_name}</strong>
                  <p className="dash-muted">{o.flow_summary}</p>
                  {o.customer_facing_note ? (
                    <p className="ds-field__hint" style={{ margin: '0.25rem 0 0' }}>
                      {o.customer_facing_note}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="primary" onClick={() => void enroll(o.id)} disabled={busy}>
                  Join scheme
                </Button>
              </li>
            ))}
            {availableOfferings.length === 0 ? (
              <EmptyState
                title="No schemes available"
                description="This jeweller has not added active schemes yet. Try another jeweller or ask them to select schemes from their catalog."
              />
            ) : null}
          </ul>
        ) : (
          <p className="dash-muted" style={{ marginTop: '1rem' }}>
            Select a jeweller to see schemes you can join.
          </p>
        )}
      </Card>

      {selectedEnrollment?.status === 'active' ? (
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
                    {otpCountdown.label ? ` · ${otpCountdown.label}` : null}
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
