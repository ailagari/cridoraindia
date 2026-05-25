import { Fragment, useCallback, useEffect, useState } from 'react'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import {
  adminTreasuryLedger,
  adminTreasuryPaymentInitiate,
  adminTreasurySettlementSummary,
  treasuryExportUrl,
  type SettlementSummary,
  type TreasuryLedgerRow,
} from '@/lib/adminTreasuryApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { AdminSettlementPaymentsPanel } from '@/features/treasury/AdminSettlementPaymentsPanel'

const TABS = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'settlement', label: 'Settlement' },
] as const

type Tab = (typeof TABS)[number]['id']

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function AdminTreasuryPanel({ mode }: { mode: 'ledger' | 'settlement' | 'payments' }) {
  if (mode === 'payments') {
    return <AdminSettlementPaymentsPanel />
  }

  const [tab, setTab] = useState<Tab>(mode === 'settlement' ? 'settlement' : 'ledger')
  const [ledger, setLedger] = useState<TreasuryLedgerRow[]>([])
  const [summary, setSummary] = useState<SettlementSummary | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [payoutBusyId, setPayoutBusyId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const loadLedger = useCallback(async () => {
    const out = await adminTreasuryLedger({ limit: 200 })
    if (!out.ok) {
      setErr(out.detail)
      setLedger([])
      return
    }
    setLedger(out.results)
  }, [])

  const loadSummary = useCallback(async () => {
    const out = await adminTreasurySettlementSummary()
    if (!out.ok) {
      setErr(out.detail)
      setSummary(null)
      return
    }
    setSummary(out.data)
  }, [])

  const load = useCallback(async () => {
    setErr('')
    if (tab === 'ledger') await loadLedger()
    else await loadSummary()
  }, [tab, loadLedger, loadSummary])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, false)

  const exportCsv = (groupBy: string) => {
    window.open(treasuryExportUrl(groupBy), '_blank', 'noopener,noreferrer')
  }

  const initiatePayout = async (jewellerId: number, amountInr: string, method: 'upi' | 'otp') => {
    setPayoutBusyId(jewellerId)
    setErr('')
    const out = await adminTreasuryPaymentInitiate({
      jeweller_id: jewellerId,
      amount_inr: amountInr,
      payment_method: method,
      direction: 'platform_to_jeweller',
    })
    setPayoutBusyId(null)
    if (!out.ok) {
      setErr(out.detail)
      return
    }
    setMsg(`Payout SET-${out.data.id} started — complete in Payments tab.`)
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Platform-wide ledger — all jeweller and customer transactions across fractional, deposits, jewellery purchases,
        CridoraPay, sellbacks, and loans.
      </p>

      <DashSegmentPair
        items={[...TABS]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        ariaLabel="Treasury section"
      />

      <div style={{ margin: '1rem 0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
        {tab === 'ledger' ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => exportCsv('jeweller')}>
              Export by jeweller
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => exportCsv('day')}>
              Export by day
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => exportCsv('feature')}>
            Export by feature
          </button>
        )}
      </div>

      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? <p className="form-success">{msg}</p> : null}

      {tab === 'settlement' && summary ? (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="dash-stat-card">
              <span className="dash-stat-card__label">Revenue today</span>
              <strong className="tabular">₹{formatInr(summary.platform_revenue_today_inr)}</strong>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-card__label">Revenue MTD</span>
              <strong className="tabular">₹{formatInr(summary.platform_revenue_mtd_inr)}</strong>
            </div>
          </div>

          <section>
            <h3 style={{ marginBottom: '0.5rem' }}>Jewellers owe platform</h3>
            <table className="jeweller-purchases-table">
              <thead>
                <tr>
                  <th>Jeweller</th>
                  <th>Pending INR</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {summary.jewellers_owe_platform_inr.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No pending platform fees.</td>
                  </tr>
                ) : (
                  summary.jewellers_owe_platform_inr.map((r) => (
                    <tr key={r.jeweller_id}>
                      <td>{r.name}</td>
                      <td className="tabular">₹{formatInr(r.pending_inr)}</td>
                      <td>{r.period}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 style={{ marginBottom: '0.5rem' }}>Platform owes jewellers</h3>
            <table className="jeweller-purchases-table">
              <thead>
                <tr>
                  <th>Jeweller</th>
                  <th>Net credit INR</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {summary.platform_owes_jewellers_inr.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No net credits owed to jewellers.</td>
                  </tr>
                ) : (
                  summary.platform_owes_jewellers_inr.map((r) => (
                    <tr key={r.jeweller_id}>
                      <td>{r.name}</td>
                      <td className="tabular">₹{formatInr(r.net_credit_inr)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={payoutBusyId != null}
                          onClick={() => void initiatePayout(r.jeweller_id, r.net_credit_inr, 'otp')}
                        >
                          OTP payout
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={payoutBusyId != null}
                          onClick={() => void initiatePayout(r.jeweller_id, r.net_credit_inr, 'upi')}
                        >
                          UPI payout
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 style={{ marginBottom: '0.5rem' }}>Cross-jeweller net</h3>
            <table className="jeweller-purchases-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Pending INR</th>
                  <th>Grams</th>
                </tr>
              </thead>
              <tbody>
                {summary.cross_jeweller_net.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No open cross-jeweller obligations.</td>
                  </tr>
                ) : (
                  summary.cross_jeweller_net.map((r) => (
                    <tr key={`${r.from_jeweller_id}-${r.to_jeweller_id}`}>
                      <td>{r.from_jeweller}</td>
                      <td>{r.to_jeweller}</td>
                      <td className="tabular">₹{formatInr(r.pending_inr)}</td>
                      <td>{r.grams}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {tab === 'ledger' ? (
        <div className="jeweller-purchases-wrap admin-treasury-ledger-scroll">
          <table className="jeweller-purchases-table admin-treasury-ledger-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Customer</th>
                <th>Jeweller</th>
                <th>Amount</th>
                <th>Platform fee</th>
                <th>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={8}>No ledger entries.</td>
                </tr>
              ) : (
                ledger.map((row) => {
                  const key = `${row.reference}-${row.when}`
                  const open = expanded.has(key)
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td data-label="When">{row.when.slice(0, 16).replace('T', ' ')}</td>
                        <td data-label="Type">{row.feature_label || row.feature}</td>
                        <td data-label="Reference">
                          <button
                            type="button"
                            className="jeweller-unified-desk-order-toggle tabular"
                            aria-expanded={open}
                            onClick={() =>
                              setExpanded((s) => {
                                const n = new Set(s)
                                if (n.has(key)) n.delete(key)
                                else n.add(key)
                                return n
                              })
                            }
                          >
                            {row.reference}
                          </button>
                        </td>
                        <td data-label="Customer">{row.customer || '—'}</td>
                        <td data-label="Jeweller">{row.jeweller}</td>
                        <td data-label="Amount" className="tabular">
                          ₹{formatInr(row.amount_inr)}
                        </td>
                        <td data-label="Platform fee" className="tabular">
                          ₹{formatInr(row.platform_revenue_inr)}
                        </td>
                        <td data-label="Settlement">{row.settlement_status}</td>
                      </tr>
                      {open ? (
                        <tr className="jeweller-unified-desk-detail-row">
                          <td colSpan={8}>
                            <pre className="jeweller-unified-desk-detail-pre">{JSON.stringify(row.detail, null, 2)}</pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
