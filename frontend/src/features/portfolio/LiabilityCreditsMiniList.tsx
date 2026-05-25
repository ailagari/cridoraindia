import { TablePagination } from '@/components/ui'
import type { TablePageSize } from '@/hooks/useTablePagination'
import { useTablePagination } from '@/hooks/useTablePagination'

type CreditRow = {
  grams: string
  created_at: string
  customer_label?: string
  customer_member_id?: string
  purchase_reference?: string
}

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso.slice(0, 10) || '—'
  return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Props = {
  rows: CreditRow[]
  /** When there are more rows than this per page, prev/next paging is shown. */
  pageSize?: TablePageSize
}

export function LiabilityCreditsMiniList({ rows, pageSize = 10 }: Props) {
  const pg = useTablePagination(rows.length, pageSize)
  const pageRows = pg.active ? rows.slice(pg.sliceStart, pg.sliceEnd) : rows

  if (rows.length === 0) {
    return <p className="pf-groww-footnote" style={{ margin: '0.35rem 0 0' }}>No recent credits yet.</p>
  }

  return (
    <>
      <ul className="pf-credits-mini" aria-label="Recent liability credits">
        {pageRows.map((row, i) => (
          <li
            key={`${row.purchase_reference ?? ''}-${row.created_at}-${row.customer_member_id ?? ''}-${pg.sliceStart + i}`}
            className="pf-credits-mini__row"
          >
            <div className="pf-credits-mini__main">
              <span className="pf-credits-mini__who">{row.customer_label ?? row.customer_member_id ?? 'Customer'}</span>
              <span className="pf-credits-mini__ref">{row.purchase_reference ?? '—'}</span>
            </div>
            <div className="pf-credits-mini__end">
              <strong className="pf-credits-mini__grams tabular">+{parseG(row.grams).toFixed(3)} g</strong>
              <span className="pf-credits-mini__when">{fmtWhen(row.created_at)}</span>
            </div>
          </li>
        ))}
      </ul>
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
    </>
  )
}
