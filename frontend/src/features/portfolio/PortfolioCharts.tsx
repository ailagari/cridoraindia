import { useId, useMemo } from 'react'

import type { GoldTickerHistoryPayload } from '@/lib/marketplaceApi'

export type PortfolioHistoryRangeKey = '1d' | '1w' | '1m' | '1y'

export const PORTFOLIO_HISTORY_RANGE_OPTIONS: { key: PortfolioHistoryRangeKey; label: string }[] = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '1y', label: '1Y' },
]

/** Width used by portfolio trend SVGs (matching historical linePath viewBox X). */
const TREND_VIEW_W = 100

type Point = { x: number; y: number }

type TrendPads = { l: number; r: number; t: number; b: number }

/** Extra right inset so the trailing dot halo matches index.html hero sparkline layout. */
const LIVE_GOLD_PADS: TrendPads = { l: 4, r: 12, t: 8, b: 8 }

function normalizeSeries(values: number[]): Point[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values.map((v, i) => ({
    x: values.length === 1 ? 0.5 : i / (values.length - 1),
    y: (v - min) / span,
  }))
}

function linePath(pts: Point[], height = 80): string {
  if (pts.length === 0) return ''
  const w = TREND_VIEW_W
  const pad = 4
  const mapX = (x: number) => pad + x * (w - pad * 2)
  const mapY = (y: number) => pad + (1 - y) * (height - pad * 2)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.x)} ${mapY(p.y)}`)
  return d.join(' ')
}

/** Smooth cubic spline through points — same vocabulary as webpages/index.html mini-sparkline. */
function mapTrendSvgPoint(p: Point, svgH: number, pads: TrendPads) {
  const innerW = TREND_VIEW_W - pads.l - pads.r
  const innerH = svgH - pads.t - pads.b
  return {
    x: pads.l + p.x * innerW,
    y: pads.t + (1 - p.y) * innerH,
  }
}

function smoothTrendLinePath(pts: Point[], svgH: number, pads: TrendPads): string {
  if (pts.length === 0) return ''
  const px = pts.map((p) => mapTrendSvgPoint(p, svgH, pads))
  const n = px.length
  if (n === 1) return `M ${px[0].x} ${px[0].y}`
  if (n === 2) return `M ${px[0].x} ${px[0].y} L ${px[1].x} ${px[1].y}`

  let d = `M ${px[0].x} ${px[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = px[Math.max(0, i - 1)]
    const p1 = px[i]
    const p2 = px[i + 1]
    const p3 = px[Math.min(n - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

function smoothTrendAreaPath(pts: Point[], svgH: number, pads: TrendPads): string {
  const line = smoothTrendLinePath(pts, svgH, pads)
  if (line === '' || pts.length === 0) return ''
  const first = mapTrendSvgPoint(pts[0]!, svgH, pads)
  const last = mapTrendSvgPoint(pts[pts.length - 1]!, svgH, pads)
  const bottom = svgH - pads.b
  return `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`
}

function trendSeriesEndSvgPoint(
  pts: Point[],
  svgH: number,
  pads: TrendPads,
): { x: number; y: number } | null {
  if (pts.length < 2) return null
  return mapTrendSvgPoint(pts[pts.length - 1]!, svgH, pads)
}

export function PortfolioTrendChart({
  values,
  stroke,
  fillId,
  ariaLabel,
}: {
  values: number[]
  stroke: string
  fillId: string
  ariaLabel: string
}) {
  const pts = useMemo(() => normalizeSeries(values), [values])
  const height = 88
  const pads = LIVE_GOLD_PADS
  const dLine = smoothTrendLinePath(pts, height, pads)
  const dArea = smoothTrendAreaPath(pts, height, pads)
  const endPt = trendSeriesEndSvgPoint(pts, height, pads)

  return (
    <svg
      className="pf-chart-svg pf-chart-svg--trend"
      viewBox={`0 0 ${TREND_VIEW_W} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path pathLength={1} d={dArea} fill={`url(#${fillId})`} className="pf-area-fade" />
      <path
        pathLength={1}
        d={dLine}
        fill="none"
        stroke={stroke}
        strokeWidth={1.1}
        vectorEffect="nonScalingStroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pf-line-draw pf-trend-line"
      />
      {endPt != null ? (
        <>
          <circle cx={endPt.x} cy={endPt.y} r={6} fill={stroke} fillOpacity={0.18} />
          <circle cx={endPt.x} cy={endPt.y} r={3} fill={stroke} />
        </>
      ) : null}
    </svg>
  )
}

export function PortfolioBarChart({
  values,
  labels,
  colors,
  ariaLabel,
}: {
  values: number[]
  labels: string[]
  colors: string[]
  ariaLabel: string
}) {
  const max = Math.max(...values, 1)
  const n = values.length
  const gap = 4
  const barW = (100 - gap * (n + 1)) / n

  return (
    <svg className="pf-chart-svg pf-bar-svg" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      {values.map((v, i) => {
        const h = (v / max) * 52
        const x = gap + i * (barW + gap)
        const y = 58 - h
        return (
          <g key={labels[i] ?? i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={colors[i % colors.length]} className="pf-bar-rect" style={{ animationDelay: `${i * 0.07}s` }} />
            <text x={x + barW / 2} y="66" textAnchor="middle" className="pf-bar-label" fontSize="5">
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

type DonutSeg = { pct: number; color: string; label: string }

export function PortfolioDonut({ segments, ariaLabel }: { segments: DonutSeg[]; ariaLabel: string }) {
  const r = 28
  const c = 2 * Math.PI * r
  let rot = 0

  return (
    <svg viewBox="0 0 100 100" className="pf-donut-svg" role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <g transform="translate(50 50) rotate(-90)" className="pf-donut-spin">
        {segments.map((s, i) => {
          const arc = Math.max(0.02, s.pct) * c
          const el = (
            <circle
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${c - arc}`}
              transform={`rotate(${rot})`}
              className="pf-donut-seg"
              style={{ animationDelay: `${0.06 * i}s` }}
            />
          )
          rot += s.pct * 360
          return <g key={s.label}>{el}</g>
        })}
      </g>
    </svg>
  )
}

/** Decorative sparkline (Groww-style); not historical market data. */
export function VaultTrendSparkline({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  const points =
    trend === 'up'
      ? '0,18 8,15 16,17 24,8 32,10 40,5'
      : trend === 'down'
        ? '0,5 8,12 16,10 24,18 32,15 40,20'
        : '0,12 10,11 20,13 30,12 40,12'
  const stroke = trend === 'up' ? '#34d399' : trend === 'down' ? '#fb7185' : '#94a3b8'

  return (
    <svg className="pf-vault-spark" width={50} height={22} viewBox="0 0 40 25" aria-hidden>
      <line x1="0" y1="12.5" x2="40" y2="12.5" stroke="rgba(148,163,184,0.25)" strokeWidth={0.6} strokeDasharray="2 3" />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.05}
        vectorEffect="nonScalingStroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export function PortfolioSparkRow({ points, stroke }: { points: number[]; stroke: string }) {
  const pts = normalizeSeries(points)
  const height = 28
  const d = linePath(pts, height)
  return (
    <svg className="pf-spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        pathLength={1}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.1}
        vectorEffect="nonScalingStroke"
        strokeLinecap="round"
        className="pf-line-draw"
      />
    </svg>
  )
}

function fmtInrBoard(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtSignedBoard(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  const abs = Math.abs(Math.round(n))
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

type LivePnLGeo = {
  lineD: string
  baselineY: number
  xmin: number
  xmax: number
  ymin: number
  ymax: number
  firstX: number
  lastX: number
  lastY: number
  innerTop: number
  innerBottom: number
}

function buildLivePnLGeometry(
  samples: number[],
  investedInr: number,
  svgW: number,
  svgH: number,
): LivePnLGeo | null {
  if (samples.length === 0) return null

  const pl = 4
  const pr = 4
  const pt = 6
  const pb = 16
  const iw = svgW - pl - pr
  const ih = svgH - pt - pb
  let minVal = investedInr > 0 ? Math.min(investedInr, ...samples) : Math.min(...samples)
  let maxVal = investedInr > 0 ? Math.max(investedInr, ...samples) : Math.max(...samples)
  const spread = Math.max(maxVal - minVal, Math.max(minVal * 0.015, investedInr * 0.012, 1))
  minVal = Math.max(0, minVal - spread * 0.06)
  maxVal = maxVal + spread * 0.06
  const span = maxVal - minVal || 1
  const mapY = (v: number) => pt + ih - ((v - minVal) / span) * ih
  const baselineY = investedInr > 0 ? mapY(investedInr) : pt + ih / 2
  const n = samples.length
  const xs = samples.map((_, i) =>
    n <= 1 ? pl + iw / 2 : pl + (i / Math.max(n - 1, 1)) * iw,
  )
  let lineD = ''
  for (let i = 0; i < n; i++) {
    const y = mapY(samples[i]!)
    lineD += i === 0 ? `M ${xs[i]} ${y}` : ` L ${xs[i]} ${y}`
  }
  return {
    lineD,
    baselineY,
    xmin: pl,
    xmax: pl + iw,
    ymin: minVal,
    ymax: maxVal,
    firstX: xs[0]!,
    lastX: xs[n - 1]!,
    lastY: mapY(samples[n - 1]!),
    innerTop: pt,
    innerBottom: pt + ih,
  }
}

/** Point on board-rate valuation curve (scaled by current holdings). */
export type PortfolioHistoryValuePoint = { iso: string; valueInr: number }

/** Board 22K ₹/g history × holdings grams (current snapshot); ignores past quantity changes. */
export function buildPortfolioHoldingsValueSeries(
  payload: GoldTickerHistoryPayload | null,
  holdingsGrams: number,
  livePricePerGram22k: number | null,
): PortfolioHistoryValuePoint[] {
  const g = Math.max(0, holdingsGrams)
  const pts = payload?.points ?? []
  const out: PortfolioHistoryValuePoint[] = []
  for (const pt of pts) {
    const ppg = Number.parseFloat(pt.v)
    if (!Number.isFinite(ppg)) continue
    out.push({ iso: pt.t, valueInr: ppg * g })
  }
  if (livePricePerGram22k != null && Number.isFinite(livePricePerGram22k) && g > 0) {
    const anchor = livePricePerGram22k * g
    const last = out[out.length - 1]?.valueInr
    if (last == null || Math.abs(last - anchor) > Math.max(anchor * 0.00002, 0.05)) {
      out.push({ iso: new Date().toISOString(), valueInr: anchor })
    }
  }
  if (out.length === 1 && g > 0) {
    const only = out[0]!.valueInr
    out.push({ iso: out[0]!.iso, valueInr: only })
  }
  return out
}

function formatHistoryXLabel(iso: string, granularity: 'intraday' | 'daily'): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const d = new Date(t)
  if (granularity === 'intraday') {
    return d.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: '2-digit',
      month: 'short',
    })
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function axisInrTxt(n: number, masked: boolean): string {
  if (masked) return '••••'
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1 })}`
}

type HistGeo = {
  lineD: string
  xs: number[]
  ys: number[]
  pl: number
  cw: number
  ch: number
  pt: number
  innerBottom: number
  minV: number
  maxV: number
  baselineY: number | null
  firstIdx: number
  midIdx: number
  lastIdx: number
}

function buildPortfolioHistoryGeo(
  points: PortfolioHistoryValuePoint[],
  investedInr: number,
  svgW: number,
  svgH: number,
): HistGeo | null {
  if (points.length === 0) return null
  const vals = points.map((p) => p.valueInr)
  const n = vals.length

  const pl = 54
  const pr = 12
  const pt = 18
  const pbPad = 38
  const cw = svgW - pl - pr
  const ch = svgH - pt - pbPad

  let minV = Math.min(...vals)
  let maxV = Math.max(...vals)
  if (investedInr > 0) {
    minV = Math.min(minV, investedInr)
    maxV = Math.max(maxV, investedInr)
  }
  const pad = Math.max(maxV - minV, 1) * 0.08
  minV = Math.max(0, minV - pad)
  maxV += pad
  const span = maxV - minV || 1
  const mapY = (v: number) => pt + ch - ((v - minV) / span) * ch
  const baselineY = investedInr > 0 ? mapY(investedInr) : null

  const xs = points.map((_, i) => (n <= 1 ? pl + cw / 2 : pl + (i / (n - 1)) * cw))
  const ys = vals.map(mapY)

  let lineD = ''
  for (let i = 0; i < n; i++) {
    lineD += i === 0 ? `M ${xs[i]} ${ys[i]}` : ` L ${xs[i]} ${ys[i]}`
  }

  return {
    lineD,
    xs,
    ys,
    pl,
    cw,
    ch,
    pt,
    innerBottom: pt + ch,
    minV,
    maxV,
    baselineY,
    firstIdx: 0,
    midIdx: Math.max(0, Math.floor((n - 1) / 2)),
    lastIdx: n - 1,
  }
}

/** Board-rate history × holdings, with ₹ axes and invested baseline (above = unrealised profit). */
export function PortfolioHistoryValuationChart({
  points,
  investedInr,
  granularity,
  rangeKey,
  onRangeChange,
  masked,
  loading,
  holdingsGrams,
  compact,
  ariaLead,
}: {
  points: PortfolioHistoryValuePoint[]
  investedInr: number
  granularity: 'intraday' | 'daily'
  rangeKey: PortfolioHistoryRangeKey
  onRangeChange: (next: PortfolioHistoryRangeKey) => void
  masked: boolean
  loading: boolean
  holdingsGrams: number
  compact?: boolean
  ariaLead: string
}) {
  const svgW = 340
  const svgH = compact ? 118 : 132
  const geo = useMemo(
    () => buildPortfolioHistoryGeo(points, investedInr, svgW, svgH),
    [investedInr, points, svgH],
  )

  const lastVal = points.length > 0 ? points[points.length - 1]!.valueInr : null
  const stroke =
    investedInr <= 0
      ? 'var(--gold-light)'
      : lastVal != null && lastVal >= investedInr
        ? '#34d399'
        : '#fb7185'

  const pctHint =
    investedInr > 0 && lastVal != null && Number.isFinite(lastVal)
      ? ((lastVal - investedInr) / Math.max(investedInr, 1)) * 100
      : null

  const ariaPct =
    pctHint != null && Number.isFinite(pctHint)
      ? `${pctHint >= 0 ? '+' : ''}${pctHint.toFixed(2)} percent vs invested. `
      : ''
  const aria = `${ariaLead} Invested baseline ${masked ? 'hidden' : `₹${Math.round(investedInr).toLocaleString('en-IN')}`}. ${ariaPct}${points.length} samples.`

  if (holdingsGrams <= 1e-9) {
    return (
      <div className="pf-history-valuation pf-history-valuation--empty">
        <div className="pf-history-valuation__toolbar">
          <div className="pf-live-gold__ranges" role="group" aria-label="Chart window">
            {PORTFOLIO_HISTORY_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`pf-live-gold__range${rangeKey === opt.key ? ' pf-live-gold__range--active' : ''}`}
                aria-pressed={rangeKey === opt.key}
                onClick={() => onRangeChange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="pf-history-valuation__empty">
          Add vaulted or personal holdings to graph estimated portfolio value against the board-rate history.
        </p>
      </div>
    )
  }

  if (loading && points.length < 2) {
    return (
      <div className="pf-history-valuation pf-history-valuation--waiting" role="status" aria-busy="true">
        <div className="pf-history-valuation__toolbar">
          <div className="pf-live-gold__ranges" role="group" aria-label="Chart window">
            {PORTFOLIO_HISTORY_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`pf-live-gold__range${rangeKey === opt.key ? ' pf-live-gold__range--active' : ''}`}
                aria-pressed={rangeKey === opt.key}
                onClick={() => onRangeChange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="pf-history-valuation__empty">Loading history…</p>
      </div>
    )
  }

  if (!loading && points.length < 2) {
    return (
      <div className="pf-history-valuation pf-history-valuation--empty">
        <div className="pf-history-valuation__toolbar">
          <div className="pf-live-gold__ranges" role="group" aria-label="Chart window">
            {PORTFOLIO_HISTORY_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`pf-live-gold__range${rangeKey === opt.key ? ' pf-live-gold__range--active' : ''}`}
                aria-pressed={rangeKey === opt.key}
                onClick={() => onRangeChange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="pf-history-valuation__empty">
          Not enough history points yet for this range. Pick a longer window (e.g. 1W / 1M) or wait for more board-rate snapshots.
        </p>
      </div>
    )
  }

  if (!geo) {
    return null
  }

  const midV = geo.minV + (geo.maxV - geo.minV) / 2
  const gTop = geo.pt
  const gBot = geo.innerBottom

  return (
    <div className="pf-history-valuation" role="img" aria-label={aria}>
      <div className="pf-history-valuation__toolbar">
        <div className="pf-live-gold__ranges" role="group" aria-label="Chart window">
          {PORTFOLIO_HISTORY_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`pf-live-gold__range${rangeKey === opt.key ? ' pf-live-gold__range--active' : ''}`}
              aria-pressed={rangeKey === opt.key}
              onClick={() => onRangeChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="pf-history-valuation__svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{aria}</title>

        {[0.25, 0.5, 0.75].map((t) => {
          const y = geo.pt + geo.ch * (1 - t)
          return (
            <line
              key={`gh-${String(t)}`}
              x1={geo.pl}
              y1={y}
              x2={geo.pl + geo.cw}
              y2={y}
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth={1}
              vectorEffect="nonScalingStroke"
              strokeDasharray="3 5"
            />
          )
        })}

        {geo.baselineY != null ? (
          <rect x={geo.pl} y={gTop} width={geo.cw} height={Math.max(0, geo.baselineY - gTop)} fill="rgba(52,211,153,0.07)" />
        ) : null}
        {geo.baselineY != null ? (
          <rect
            x={geo.pl}
            y={geo.baselineY}
            width={geo.cw}
            height={Math.max(0, gBot - geo.baselineY)}
            fill="rgba(251,113,133,0.07)"
          />
        ) : null}

        <text x="10" y="13" fill="rgba(226,232,240,0.55)" fontSize="9" className="pf-history-valuation__axis-y">
          {`${axisInrTxt(geo.maxV, masked)}${masked ? '' : ' · j=max'}`}
        </text>
        <text
          x="10"
          y={geo.pt + geo.ch / 2 + 3}
          fill="rgba(226,232,240,0.45)"
          fontSize="8.5"
          className="pf-history-valuation__axis-y"
        >
          {`${axisInrTxt(midV, masked)}${masked ? '' : ' · j=mid'}`}
        </text>
        <text
          x="10"
          y={geo.innerBottom - 4}
          fill="rgba(226,232,240,0.55)"
          fontSize="9"
          className="pf-history-valuation__axis-y"
        >
          {`${axisInrTxt(geo.minV, masked)}${masked ? '' : ' · j=min'}`}
        </text>

        <text
          x={Math.min(geo.pl + geo.cw * 0.02 + 12, geo.xs[geo.firstIdx]!)}
          y={svgH - 5}
          textAnchor="middle"
          fill="rgba(148,163,184,0.78)"
          fontSize="8.5"
        >
          {!masked
            ? `${formatHistoryXLabel(points[geo.firstIdx]!.iso, granularity)} · i=${geo.firstIdx + 1}`
            : '••'}
        </text>
        {geo.midIdx !== geo.firstIdx ? (
          <text
            x={geo.xs[geo.midIdx]!}
            y={svgH - 5}
            textAnchor="middle"
            fill="rgba(148,163,184,0.78)"
            fontSize="8.5"
          >
            {!masked
              ? `${formatHistoryXLabel(points[geo.midIdx]!.iso, granularity)} · i=${geo.midIdx + 1}`
              : '••'}
          </text>
        ) : null}
        {geo.lastIdx !== geo.midIdx ? (
          <text
            x={Math.max(geo.pl + geo.cw * 0.98 - 12, geo.xs[geo.lastIdx]!)}
            y={svgH - 5}
            textAnchor="middle"
            fill="rgba(148,163,184,0.78)"
            fontSize="8.5"
          >
            {!masked
              ? `${formatHistoryXLabel(points[geo.lastIdx]!.iso, granularity)} · i=${geo.lastIdx + 1}`
              : '••'}
          </text>
        ) : null}

        {geo.baselineY != null ? (
          <line
            x1={geo.pl}
            y1={geo.baselineY}
            x2={geo.pl + geo.cw}
            y2={geo.baselineY}
            stroke="rgba(226,232,240,0.55)"
            strokeWidth={1.1}
            vectorEffect="nonScalingStroke"
            strokeDasharray="5 5"
          />
        ) : null}

        <path
          d={geo.lineD}
          fill="none"
          stroke={stroke}
          strokeWidth={1.2}
          vectorEffect="nonScalingStroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={geo.xs[geo.lastIdx]!}
          cy={geo.ys[geo.lastIdx]!}
          r={3.2}
          fill={stroke}
        />
      </svg>
      <div className="pf-history-valuation__legend" aria-hidden>
        <span className="pf-history-valuation__lg">
          <span className="pf-history-valuation__dash" /> Invested baseline
        </span>
        <span className="pf-history-valuation__lg">
          <span className="pf-history-valuation__dot" style={{ background: stroke }} /> Estimated value ({rangeKey}) ·{' '}
          {holdingsGrams.toFixed(Math.abs(holdingsGrams) >= 1 ? 2 : 3)} g × 22K board
        </span>
      </div>
    </div>
  )
}

/** Live portfolio INR vs dashed metal-cost baseline (samples from polls; horizontal axis = refreshes). */
export function PortfolioLiveValueVsCostChart({
  samples,
  investedInr,
  formatInrAxis,
}: {
  samples: number[]
  investedInr: number
  formatInrAxis: (inr: number) => string
}) {
  const svgW = 320
  const svgH = 96
  const fillGradId = useId().replace(/:/g, '')
  const geo = useMemo(
    () => buildLivePnLGeometry(samples, investedInr, svgW, svgH),
    [samples, investedInr],
  )
  if (geo == null) return null

  const lastVal = samples[samples.length - 1] ?? 0
  const stroke =
    investedInr > 0 ? (lastVal >= investedInr ? '#34d399' : '#fb7185') : '#fcd34d'
  const pct =
    investedInr > 0 && Number.isFinite(lastVal)
      ? ((lastVal - investedInr) / Math.max(investedInr, 1)) * 100
      : null
  const status =
    investedInr <= 0
      ? 'Metal cost basis not available.'
      : lastVal >= investedInr
        ? 'Live value is at or above your invested metal cost.'
        : 'Live value is below your invested metal cost.'
  const pctBit =
    pct != null && Number.isFinite(pct) && investedInr > 0
      ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} percent versus cost basis.`
      : ''
  const aria = `${status} ${pctBit} Cost reference ${formatInrAxis(investedInr)} latest sample ${formatInrAxis(lastVal)}.`

  return (
    <div className="pf-groww-pnl-chart" role="img" aria-label={aria}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="pf-groww-pnl-chart__svg" preserveAspectRatio="xMidYMid meet">
        <title>{aria}</title>
        <defs>
          <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((t) => {
          const y = geo.innerTop + (geo.innerBottom - geo.innerTop) * t
          return (
            <line
              key={`g-${String(t)}`}
              x1={geo.xmin}
              y1={y}
              x2={geo.xmax}
              y2={y}
              stroke="rgba(148, 163, 184, 0.14)"
              strokeWidth={1}
              vectorEffect="nonScalingStroke"
            />
          )
        })}
        <text x="8" y="14" fill="rgba(226,232,240,0.55)" fontSize="9">
          {formatInrAxis(geo.ymax)}
        </text>
        <text x="8" y={svgH - 4} fill="rgba(226,232,240,0.55)" fontSize="9">
          {formatInrAxis(geo.ymin)}
        </text>
        {investedInr > 0 ? (
          <line
            x1={geo.xmin}
            y1={geo.baselineY}
            x2={geo.xmax}
            y2={geo.baselineY}
            stroke="rgba(203,213,225,0.5)"
            strokeWidth={1.1}
            vectorEffect="nonScalingStroke"
            strokeDasharray="5 5"
          />
        ) : null}
        {investedInr > 0 ? (
          <path
            d={`${geo.lineD} L ${geo.lastX} ${geo.baselineY} L ${geo.firstX} ${geo.baselineY} Z`}
            fill={`url(#${fillGradId})`}
            opacity={0.9}
          />
        ) : null}
        <path
          d={geo.lineD}
          fill="none"
          stroke={stroke}
          strokeWidth={1.15}
          vectorEffect="nonScalingStroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={geo.lastX} cy={geo.lastY} r={3} fill={stroke} />
      </svg>
      <div className="pf-groww-pnl-chart__legend" aria-hidden>
        {investedInr > 0 ? (
          <span className="pf-groww-pnl-chart__lg">
            <span className="pf-groww-pnl-chart__dash" /> Metal cost basis
          </span>
        ) : null}
        <span className="pf-groww-pnl-chart__lg">
          <span className="pf-groww-pnl-chart__dot" style={{ background: stroke }} /> Live vault value (this session)
        </span>
      </div>
    </div>
  )
}

function buildCostStepGeometry(
  cumInr: number[],
  ymax: number,
  svgW: number,
  svgH: number,
): {
  lineD: string
  areaD: string
  xs: number[]
  gridYs: number[]
  mapY: (v: number) => number
  baselineY: number
  pl: number
  cw: number
} {
  const pl = 46
  const pr = 10
  const pt = 10
  const pbPad = 14
  const cw = svgW - pl - pr
  const ch = svgH - pt - pbPad
  const baselineY = pt + ch
  const mapY = (v: number) => pt + ch - (ymax <= 0 ? 0 : (v / ymax) * ch)
  const n = cumInr.length
  const xs =
    n <= 1 ? [pl, pl + cw] : cumInr.map((_, i) => pl + (i / Math.max(n - 1, 1)) * cw)

  const gridYs = [0.25, 0.5, 0.75].map((t) => pt + ch * (1 - t))

  if (n === 0) {
    return { lineD: '', areaD: '', xs, gridYs, mapY, baselineY, pl, cw }
  }

  let lineD = `M ${xs[0]} ${baselineY} L ${xs[0]} ${mapY(cumInr[0])}`
  for (let i = 0; i < n - 1; i++) {
    lineD += ` L ${xs[i + 1]} ${mapY(cumInr[i])} L ${xs[i + 1]} ${mapY(cumInr[i + 1])}`
  }
  lineD += ` L ${pl + cw} ${mapY(cumInr[n - 1])}`
  const areaD = `${lineD} L ${pl + cw} ${baselineY} L ${xs[0]} ${baselineY} Z`

  return { lineD, areaD, xs, gridYs, mapY, baselineY, pl, cw }
}

/** Dashboard-style cost vs market snapshot + optional cumulative invested staircase from ledger. */
export function PortfolioCostVsMarketBoard({
  allocatedCost,
  marketValue,
  pnlInr,
  pnlPct,
  cumulativeMetalCostSteps,
}: {
  allocatedCost: number
  marketValue: number
  pnlInr: number
  pnlPct: number | null
  cumulativeMetalCostSteps: number[]
}) {
  const maxBar = useMemo(
    () => Math.max(allocatedCost, marketValue, 1),
    [allocatedCost, marketValue],
  )

  const ymaxChart = useMemo(() => {
    const peakSteps =
      cumulativeMetalCostSteps.length > 0 ? Math.max(...cumulativeMetalCostSteps) : 0
    return Math.max(allocatedCost, marketValue, peakSteps, 1)
  }, [allocatedCost, marketValue, cumulativeMetalCostSteps])

  const geo = useMemo(
    () => buildCostStepGeometry(cumulativeMetalCostSteps, ymaxChart, 340, 112),
    [cumulativeMetalCostSteps, ymaxChart],
  )

  const mvY = geo.mapY(marketValue)
  const showBuildup =
    cumulativeMetalCostSteps.length > 0 && cumulativeMetalCostSteps.some((v) => v > 0)

  const pctLabel =
    pnlPct != null && Number.isFinite(pnlPct) && allocatedCost > 0
      ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% vs cost`
      : null

  const ariaParts = [
    `Metal cost basis ${fmtInrBoard(allocatedCost)}.`,
    `Live portfolio value ${fmtInrBoard(marketValue)}.`,
    `Unrealized ${fmtSignedBoard(pnlInr)}.`,
  ]
  if (pctLabel) ariaParts.push(`${pctLabel}.`)
  const ariaSummary = ariaParts.join(' ')

  const costPct = Math.min(100, (allocatedCost / maxBar) * 100)
  const marketPct = Math.min(100, (marketValue / maxBar) * 100)

  return (
    <div className="pf-mkt-board" role="region" aria-label={ariaSummary}>
      <div className="pf-mkt-board__ticker">
        <div className="pf-mkt-board__quote pf-mkt-board__quote--basis">
          <span className="pf-mkt-board__sym">Metal cost basis</span>
          <span className="pf-mkt-board__px tabular">{fmtInrBoard(allocatedCost)}</span>
          <span className="pf-mkt-board__hint">Pre‑GST allocation · scaled to holdings</span>
        </div>
        <div className="pf-mkt-board__quote pf-mkt-board__quote--live">
          <span className="pf-mkt-board__sym">Portfolio value · live</span>
          <div className="pf-mkt-board__live-row">
            <span className="pf-mkt-board__last tabular">{fmtInrBoard(marketValue)}</span>
            <span
              className={`pf-mkt-board__chg tabular ${pnlInr >= 0 ? 'pf-mkt-board__chg--up' : 'pf-mkt-board__chg--down'}`}
            >
              {fmtSignedBoard(pnlInr)}
              {pctLabel ? <span className="pf-mkt-board__chg-pct"> · {pctLabel}</span> : null}
            </span>
          </div>
          <span className="pf-mkt-board__hint">Jeweller ₹/g marks on vault holdings · not historical NAV</span>
        </div>
      </div>

      <div className="pf-mkt-board__bars" aria-hidden="true">
        <div className="pf-mkt-board__bar-track">
          <span className="pf-mkt-board__bar-label">Cost</span>
          <div className="pf-mkt-board__bar-rail">
            <div
              className="pf-mkt-board__bar-fill pf-mkt-board__bar-fill--cost"
              style={{ width: `${costPct}%` }}
            />
          </div>
          <span className="pf-mkt-board__bar-num tabular">{fmtInrBoard(allocatedCost)}</span>
        </div>
        <div className="pf-mkt-board__bar-track">
          <span className="pf-mkt-board__bar-label">Market</span>
          <div className="pf-mkt-board__bar-rail">
            <div
              className="pf-mkt-board__bar-fill pf-mkt-board__bar-fill--mkt"
              style={{ width: `${marketPct}%` }}
            />
          </div>
          <span className="pf-mkt-board__bar-num tabular">{fmtInrBoard(marketValue)}</span>
        </div>
      </div>

      {showBuildup ? (
        <div className="pf-mkt-board__chart-wrap">
          <div className="pf-mkt-board__chart-head">
            <span className="pf-mkt-board__chart-title">Invested vs valuation</span>
            <span className="pf-mkt-board__chart-caption">
              Step curve · cumulative metal ₹ after each purchase · dashed · live vault mark
            </span>
          </div>
          <svg
            className="pf-mkt-board__svg"
            viewBox="0 0 340 112"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Step chart of cumulative purchase cost with reference line at current market value"
          >
            <title>{ariaSummary}</title>
            <defs>
              <linearGradient id="pf-mkt-step-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {geo.gridYs.map((gy, i) => (
              <line
                key={`g-${String(i)}`}
                x1={geo.pl}
                y1={gy}
                x2={geo.pl + geo.cw}
                y2={gy}
                stroke="rgba(148, 163, 184, 0.13)"
                strokeWidth={1}
                vectorEffect="nonScalingStroke"
                strokeDasharray="3 6"
              />
            ))}
            <text x="4" y="22" className="pf-mkt-board__axis-label" fontSize="9">
              {fmtInrBoard(ymaxChart)}
            </text>
            <text x="4" y={geo.baselineY - 4} className="pf-mkt-board__axis-label" fontSize="9">
              ₹0
            </text>
            {geo.areaD ? (
              <path d={geo.areaD} fill="url(#pf-mkt-step-fill)" className="pf-mkt-board__area" />
            ) : null}
            {geo.lineD ? (
              <path
                d={geo.lineD}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth={1.1}
                vectorEffect="nonScalingStroke"
                strokeLinecap="square"
                strokeLinejoin="round"
                className="pf-line-draw"
              />
            ) : null}
            <line
              x1={geo.pl}
              y1={mvY}
              x2={geo.pl + geo.cw}
              y2={mvY}
              stroke="#fcd34d"
              strokeWidth={1.05}
              vectorEffect="nonScalingStroke"
              strokeDasharray="5 5"
              opacity={0.95}
            />
            <circle cx={geo.pl + geo.cw} cy={mvY} r={3} fill="#fcd34d" opacity={0.95} />
          </svg>
          <div className="pf-mkt-board__legend">
            <span className="pf-mkt-board__lg">
              <span aria-hidden className="pf-mkt-board__lg-i pf-mkt-board__lg-i--step" /> Cumulative metal cost (ledger)
            </span>
            <span className="pf-mkt-board__lg">
              <span aria-hidden className="pf-mkt-board__lg-i pf-mkt-board__lg-i--mv" /> Live portfolio value
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
