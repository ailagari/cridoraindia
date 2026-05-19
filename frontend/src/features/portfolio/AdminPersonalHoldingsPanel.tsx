import { Fragment, useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type JewellerBreakdown = {
  jeweller_id: number | null
  jeweller_name: string
  holding_count: number
  total_weight_grams: string
  is_default_jeweller: boolean
}

type UserVaultRow = {
  user_id: number
  email: string
  full_name: string
  cridora_member_id: string
  default_jeweller_id: number | null
  default_jeweller_name: string
  holding_count: number
  total_weight_grams: string
  total_estimated_value_inr: string
  holdings_by_jeweller: JewellerBreakdown[]
}

function fmtGrams(raw: string): string {
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return raw
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 4 })} g`
}

function fmtInr(raw: string): string {
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return raw
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function customerLabel(row: UserVaultRow): string {
  if (row.full_name.trim()) return row.full_name.trim()
  return row.email
}

export function AdminPersonalHoldingsPanel() {
  const [rows, setRows] = useState<UserVaultRow[]>([])
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    const res = await authFetch(`/api/v1/admin/personal-holdings/?${sp.toString()}`)
    const data = (await res.json()) as { results?: UserVaultRow[]; detail?: string }
    if (!res.ok) {
      setErr(data.detail ?? 'Could not load personal vault summary.')
      setRows([])
      return
    }
    setRows(data.results ?? [])
  }, [q])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="dash-panel-max">
      <h2 className="dash-coming__title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
        Personal vault holdings by customer
      </h2>
      <p className="dash-panel-lead">
        Read-only view for marketing insight: each customer&apos;s default jeweller and how much personal gold they
        track, broken down by linked jeweller where available.
      </p>
      {err ? <p className="form-error">{err}</p> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          className="input"
          placeholder="Search customer, member ID, jeweller…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Search
        </button>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No customers with personal vault records yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="pf-ledger-table admin-user-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Member ID</th>
                <th>Default jeweller</th>
                <th>Holdings</th>
                <th>Total grams</th>
                <th>Est. value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expandedId === row.user_id
                const hasBreakdown = row.holdings_by_jeweller.length > 0
                return (
                  <Fragment key={row.user_id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 700 }}>{customerLabel(row)}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.email}</div>
                      </td>
                      <td className="tabular">{row.cridora_member_id || '—'}</td>
                      <td>
                        {row.default_jeweller_name ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{row.default_jeweller_name}</div>
                            {row.default_jeweller_id ? (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ID {row.default_jeweller_id}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Not set</span>
                        )}
                      </td>
                      <td className="tabular">{row.holding_count}</td>
                      <td className="tabular">{fmtGrams(row.total_weight_grams)}</td>
                      <td className="tabular">{fmtInr(row.total_estimated_value_inr)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {hasBreakdown ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            aria-expanded={open}
                            onClick={() => setExpandedId(open ? null : row.user_id)}
                          >
                            {open ? 'Hide' : 'Breakdown'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {open && hasBreakdown ? (
                      <tr key={`${row.user_id}-detail`}>
                        <td colSpan={7} style={{ background: 'var(--veil)', padding: '0.85rem 1rem' }}>
                          <p
                            style={{
                              margin: '0 0 0.65rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Grams by linked jeweller
                          </p>
                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            {row.holdings_by_jeweller.map((item) => (
                              <div
                                key={`${row.user_id}-${item.jeweller_id ?? 'self'}`}
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.35rem 1rem',
                                  alignItems: 'center',
                                  fontSize: '0.84rem',
                                }}
                              >
                                <span style={{ fontWeight: 600, minWidth: '8rem' }}>{item.jeweller_name}</span>
                                <span className="tabular">{fmtGrams(item.total_weight_grams)}</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {item.holding_count} item{item.holding_count === 1 ? '' : 's'}
                                </span>
                                {item.is_default_jeweller ? (
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      letterSpacing: '0.06em',
                                      textTransform: 'uppercase',
                                      color: 'var(--gold-light)',
                                    }}
                                  >
                                    Default jeweller
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
