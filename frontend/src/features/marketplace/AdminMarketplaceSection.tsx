import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { authFetch } from '@/lib/api'
import { LIVE_ADMIN_TICKER_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type DeductionMode = 'percent' | 'fixed_inr'

type AdjustmentSide = { mode: DeductionMode; amount: string }

type MetalAdjustmentRow = {
  markup: AdjustmentSide
  deduction: AdjustmentSide
}

type AdjustmentsState = {
  gold: Record<string, MetalAdjustmentRow>
  silver: Record<string, MetalAdjustmentRow>
}

type LivePreviewRow = {
  family: string
  key: string
  label: string
  raw_inr_per_gram: string | null
  after_markup_inr_per_gram: string | null
  final_inr_per_gram: string | null
}

type AdminTickerPayload = {
  live_metal_adjustments_json: Record<string, unknown>
  live_spot_raw_preview: { source: string; rows: LivePreviewRow[] }
  rate_move_alert_threshold_inr: string
  rate_alert_baseline_inr_per_gram_22k: string | null
  hourly_gold_push_enabled?: boolean
  hourly_gold_push_baseline_inr_per_gram_22k?: string | null
  hourly_gold_push_baseline_recorded_at?: string | null
  manual_ticker_enabled?: boolean
  ticker_manual_22k_inr_per_gram?: string | null
  ticker_manual_24k_inr_per_gram?: string | null
  gold_deposit_yield_apr_percent?: string
  gold_loan_interest_apr_percent?: string
  gold_loan_processing_fee_percent?: string
  cross_platform_fee_inr?: string
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
  const side = (): AdjustmentSide => ({ mode: 'percent', amount: '0' })
  const gold: AdjustmentsState['gold'] = {}
  const silver: AdjustmentsState['silver'] = {}
  for (const { family, key } of METAL_ROWS) {
    const row: MetalAdjustmentRow = { markup: side(), deduction: side() }
    if (family === 'gold') gold[key] = row
    else silver[key] = row
  }
  return { gold, silver }
}

function normalizeAdjustmentSide(raw: unknown): AdjustmentSide {
  if (raw && typeof raw === 'object') {
    const s = raw as { mode?: string; amount?: unknown }
    const mode = s.mode === 'fixed_inr' ? 'fixed_inr' : 'percent'
    return { mode, amount: String(s.amount ?? '0') }
  }
  return { mode: 'percent', amount: '0' }
}

function parseAdjustments(raw: unknown): AdjustmentsState {
  const base = emptyAdjustments()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as {
    gold?: Record<string, Record<string, unknown>>
    silver?: Record<string, Record<string, unknown>>
  }
  const ingest = (family: 'gold' | 'silver', keys: string[]) => {
    for (const k of keys) {
      const e = o[family]?.[k]
      if (!e || typeof e !== 'object') continue
      if ('markup' in e || 'deduction' in e) {
        base[family][k] = {
          markup: normalizeAdjustmentSide(e.markup),
          deduction: normalizeAdjustmentSide(e.deduction),
        }
      } else if ('mode' in e || 'amount' in e || 'deduction_mode' in e) {
        const dmRaw = (e as { deduction_mode?: string; mode?: string }).deduction_mode
        const modeRaw = (e as { mode?: string }).mode
        const dm = dmRaw === 'fixed_inr' || modeRaw === 'fixed_inr' ? 'fixed_inr' : 'percent'
        base[family][k] = {
          markup: { mode: 'percent', amount: '0' },
          deduction: { mode: dm, amount: String((e as { amount?: unknown }).amount ?? '0') },
        }
      }
    }
  }
  ingest('gold', Object.keys(base.gold))
  ingest('silver', Object.keys(base.silver))
  return base
}

function buildAdjustmentsPayload(a: AdjustmentsState): {
  gold: Record<string, MetalAdjustmentRow>
  silver: Record<string, MetalAdjustmentRow>
} {
  const pack = (src: Record<string, MetalAdjustmentRow>) => {
    const out: Record<string, MetalAdjustmentRow> = {}
    for (const k of Object.keys(src)) {
      const r = src[k]
      out[k] = {
        markup: { mode: r.markup.mode, amount: r.markup.amount.trim() || '0' },
        deduction: { mode: r.deduction.mode, amount: r.deduction.amount.trim() || '0' },
      }
    }
    return out
  }
  return { gold: pack(a.gold), silver: pack(a.silver) }
}

function applyMarkup(raw: number, mode: DeductionMode, amount: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return NaN
  if (mode === 'percent') {
    const p = Math.min(Math.max(amount, 0), 1000)
    return Math.max(0, raw * (1 + p / 100))
  }
  return Math.max(0, raw + Math.max(0, amount))
}

function applyDeductionFromMarkup(mid: number, mode: DeductionMode, amount: number): number {
  if (!Number.isFinite(mid) || mid <= 0) return NaN
  if (mode === 'percent') {
    const p = Math.min(Math.max(amount, 0), 100)
    return Math.max(0, mid * (1 - p / 100))
  }
  return Math.max(0, mid - Math.max(0, amount))
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

function useTimedSuccessMessage(durationMs = 3400) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const show = useCallback(
    (text: string) => {
      setMessage(text)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        setMessage(null)
        timerRef.current = null
      }, durationMs)
    },
    [durationMs],
  )

  const clear = useCallback(() => {
    setMessage(null)
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return { message, show, clear }
}

function AdminFormSuccessBanner({
  message,
  layout = 'flex',
}: {
  message: string | null
  layout?: 'flex' | 'block'
}) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`admin-dash-form-success${layout === 'block' ? ' admin-dash-form-success--block' : ''}`}
    >
      {message}
    </div>
  )
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
  rawPreviewSource?: string
}) {
  const { manualOn, previewRows, manual22Draft, manual24Draft, rawPreviewSource } = props

  if (manualOn) {
    const ladder = manualTickerGoldLadder(manual22Draft, manual24Draft)
    return (
      <div
        className="card"
        style={{
          padding: '0.65rem 0.75rem',
          borderRadius: 12,
          border: '1px solid var(--border-soft)',
          marginBottom: '1rem',
          background: 'var(--veil-35)',
        }}
      >
        <p style={{ margin: '0 0 0.45rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Manual gold ₹/g
        </p>
        {!ladder ? (
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>Enter 22K to preview.</p>
        ) : (
          <div className="dash-table-scroll">
            <table className="admin-user-table" style={{ fontSize: '0.78rem', margin: 0 }}>
              <thead>
                <tr>
                  <th>Metal</th>
                  <th className="tabular">Board ₹/g</th>
                </tr>
              </thead>
              <tbody>
                {(['24K', '22K', '21K', '18K'] as const).map((k) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 600 }}>Gold {k}</td>
                    <td className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
                      ₹{formatFinal('gold', ladder[k])}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 6 }}>
                    Silver N/A in manual mode.
                  </td>
                </tr>
              </tbody>
            </table>
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
        padding: '0.65rem 0.75rem',
        borderRadius: 12,
        border: '1px solid var(--border-soft)',
        marginBottom: '1rem',
        background: 'var(--veil-35)',
      }}
    >
      <p style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Published ₹/g <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}>(saved rules · current raw)</span>
      </p>
      <div className="dash-table-scroll">
        <table className="admin-user-table" style={{ fontSize: '0.78rem', margin: 0 }}>
          <thead>
            <tr>
              <th>Metal</th>
              <th className="tabular">International (reference)</th>
              <th className="tabular">+Markup</th>
              <th className="tabular">Published</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.family}-${r.key}`}>
                <td style={{ fontWeight: 600 }}>{r.label}</td>
                <td className="tabular" style={{ color: 'var(--text-muted)' }}>
                  {r.raw_inr_per_gram != null
                    ? `₹${formatMaybeStrInr(r.raw_inr_per_gram, r.family === 'silver' ? 3 : 2)}`
                    : '—'}
                </td>
                <td className="tabular" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                  {r.after_markup_inr_per_gram != null
                    ? `₹${formatMaybeStrInr(r.after_markup_inr_per_gram, r.family === 'silver' ? 3 : 2)}`
                    : '—'}
                </td>
                <td className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
                  {r.final_inr_per_gram != null
                    ? `₹${formatMaybeStrInr(r.final_inr_per_gram, r.family === 'silver' ? 3 : 2)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rawPreviewSource ? (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: 'var(--text-faint)' }}>
          Raw snapshot: {rawPreviewSource.replace(/_/g, ' ')}
        </p>
      ) : null}
    </div>
  )
}

