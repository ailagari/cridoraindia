import type { ReactNode } from 'react'

type VendorShellProps = {
  children: ReactNode
}

export function VendorShell({ children }: VendorShellProps) {
  return <section className="dash-panel-max density-default">{children}</section>
}
