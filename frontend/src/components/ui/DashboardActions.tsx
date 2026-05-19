import type { ReactNode } from 'react'

export type DashboardAction = {
  label: string
  description?: string
  tone?: 'primary' | 'secondary'
  onClick: () => void
}

type Props = {
  title?: string
  actions: DashboardAction[]
  aside?: ReactNode
}

export function DashboardActions({ title = 'Next actions', actions, aside }: Props) {
  return (
    <section className="dash-action-panel" aria-label={title}>
      <div className="dash-action-panel__head">
        <h2 className="dash-action-panel__title">{title}</h2>
        {aside ? <div className="dash-action-panel__aside">{aside}</div> : null}
      </div>
      <div className="dash-action-panel__grid">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={`dash-action-card dash-action-card--${action.tone ?? 'secondary'}`}
            onClick={action.onClick}
          >
            <span className="dash-action-card__label">{action.label}</span>
            {action.description ? <span className="dash-action-card__desc">{action.description}</span> : null}
          </button>
        ))}
      </div>
    </section>
  )
}
