import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Max content width — defaults to 720px for single-column forms, wider for dashboards */
  maxWidth?: number | string
  style?: CSSProperties
}

/**
 * Constrains page content width and applies consistent horizontal padding.
 * Wrap the children of a dashboard panel with this to keep content readable.
 */
export function PageWrapper({ children, maxWidth = 720, style }: Props) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth,
        marginInline: 'auto',
        paddingInline: 'clamp(16px, 4vw, 24px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
