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
