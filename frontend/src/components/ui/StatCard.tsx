import type { ReactNode } from 'react'

type Tone = 'default' | 'gold' | 'success' | 'danger'

type Props = {
  label: string
  value: ReactNode
  tone?: Tone
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' }
  action?: ReactNode
  loading?: boolean
}

const TONE_CLASS: Record<Tone, string> = {
  default: '',
  gold:    'stat-card__value--gold',
  success: 'stat-card__value--success',
  danger:  'stat-card__value--danger',
}

export function StatCard({ label, value, tone = 'default', delta, action, loading }: Props) {
  if (loading) {
    return (
      <div className="stat-card">
        <span className="stat-card__label">{label}</span>
        <span className="skeleton skeleton--heading" style={{ width: '65%', height: 28, marginTop: 4 }} aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className={['stat-card__value', TONE_CLASS[tone]].filter(Boolean).join(' ')}>{value}</span>
      {delta ? (
        <span className={`stat-card__delta stat-card__delta--${delta.direction}`}>
          {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : null}
          {delta.value}
        </span>
      ) : null}
      {action ?? null}
    </div>
  )
}
