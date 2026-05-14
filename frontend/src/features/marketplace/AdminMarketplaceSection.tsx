import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { LIVE_ADMIN_TICKER_POLL_MS, LIVE_ADMIN_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type Ticker = {
  reference_price_inr_per_gram_22k: string
  admin_markup_percent: string
  admin_markup_inr_per_gram: string
  rate_move_alert_threshold_inr: string
  rate_alert_baseline_inr_per_gram_22k: string | null
  manual_ticker_enabled?: boolean
  ticker_manual_22k_inr_per_gram?: string | null
  ticker_manual_24k_inr_per_gram?: string | null
  gold_deposit_yield_apr_percent?: string
  gold_loan_interest_apr_percent?: string
  gold_loan_processing_fee_inr?: string
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  updated_at: string
}

export function AdminGoldTickerPanel() {
  const [data, setData] = useState<Ticker | null>(null)
  const [refDraft, setRefDraft] = useState('')
  const [mkDraft, setMkDraft] = useState('')
  const [mkInrDraft, setMkInrDraft] = useState('')
  const [alertDraft, setAlertDraft] = useState('')
  const [manualOn, setManualOn] = useState(false)
  const [manual22Draft, setManual22Draft] = useState('')
  const [manual24Draft, setManual24Draft] = useState('')
  const [depositYieldDraft, setDepositYieldDraft] = useState('0')
  const [loanAprDraft, setLoanAprDraft] = useState('0')
  const [loanFeeDraft, setLoanFeeDraft] = useState('0')
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
    setMkInrDraft(j.admin_markup_inr_per_gram ?? '0')
    setAlertDraft(j.rate_move_alert_threshold_inr ?? '10')
    setManualOn(Boolean(j.manual_ticker_enabled))
    setManual22Draft(j.ticker_manual_22k_inr_per_gram ?? '')
    setManual24Draft(j.ticker_manual_24k_inr_per_gram ?? '')
    setDepositYieldDraft(j.gold_deposit_yield_apr_percent ?? '0')
    setLoanAprDraft(j.gold_loan_interest_apr_percent ?? '0')
    setLoanFeeDraft(j.gold_loan_processing_fee_inr ?? '0')
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
        admin_markup_inr_per_gram: mkInrDraft.trim(),
        rate_move_alert_threshold_inr: alertDraft.trim(),
        manual_ticker_enabled: manualOn,
        ticker_manual_22k_inr_per_gram: manual22Draft.trim() || null,
        ticker_manual_24k_inr_per_gram: manual24Draft.trim() ? manual24Draft.trim() : null,
        gold_deposit_yield_apr_percent: depositYieldDraft.trim(),
        gold_loan_interest_apr_percent: loanAprDraft.trim(),
        gold_loan_processing_fee_inr: loanFeeDraft.trim(),
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
        There are two published references: <strong>live spot</strong> (global feed plus your adjustments below) or{' '}
        <strong>manual</strong> 22K ₹/g. That single Cridora reference is what jewellers compare against; each jeweller
        sets board/buyback on top in Rates &amp; schemes.
      </p>
      <p className="dash-coming__text" style={{ marginTop: '0.5rem' }}>
        <strong>Notifications:</strong> when the Cridora reference moves by at least the threshold below versus the{' '}
        <em>previous</em> reference, subscribers with push enabled get an alert (up or down). Set to{' '}
        <strong>0</strong> to disable. Requires VAPID keys on the server.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {data ? (
        <p className="dash-footnote" style={{ marginBottom: '1rem' }}>
          Current Cridora reference 22K: <strong>{data.platform_base_inr_per_gram_22k}</strong> ₹/g
          {data.cridora_base_source ? (
            <>
              {' '}
              ({data.cridora_base_source.replace(/_/g, ' ')})
            </>
          ) : null}{' '}
          · Previous reference (alerts):{' '}
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
              <strong style={{ color: 'var(--text)' }}>Live mode.</strong> Raw spot 22K gets your markup % and fixed ₹/g;
              the result is the Cridora reference for the ticker and jeweller pricing. Manual ₹/g fields apply only after
              you switch to manual board rates.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>Manual mode.</strong> Your 22K (and optional 24K) ₹/g{' '}
              <em>is</em> the Cridora reference for the ticker and jewellers. Live markup % / ₹/g below are stored but not
              applied until you switch back to live spot.
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
          <span>Live spot — markup (% on raw 22K)</span>
          <input value={mkDraft} onChange={(e) => setMkDraft(e.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        <label className="field">
          <span>Live spot — plus ₹/g (after %)</span>
          <input value={mkInrDraft} onChange={(e) => setMkInrDraft(e.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        <label className="field">
          <span>Alert — reference moved ≥ ₹/g vs previous</span>
          <input
            type="text"
            inputMode="decimal"
            value={alertDraft}
            onChange={(e) => setAlertDraft(e.target.value)}
            placeholder="10"
          />
        </label>
      </div>
      <div
        style={{
          marginTop: '0.85rem',
          padding: '0.85rem',
          borderRadius: 12,
          border: '1px dashed var(--border-soft)',
          background: 'var(--veil-35)',
        }}
      >
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>Emergency only</strong> — if the global spot feed and caches are empty,
          this raw 22K ₹/g stands in for spot; the same markup % and plus ₹/g above still apply.
        </p>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Emergency raw 22K ₹/g (spot unavailable)</span>
          <input value={refDraft} onChange={(e) => setRefDraft(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <div
        style={{
          marginTop: '1rem',
          padding: '1rem',
          borderRadius: 12,
          border: '1px solid var(--border-soft)',
          background: 'var(--veil-35)',
        }}
      >
        <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.88rem' }}>
          Jeweller storefront disclosures (platform-wide)
        </p>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Deposit yield, headline loan APR, and processing fee appear on verified jeweller directory cards. Jewellers can
          still disclose their own ₹/g loan adjustment in Rates &amp; schemes.
        </p>
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label className="field">
            <span>Gold deposit yield (% APR)</span>
            <input
              value={depositYieldDraft}
              onChange={(e) => setDepositYieldDraft(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="field">
            <span>Gold loan APR (%)</span>
            <input value={loanAprDraft} onChange={(e) => setLoanAprDraft(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Gold loan processing fee (₹)</span>
            <input value={loanFeeDraft} onChange={(e) => setLoanFeeDraft(e.target.value)} inputMode="decimal" />
          </label>
        </div>
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