export function AdminGoldTickerPanel() {
  const [data, setData] = useState<AdminTickerPayload | null>(null)
  const [adjDraft, setAdjDraft] = useState<AdjustmentsState>(() => emptyAdjustments())
  const [alertDraft, setAlertDraft] = useState('')
  const [hourlyPushDraft, setHourlyPushDraft] = useState(true)
  const [manualOn, setManualOn] = useState(false)
  const [manual22Draft, setManual22Draft] = useState('')
  const [manual24Draft, setManual24Draft] = useState('')
  const [depositYieldDraft, setDepositYieldDraft] = useState('0')
  const [loanAprDraft, setLoanAprDraft] = useState('0')
  const [loanFeeDraft, setLoanFeeDraft] = useState('0')
  const [crossPlatformFeeDraft, setCrossPlatformFeeDraft] = useState('49')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { message: saveSuccessMsg, show: showSaveSuccess, clear: clearSaveSuccess } = useTimedSuccessMessage()

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
    setHourlyPushDraft(j.hourly_gold_push_enabled !== false)
    setManualOn(Boolean(j.manual_ticker_enabled))
    setManual22Draft(j.ticker_manual_22k_inr_per_gram ?? '')
    setManual24Draft(j.ticker_manual_24k_inr_per_gram ?? '')
    setDepositYieldDraft(j.gold_deposit_yield_apr_percent ?? '0')
    setLoanAprDraft(j.gold_loan_interest_apr_percent ?? '0')
    setLoanFeeDraft(j.gold_loan_processing_fee_percent ?? '0')
    setCrossPlatformFeeDraft(j.cross_platform_fee_inr ?? '49')
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

  const patchAdjSide = (
    family: 'gold' | 'silver',
    key: string,
    which: 'markup' | 'deduction',
    patch: Partial<AdjustmentSide>,
  ) => {
    setAdjDraft((prev) => ({
      ...prev,
      [family]: {
        ...prev[family],
        [key]: {
          ...prev[family][key],
          [which]: { ...prev[family][key][which], ...patch },
        },
      },
    }))
  }

  const previewRow = (family: string, key: string): LivePreviewRow | undefined =>
    data?.live_spot_raw_preview?.rows?.find((r) => r.family === family && r.key === key)

  const save = async () => {
    setBusy(true)
    setError('')
    clearSaveSuccess()
    const res = await authFetch('/api/v1/admin/gold-ticker/', {
      method: 'PATCH',
      jsonBody: {
        live_metal_adjustments_json: buildAdjustmentsPayload(adjDraft),
        rate_move_alert_threshold_inr: alertDraft.trim(),
        hourly_gold_push_enabled: hourlyPushDraft,
        manual_ticker_enabled: manualOn,
        ticker_manual_22k_inr_per_gram: manual22Draft.trim() || null,
        ticker_manual_24k_inr_per_gram: manual24Draft.trim() ? manual24Draft.trim() : null,
        gold_deposit_yield_apr_percent: depositYieldDraft.trim(),
        gold_loan_interest_apr_percent: loanAprDraft.trim(),
        gold_loan_processing_fee_percent: loanFeeDraft.trim(),
        cross_platform_fee_inr: crossPlatformFeeDraft.trim(),
      },
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(JSON.stringify(j))
      return
    }
    await load()
    showSaveSuccess('Saved — ticker & fees are updated and live.')
  }

  return (
    <section className="card admin-ticker-panel" style={{ padding: 0, borderRadius: 18, overflow: 'hidden' }}>
      <header className="admin-ticker-panel__head">
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Ticker &amp; fees
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: 0, fontSize: '0.82rem', maxWidth: '52rem' }}>
          Configure live metal rates, alerts, and <strong>all platform fees and storefront disclosures</strong> here.{' '}
          <strong>Live:</strong> markup on international raw spot, then deduction — jewellers and customers see the published
          live market column. <strong>Manual:</strong> fixed 22K/24K gold only (no row rules).{' '}
          <strong>Alerts:</strong> 22K vs baseline; <strong>0</strong> disables.
        </p>
        {data ? (
          <ul className="admin-ticker-panel__meta" aria-label="Current ticker snapshot">
            <li>
              <span className="admin-ticker-panel__meta-k">Live 22K</span>
              <strong className="tabular">
                ₹{formatMaybeStrInr(data.platform_base_inr_per_gram_22k)}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>/g</span>
            </li>
            <li>
              <span className="admin-ticker-panel__meta-k">Feed</span>
              <span>{data.cridora_base_source ? data.cridora_base_source.replace(/_/g, ' ') : '—'}</span>
            </li>
            <li>
              <span className="admin-ticker-panel__meta-k">Alert baseline</span>
              <strong className="tabular">{data.rate_alert_baseline_inr_per_gram_22k ?? '—'}</strong>
            </li>
            <li>
              <span className="admin-ticker-panel__meta-k">Last saved</span>
              <span className="tabular" style={{ fontWeight: 600 }}>
                {data.updated_at}
              </span>
            </li>
          </ul>
        ) : null}
      </header>
      <div className="admin-ticker-panel__body">
      {error ? <p className="form-error">{error}</p> : null}
      <p className="admin-ticker-panel__section-title">Price source</p>
      <div className="admin-ticker-panel__card">
        <div
          role="group"
          aria-label="Ticker metal price source"
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: manualOn ? '0.85rem' : 0,
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
        <>
          <p className="admin-ticker-panel__section-title">Published preview</p>
          <AdminPublishedRatesSummary
            manualOn={manualOn}
            previewRows={data.live_spot_raw_preview?.rows}
            manual22Draft={manual22Draft}
            manual24Draft={manual24Draft}
            rawPreviewSource={data.live_spot_raw_preview?.source}
          />
        </>
      ) : null}

      {!manualOn ? (
        <>
          <p className="admin-ticker-panel__section-title">Live markup rules (draft)</p>
        <div className="admin-ticker-adj-table-wrap">
          <p className="admin-ticker-panel__draft-banner">
            <strong>Live ladder (draft)</strong> — raw feed{' '}
            <strong>{data?.live_spot_raw_preview?.source?.replace(/_/g, ' ') || '—'}</strong>. Edits apply after{' '}
            <strong>Save</strong>.
          </p>
          <div className="dash-table-scroll">
          <table className="admin-user-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th scope="col">Metal</th>
                <th className="tabular" scope="col" title="International raw reference">
                  Raw ₹/g
                </th>
                <th scope="col" title="Markup: percent or fixed ₹ on raw">
                  Markup
                </th>
                <th className="tabular" scope="col" title="Markup amount">
                  Value
                </th>
                <th className="tabular" scope="col" title="Price after markup">
                  Post-mk
                </th>
                <th scope="col" title="Deduction from post-markup reference">
                  Deduction
                </th>
                <th className="tabular" scope="col" title="Deduction amount">
                  Value
                </th>
                <th className="tabular" scope="col" title="Published live market">
                  Published
                </th>
              </tr>
            </thead>
            <tbody>
              {METAL_ROWS.map(({ family, key, label }) => {
                const pr = previewRow(family, key)
                const rawStr = pr?.raw_inr_per_gram
                const rawNum = rawStr != null ? Number.parseFloat(rawStr) : NaN
                const rowAdj = adjDraft[family][key]
                const mAmt = Number.parseFloat(rowAdj.markup.amount) || 0
                const dAmt = Number.parseFloat(rowAdj.deduction.amount) || 0
                const midNum =
                  Number.isFinite(rawNum) && rawNum > 0
                    ? applyMarkup(rawNum, rowAdj.markup.mode, mAmt)
                    : NaN
                const finalNum =
                  Number.isFinite(midNum) && midNum > 0
                    ? applyDeductionFromMarkup(midNum, rowAdj.deduction.mode, dAmt)
                    : NaN
                const inpStyle: CSSProperties = {
                  width: '100%',
                  maxWidth: 112,
                  padding: '0.35rem 0.5rem',
                  borderRadius: 8,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--input-bg, transparent)',
                  color: 'var(--text)',
                }
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
                          className={
                            rowAdj.markup.mode === 'percent'
                              ? 'btn btn-primary kyb-btn-sm'
                              : 'btn btn-ghost kyb-btn-sm'
                          }
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => patchAdjSide(family, key, 'markup', { mode: 'percent' })}
                        >
                          % on raw
                        </button>
                        <button
                          type="button"
                          className={
                            rowAdj.markup.mode === 'fixed_inr'
                              ? 'btn btn-primary kyb-btn-sm'
                              : 'btn btn-ghost kyb-btn-sm'
                          }
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => patchAdjSide(family, key, 'markup', { mode: 'fixed_inr' })}
                        >
                          ₹/g on raw
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        value={rowAdj.markup.amount}
                        onChange={(e) => patchAdjSide(family, key, 'markup', { amount: e.target.value })}
                        inputMode="decimal"
                        style={inpStyle}
                        aria-label={
                          rowAdj.markup.mode === 'percent' ? 'Markup percent on raw' : 'Markup rupees per gram on raw'
                        }
                      />
                    </td>
                    <td className="tabular" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                      {Number.isFinite(midNum) ? formatFinal(family, midNum) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={
                            rowAdj.deduction.mode === 'percent'
                              ? 'btn btn-primary kyb-btn-sm'
                              : 'btn btn-ghost kyb-btn-sm'
                          }
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => patchAdjSide(family, key, 'deduction', { mode: 'percent' })}
                        >
                          % off ref
                        </button>
                        <button
                          type="button"
                          className={
                            rowAdj.deduction.mode === 'fixed_inr'
                              ? 'btn btn-primary kyb-btn-sm'
                              : 'btn btn-ghost kyb-btn-sm'
                          }
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => patchAdjSide(family, key, 'deduction', { mode: 'fixed_inr' })}
                        >
                          ₹/g off ref
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        value={rowAdj.deduction.amount}
                        onChange={(e) => patchAdjSide(family, key, 'deduction', { amount: e.target.value })}
                        inputMode="decimal"
                        style={inpStyle}
                        aria-label={
                          rowAdj.deduction.mode === 'percent'
                            ? 'Deduction percent after markup'
                            : 'Deduction rupees per gram after markup'
                        }
                      />
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
        </div>
        </>
      ) : (
        <p className="dash-footnote" style={{ marginBottom: '0.85rem' }}>
          Manual mode uses only the board rates above. Switch to <strong>Live spot (API)</strong> to edit per-metal markup
          rules.
        </p>
      )}

      <p className="admin-ticker-panel__section-title">Rate move alerts</p>
      <div className="admin-ticker-panel__card">
      <label className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
        <span>22K alert (₹ move vs baseline, 0 = off)</span>
        <input
          type="text"
          inputMode="decimal"
          value={alertDraft}
          onChange={(e) => setAlertDraft(e.target.value)}
          placeholder="10"
        />
        {data ? (
          <span className="dash-footnote" style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.72rem' }}>
            Baseline <strong className="tabular">{data.rate_alert_baseline_inr_per_gram_22k ?? '—'}</strong> · now{' '}
            <strong className="tabular">{data.platform_base_inr_per_gram_22k}</strong>
          </span>
        ) : null}
      </label>
      </div>

      <div className="admin-ticker-panel__card">
        <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hourlyPushDraft}
            onChange={(e) => setHourlyPushDraft(e.target.checked)}
            style={{ marginTop: '0.2rem' }}
          />
          <span style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
            <strong>Hourly gold digest (Web Push)</strong> — each scheduled run compares live{' '}
            <strong className="tabular">22K</strong> reference to the prior hourly snapshot and notifies subscribed devices when
            the price moves (requires VAPID keys + cron; first run only stores a baseline).
            {data?.hourly_gold_push_baseline_inr_per_gram_22k != null ? (
              <span className="dash-footnote" style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.72rem' }}>
                Last snapshot{' '}
                <strong className="tabular">{data.hourly_gold_push_baseline_inr_per_gram_22k}</strong>
                {data.hourly_gold_push_baseline_recorded_at
                  ? ` · ${new Date(data.hourly_gold_push_baseline_recorded_at).toLocaleString()}`
                  : ''}
              </span>
            ) : null}
          </span>
        </label>
      </div>

      <p className="admin-ticker-panel__section-title">Platform fees &amp; storefront disclosures</p>
      <div className="admin-ticker-panel__card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label className="field">
            <span>Cross-network platform fee (₹ per order)</span>
            <input
              value={crossPlatformFeeDraft}
              onChange={(e) => setCrossPlatformFeeDraft(e.target.value)}
              inputMode="decimal"
            />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.68rem' }}>
              Checkout: <strong className="tabular">₹{formatMaybeStrInr(crossPlatformFeeDraft, 2)}</strong> on X-redeem
              listings only (not charged by jewellers).
            </span>
          </label>
          <label className="field">
            <span>Gold deposit yield (% APR)</span>
            <input
              value={depositYieldDraft}
              onChange={(e) => setDepositYieldDraft(e.target.value)}
              inputMode="decimal"
            />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.68rem' }}>
              Headline: <strong className="tabular">{formatMaybeStrInr(depositYieldDraft, 3)}%</strong> APR
            </span>
          </label>
          <label className="field">
            <span>Gold loan APR (%)</span>
            <input value={loanAprDraft} onChange={(e) => setLoanAprDraft(e.target.value)} inputMode="decimal" />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.68rem' }}>
              Headline: <strong className="tabular">{formatMaybeStrInr(loanAprDraft, 3)}%</strong> APR
            </span>
          </label>
          <label className="field">
            <span>Gold loan processing fee (% of principal)</span>
            <input value={loanFeeDraft} onChange={(e) => setLoanFeeDraft(e.target.value)} inputMode="decimal" />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.68rem' }}>
              Headline: <strong className="tabular">{formatMaybeStrInr(loanFeeDraft, 3)}%</strong> of loan principal
            </span>
          </label>
        </div>
      </div>
      <div className="admin-ticker-panel__footer">
        <button
          type="button"
          className="btn btn-primary"
          style={{ minWidth: '11rem' }}
          disabled={busy || (manualOn && !manual22Draft.trim())}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save ticker &amp; fees'}
        </button>
        <AdminFormSuccessBanner message={saveSuccessMsg} />
      </div>
      {manualOn && !manual22Draft.trim() ? (
        <p className="dash-footnote" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          Enter a 22K ₹/g value before saving in manual mode.
        </p>
      ) : null}
      </div>
    </section>
  )
}

export function AdminMarketplaceCatalogSetupPanel() {
  return (
    <section className="card" style={{ padding: '1.25rem', borderRadius: 18 }}>
      <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
        Catalogue reference data
      </h2>
      <p className="dash-coming__text">
        Verified jewellers publish SKUs directly — no product approval queue. Use Django admin to maintain{' '}
        <strong>metal purities</strong> (hallmark / fineness factors for quotes) and <strong>product categories</strong>.
        Jewellers choose which purities they stock from their Catalogue dashboard.
      </p>
      <p className="dash-coming__text" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        Django admin: <span className="tabular">Marketplace → Metal purities</span> and{' '}
        <span className="tabular">Marketplace → Product categories</span>.
      </p>
    </section>
  )
}
