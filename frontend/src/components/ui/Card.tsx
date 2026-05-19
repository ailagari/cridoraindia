import type { HTMLAttributes, ReactNode } from 'react'

type CardTone = 'default' | 'flat' | 'accent' | 'danger'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone
  children: ReactNode
}

const TONE_CLASS: Record<CardTone, string> = {
  default: 'ds-card',
  flat: 'ds-card ds-card--flat',
  accent: 'ds-card ds-card--accent',
  danger: 'ds-card ds-card--danger',
}

export function Card({ tone = 'default', className, children, ...rest }: CardProps) {
  return (
    <div className={[TONE_CLASS[tone], className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="ds-card__header">
      <h3 className="ds-card__title">{title}</h3>
      {action ? <div className="ds-card__action">{action}</div> : null}
    </div>
  )
}
