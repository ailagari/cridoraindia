import type { ReactNode } from 'react'

export type TabItem = {
  key: string
  label: ReactNode
  badge?: number
}

type TabBarProps = {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
  variant?: 'underline' | 'segmented'
}

export function TabBar({ tabs, active, onChange, variant = 'underline' }: TabBarProps) {
  if (variant === 'segmented') {
    return (
      <div className="tab-seg" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            className={['tab-seg__item', active === t.key ? 'tab-seg__item--active' : ''].filter(Boolean).join(' ')}
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          className={['tab-bar__item', active === t.key ? 'tab-bar__item--active' : ''].filter(Boolean).join(' ')}
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.badge != null && t.badge > 0 ? (
            <span className="tab-bar__badge">{t.badge > 99 ? '99+' : t.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
