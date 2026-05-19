import type { ReactNode } from 'react'

type AdminShellProps = {
  children: ReactNode
}

export function AdminShell({ children }: AdminShellProps) {
  return <section className="dash-panel-max density-compact">{children}</section>
}
