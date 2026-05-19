import type { ReactNode } from 'react'

type Props = {
  title: string
  eyebrow?: string
  subtitle?: string
  actions?: ReactNode
  compact?: boolean
}

export function PageHeader({ title, eyebrow, subtitle, actions, compact }: Props) {
  return (
    <div className={['page-header', compact ? 'page-header--compact' : ''].filter(Boolean).join(' ')}>
      <div className="page-header__text">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  )
}
