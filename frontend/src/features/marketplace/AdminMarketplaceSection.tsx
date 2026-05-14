import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { LIVE_ADMIN_TICKER_POLL_MS, LIVE_ADMIN_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type DeductionMode = 'percent' | 'fixed_inr'

type AdjustmentsState = {
  gold: Record<string, { mode: DeductionMode; amount: string }>
  silver: Record<string, { mode: DeductionMode; amount: string }>
}

type LivePreviewRow = {
  family: string
  key: string
  label: string
  raw_inr_per_gram: string | null
  final_inr_per_gram: string | null
}

type AdminTickerPayload = {
  live_metal_adjustments_json: Record<string, unknown>
  live_spot_raw_preview: { source: string; rows: LivePreviewRow[] }
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

const METAL_ROWS: Array<{ family: 'gold' | 'silver'; key: string; label: string }> = [
  { family: 'gold', key: '24K', label: 'Gold 24K' },
  { family: 'gold', key: '22K', label: 'Gold 22K' },
  { family: 'gold', key: '21K', label: 'Gold 21K' },
  { family: 'gold', key: '18K', label: 'Gold 18K' },
  { family: 'silver', key: '999', label: 'Silver 999' },
  { family: 'silver', key: '925', label: 'Silver 925' },
]

function emptyAdjustments(): AdjustmentsState {
  const gold: AdjustmentsState['gold'] = {}
  const silver: AdjustmentsState['silver'] = {}
  for (const { family, key } of METAL_ROWS) {
    if (family === 'gold') gold[key] = { mode: 'percent', amount: '0' }
    else silver[key] = { mode: 'percent', amount: '0' }
  }
  return { gold, silver }
}

function parseAdjustments(raw: unknown): AdjustmentsState {
  const base = emptyAdjustments()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as {
    gold?: Record<string, { mode?: string; amount?: string }>
    silver?: Record<string, { mode?: string; amount?: string }>
  }
  for (const k of Object.keys(base.gold)) {
    const e = o.gold?.[k]
    if (e && (e.mode === 'percent' || e.mode === 'fixed_inr')) {
      base.gold[k] = { mode: e.mode, amount: String(e.amount ?? '0') }
    }
  }
  for (const k of Object.keys(base.silver)) {
    const e = o.silver?.[k]
    if (e && (e.mode === 'percent' || e.mode === 'fixed_inr')) {
      base.silver[k] = { mode: e.mode, amount: String(e.amount ?? '0') }
    }
  }
  return base
}

function buildAdjustmentsPayload(a: AdjustmentsState): {
  gold: Record<string, { mode: DeductionMode; amount: string }>
  silver: Record<string, { mode: DeductionMode; amount: string }>
} {
  const gold: Record<string, { mode: DeductionMode; amount: string }> = {}
  const silver: Record<string, { mode: DeductionMode; amount: string }> = {}
  for (const k of Object.keys(a.gold)) {
    gold[k] = { mode: a.gold[k].mode, amount: a.gold[k].amount.trim() || '0' }
  }
  for (const k of Object.keys(a.silver)) {
    silver[k] = { mode: a.silver[k].mode, amount: a.silver[k].amount.trim() || '0' }
  }
  return { gold, silver }
}

function applyDeduction(raw: number, mode: DeductionMode, amount: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  if (mode === 'percent') {
    const p = Math.min(Math.max(amount, 0), 100)
    return Math.max(0, raw * (1 - p / 100))
  }
  return Math.max(0, raw - amount)
}

function formatFinal(family: 'gold' | 'silver', n: number): string {
  const fd = family === 'silver' ? 3 : 2
  return n.toLocaleString('en-IN', { minimumFractionDigits: fd, maximumFractionDigits: fd })
}

function formatMaybeStrInr(s: unknown, fractionDigits = 2): string {
  if (s == null || s === '') return '—'
  const n = Number.parseFloat(String(s))
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Matches backend _manual_ticker_spot_payload karat ladder. */
function manualTickerGoldLadder(manual22: string, manual24: string): Record<string, number> | null {
  const k22 = Number.parseFloat(manual22)
  if (!Number.isFinite(k22) || k22 <= 0) return null
  let k24 = Number.parseFloat(manual24)
  if (!Number.isFinite(k24) || k24 <= 0) k24 = k22 / 0.916
  const k24r = Math.round(k24 * 100) / 100
  const k22r = Math.round(k22 * 100) / 100
  return {
    '24K': k24r,
    '22K': k22r,
    '21K': Math.round(k24r * 0.875 * 100) / 100,
    '18K': Math.round(k24r * 0.75 * 100) / 100,
  }
}

function AdminPublishedRatesSummary(props: {
  manualOn: boolean
  previewRows: LivePreviewRow[] | undefined
  manual22Draft: string
  manual24Draft: string
}) {
  const { manualOn, previewRows, manual22Draft, manual24Draft } = props

  if (manualOn) {
    const ladder = manualTickerGoldLadder(manual22Draft, manual24Draft)
    return (
      <div
        className="card"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: 12,
          border: '1px solid var(--border-soft)',
          marginBottom: '1rem',
          background: 'var(--veil-35)',
        }}
      >
        <p style={{ margin: '0 0 0.65rem', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Published manual gold reference (₹/g) — from inputs below
        </p>
        {!ladder ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter a valid 22K ₹/g to preview.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '0.35rem 1rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              fontSize: '0.82rem',
            }}
          >
            {(['24K', '22K', '21K', '18K'] as const).map((k) => (
              <div key={k} className="tabular">
                <span style={{ color: 'var(--text-muted)' }}>Gold {k}: </span>
                <strong style={{ color: 'var(--gold-light)' }}>₹{formatFinal('gold', ladder[k])}</strong>
              </div>
            ))}
            <div className="tabular" style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', fontSize: '0.76rem' }}>
              Silver not set in manual ticker mode.
            </div>
          </div>
        )}
      </div>
    )
  }

  const rows = previewRows ?? []
  return (
    <div
      className="card"
      style={{
        padding: '0.85rem 1rem',
        borderRadius: 12,
        border: '1px solid var(--border-soft)',
        marginBottom: '1rem',
        background: 'var(--veil-35)',
      }}
    >
      <p style={{ margin: '0 0 0.65rem', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Published Cridora reference (₹/g) — saved deductions on current live raw
      </p>
      <div
        style={{
          display: 'grid',
          gap: '0.35rem 1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
          fontSize: '0.82rem',
        }}
      >
        {rows.map((r) => (
          <div key={`${r.family}-${r.key}`} className="tabular">
            <span style={{ color: 'var(--text-muted)' }}>{r.label}: </span>
            <strong style={{ color: 'var(--gold-light)' }}>
              {r.final_inr_per_gram != null ? `₹${formatMaybeStrInr(r.final_inr_per_gram, r.family === 'silver' ? 3 : 2)}` : '—'}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminGoldTickerPanel() {
  const [data, setData] = useState<AdminTickerPayload | null>(null)
  const [adjDraft, setAdjDraft] = useState<AdjustmentsState>(() => emptyAdjustments())
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
    const j = (await res.json()) as AdminTickerPayload
    setData(j)
    setAdjDraft(parseAdjustments(j.live_metal_adjustments_json))
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
    const j = (await res.json()) as AdminTickerPayload
    setData(j)
  }, [busy])

  useLivePoll(refreshSnapshot, LIVE_ADMIN_TICKER_POLL_MS, true)

  const setMetalMode = (family: 'gold' | 'silver', key: string, mode: DeductionMode) => {
    setAdjDraft((prev) => ({
      ...prev,
      [family]: {
        ...prev[family],
        [key]: { ...prev[family][key], mode },
      },
    }))
  }

  const setMetalAmount = (family: 'gold' | 'silver', key: string, amount: string) => {
    setAdjDraft((prev) => ({
      ...prev,
      [family]: {
        ...prev[family],
        [key]: { ...prev[family][key], amount },
      },
    }))
  }

  const previewRow = (family: string, key: string): LivePreviewRow | undefined =>
    data?.live_spot_raw_preview?.rows?.find((r) => r.family === family && r.key === key)

  const save = async () => {
    setBusy(true)
    setError('')
    const res = await authFetch('/api/v1/admin/gold-ticker/', {
      method: 'PATCH',
      jsonBody: {
        live_metal_adjustments_json: buildAdjustmentsPayload(adjDraft),
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
        Gold ticker (Cridora reference)
      </h2>
      <p className="dash-coming__text">
        <strong>Live spot:</strong> global metal ₹/g feeds match row-by-row below. Set a <strong>deduction</strong> per metal
        as either a percent off live or a fixed ₹/g off live — one mode per metal (toggle). Published ticker uses{' '}
        <strong>live raw</strong> minus your deduction; jewellers price above or below that reference in Rates &amp;
        schemes.
      </p>
      <p className="dash-coming__text" style={{ marginTop: '0.5rem' }}>
        <strong>Manual:</strong> your 22K (optional 24K) replaces live for gold ticker rows; row deductions do not apply.
        Last successful live snapshot is kept automatically for outage fallback (same raw as live when the feed was
        last healthy).
      </p>
      <p className="dash-coming__text" style={{ marginTop: '0.5rem' }}>
        <strong>Notifications:</strong> push when Cridora <strong>22K reference</strong> moves by ≥ threshold versus the
        previous reference. Set to <strong>0</strong> to disable.
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
          <strong>{data.rate_alert_baseline_inr_per_gram_22k ?? '—'}</strong> ₹/g · Saved{' '}
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

      {data ? (
        <AdminPublishedRatesSummary
          manualOn={manualOn}
          previewRows={data.live_spot_raw_preview?.rows}
          manual22Draft={manual22Draft}
          manual24Draft={manual24Draft}
        />
      ) : null}

      {!manualOn ? (
        <div className="dash-table-scroll card" style={{ marginBottom: '1rem', borderRadius: 12 }}>
          <p className="dash-footnote" style={{ padding: '0.65rem 0.75rem', margin: 0, borderBottom: '1px solid var(--border-soft)' }}>
            Live raw ₹/g refreshes from cache / feed / last snapshot (source:{' '}
            <strong>{data?.live_spot_raw_preview?.source?.replace(/_/g, ' ') || '—'}</strong>). Final column shows Cridora
            reference after your deduction (preview uses draft values until you save).
          </p>
          <table className="admin-user-table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Metal</th>
                <th className="tabular">Live ₹/g</th>
                <th>Deduction type</th>
                <th className="tabular">Deduction value</th>
                <th className="tabular">Final ₹/g</th>
              </tr>
            </thead>
            <tbody>
              {METAL_ROWS.map(({ family, key, label }) => {
                const pr = previewRow(family, key)
                const rawStr = pr?.raw_inr_per_gram
                const rawNum = rawStr != null ? Number.parseFloat(rawStr) : NaN
                const rowAdj = adjDraft[family][key]
                const amt = Number.parseFloat(rowAdj.amount) || 0
                const finalNum =
                  Number.isFinite(rawNum) && rawNum > 0 ? applyDeduction(rawNum, rowAdj.mode, amt) : NaN
                return (
                  <tr key={`${family}-${key}`}>
                    <td style={{ fontWeight: 600 }}>{label}</td>
                    <td className="tabular" style={{ color: 'var(--text-muted)' }}>
                      {Number.isFinite(rawNum) ? formatFinal(family, rawNum) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={rowAdj.mode === 'percent' ? 'btn btn-primary kyb-btn-sm' : 'btn btn-ghost kyb-btn-sm'}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => setMetalMode(family, key, 'percent')}
                        >
                          % off live
                        </button>
                        <button
                          type="button"
                          className={rowAdj.mode === 'fixed_inr' ? 'btn btn-primary kyb-btn-sm' : 'btn btn-ghost kyb-btn-sm'}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => setMetalMode(family, key, 'fixed_inr')}
                        >
                          ₹/g off live
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        value={rowAdj.amount}
                        onChange={(e) => setMetalAmount(family, key, e.target.value)}
                        inputMode="decimal"
                        style={{
                          width: '100%',
                          maxWidth: 120,
                          padding: '0.35rem 0.5rem',
                          borderRadius: 8,
                          border: '1px solid var(--border-soft)',
                          background: 'var(--input-bg, transparent)',
                          color: 'var(--text)',
                        }}
                        aria-label={rowAdj.mode === 'percent' ? 'Percent deduction' : 'Rupees per gram deduction'}
                      />
                      {Number.isFinite(finalNum) ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                          → final{' '}
                          <span className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 600 }}>
                            ₹{formatFinal(family, finalNum)}
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
                      {Number.isFinite(finalNum) ? formatFinal(family, finalNum) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="dash-footnote" style={{ marginBottom: '1rem' }}>
          Manual mode: gold ticker uses your 22K/24K only. Switch to live spot to edit per-metal deductions.
        </p>
      )}

      <label className="field" style={{ maxWidth: 420 }}>
        <span>Alert — 22K reference moved ≥ ₹/g vs previous</span>
        <input
          type="text"
          inputMode="decimal"
          value={alertDraft}
          onChange={(e) => setAlertDraft(e.target.value)}
          placeholder="10"
        />
        {data ? (
          <span className="dash-footnote" style={{ display: 'block', marginTop: '0.35rem' }}>
            Compared against baseline{' '}
            <strong className="tabular">{data.rate_alert_baseline_inr_per_gram_22k ?? '—'}</strong> ₹/g · Live published
            22K now <strong className="tabular">{data.platform_base_inr_per_gram_22k}</strong> ₹/g
          </span>
        ) : null}
      </label>

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
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.35rem' }}>
              Published headline:{' '}
              <strong className="tabular">{formatMaybeStrInr(depositYieldDraft, 3)}%</strong> APR
            </span>
          </label>
          <label className="field">
            <span>Gold loan APR (%)</span>
            <input value={loanAprDraft} onChange={(e) => setLoanAprDraft(e.target.value)} inputMode="decimal" />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.35rem' }}>
              Published headline: <strong className="tabular">{formatMaybeStrInr(loanAprDraft, 3)}%</strong> APR
            </span>
          </label>
          <label className="field">
            <span>Gold loan processing fee (₹)</span>
            <input value={loanFeeDraft} onChange={(e) => setLoanFeeDraft(e.target.value)} inputMode="decimal" />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.35rem' }}>
              Published fee: <strong className="tabular">₹{formatMaybeStrInr(loanFeeDraft, 2)}</strong>
            </span>
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

function AdminModerationPricingCell({ row }: { row: ProductAdminRow }) {
  const perG = (label: string, val: unknown) => {
    const s = formatMaybeStrInr(val)
    return (
      <div className="tabular">
        <span style={{ color: 'var(--text-muted)' }}>{label} </span>
        {s === '—' ? (
          <strong>—</strong>
        ) : (
          <>
            <strong style={label.startsWith('Cridora') ? { color: 'var(--gold-light)' } : undefined}>₹{s}</strong>
            <span style={{ color: 'var(--text-muted)' }}> /g</span>
          </>
        )}
      </div>
    )
  }
  const gv = formatMaybeStrInr(row.gold_metal_value_inr)
  return (
    <td style={{ fontSize: '0.76rem', lineHeight: 1.45, verticalAlign: 'top', maxWidth: 220 }}>
      {perG('Cridora 22K', row.platform_base_inr_per_gram_22k)}
      {perG('Board', row.metal_rate_inr_per_gram_used)}
      <div className="tabular">
        <span style={{ color: 'var(--text-muted)' }}>Gold value </span>
        {gv === '—' ? <strong>—</strong> : <strong>₹{gv}</strong>}
      </div>
      {perG('Sellback', row.sellback_indicative_inr_per_gram)}
    </td>
  )
}

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
              <th>Calculated pricing</th>
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
                    <AdminModerationPricingCell row={row} />
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
