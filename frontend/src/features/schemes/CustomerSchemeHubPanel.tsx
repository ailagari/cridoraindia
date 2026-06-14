import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  createSchemeContribution,
  enrollCustomerScheme,
  fetchCustomerSchemeEnrollments,
  fetchCustomerSchemeOfferings,
  fetchSchemeContributionPayment,
  issueSchemeCounterOtp,
  quoteSchemeContribution,
  submitSchemeContributionUtr,
  type SchemeEnrollmentDTO,
  type SchemeOfferingDTO,
} from '@/lib/schemesApi'
import { CustomerSchemeProgressCard } from './CustomerSchemeProgressCard'

const VISIBLE_STATUSES = new Set(['active', 'plan_month_complete'])

function resetPaymentState(setters: {
  setOtp: (v: string) => void
  setUtr: (v: string) => void
  setUpiUri: (v: string) => void
  setLastContributionId: (v: number | null) => void
  setMsg: (v: string) => void
  setErr: (v: string) => void
}) {
  setters.setOtp('')
  setters.setUtr('')
  setters.setUpiUri('')
  setters.setLastContributionId(null)
  setters.setMsg('')
  setters.setErr('')
}

export function CustomerSchemeHubPanel() {
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [jewellerId, setJewellerId] = useState<number | ''>('')
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [enrollments, setEnrollments] = useState<SchemeEnrollmentDTO[]>([])
  const [selectedEnrollment, setSelectedEnrollment] = useState<SchemeEnrollmentDTO | null>(null)
  const [amount, setAmount] = useState('5000')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'counter'>('counter')
  const [quote, setQuote] = useState<Record<string, string> | null>(null)
  const [lastContributionId, setLastContributionId] = useState<number | null>(null)
  const [otp, setOtp] = useState('')
  const [utr, setUtr] = useState('')
  const [upiUri, setUpiUri] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reloadEnrollments = useCallback(async () => {
    const rows = await fetchCustomerSchemeEnrollments()
    const visible = rows.filter((r) => VISIBLE_STATUSES.has(r.status))
    setEnrollments(visible)
    setSelectedEnrollment((prev) => {
      if (prev && visible.some((r) => r.id === prev.id)) return prev
      return visible[0] ?? null
    })
  }, [])

  useEffect(() => {
    void fetchVerifiedJewellers().then(setJewellers)
    void reloadEnrollments()
  }, [reloadEnrollments])

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
    () => offerings.filter((o) => !enrolledOfferingIds.has(o.id)),
    [offerings, enrolledOfferingIds],
  )

  useEffect(() => {
    if (!jewellerId) {
      setOfferings([])
      return
    }
    void fetchCustomerSchemeOfferings(jewellerId).then(setOfferings).catch(() => setOfferings([]))
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

  const selectEnrollment = (e: SchemeEnrollmentDTO) => {
    setSelectedEnrollment(e)
    resetPaymentState({ setOtp, setUtr, setUpiUri, setLastContributionId, setMsg, setErr })
  }

  const enroll = async (offeringId: number) => {
    setBusy(true)
    setErr('')
    try {
      const e = await enrollCustomerScheme(offeringId)
      selectEnrollment(e)
      await reloadEnrollments()
      setMsg('Enrolled successfully.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Enroll failed')
    } finally {
      setBusy(false)
    }
  }

  const contribute = async () => {
    if (!selectedEnrollment || selectedEnrollment.status !== 'active') return
    setBusy(true)
    setErr('')
    try {
      const c = await createSchemeContribution({
        enrollment_id: selectedEnrollment.id,
        amount_inr: amount,
        payment_method: paymentMethod,
      })
      setLastContributionId(c.id)
      if (paymentMethod === 'counter') {
        const withOtp = await issueSchemeCounterOtp(c.id)
        setOtp(withOtp.otp ?? '')
        setMsg('Pay at counter, then share OTP with jeweller.')
      } else {
        const pay = await fetchSchemeContributionPayment(c.id)
        setUpiUri(pay.payment?.upi_uri ?? '')
        setMsg('Complete UPI payment, then submit UTR.')
      }
      await reloadEnrollments()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Contribution failed')
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

  return (
    <div className="dash-panel-max">
      <Card>
        <h2 className="dash-card-title">Investment schemes</h2>
        <p className="dash-muted">Join a jeweller scheme and deposit anytime — amounts roll into monthly buckets.</p>
      </Card>

      {enrollments.length === 0 ? (
        <Card>
          <p className="dash-muted">You have no active schemes yet. Join one below.</p>
        </Card>
      ) : (
        <>
          {renderEnrollmentGroup('Active schemes', activeEnrollments)}
          {renderEnrollmentGroup('Awaiting bonus or redemption', awaitingEnrollments)}
        </>
      )}

      <Card>
        <h3 className="dash-card-title">Join a scheme</h3>
        <label className="form-label">
          Jeweller
          <select
            className="form-input"
            value={jewellerId}
            onChange={(e) => setJewellerId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select jeweller</option>
            {jewellers.map((j) => (
              <option key={j.id} value={j.id}>
                {j.business_name || `Jeweller #${j.id}`}
              </option>
            ))}
          </select>
        </label>
        <ul className="dash-list">
          {availableOfferings.map((o) => (
            <li key={o.id} className="dash-list-item">
              <div>
                <strong>{o.display_name}</strong>
                <p className="dash-muted">{o.flow_summary}</p>
              </div>
              <Button size="sm" onClick={() => void enroll(o.id)} disabled={busy}>
                Enroll
              </Button>
            </li>
          ))}
          {jewellerId && availableOfferings.length === 0 ? (
            <p className="dash-muted">No new schemes available from this jeweller.</p>
          ) : null}
        </ul>
      </Card>

      {selectedEnrollment?.status === 'active' ? (
        <Card>
          <h3 className="dash-card-title">Add deposit — {selectedEnrollment.offering.display_name}</h3>
          <Input label="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {quote ? (
            <p className="dash-muted" style={{ margin: '0.5rem 0' }}>
              Total ₹{quote.total_inr}
              {quote.gold_grams && quote.gold_grams !== '0.000000' ? ` · ${quote.gold_grams} g` : ''}
            </p>
          ) : null}
          <div className="dash-segment-row" style={{ margin: '0.75rem 0' }}>
            <button
              type="button"
              className={paymentMethod === 'counter' ? 'dash-segment is-active' : 'dash-segment'}
              onClick={() => setPaymentMethod('counter')}
            >
              Counter
            </button>
            <button
              type="button"
              className={paymentMethod === 'upi' ? 'dash-segment is-active' : 'dash-segment'}
              onClick={() => setPaymentMethod('upi')}
            >
              UPI
            </button>
          </div>
          <Button onClick={() => void contribute()} disabled={busy}>
            Create deposit
          </Button>
          {otp ? (
            <p style={{ marginTop: '0.75rem' }}>
              Counter OTP: <strong className="tabular">{otp}</strong>
            </p>
          ) : null}
          {lastContributionId && paymentMethod === 'upi' ? (
            <div style={{ marginTop: '1rem' }}>
              {upiUri ? (
                <p className="dash-muted">
                  <a href={upiUri}>Open UPI app</a>
                </p>
              ) : null}
              <Input label="UTR after payment" value={utr} onChange={(e) => setUtr(e.target.value)} />
              <Button
                size="sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() =>
                  lastContributionId &&
                  submitSchemeContributionUtr(lastContributionId, utr).then(() =>
                    setMsg('UTR submitted.'),
                  )
                }
              >
                Submit UTR
              </Button>
            </div>
          ) : null}
        </Card>
      ) : selectedEnrollment?.status === 'plan_month_complete' ? (
        <Card>
          <p className="dash-muted">
            This scheme cycle is complete. Contact your jeweller for bonus confirmation and redemption.
          </p>
        </Card>
      ) : null}

      {msg ? <p className="form-success">{msg}</p> : null}
      {err ? <p className="form-error">{err}</p> : null}
    </div>
  )
}
