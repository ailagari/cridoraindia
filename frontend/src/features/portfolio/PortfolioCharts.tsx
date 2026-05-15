import { useMemo } from 'react'

type Point = { x: number; y: number }

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
  const w = 100
  const pad = 4
  const mapX = (x: number) => pad + x * (w - pad * 2)
  const mapY = (y: number) => pad + (1 - y) * (height - pad * 2)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.x)} ${mapY(p.y)}`)
  return d.join(' ')
}

function areaPath(pts: Point[], height = 80): string {
  if (pts.length === 0) return ''
  const line = linePath(pts, height)
  const w = 100
  const pad = 4
  const lastX = pad + pts[pts.length - 1].x * (w - pad * 2)
  const firstX = pad + pts[0].x * (w - pad * 2)
  const bottom = height - pad
  return `${line} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`
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
  const dLine = linePath(pts, height)
  const dArea = areaPath(pts, height)

  return (
    <svg
      className="pf-chart-svg"
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path pathLength={1} d={dArea} fill={`url(#${fillId})`} className="pf-area-fade" />
      <path
        pathLength={1}
        d={dLine}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pf-line-draw"
      />
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
              strokeWidth={14}
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
        strokeWidth={1.5}
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
      <path pathLength={1} d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" className="pf-line-draw" />
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
                stroke="rgba(148, 163, 184, 0.14)"
                strokeWidth={1}
                strokeDasharray="3 5"
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
                strokeWidth={2}
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
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.95}
            />
            <circle cx={geo.pl + geo.cw} cy={mvY} r={3.5} fill="#fcd34d" opacity={0.95} />
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
