import type { ReactNode } from 'react'

type Tone = 'default' | 'gold' | 'success' | 'danger'

type Props = {
  label: string
  value: ReactNode
  tone?: Tone
  meta?: ReactNode
  action?: ReactNode
}

const TONE_CLASS: Record<Tone, string> = {
  default: '',
  gold: 'stat-card__value--gold',
  success: 'stat-card__value--success',
  danger: 'stat-card__value--danger',
}

export function DashboardWidget({ label, value, tone = 'default', meta, action }: Props) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className={['stat-card__value', TONE_CLASS[tone]].filter(Boolean).join(' ')}>{value}</span>
      {meta ? <span className="stat-card__meta">{meta}</span> : null}
      {action ? <div className="stat-card__action">{action}</div> : null}
    </div>
  )
}
