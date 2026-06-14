import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, EmptyState, Feedback } from '@/components/ui'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { JewellerSchemeCustomersLedger } from '@/features/schemes/JewellerSchemeCustomersLedger'
import { JewellerSchemeEnrollPanel } from '@/features/schemes/JewellerSchemeEnrollPanel'
import { JewellerSchemePaymentsLedger } from '@/features/schemes/JewellerSchemePaymentsLedger'
import {
  fetchJewellerSchemeContributionsLedger,
  type SchemeLedgerSummary,
} from '@/lib/schemesApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { fetchPlatformFeatures, isFeatureEnabled } from '@/lib/platformFeatures'

const DESK_TABS = [
  { id: 'queue', label: 'Action queue' },
  { id: 'customers', label: 'Customers' },
  { id: 'payments', label: 'Payments' },
  { id: 'enroll', label: 'Add customers' },
] as const

type DeskTab = (typeof DESK_TABS)[number]['id']

export function JewellerSchemeDeskPanel() {
  const [tab, setTab] = useState<DeskTab>('queue')
  const [summary, setSummary] = useState<SchemeLedgerSummary | null>(null)
  const [customerFilter, setCustomerFilter] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [featureReady, setFeatureReady] = useState(false)
  const [schemesEnabled, setSchemesEnabled] = useState(false)

  useEffect(() => {
    void fetchPlatformFeatures().then((f) => {
      setSchemesEnabled(isFeatureEnabled(f?.flags ?? null, 'golden_scheme'))
      setFeatureReady(true)
    })
  }, [])

  const reloadSummary = useCallback(async () => {
    try {
      const data = await fetchJewellerSchemeContributionsLedger({ bucket: 'pending' })
      setSummary(data.summary)
    } catch {
      setSummary(null)
    }
  }, [])

  useEffect(() => {
    void reloadSummary()
  }, [reloadSummary])

  useLivePoll(reloadSummary, LIVE_BALANCE_POLL_MS, schemesEnabled && tab !== 'enroll')

  const viewCustomerPayments = (customerId: number) => {
    setCustomerFilter(customerId)
    setTab('payments')
  }

  if (!featureReady) {
    return (
      <div className="dash-panel-max scheme-desk-panel">
        <p className="dash-muted">Loading schemes desk…</p>
      </div>
    )
  }

  if (!schemesEnabled) {
    return (
      <div className="dash-panel-max scheme-desk-panel">
        <EmptyState
          title="Schemes desk unavailable"
          description="Golden scheme is not enabled on the platform yet."
        />
      </div>
    )
  }

  return (
    <div className="dash-panel-max scheme-desk-panel">
      <Card className="scheme-desk-hero">
        <CardHeader title="Schemes desk" />
        <p className="scheme-desk-hero__lead">
          Manage scheme customers, verify deposits, and review payment history — same workflow as fractional purchases.
        </p>
        {summary ? (
          <div className="scheme-desk-hero__stats" role="status">
            <span className="scheme-desk-stat">
              <strong className="tabular">{summary.pending_action_count ?? 0}</strong>
              <span>need action</span>
            </span>
            <span className="scheme-desk-stat">
              <strong className="tabular">{summary.pending_count}</strong>
              <span>open deposits</span>
            </span>
            <span className="scheme-desk-stat">
              <strong className="tabular">{summary.completed_count}</strong>
              <span>completed</span>
            </span>
          </div>
        ) : null}
        {msg ? <Feedback tone="success">{msg}</Feedback> : null}
        {err ? <Feedback tone="error">{err}</Feedback> : null}
      </Card>

      <DashSegmentPair
        ariaLabel="Schemes desk sections"
        className="scheme-desk-tabs"
        items={DESK_TABS.map((t) => ({
          id: t.id,
          label:
            t.id === 'queue' && summary?.pending_action_count
              ? `${t.label} (${summary.pending_action_count})`
              : t.label,
        }))}
        value={tab}
        onChange={(id) => {
          setErr('')
          setMsg('')
          if (id !== 'payments') setCustomerFilter(null)
          setTab(id as DeskTab)
        }}
      />

      {tab === 'queue' ? (
        <Card>
          <CardHeader title="Pending deposits" />
          <p className="dash-muted" style={{ marginTop: 0 }}>
            Counter OTP verification and UPI proof review for deposits awaiting your action.
          </p>
          <JewellerSchemePaymentsLedger
            queueOnly
            onMsg={(text) => {
              setMsg(text)
              void reloadSummary()
            }}
            onErr={setErr}
          />
        </Card>
      ) : null}

      {tab === 'customers' ? (
        <Card>
          <CardHeader title="Scheme customers" />
          <p className="dash-muted" style={{ marginTop: 0 }}>
            Search customers across schemes. Ongoing includes active savers; finished includes redeemed or closed plans.
          </p>
          <JewellerSchemeCustomersLedger onSelectCustomer={viewCustomerPayments} />
        </Card>
      ) : null}

      {tab === 'payments' ? (
        <Card>
          <CardHeader title="Payment ledger" />
          <p className="dash-muted" style={{ marginTop: 0 }}>
            Full deposit history — pending, completed, and cancelled — with search and scheme filters.
          </p>
          {customerFilter ? (
            <p className="scheme-desk-ledger__hint">
              Filtered to one customer.{' '}
              <button type="button" className="btn btn-ghost btn--sm" onClick={() => setCustomerFilter(null)}>
                Show all
              </button>
            </p>
          ) : null}
          <JewellerSchemePaymentsLedger
            customerFilter={customerFilter}
            onMsg={setMsg}
            onErr={setErr}
          />
        </Card>
      ) : null}

      {tab === 'enroll' ? <JewellerSchemeEnrollPanel /> : null}
    </div>
  )
}
