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
  limit?: number
}

export function LiabilityCreditsMiniList({ rows, limit = 5 }: Props) {
  const show = rows.slice(0, limit)
  if (show.length === 0) {
    return <p className="pf-groww-footnote" style={{ margin: '0.35rem 0 0' }}>No recent credits yet.</p>
  }

  return (
    <ul className="pf-credits-mini" aria-label="Recent liability credits">
      {show.map((row, i) => (
        <li
          key={`${row.purchase_reference ?? ''}-${row.created_at}-${row.customer_member_id ?? ''}-${i}`}
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
  )
}
