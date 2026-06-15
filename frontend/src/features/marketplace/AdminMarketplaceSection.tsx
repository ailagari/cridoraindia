import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AdminFractionalMarkupPanel } from '@/features/admin/AdminFractionalMarkupPanel'
import { authFetch } from '@/lib/api'
import { publicRateSourceLabel } from '@/lib/publicRateLabels'
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

type MetalSource = 'live' | 'manual'

type MetalSourceState = {
  gold: Record<string, MetalSource>
  silver: Record<string, MetalSource>
}

type AdminTickerPayload = {
  live_metal_adjustments_json: Record<string, unknown>
  live_spot_raw_preview: {
    source: string
    source_updated_at?: string
    rate_date?: string
    rows: LivePreviewRow[]
  }
  rate_move_alert_threshold_inr: string
  rate_alert_baseline_inr_per_gram_22k: string | null
  hourly_gold_push_enabled?: boolean
  hourly_gold_push_baseline_inr_per_gram_22k?: string | null
  hourly_gold_push_baseline_recorded_at?: string | null
  manual_ticker_enabled?: boolean
  ticker_metal_source_json?: Record<string, Record<string, string>>
  ticker_manual_22k_inr_per_gram?: string | null
  ticker_manual_24k_inr_per_gram?: string | null
  ticker_manual_18k_inr_per_gram?: string | null
  ticker_manual_silver_999_inr_per_gram?: string | null
  gold_deposit_yield_apr_percent?: string
  gold_loan_interest_apr_percent?: string
  gold_loan_processing_fee_percent?: string
  gold_loan_processing_fee_jeweller_share_percent?: string
  gold_loan_ltv_min_percent?: string
  gold_loan_ltv_max_percent?: string
  cross_platform_fee_inr?: string
  platform_base_inr_per_gram_22k: string
  cridora_base_source?: string
  updated_at: string
}

const DEFAULT_METAL_SOURCES: MetalSourceState = {
  gold: { '24K': 'live', '22K': 'live', '21K': 'live', '18K': 'live' },
  silver: { '999': 'live', '925': 'live' },
}

function emptyMetalSources(): MetalSourceState {
  return {
    gold: { ...DEFAULT_METAL_SOURCES.gold },
    silver: { ...DEFAULT_METAL_SOURCES.silver },
  }
}

function parseMetalSources(raw: unknown, legacyManualOn?: boolean): MetalSourceState {
  const base = emptyMetalSources()
  if (raw && typeof raw === 'object') {
    const o = raw as { gold?: Record<string, string>; silver?: Record<string, string> }
    for (const key of Object.keys(base.gold)) {
      const mode = o.gold?.[key]
      base.gold[key] = mode === 'manual' ? 'manual' : 'live'
    }
    for (const key of Object.keys(base.silver)) {
      const mode = o.silver?.[key]
      base.silver[key] = mode === 'manual' ? 'manual' : 'live'
    }
    return base
  }
  if (legacyManualOn) {
    for (const family of ['gold', 'silver'] as const) {
      for (const key of Object.keys(base[family])) {
        base[family][key] = 'manual'
      }
    }
  }
  return base
}

function anyGoldManual(sources: MetalSourceState): boolean {
  return Object.values(sources.gold).some((m) => m === 'manual')
}

function anySilverManual(sources: MetalSourceState): boolean {
  return Object.values(sources.silver).some((m) => m === 'manual')
}

function metalSourceFor(sources: MetalSourceState, family: 'gold' | 'silver', key: string): MetalSource {
  return sources[family][key] ?? 'live'
}

function patchMetalSource(
  sources: MetalSourceState,
  family: 'gold' | 'silver',
  key: string,
  mode: MetalSource,
): MetalSourceState {
  return {
    ...sources,
    [family]: { ...sources[family], [key]: mode },
  }
}

const MANUAL_INPUT_KEYS: Partial<
  Record<'gold' | 'silver', Partial<Record<string, '22K' | '24K' | '18K' | '999'>>>
