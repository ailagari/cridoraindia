import type { ReactNode } from 'react'

type AuthShellProps = {
  children: ReactNode
  maxWidth?: number
}

export function AuthShell({ children, maxWidth = 440 }: AuthShellProps) {
  return (
    <main className="container page" style={{ maxWidth }}>
      {children}
    </main>
  )
}
