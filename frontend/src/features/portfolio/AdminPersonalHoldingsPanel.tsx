import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type Row = {
  id: number
  title: string
  verification_status: string
  weight_grams: string
  document_count?: number
}

export function AdminPersonalHoldingsPanel() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    const res = await authFetch(`/api/v1/admin/personal-holdings/?${sp.toString()}`)
    const data = (await res.json()) as { results?: Row[]; detail?: string }
    if (!res.ok) {
      setErr(data.detail ?? 'Could not load.')
      setRows([])
      return
    }
    setRows(data.results ?? [])
  }, [q])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (id: number) => {
    if (!window.confirm('Soft-remove this holding?')) return
    const res = await authFetch(`/api/v1/admin/personal-holdings/${id}/remove/`, { method: 'POST', jsonBody: {} })
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { detail?: string }
      setErr(d.detail ?? 'Remove failed.')
      return
    }
    void load()
  }

  const verify = async (id: number) => {
    const res = await authFetch(`/api/v1/admin/personal-holdings/${id}/verify/`, {
      method: 'PATCH',
      jsonBody: { verification_status: 'verified' },
    })
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { detail?: string }
      setErr(d.detail ?? 'Verify failed.')
      return
    }
    void load()
  }

  return (
    <div className="dash-panel-max">
      <h2 className="dash-coming__title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
        Personal holdings moderation
      </h2>
      <p className="dash-panel-lead">Review customer physical-gold records; remove suspicious entries or mark verified.</p>
      {err ? <p className="form-error">{err}</p> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <input className="input" placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Search
        </button>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No rows.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="pf-ledger-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Grams</th>
                <th>Status</th>
                <th>Docs</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular">{r.id}</td>
                  <td>{r.title}</td>
                  <td className="tabular">{r.weight_grams}</td>
                  <td>{r.verification_status}</td>
                  <td className="tabular">{r.document_count ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void verify(r.id)}>
                      Verify
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(r.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