> = {
  gold: { '22K': '22K', '24K': '24K', '18K': '18K' },
  silver: { '999': '999' },
}

const MANUAL_DERIVED_HINT: Partial<Record<string, string>> = {
  '21K': 'From 24K × 0.875',
  '925': 'From 999 × 0.925',
}

const OPTIONAL_LIVE_METAL_KEYS = new Set(['21K'])

function visibleMetalRows(
  previewRows: LivePreviewRow[] | undefined,
): Array<{ family: 'gold' | 'silver'; key: string; label: string }> {
  const liveByKey = new Map(
    (previewRows ?? []).map((r) => [`${r.family}:${r.key}`, r] as const),
  )
  return METAL_ROWS.filter(({ family, key }) => {
    if (!OPTIONAL_LIVE_METAL_KEYS.has(key)) return true
    return liveByKey.get(`${family}:${key}`)?.raw_inr_per_gram != null
  })
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
  const timerRef = useRef<number | null>(null)

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

/** Matches backend _manual_ticker_spot_payload karat and silver ladder. */
function manualTickerRates(
  manual22: string,
  manual24: string,
  manual18: string,
  manualSilver999: string,
): {
  gold: Record<string, number>
  silver: Record<string, number>
} | null {
  const k22 = Number.parseFloat(manual22)
  if (!Number.isFinite(k22) || k22 <= 0) return null
  let k24 = Number.parseFloat(manual24)
  if (!Number.isFinite(k24) || k24 <= 0) k24 = k22 / 0.916
  let k18 = Number.parseFloat(manual18)
  if (!Number.isFinite(k18) || k18 <= 0) k18 = k24 * 0.75
  const k24r = Math.round(k24 * 100) / 100
  const k22r = Math.round(k22 * 100) / 100
  const k18r = Math.round(k18 * 100) / 100
  const gold = {
    '24K': k24r,
    '22K': k22r,
    '18K': k18r,
  }
  const silver: Record<string, number> = {}
  const s999 = Number.parseFloat(manualSilver999)
  if (Number.isFinite(s999) && s999 > 0) {
    const s999r = Math.round(s999 * 1000) / 1000
    silver['999'] = s999r
    silver['925'] = Math.round(s999r * 0.925 * 1000) / 1000
  }
  return { gold, silver }
}

function AdminMetalSourceToggle({
  mode,
  onChange,
  liveAvailable,
}: {
  mode: MetalSource
  onChange: (mode: MetalSource) => void
  liveAvailable: boolean
}) {
  return (
    <div className="admin-ticker-source-toggle" role="group" aria-label="Price source">
      <button
        type="button"
        className={mode === 'live' ? 'btn btn-primary kyb-btn-sm' : 'btn btn-ghost kyb-btn-sm'}
        aria-pressed={mode === 'live'}
        disabled={!liveAvailable && mode !== 'live'}
        title={liveAvailable ? 'Use live Kerala feed' : 'Live feed unavailable — use manual'}
        onClick={() => onChange('live')}
      >
        Live
      </button>
      <button
        type="button"
        className={mode === 'manual' ? 'btn btn-primary kyb-btn-sm' : 'btn btn-ghost kyb-btn-sm'}
        aria-pressed={mode === 'manual'}
        onClick={() => onChange('manual')}
      >
        Manual
      </button>
    </div>
  )
}

export function AdminGoldTickerPanel() {
  const [data, setData] = useState<AdminTickerPayload | null>(null)
  const [adjDraft, setAdjDraft] = useState<AdjustmentsState>(() => emptyAdjustments())
  const [sourceDraft, setSourceDraft] = useState<MetalSourceState>(() => emptyMetalSources())
  const [manual22Draft, setManual22Draft] = useState('')
  const [manual24Draft, setManual24Draft] = useState('')
  const [manual18Draft, setManual18Draft] = useState('')
  const [manualSilver999Draft, setManualSilver999Draft] = useState('')
  const [depositYieldDraft, setDepositYieldDraft] = useState('0')
  const [loanAprDraft, setLoanAprDraft] = useState('0')
  const [loanFeeDraft, setLoanFeeDraft] = useState('0')
  const [loanFeeJewellerShareDraft, setLoanFeeJewellerShareDraft] = useState('0')
  const [loanLtvMinDraft, setLoanLtvMinDraft] = useState('95')
  const [loanLtvMaxDraft, setLoanLtvMaxDraft] = useState('99')
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
    setSourceDraft(parseMetalSources(j.ticker_metal_source_json, j.manual_ticker_enabled))
    setManual22Draft(j.ticker_manual_22k_inr_per_gram ?? '')
    setManual24Draft(j.ticker_manual_24k_inr_per_gram ?? '')
    setManual18Draft(j.ticker_manual_18k_inr_per_gram ?? '')
    setManualSilver999Draft(j.ticker_manual_silver_999_inr_per_gram ?? '')
    setDepositYieldDraft(j.gold_deposit_yield_apr_percent ?? '0')
    setLoanAprDraft(j.gold_loan_interest_apr_percent ?? '0')
    setLoanFeeDraft(j.gold_loan_processing_fee_percent ?? '0')
    setLoanFeeJewellerShareDraft(j.gold_loan_processing_fee_jeweller_share_percent ?? '0')
    setLoanLtvMinDraft(j.gold_loan_ltv_min_percent ?? '95')
    setLoanLtvMaxDraft(j.gold_loan_ltv_max_percent ?? '99')
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

  const manualRates = manualTickerRates(
    manual22Draft,
    manual24Draft,
    manual18Draft,
    manualSilver999Draft,
  )

  const liveAvailableFor = (family: 'gold' | 'silver', key: string): boolean =>
    previewRow(family, key)?.raw_inr_per_gram != null

  const publishedForRow = (family: 'gold' | 'silver', key: string): number | null => {
    if (metalSourceFor(sourceDraft, family, key) === 'manual') {
      if (!manualRates) return null
      const bucket = family === 'gold' ? manualRates.gold : manualRates.silver
      const v = bucket[key as keyof typeof bucket]
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    }
    const live = previewRow(family, key)
    if (!live?.final_inr_per_gram) return null
    const n = Number.parseFloat(live.final_inr_per_gram)
    return Number.isFinite(n) ? n : null
  }

  const manualDraftForKey = (family: 'gold' | 'silver', key: string): string => {
    const mapped = MANUAL_INPUT_KEYS[family]?.[key]
    if (mapped === '22K') return manual22Draft
    if (mapped === '24K') return manual24Draft
    if (mapped === '18K') return manual18Draft
    if (mapped === '999') return manualSilver999Draft
    return ''
  }

  const setManualDraftForKey = (family: 'gold' | 'silver', key: string, value: string) => {
    const mapped = MANUAL_INPUT_KEYS[family]?.[key]
    if (mapped === '22K') setManual22Draft(value)
    else if (mapped === '24K') setManual24Draft(value)
    else if (mapped === '18K') setManual18Draft(value)
    else if (mapped === '999') setManualSilver999Draft(value)
  }

  const saveBlocked =
    (anyGoldManual(sourceDraft) && !manual22Draft.trim()) ||
    (anySilverManual(sourceDraft) && !manualSilver999Draft.trim())

  const liveMarkupRows = visibleMetalRows(data?.live_spot_raw_preview?.rows).filter(
    ({ family, key }) => metalSourceFor(sourceDraft, family, key) === 'live',
  )

  const save = async () => {
    setBusy(true)
    setError('')
    clearSaveSuccess()
    const res = await authFetch('/api/v1/admin/gold-ticker/', {
      method: 'PATCH',
      jsonBody: {
        live_metal_adjustments_json: buildAdjustmentsPayload(adjDraft),
        ticker_metal_source_json: sourceDraft,
        manual_ticker_enabled: Object.values(sourceDraft.gold).some((m) => m === 'manual')
          || Object.values(sourceDraft.silver).some((m) => m === 'manual'),
        ticker_manual_22k_inr_per_gram: manual22Draft.trim() || null,
        ticker_manual_24k_inr_per_gram: manual24Draft.trim() ? manual24Draft.trim() : null,
        ticker_manual_18k_inr_per_gram: manual18Draft.trim() ? manual18Draft.trim() : null,
        ticker_manual_silver_999_inr_per_gram: manualSilver999Draft.trim()
          ? manualSilver999Draft.trim()
          : null,
        gold_deposit_yield_apr_percent: depositYieldDraft.trim(),
        gold_loan_interest_apr_percent: loanAprDraft.trim(),
        gold_loan_processing_fee_percent: loanFeeDraft.trim(),
        gold_loan_processing_fee_jeweller_share_percent: loanFeeJewellerShareDraft.trim(),
        gold_loan_ltv_min_percent: loanLtvMinDraft.trim(),
        gold_loan_ltv_max_percent: loanLtvMaxDraft.trim(),
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
    <>
      <div style={{ marginBottom: '1.25rem' }}>
        <AdminFractionalMarkupPanel />
      </div>

      <section className="card admin-ticker-panel" style={{ padding: 0, borderRadius: 18, overflow: 'hidden' }}>
      <header className="admin-ticker-panel__head">
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Ticker &amp; fees
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: 0, fontSize: '0.82rem', maxWidth: '44rem' }}>
          Set published ₹/g per metal — use <strong>Live</strong> when the Kerala feed looks right, or{' '}
          <strong>Manual</strong> when it is missing or wrong. Platform fees and loan disclosures are below.
        </p>
        {data ? (
          <ul className="admin-ticker-panel__meta" aria-label="Current ticker snapshot">
            <li>
              <span className="admin-ticker-panel__meta-k">Published 22K</span>
              <strong className="tabular">₹{formatMaybeStrInr(data.platform_base_inr_per_gram_22k)}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>/g</span>
            </li>
            <li>
              <span className="admin-ticker-panel__meta-k">Kerala live 22K</span>
              <strong className="tabular">
                {previewRow('gold', '22K')?.raw_inr_per_gram
                  ? `₹${formatMaybeStrInr(previewRow('gold', '22K')!.raw_inr_per_gram!)}`
                  : '—'}
              </strong>
            </li>
            {data.live_spot_raw_preview?.source ? (
              <li>
                <span className="admin-ticker-panel__meta-k">Feed</span>
                <span>{publicRateSourceLabel(data.live_spot_raw_preview.source)}</span>
              </li>
            ) : null}
            <li>
              <span className="admin-ticker-panel__meta-k">Last saved</span>
              <span className="tabular" style={{ fontWeight: 600 }}>{data.updated_at}</span>
            </li>
          </ul>
        ) : null}
      </header>
      <div className="admin-ticker-panel__body">
      {error ? <p className="form-error">{error}</p> : null}

      <p className="admin-ticker-panel__section-title">Published rates</p>
      <div className="admin-ticker-adj-table-wrap">
        <div className="dash-table-scroll">
          <table className="admin-user-table admin-ticker-rates-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Metal</th>
                <th className="tabular">Live feed</th>
                <th>Source</th>
                <th>Manual ₹/g</th>
                <th className="tabular">Published</th>
              </tr>
            </thead>
            <tbody>
              {visibleMetalRows(data?.live_spot_raw_preview?.rows).map(({ family, key, label }) => {
                const mode = metalSourceFor(sourceDraft, family, key)
                const live = previewRow(family, key)
                const published = publishedForRow(family, key)
                const decimals = family === 'silver' ? 3 : 2
                const inputKey = MANUAL_INPUT_KEYS[family]?.[key]
                const derivedHint = MANUAL_DERIVED_HINT[key]
                const inpStyle: CSSProperties = {
                  width: '100%',
                  minWidth: 88,
                  maxWidth: 120,
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
                      {live?.raw_inr_per_gram != null
                        ? `₹${formatMaybeStrInr(live.raw_inr_per_gram, decimals)}`
                        : '—'}
                    </td>
                    <td>
                      <AdminMetalSourceToggle
                        mode={mode}
                        liveAvailable={liveAvailableFor(family, key)}
                        onChange={(next) => {
                          if (next === 'live' && !liveAvailableFor(family, key)) return
                          setSourceDraft((prev) => patchMetalSource(prev, family, key, next))
                        }}
                      />
                    </td>
                    <td>
                      {mode === 'manual' && inputKey ? (
                        <input
                          value={manualDraftForKey(family, key)}
                          onChange={(e) => setManualDraftForKey(family, key, e.target.value)}
                          placeholder={
                            key === '22K'
                              ? 'Required'
                              : key === '999'
                                ? 'Required'
                                : 'Optional'
                          }
                          inputMode="decimal"
                          style={inpStyle}
                          aria-label={`Manual ${label} rate`}
                        />
                      ) : mode === 'manual' && derivedHint ? (
                        <span className="dash-footnote" style={{ fontSize: '0.72rem' }}>
                          {derivedHint}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td
                      className="tabular"
                      style={{ color: 'var(--gold-light)', fontWeight: 700 }}
                    >
                      {published != null ? `₹${formatFinal(family, published)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {data?.live_spot_raw_preview?.source ? (
          <p className="dash-footnote" style={{ margin: '0.5rem 0 0', fontSize: '0.68rem' }}>
            Live feed: {publicRateSourceLabel(data.live_spot_raw_preview.source)}
            {data.live_spot_raw_preview.source_updated_at
              ? ` · ${data.live_spot_raw_preview.source_updated_at}`
              : null}
          </p>
        ) : null}
      </div>

      {liveMarkupRows.length > 0 ? (
        <>
          <p className="admin-ticker-panel__section-title">Live markup (live metals only)</p>
        <div className="admin-ticker-adj-table-wrap">
          <div className="dash-table-scroll">
          <table className="admin-user-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th scope="col">Metal</th>
                <th className="tabular" scope="col">Raw</th>
                <th scope="col">Markup</th>
                <th className="tabular" scope="col">Value</th>
                <th scope="col">Deduction</th>
                <th className="tabular" scope="col">Value</th>
                <th className="tabular" scope="col">After rules</th>
              </tr>
            </thead>
            <tbody>
              {liveMarkupRows.map(({ family, key, label }) => {
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
                          %
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
                          ₹/g
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        value={rowAdj.deduction.amount}
                        onChange={(e) => patchAdjSide(family, key, 'deduction', { amount: e.target.value })}
                        inputMode="decimal"
                        style={inpStyle}
                        aria-label="Deduction amount"
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
      ) : null}

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
          <label className="field">
            <span>Processing fee share to jewellers (%)</span>
            <input
              value={loanFeeJewellerShareDraft}
              onChange={(e) => setLoanFeeJewellerShareDraft(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="field">
            <span>Loan LTV range — minimum (%)</span>
            <input value={loanLtvMinDraft} onChange={(e) => setLoanLtvMinDraft(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Loan LTV range — maximum (%)</span>
            <input value={loanLtvMaxDraft} onChange={(e) => setLoanLtvMaxDraft(e.target.value)} inputMode="decimal" />
            <span className="dash-footnote" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.68rem' }}>
              Jewellers offering loans choose any % between min and max.
            </span>
          </label>
        </div>
      </div>
      <div className="admin-ticker-panel__footer">
        <button
          type="button"
          className="btn btn-primary"
          style={{ minWidth: '11rem' }}
          disabled={busy || saveBlocked}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save ticker &amp; fees'}
        </button>
        <AdminFormSuccessBanner message={saveSuccessMsg} />
      </div>
      {saveBlocked ? (
        <p className="dash-footnote" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          Enter 22K ₹/g when any gold row is manual, and silver 999 ₹/g when any silver row is manual.
        </p>
      ) : null}
      </div>
    </section>
    </>
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
