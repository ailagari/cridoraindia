import type { CSSProperties, ReactNode } from 'react'

type Cols = 1 | 2 | 3 | 4

type Props = {
  children: ReactNode
  cols?: Cols
  gap?: number | string
  style?: CSSProperties
}

const COLS_STYLE: Record<Cols, string> = {
  1: '1fr',
  2: 'repeat(2, minmax(0, 1fr))',
  3: 'repeat(3, minmax(0, 1fr))',
  4: 'repeat(4, minmax(0, 1fr))',
}

/**
 * Responsive stat/widget grid. Automatically collapses to 2 cols on tablet and 1 on mobile.
 * Use for dashboard KPI rows and feature card grids.
 */
export function SectionGrid({ children, cols = 3, gap = 'var(--dens-gap)', style }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: COLS_STYLE[cols],
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
