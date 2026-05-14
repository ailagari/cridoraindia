import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { LIVE_ADMIN_TICKER_POLL_MS, LIVE_ADMIN_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type Ticker = {
  reference_price_inr_per_gram_22k: string
  admin_markup_percent: string
  rate_move_alert_threshold_inr: string
  rate_alert_baseline_inr_per_gram_22k: string | null
  manual_ticker_enabled?: boolean
  ticker_manual_22k_inr_per_gram?: string | null
  ticker_manual_24k_inr_per_gram?: string | null
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  updated_at: string
}

export function AdminGoldTickerPanel() {
  const [data, setData] = useState<Ticker | null>(null)
  const [refDraft, setRefDraft] = useState('')
  const [mkDraft, setMkDraft] = useState('')
  const [alertDraft, setAlertDraft] = useState('')
  const [manualOn, setManualOn] = useState(false)
  const [manual22Draft, setManual22Draft] = useState('')
  const [manual24Draft, setManual24Draft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const res = await authFetch('/api/v1/admin/gold-ticker/')
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { detail?: string }).detail ?? 'Could not load ticker.')
      return
    }
    const j = (await res.json()) as Ticker
    setData(j)
    setRefDraft(j.reference_price_inr_per_gram_22k)
    setMkDraft(j.admin_markup_percent)
    setAlertDraft(j.rate_move_alert_threshold_inr ?? '10')
    setManualOn(Boolean(j.manual_ticker_enabled))
    setManual22Draft(j.ticker_manual_22k_inr_per_gram ?? '')
    setManual24Draft(j.ticker_manual_24k_inr_per_gram ?? '')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refreshSnapshot = useCallback(async () => {
    if (busy) return
    const res = await authFetch('/api/v1/admin/gold-ticker/')
    if (!res.ok) return
    const j = (await res.json()) as Ticker
    setData(j)
  }, [busy])

  useLivePoll(refreshSnapshot, LIVE_ADMIN_TICKER_POLL_MS, true)

  const save = async () => {
    setBusy(true)
    setError('')
    const res = await authFetch('/api/v1/admin/gold-ticker/', {
      method: 'PATCH',
      jsonBody: {
        reference_price_inr_per_gram_22k: refDraft.trim(),
        admin_markup_percent: mkDraft.trim(),
        rate_move_alert_threshold_inr: alertDraft.trim(),
        manual_ticker_enabled: manualOn,
        ticker_manual_22k_inr_per_gram: manual22Draft.trim() || null,
        ticker_manual_24k_inr_per_gram: manual24Draft.trim() ? manual24Draft.trim() : null,
      },
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(JSON.stringify(j))
      return
    }
    await load()
  }

  return (
    <section className="card" style={{ padding: '1.25rem', borderRadius: 18 }}>
      <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
        Gold ticker (22K benchmark)
      </h2>
      <p className="dash-coming__text">
        Choose whether the public ticker and platform 22K base follow <strong>live spot</strong> (when the feed is
        available) or fixed <strong>manual board rates</strong>. Reference price and markup still apply as fallback when
        live spot cannot be resolved.
      </p>
      <p className="dash-coming__text" style={{ marginTop: '0.5rem' }}>
        <strong>Rate alerts:</strong> subscribers who enabled device notifications get a push when resolved 22K ₹/g moves
        by at least the threshold below (vs the rate at the last alert). Set to <strong>0</strong> to turn alerts off.
        Requires VAPID keys on the server.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {data ? (
        <p className="dash-footnote" style={{ marginBottom: '1rem' }}>
          Resolved Cridora 22K: <strong>{data.platform_base_inr_per_gram_22k}</strong> ₹/g
          {data.cridora_base_source ? (
            <>
              {' '}
              ({data.cridora_base_source.replace(/_/g, ' ')})
            </>
          ) : null}{' '}
          · Alert baseline (internal):{' '}
          <strong>{data.rate_alert_baseline_inr_per_gram_22k ?? '—'}</strong> ₹/g · Ticker admin fields updated{' '}
          {data.updated_at}
        </p>
      ) : null}
      <div
        className="card"
        style={{
          padding: '1rem',
          borderRadius: 12,
          border: '1px solid var(--border-soft)',
          marginBottom: '1rem',
        }}
      >
        <div className="field" style={{ marginBottom: '0.65rem' }}>
          <span style={{ fontWeight: 600, letterSpacing: '0.02em', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Price source
          </span>
        </div>
        <div
          role="group"
          aria-label="Gold ticker price source"
          style={{
            display: 'flex',
            gap: '0.45rem',
            flexWrap: 'wrap',
            marginBottom: '0.85rem',
          }}
        >
          <button
            type="button"
            className={manualOn ? 'btn btn-ghost' : 'btn btn-primary'}
            aria-pressed={!manualOn}
            style={{ flex: '1 1 160px', justifyContent: 'center' }}
            onClick={() => setManualOn(false)}
          >
            Live spot (API)
          </button>
          <button
            type="button"
            className={manualOn ? 'btn btn-primary' : 'btn btn-ghost'}
            aria-pressed={manualOn}
            style={{ flex: '1 1 160px', justifyContent: 'center' }}
            onClick={() => setManualOn(true)}
          >
            Manual board rates
          </button>
        </div>
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 10,
            background: 'var(--dash-tab-bg, rgba(0, 21, 41, 0.35))',
            border: '1px solid var(--border-soft)',
            marginBottom: manualOn ? '0.85rem' : 0,
          }}
        >
          {!manualOn ? (
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>Live mode.</strong> Strip and Cridora base prefer the global spot
              feed. Manual ₹/g fields are hidden and not applied until you switch to manual board rates.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>Manual mode.</strong> Your 22K (and optional 24K) ₹/g values
              override live spot for the ticker strip and platform base. Save to publish.
            </p>
          )}
        </div>
        {manualOn ? (
          <div
            style={{
              display: 'grid',
              gap: '0.85rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <label className="field">
              <span>22K ₹/g (required)</span>
              <input
                value={manual22Draft}
                onChange={(e) => setManual22Draft(e.target.value)}
                placeholder="e.g. 14850"
                inputMode="decimal"
              />
            </label>
            <label className="field">
              <span>24K ₹/g (optional)</span>
              <input
                value={manual24Draft}
                onChange={(e) => setManual24Draft(e.target.value)}
                placeholder="Leave blank to derive from 22K ÷ 0.916"
                inputMode="decimal"
              />
            </label>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="field">
          <span>Reference price (₹/g)</span>
          <input value={refDraft} onChange={(e) => setRefDraft(e.target.value)} />
        </label>
        <label className="field">
          <span>Admin markup (%)</span>
          <input value={mkDraft} onChange={(e) => setMkDraft(e.target.value)} />
        </label>
        <label className="field">
          <span>Alert swing threshold (₹/g)</span>
          <input
            type="text"
            inputMode="decimal"
            value={alertDraft}
            onChange={(e) => setAlertDraft(e.target.value)}
            placeholder="10"
          />
        </label>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: '1rem' }}
        disabled={busy || (manualOn && !manual22Draft.trim())}
        onClick={() => void save()}
      >
        Save ticker
      </button>
      {manualOn && !manual22Draft.trim() ? (
        <p className="dash-footnote" style={{ marginTop: '0.5rem' }}>
          Enter a 22K ₹/g value before saving in manual mode.
        </p>
      ) : null}
    </section>
  )
}

type ProductAdminRow = Record<string, unknown>

export function AdminMarketplaceModerationPanel() {
  const [rows, setRows] = useState<ProductAdminRow[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setError('')
    const q = filter === 'pending' ? '?status=pending' : ''
    const res = await authFetch(`/api/v1/admin/marketplace/products/${q}`)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { detail?: string }).detail ?? 'Could not load products.')
      return
    }
    const j = (await res.json()) as { results: ProductAdminRow[] }
    setRows(j.results ?? [])
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_ADMIN_POLL_MS, true)

  const moderate = async (id: number, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      setError('Add a rejection reason.')
      return
    }
    setBusyId(id)
    setError('')
    const res = await authFetch(`/api/v1/admin/marketplace/products/${id}/moderate/`, {
      method: 'POST',
      jsonBody:
        action === 'approve'
          ? { action: 'approve' }
          : { action: 'reject', reason: rejectReason.trim() },
    })
    setBusyId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(JSON.stringify(j))
      return
    }
    setRejectReason('')
    await load()
  }

  return (
    <section className="card" style={{ padding: '1.25rem', borderRadius: 18 }}>
      <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
        Product approval
      </h2>
      <p className="dash-coming__text">
        BIS 916 ornaments and related SKUs stay private until approved. Configure the live 22K benchmark under
        Control → Gold ticker.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={
            filter === 'pending'
              ? { borderColor: 'var(--gold)', color: 'var(--gold-light)' }
              : undefined
          }
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={
            filter === 'all' ? { borderColor: 'var(--gold)', color: 'var(--gold-light)' } : undefined
          }
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <label className="field">
        <span>Rejection reason (required to reject)</span>
        <textarea className="dash-textarea" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </label>
      <div className="dash-table-scroll card" style={{ marginTop: '1rem' }}>
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Jeweller</th>
              <th>Status</th>
              <th>Metal ₹/g</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                  Nothing in this queue.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = Number(row.id)
                return (
                  <tr key={id}>
                    <td>{String(row.name ?? '')}</td>
                    <td>{String(row.jeweller_name ?? row.jeweller_email ?? '')}</td>
                    <td>{String(row.moderation_status ?? '')}</td>
                    <td className="tabular">{String(row.metal_rate_inr_per_gram_used ?? '')}</td>
                    <td>
                      <div className="kyb-actions">
                        <button
                          type="button"
                          className="btn btn-primary kyb-btn-sm"
                          disabled={busyId === id || row.moderation_status === 'approved'}
                          onClick={() => void moderate(id, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost kyb-btn-sm"
                          disabled={busyId === id}
                          style={{ borderColor: 'rgba(217,83,79,0.45)', color: '#f0a8a5' }}
                          onClick={() => void moderate(id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
