import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function DashboardPanel({ children, className }: Props) {
  return <div className={['dash-panel-max', className ?? ''].filter(Boolean).join(' ')}>{children}</div>
}
