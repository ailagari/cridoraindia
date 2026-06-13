import { useCallback, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  axisInrTxt,
  buildHistoryChartGeo,
  formatHistoryXLabel,
  type PortfolioHistoryValuePoint,
} from '@/features/portfolio/PortfolioCharts'

type Props = {
  points: PortfolioHistoryValuePoint[]
  granularity: 'intraday' | 'daily'
  metalLabel: string
  rangeLabel: string
  ariaLabel: string
}

function formatTooltipDate(iso: string, granularity: 'intraday' | 'daily'): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const d = new Date(t)
  if (granularity === 'intraday') {
    return d.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtRate(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function GoldRatesPriceChart({ points, granularity, metalLabel, rangeLabel, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const svgW = 720
  const svgH = 280
  const refPrice = points[0]?.valueInr ?? 0
  const geo = useMemo(
    () => (refPrice > 0 ? buildHistoryChartGeo(points, refPrice, svgW, svgH) : buildHistoryChartGeo(points, -1, svgW, svgH)),
    [points, refPrice],
  )

  const lastVal = points.length > 0 ? points[points.length - 1]!.valueInr : null
  const stroke =
    refPrice <= 0
      ? 'var(--gold-light)'
      : lastVal != null && lastVal >= refPrice
        ? '#34d399'
        : '#fb7185'

  const pctVsOpen =
    refPrice > 0 && lastVal != null && Number.isFinite(lastVal)
      ? ((lastVal - refPrice) / refPrice) * 100
      : null

  const resolveIdx = useCallback(
    (clientX: number) => {
      if (!geo || !wrapRef.current) return null
      const rect = wrapRef.current.getBoundingClientRect()
      const relX = ((clientX - rect.left) / rect.width) * svgW
      const chartX = Math.max(geo.pl, Math.min(geo.pl + geo.cw, relX))
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < geo.xs.length; i++) {
        const dist = Math.abs(geo.xs[i]! - chartX)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      return best
    },
    [geo],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const idx = resolveIdx(e.clientX)
      setHoverIdx(idx)
    },
    [resolveIdx],
  )

  const onPointerLeave = useCallback(() => setHoverIdx(null), [])

  if (!geo || points.length < 2) return null

  const activeIdx = hoverIdx ?? geo.lastIdx
  const activePoint = points[activeIdx]!
  const activeX = geo.xs[activeIdx]!
  const activeY = geo.ys[activeIdx]!
  const midV = geo.minV + (geo.maxV - geo.minV) / 2
  const gTop = geo.pt
  const gBot = geo.innerBottom
  const tooltipLeftPct = Math.min(Math.max((activeX / svgW) * 100, 8), 92)

  return (
    <div className="gr-price-chart">
      <div className="gr-price-chart__summary">
        <div className="gr-price-chart__live">
          <span className="gr-price-chart__metal">{metalLabel}</span>
          <strong className="gr-price-chart__rate">{lastVal != null ? fmtRate(lastVal) : '—'}</strong>
          <span className="gr-price-chart__unit">/ gram</span>
          {pctVsOpen != null && Number.isFinite(pctVsOpen) ? (
            <span className={`gr-price-chart__chg${pctVsOpen >= 0 ? ' gr-price-chart__chg--up' : ' gr-price-chart__chg--down'}`}>
              {pctVsOpen >= 0 ? '+' : ''}
              {pctVsOpen.toFixed(2)}% vs {rangeLabel} open
            </span>
          ) : null}
        </div>
        <p className="gr-price-chart__hint">Hover on the chart to see date and rate</p>
      </div>

      <div
        ref={wrapRef}
        className="gr-price-chart__plot"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="gr-price-chart__svg" preserveAspectRatio="xMidYMid meet">
          <title>{ariaLabel}</title>

          {[0.25, 0.5, 0.75].map((t) => {
            const y = geo.pt + geo.ch * (1 - t)
            return (
              <line
                key={`gh-${String(t)}`}
                x1={geo.pl}
                y1={y}
                x2={geo.pl + geo.cw}
                y2={y}
                stroke="rgba(148, 163, 184, 0.14)"
                strokeWidth={1}
                vectorEffect="nonScalingStroke"
                strokeDasharray="4 6"
              />
            )
          })}

          {geo.baselineY != null ? (
            <rect x={geo.pl} y={gTop} width={geo.cw} height={Math.max(0, geo.baselineY - gTop)} fill="rgba(52,211,153,0.06)" />
          ) : null}
          {geo.baselineY != null ? (
            <rect
              x={geo.pl}
              y={geo.baselineY}
              width={geo.cw}
              height={Math.max(0, gBot - geo.baselineY)}
              fill="rgba(251,113,133,0.06)"
            />
          ) : null}

          <text x="12" y="16" fill="rgba(226,232,240,0.6)" className="gr-price-chart__tick">
            {axisInrTxt(geo.maxV, false)}
          </text>
          <text x="12" y={geo.pt + geo.ch / 2 + 4} fill="rgba(226,232,240,0.45)" className="gr-price-chart__tick">
            {axisInrTxt(midV, false)}
          </text>
          <text x="12" y={geo.innerBottom - 6} fill="rgba(226,232,240,0.6)" className="gr-price-chart__tick">
            {axisInrTxt(geo.minV, false)}
          </text>

          <text
            x={geo.xs[geo.firstIdx]!}
            y={svgH - 8}
            textAnchor="middle"
            fill="rgba(148,163,184,0.75)"
            className="gr-price-chart__tick"
          >
            {formatHistoryXLabel(points[geo.firstIdx]!.iso, granularity)}
          </text>
          {geo.midIdx !== geo.firstIdx ? (
            <text
              x={geo.xs[geo.midIdx]!}
              y={svgH - 8}
              textAnchor="middle"
              fill="rgba(148,163,184,0.75)"
              className="gr-price-chart__tick"
            >
              {formatHistoryXLabel(points[geo.midIdx]!.iso, granularity)}
            </text>
          ) : null}
          {geo.lastIdx !== geo.midIdx ? (
            <text
              x={geo.xs[geo.lastIdx]!}
              y={svgH - 8}
              textAnchor="middle"
              fill="rgba(148,163,184,0.75)"
              className="gr-price-chart__tick"
            >
              {formatHistoryXLabel(points[geo.lastIdx]!.iso, granularity)}
            </text>
          ) : null}

          {geo.baselineY != null ? (
            <line
              x1={geo.pl}
              y1={geo.baselineY}
              x2={geo.pl + geo.cw}
              y2={geo.baselineY}
              stroke="rgba(226,232,240,0.45)"
              strokeWidth={1.2}
              vectorEffect="nonScalingStroke"
              strokeDasharray="6 5"
            />
          ) : null}

          <path
            d={geo.lineD}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            vectorEffect="nonScalingStroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hoverIdx != null ? (
            <>
              <line
                x1={activeX}
                y1={geo.pt}
                x2={activeX}
                y2={geo.innerBottom}
                stroke="rgba(252, 211, 77, 0.55)"
                strokeWidth={1.2}
                vectorEffect="nonScalingStroke"
                strokeDasharray="4 4"
              />
              <circle cx={activeX} cy={activeY} r={5} fill={stroke} stroke="#0f172a" strokeWidth={2} />
            </>
          ) : (
            <circle cx={geo.xs[geo.lastIdx]!} cy={geo.ys[geo.lastIdx]!} r={4.5} fill={stroke} />
          )}

          <rect
            x={geo.pl}
            y={geo.pt}
            width={geo.cw}
            height={geo.ch}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
          />
        </svg>

        <div
          className={`gr-price-chart__tooltip${hoverIdx == null ? ' gr-price-chart__tooltip--idle' : ''}`}
          style={{ left: `${tooltipLeftPct}%`, opacity: hoverIdx == null ? 0 : 1 }}
          aria-hidden={hoverIdx == null}
        >
          <span className="gr-price-chart__tooltip-date">
            {formatTooltipDate(activePoint.iso, granularity)}
          </span>
          <strong className="gr-price-chart__tooltip-rate">{fmtRate(activePoint.valueInr)}</strong>
          <span className="gr-price-chart__tooltip-meta">{metalLabel} · per gram</span>
        </div>
      </div>
    </div>
  )
}
