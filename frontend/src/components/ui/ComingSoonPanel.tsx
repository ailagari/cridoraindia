import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'

type Props = {
  title: string
  action?: ReactNode
}

export function ComingSoonPanel({ title, action }: Props) {
  return (
    <div className="dash-panel-max">
      <EmptyState title={title} description="Available in a future release." action={action} />
    </div>
  )
}
