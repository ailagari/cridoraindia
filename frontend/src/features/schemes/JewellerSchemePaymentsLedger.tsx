import { Fragment, useCallback, useEffect, useState } from 'react'
import { Badge, Input, Select, TablePagination } from '@/components/ui'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { UpiProofReviewActions } from '@/features/upi/UpiProofReviewActions'
import { useTablePagination } from '@/hooks/useTablePagination'
import {
  fetchJewellerSchemeContributionsLedger,
  fetchJewellerSchemeOfferings,
  verifySchemeContributionOtp,
  type SchemeContributionDTO,
  type SchemeLedgerSummary,
  type SchemeOfferingDTO,
} from '@/lib/schemesApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

type TabId = (typeof TABS)[number]['id']
const PAGE_SZ = 10
const OTP_LEN = 6

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function statusTone(status: string): 'success' | 'danger' | 'gold' | 'warning' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled' || status === 'rejected' || status === 'on_hold') return 'danger'
  if (status === 'awaiting_counter') return 'gold'
  return 'warning'
}

function needsUpiReview(row: SchemeContributionDTO): boolean {
  return (
    row.payment_method === 'upi' &&
    (row.status === 'pending_review' ||
      row.status === 'needs_manual_verification' ||
      row.status === 'awaiting_utr_verify')
  )
}

function needsCounterOtp(row: SchemeContributionDTO): boolean {
  return row.payment_method === 'counter' && row.status === 'awaiting_counter'
}

function OtpExpiryHint({ expiresAt }: { expiresAt?: string | null }) {
  const countdown = useCounterOtpCountdown(expiresAt ?? null)
  if (!expiresAt || countdown.expired) return null
  return (
    <p className="jeweller-purchases-otp-count tabular" style={{ margin: 0 }}>
      OTP expires in <strong>{countdown.labelMmSs}</strong>
    </p>
  )
}

type Props = {
  offeringFilter?: number | ''
  customerFilter?: number | null
  queueOnly?: boolean
  onMsg?: (text: string) => void
  onErr?: (text: string) => void
}

