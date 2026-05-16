import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  fetchGoldTickerHistory,
  type GoldTickerHistoryPayload,
  type GoldTickerHistoryRange,
} from '@/lib/marketplaceApi'
import { PortfolioTrendChart } from './PortfolioCharts'

const LIVE_REFRESH_MS = 18_000

const RANGES: { id: GoldTickerHistoryRange; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: '1d', label: 'Day' },
  { id: '1w', label: 'Week' },
  { id: '1m', label: 'Month' },
  { id: '6m', label: '6 mo' },
  { id: '1y', label: 'Year' },
]

function fmtAxis(iso: string): string {
  const d = Date.parse(iso)
  if (Number.isNaN(d)) return '—'
  return new Date(d).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtInr2(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function seriesFromPayload(body: GoldTickerHistoryPayload | null): {
  values: number[]
  startLabel: string
  endLabel: string
  latestVal: string | null
  latestSrc: string | null
} {
  if (!body) {
    return { values: [], startLabel: '—', endLabel: '—', latestVal: null, latestSrc: null }
  }
  const pts = body.points ?? []
  const vals = pts.map((p) => Number.parseFloat(p.v)).filter((n) => Number.isFinite(n))
  const lv = Number.parseFloat(body.latest?.v ?? '')
  if (Number.isFinite(lv)) {
    if (vals.length === 0) {
      return {
        values: [lv],
        startLabel: fmtAxis(body.latest.t),
        endLabel: fmtAxis(body.latest.t),
        latestVal: body.latest.v,
        latestSrc: body.latest.source ?? null,
      }
    }
    const out = vals.slice()
    out[out.length - 1] = lv
    return {
      values: out,
      startLabel: pts.length ? fmtAxis(pts[0]!.t) : fmtAxis(body.latest.t),
      endLabel: fmtAxis(body.latest.t),
      latestVal: body.latest.v,
      latestSrc: body.latest.source ?? null,
    }
  }
  return {
    values: vals,
    startLabel: pts.length ? fmtAxis(pts[0]!.t) : '—',
    endLabel: pts.length ? fmtAxis(pts[pts.length - 1]!.t) : '—',
    latestVal: body.latest?.v ?? null,
    latestSrc: body.latest?.source ?? null,
  }
}

export function CridoraGoldPriceHistory({
  vaultTotals,
  vaultSortBar,
}: {
  /** Compact vault summary (e.g. total grams + indicative ₹) shown beside sort controls. */
  vaultTotals?: ReactNode
  /** Sort / toolbar buttons for the vault list below. */
  vaultSortBar?: ReactNode
}) {
  const fillId = useId().replace(/:/g, '')
  const [range, setRange] = useState<GoldTickerHistoryRange>('1w')
  const [data, setData] = useState<GoldTickerHistoryPayload | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoadErr('')
    const r = await fetchGoldTickerHistory(range)
    if (!r) {
      setData(null)
      setLoadErr('Could not load price history.')
      setLoading(false)
      return
    }
    setData(r)
    setLoading(false)
  }, [range])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (range !== 'live') return
    const t = window.setInterval(() => {
      void load()
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(t)
  }, [range, load])

  const { values, startLabel, endLabel, latestVal, latestSrc } = useMemo(() => seriesFromPayload(data), [data])

  const minMax = useMemo(() => {
    if (values.length === 0) return { lo: 0, hi: 0 }
    return { lo: Math.min(...values), hi: Math.max(...values) }
  }, [values])

  return (
    <div className="pf-cridora-gold-history">
      <div className="pf-cridora-gold-history__head">
        <div>
          <h4 className="pf-cridora-gold-history__title">Cridora 22K reference</h4>
          <p className="pf-cridora-gold-history__subtitle">
            Platform ₹/g marks we publish (sampled as rates refresh — not exchange tick data).
          </p>
        </div>
        <div className="pf-cridora-gold-history__ranges" role="tablist" aria-label="Chart time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              className={`pf-cridora-gold-history__range ${range === r.id ? 'pf-cridora-gold-history__range--on' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {vaultSortBar != null || vaultTotals != null ? (
        <div className="pf-cridora-gold-history__vault-tools">
          {vaultTotals != null ? (
            <div className="pf-cridora-gold-history__vault-totals" aria-label="Vault holdings totals">
              {vaultTotals}
            </div>
          ) : (
            <span className="pf-cridora-gold-history__vault-totals-spacer" aria-hidden />
          )}
          {vaultSortBar != null ? (
            <div className="pf-cridora-gold-history__vault-sort-wrap">{vaultSortBar}</div>
          ) : null}
        </div>
      ) : null}

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {loading && !data ? <p className="pf-cridora-gold-history__loading">Loading chart…</p> : null}

      {!loading || data ? (
        <div className="pf-cridora-gold-history__chart-wrap">
          {values.length > 0 ? (
            <PortfolioTrendChart
              values={values}
              stroke="#fbbf24"
              fillId={`cridora-gold-${fillId}`}
              ariaLabel="Cridora 22K reference rupees per gram over selected range"
            />
          ) : (
            <p className="pf-cridora-gold-history__empty">
              No samples in this window yet. Rates will appear as Cridora records them.
            </p>
          )}
        </div>
      ) : null}

      <div className="pf-cridora-gold-history__footer">
        <span className="pf-cridora-gold-history__axis">{startLabel}</span>
        <div className="pf-cridora-gold-history__stats">
          {latestVal != null ? (
            <span className="pf-cridora-gold-history__now tabular">
              Now ₹{fmtInr2(Number.parseFloat(latestVal))}
              {latestSrc ? <span className="pf-cridora-gold-history__src"> · {latestSrc}</span> : null}
            </span>
          ) : null}
          {values.length > 1 ? (
            <span className="pf-cridora-gold-history__spread tabular">
              Range ₹{fmtInr2(minMax.lo)} — ₹{fmtInr2(minMax.hi)}
            </span>
          ) : null}
        </div>
        <span className="pf-cridora-gold-history__axis">{endLabel}</span>
      </div>
      {data?.note ? <p className="pf-cridora-gold-history__fine">{data.note}</p> : null}
    </div>
  )
}
