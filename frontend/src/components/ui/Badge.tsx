import type { ReactNode } from 'react'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'gold'

type Props = {
  children: ReactNode
  tone?: Tone
  pulse?: boolean
  className?: string
}

export function Badge({ children, tone = 'neutral', pulse, className }: Props) {
  return (
    <span className={['badge', `badge--${tone}`, className ?? ''].filter(Boolean).join(' ')}>
      <span className={['badge__dot', pulse ? 'badge__dot--pulse' : ''].filter(Boolean).join(' ')} aria-hidden="true" />
      {children}
    </span>
  )
}

/** Map API status strings to badge tones */
export function statusTone(status: string): Tone {
  switch (status.toLowerCase()) {
    case 'verified':
    case 'completed':
    case 'active':
    case 'approved':
      return 'success'
    case 'rejected':
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'danger'
    case 'pending':
    case 'under_review':
    case 'awaiting_utr_verify':
      return 'warning'
    case 'processing':
    case 'awaiting_counter':
      return 'gold'
    default:
      return 'neutral'
  }
}
