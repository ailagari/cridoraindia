import type { CSSProperties } from 'react'

type Props = {
  width?: string | number
  height?: string | number
  variant?: 'block' | 'text' | 'heading' | 'circle'
  style?: CSSProperties
}

export function Skeleton({ width, height, variant = 'block', style }: Props) {
  const variantClass = variant === 'block' ? 'skeleton' : `skeleton skeleton--${variant}`
  return (
    <span
      className={variantClass}
      aria-hidden="true"
      style={{ display: 'block', width: width ?? '100%', height: height ?? undefined, ...style }}
    />
  )
}

/** Pre-built card skeleton for dashboard widgets */
export function SkeletonCard() {
  return (
    <div className="stat-card" style={{ gap: 12 }}>
      <Skeleton variant="text" width="55%" />
      <Skeleton variant="heading" width="70%" height={28} />
    </div>
  )
}

/** Pre-built row skeleton for tables */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '10px 16px' }}>
          <Skeleton variant="text" width={`${60 + (i % 3) * 15}%`} />
        </td>
      ))}
    </tr>
  )
}