export function JewellerSchemePaymentsLedger({
  offeringFilter = '',
  customerFilter = null,
  queueOnly = false,
  onMsg,
  onErr,
}: Props) {
  const [tab, setTab] = useState<TabId>('pending')
  const [rows, setRows] = useState<SchemeContributionDTO[]>([])
  const [summary, setSummary] = useState<SchemeLedgerSummary | null>(null)
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [offeringId, setOfferingId] = useState<number | ''>(offeringFilter)
  const [search, setSearch] = useState('')
  const [busyKey, setBusyKey] = useState<number | null>(null)
  const [otpById, setOtpById] = useState<Record<number, string>>({})
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const pg = useTablePagination(rows.length, PAGE_SZ)
  const pageRows = pg.active ? rows.slice(pg.sliceStart, pg.sliceEnd) : rows

  useEffect(() => {
    setOfferingId(offeringFilter)
  }, [offeringFilter])

  const load = useCallback(async () => {
    try {
      const data = await fetchJewellerSchemeContributionsLedger({
        bucket: queueOnly ? 'pending' : tab,
        offering_id: offeringId === '' ? undefined : offeringId,
        customer_id: customerFilter ?? undefined,
        q: search.trim() || undefined,
      })
      setRows(data.results)
      setSummary(data.summary)
    } catch (e) {
      onErr?.(e instanceof Error ? e.message : 'Could not load payments')
    }
  }, [customerFilter, offeringId, onErr, queueOnly, search, tab])

  useEffect(() => {
    void fetchJewellerSchemeOfferings().then(setOfferings).catch(() => setOfferings([]))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, queueOnly || tab === 'pending')

  const verifyOtp = async (row: SchemeContributionDTO) => {
    const otp = otpById[row.id] ?? ''
    if (otp.length !== OTP_LEN) return
    setBusyKey(row.id)
    try {
      await verifySchemeContributionOtp(row.id, otp)
      onMsg?.(`${row.reference} verified.`)
      await load()
    } catch (e) {
      onErr?.(e instanceof Error ? e.message : 'Verify failed')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="scheme-desk-ledger">
      <div className="scheme-desk-ledger__toolbar">
        {!queueOnly ? (
          <DashSegmentPair
            ariaLabel="Payment ledger tabs"
            items={TABS.map((t) => ({
              id: t.id,
              label:
                t.id === 'pending'
                  ? `Pending (${summary?.pending_count ?? 0})`
                  : t.id === 'completed'
                    ? `Completed (${summary?.completed_count ?? 0})`
                    : `Cancelled (${summary?.cancelled_count ?? 0})`,
            }))}
            value={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        ) : null}
        <div className="scheme-desk-ledger__filters">
          <Select
            label="Scheme"
            value={offeringId === '' ? '' : String(offeringId)}
            onChange={(e) => setOfferingId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All schemes</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name}
              </option>
            ))}
          </Select>
          <Input
            label="Search"
            placeholder="Ref, UTR, member ID, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load()
            }}
          />
        </div>
      </div>

      <div className="jeweller-purchases-wrap jeweller-purchases-scroll">
        <table className="jeweller-purchases-table jeweller-unified-desk-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Scheme</th>
              <th scope="col">Deposit</th>
              <th scope="col">Amount</th>
              <th scope="col">Method</th>
              <th scope="col">Status</th>
              <th scope="col">When</th>
              {tab === 'pending' || queueOnly ? <th scope="col">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const isOpen = expanded.has(row.id)
              const busy = busyKey === row.id
              const otp = otpById[row.id] ?? ''
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td data-label="Customer">
                      <div className="jeweller-purchases-customer-stack">
                        <strong className="jeweller-purchases-customer-name">
                          {row.customer?.name || row.customer?.email || 'Customer'}
                        </strong>
                        {row.customer?.cridora_member_id ? (
                          <span className="jeweller-purchases-member">{row.customer.cridora_member_id}</span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Scheme">
                      <strong>{row.scheme_name ?? 'Scheme'}</strong>
                    </td>
                    <td data-label="Deposit">
                      <button
                        type="button"
                        className="jeweller-unified-desk-order-toggle tabular"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev)
                            if (next.has(row.id)) next.delete(row.id)
                            else next.add(row.id)
                            return next
                          })
                        }
                      >
                        {row.reference}
                      </button>
                    </td>
                    <td data-label="Amount">
                      <strong className="tabular">₹{formatInr(row.amount_inr)}</strong>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {row.gold_grams} g
                      </span>
                    </td>
                    <td data-label="Method">{row.payment_method === 'upi' ? 'UPI' : 'Counter'}</td>
                    <td data-label="Status">
                      <Badge tone={statusTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td data-label="When">{formatWhen(row.created_at)}</td>
                    {tab === 'pending' || queueOnly ? (
                      <td data-label="Action" className="jeweller-purchases-otp-cell">
                        {needsCounterOtp(row) ? (
                          <div className="jeweller-purchases-otp-stack">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={OTP_LEN}
                              className="tabular jeweller-purchases-otp-input"
                              value={otp}
                              onChange={(e) =>
                                setOtpById((m) => ({
                                  ...m,
                                  [row.id]: e.target.value.replace(/\D/g, '').slice(0, OTP_LEN),
                                }))
                              }
                              placeholder="······"
                              aria-label={`OTP for ${row.reference}`}
                            />
                            <OtpExpiryHint expiresAt={row.otp_expires_at} />
                            <button
                              type="button"
                              className="btn btn-primary jeweller-purchases-verify-btn"
                              disabled={busyKey != null || otp.length !== OTP_LEN}
                              onClick={() => void verifyOtp(row)}
                            >
                              {busy ? 'Verifying…' : 'Verify OTP'}
                            </button>
                          </div>
                        ) : needsUpiReview(row) ? (
                          <UpiProofReviewActions
                            kind="scheme"
                            paymentId={row.id}
                            reference={row.reference}
                            amountInr={row.amount_inr}
                            upiUtr={row.upi_utr}
                            busy={busyKey != null}
                            compact
                            onBusyChange={(v) => setBusyKey(v ? row.id : null)}
                            onDone={async (msg) => {
                              onMsg?.(msg)
                              await load()
                            }}
                            onError={(detail) => onErr?.(detail)}
                          />
                        ) : (
                          <span className="dash-muted" style={{ fontSize: '0.82rem' }}>
                            Awaiting customer
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                  {isOpen ? (
                    <tr className="customer-orders-detail-row">
                      <td colSpan={tab === 'pending' || queueOnly ? 8 : 7}>
                        <div className="customer-orders-detail">
                          {row.upi_utr ? (
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>
                              UTR <strong className="tabular">{row.upi_utr}</strong>
                            </p>
                          ) : null}
                          {row.customer_note ? (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              Note: {row.customer_note}
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="dash-muted" style={{ margin: 'var(--sp-4) 0 0' }}>
            No {tab} deposits{search.trim() ? ' matching your search' : ''}.
          </p>
        ) : null}
      </div>

      {pg.active ? (
        <TablePagination
          page={pg.page}
          totalPages={pg.totalPages}
          totalItems={rows.length}
          pageSize={pg.pageSize}
          onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
          onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
          className="pf-ledger-pagination"
        />
      ) : null}
    </div>
  )
}
