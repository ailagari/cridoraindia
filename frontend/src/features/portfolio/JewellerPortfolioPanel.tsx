import { useCallback, useEffect, useState } from 'react'
import { fetchGoldWallet } from '@/lib/goldTransferApi'
import { jewellerFractionalPending, type JewellerFractionalPendingRow } from '@/lib/fractionalPurchaseApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { LiabilityCreditsMiniList } from './LiabilityCreditsMiniList'
import { JewellerPortfolioLedgerSection } from './JewellerPortfolioLedgerSection'
import { TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtWhen(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim()
  if (!raw) return '—'
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return raw.slice(0, 10)
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtInrPlain(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

type PanelProps = { embedded?: boolean }

export function JewellerPortfolioPanel({ embedded }: PanelProps = {}) {
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof fetchGoldWallet>>>(null)
  const [pending, setPending] = useState<JewellerFractionalPendingRow[]>([])
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const [w, pList] = await Promise.all([fetchGoldWallet(), jewellerFractionalPending()])
    if (!w) {
      setLoadErr('Could not load wallet.')
      setWallet(null)
      setPending([])
      return
    }
    setWallet(w)
    setPending(pList)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const credits = wallet?.recent_liability_credits ?? []
  const liabilityG = parseG(wallet?.custodial_liability_grams ?? '0')
  const vaultG = parseG(wallet?.balance_grams ?? '0')

  const pendingPg = useTablePagination(pending.length, 10)
  const pendingPageRows = pendingPg.active ? pending.slice(pendingPg.sliceStart, pendingPg.sliceEnd) : pending

  return (
    <div className={embedded ? 'pf-scope' : 'dash-panel-max pf-scope'}>
      {embedded ? null : (
        <p className="dash-panel-lead pf-lead-intro">
          Live custodial liability from verified fractional purchases, your pending counter queue, and recent credits
          that hit your jeweller ledger.
        </p>
      )}

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-grid pf-grid--kpis pf-stagger">
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--rose">
          <span className="pf-kpi__eyebrow">Custodial liability</span>
          <p className="pf-kpi__value">{`${liabilityG.toFixed(6)} g`}</p>
          <span className="pf-kpi__hint">Gold owed to customers (fractional)</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--gold">
          <span className="pf-kpi__eyebrow">Vault balance</span>
          <p className="pf-kpi__value">{`${vaultG.toFixed(6)} g`}</p>
          <span className="pf-kpi__hint">Your wallet total on platform</span>
        </div>
        <div className="pf-kpi pf-kpi--pulse pf-kpi--iris">
          <span className="pf-kpi__eyebrow">Pending counter</span>
          <p className="pf-kpi__value">{pending.length}</p>
          <span className="pf-kpi__hint">Orders awaiting OTP verification</span>
        </div>
        <div className="pf-kpi pf-kpi--shimmer pf-kpi--mint">
          <span className="pf-kpi__eyebrow">Recent credits</span>
          <p className="pf-kpi__value">{credits.length}</p>
          <span className="pf-kpi__hint">Latest liability ledger rows</span>
        </div>
      </div>

      <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger-table-wrap pf-stagger">
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Pending counter purchases</h3>
            <p className="pf-card__meta">Customers waiting for in-store OTP confirmation.</p>
          </div>
        </header>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No pending counter orders.</p>
        ) : (
          <div className="pf-ledger-scroll">
            <table className="pf-ledger-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th className="tabular">Grams</th>
                  <th className="tabular">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingPageRows.map((row) => (
                  <tr key={row.id} className="pf-ledger-row">
                    <td className="pf-ledger-date" data-label="Created">
                      {fmtWhen(row.created_at)}
                    </td>
                    <td className="tabular" data-label="Reference">
                      {row.reference}
                    </td>
                    <td data-label="Customer">
                      {row.customer?.name || row.customer?.email || '—'}
                      {row.customer?.cridora_member_id ? (
                        <span className="tabular" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {' '}
                          · {row.customer.cridora_member_id}
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular pf-ledger-grams" data-label="Grams">
                      {parseG(row.grams).toFixed(6)} g
                    </td>
                    <td className="tabular pf-ledger-inr pf-ledger-inr--out" data-label="Total">
                      ₹{fmtInrPlain(row.total_inr)}
                    </td>
                    <td data-label="Status">
                      <span className="pf-ledger-pill pf-ledger-pill--buy">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingPg.active ? (
              <TablePagination
                page={pendingPg.page}
                totalPages={pendingPg.totalPages}
                totalItems={pending.length}
                pageSize={pendingPg.pageSize}
                onPrev={() => pendingPg.setPage((p) => Math.max(0, p - 1))}
                onNext={() => pendingPg.setPage((p) => Math.min(pendingPg.totalPages - 1, p + 1))}
                className="pf-ledger-pagination"
              />
            ) : null}
          </div>
        )}
      </article>

      <article className="pf-card pf-card--lift pf-card--ledger-compact pf-stagger" style={{ marginTop: '1rem' }}>
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Recent liability credits</h3>
            <p className="pf-card__meta">Grams posted when purchases complete.</p>
          </div>
        </header>
        <LiabilityCreditsMiniList rows={credits} pageSize={10} />
      </article>

      <JewellerPortfolioLedgerSection />
    </div>
  )
}
