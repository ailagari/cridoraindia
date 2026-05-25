import type { DashboardNavItem } from '@/lib/mobileNav/types'

type Props = {
  items: DashboardNavItem[]
  activeSection: string
  onPick: (sectionKey: string) => void
}

export function DashboardMobileSubNav({ items, activeSection, onPick }: Props) {
  if (items.length <= 1) return null

  return (
    <div className="subnav" role="tablist" aria-label="Subsections">
      {items.map((item) => {
        const active = item.sectionKey === activeSection
        return (
          <button
            key={item.sectionKey}
            type="button"
            role="tab"
            aria-selected={active}
            className={'snpill' + (active ? ' is-on' : '')}
            onClick={() => onPick(item.sectionKey)}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 ? (
              <span className="dash-hub-badge">{item.badge > 99 ? '99+' : item.badge}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
