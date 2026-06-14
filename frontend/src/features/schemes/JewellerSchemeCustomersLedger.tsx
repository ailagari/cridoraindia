import { useCallback, useEffect, useState } from 'react'
import { Badge, Input, Select, TablePagination } from '@/components/ui'
import { DashSegmentPair } from '@/components/DashSegmentPair'
import { useTablePagination } from '@/hooks/useTablePagination'
import {
  fetchJewellerSchemeEnrollmentsLedger,
  fetchJewellerSchemeOfferings,
  type SchemeEnrollmentLedgerSummary,
  type SchemeJewellerEnrollmentLedgerDTO,
  type SchemeOfferingDTO,
} from '@/lib/schemesApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

const TABS = [
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'finished', label: 'Finished' },
  { id: 'all', label: 'All' },
] as const

type TabId = (typeof TABS)[number]['id']
const PAGE_SZ = 10

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

function enrollmentTone(status: string): 'success' | 'danger' | 'gold' | 'warning' {
  if (status === 'active') return 'success'
  if (status === 'redeemed' || status === 'plan_month_complete') return 'gold'
  if (status === 'cancelled' || status === 'defaulted') return 'danger'
  return 'warning'
}

function enrollmentLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

type Props = {
  onSelectCustomer?: (customerId: number, enrollmentId: number) => void
}

export function JewellerSchemeCustomersLedger({ onSelectCustomer }: Props) {
  const [tab, setTab] = useState<TabId>('ongoing')
  const [rows, setRows] = useState<SchemeJewellerEnrollmentLedgerDTO[]>([])
  const [summary, setSummary] = useState<SchemeEnrollmentLedgerSummary | null>(null)
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [offeringId, setOfferingId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const pg = useTablePagination(rows.length, PAGE_SZ)
  const pageRows = pg.active ? rows.slice(pg.sliceStart, pg.sliceEnd) : rows

  const load = useCallback(async () => {
    try {
      const data = await fetchJewellerSchemeEnrollmentsLedger({
        bucket: tab === 'all' ? undefined : tab,
        offering_id: offeringId === '' ? undefined : offeringId,
        q: search.trim() || undefined,
      })
      setRows(data.results)
      setSummary(data.summary)
    } catch {
      setRows([])
    }
  }, [offeringId, search, tab])

  useEffect(() => {
    void fetchJewellerSchemeOfferings().then(setOfferings).catch(() => setOfferings([]))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, tab === 'ongoing')

  return (
    <div className="scheme-desk-ledger">
      <div className="scheme-desk-ledger__toolbar">
        <DashSegmentPair
          ariaLabel="Customer ledger tabs"
          items={TABS.map((t) => ({
            id: t.id,
            label:
              t.id === 'ongoing'
                ? `Ongoing (${summary?.ongoing_count ?? 0})`
                : t.id === 'finished'
                  ? `Finished (${summary?.finished_count ?? 0})`
                  : `All (${(summary?.ongoing_count ?? 0) + (summary?.finished_count ?? 0)})`,
          }))}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
        />
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
            label="Search customers"
            placeholder="Name, member ID, phone, scheme…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load()
            }}
          />
        </div>
      </div>

      {summary && tab === 'ongoing' && summary.pending_admission_count > 0 ? (
        <p className="scheme-desk-ledger__hint" role="status">
          {summary.pending_admission_count} customer
          {summary.pending_admission_count === 1 ? '' : 's'} awaiting admission — enable payments in Add customers.
        </p>
      ) : null}

      <div className="jeweller-purchases-wrap jeweller-purchases-scroll">
        <table className="jeweller-purchases-table jeweller-unified-desk-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Scheme</th>
              <th scope="col">Status</th>
              <th scope="col">Deposits</th>
              <th scope="col">Total paid</th>
              <th scope="col">Balance</th>
              <th scope="col">Last deposit</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td data-label="Customer">
                  <div className="jeweller-purchases-customer-stack">
                    <strong className="jeweller-purchases-customer-name">{row.customer.label}</strong>
                    <span className="jeweller-purchases-member">{row.customer.cridora_member_id}</span>
                    {row.customer.phone ? (
                      <span className="jeweller-purchases-customer-email">{row.customer.phone}</span>
                    ) : null}
                  </div>
                </td>
                <td data-label="Scheme">
                  <strong>{row.offering.display_name}</strong>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Month {row.current_plan_month}
                  </span>
                </td>
                <td data-label="Status">
                  <Badge tone={enrollmentTone(row.status)}>{enrollmentLabel(row.status)}</Badge>
                  {!row.payments_enabled ? (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Payments off
                    </span>
                  ) : null}
                </td>
                <td data-label="Deposits">
                  <strong className="tabular">{row.completed_deposit_count}</strong>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    of {row.deposit_count} attempts
                  </span>
                </td>
                <td data-label="Total paid">
                  <strong className="tabular">₹{formatInr(row.total_deposited_inr)}</strong>
                </td>
                <td data-label="Balance">
                  <span className="tabular">{row.balances.gold_grams_balance} g</span>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ₹{formatInr(row.balances.inr_balance)} pool
                  </span>
                </td>
                <td data-label="Last deposit">{formatWhen(row.last_deposit_at)}</td>
                <td data-label="View">
                  {onSelectCustomer ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn--sm"
                      onClick={() => onSelectCustomer(row.customer.id, row.id)}
                    >
                      Payments
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="dash-muted" style={{ margin: 'var(--sp-4) 0 0' }}>
            No {tab === 'all' ? '' : `${tab} `}customers{search.trim() ? ' matching your search' : ''}.
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
