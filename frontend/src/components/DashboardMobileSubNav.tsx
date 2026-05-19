import type { DashboardNavItem } from '@/lib/mobileNav/types'

type Props = {
  items: DashboardNavItem[]
  activeSection: string
  accentVar: string
  onPick: (sectionKey: string) => void
}

export function DashboardMobileSubNav({ items, activeSection, accentVar, onPick }: Props) {
  if (items.length <= 1) return null

  return (
    <div className="dash-mobile-sub-nav" aria-label="Subsections">
      <div className="dash-mobile-sub-nav__inner">
        <div className="dash-mobile-sub-nav__pair" role="tablist">
          {items.map((item) => {
            const active = item.sectionKey === activeSection
            return (
              <button
                key={item.sectionKey}
                type="button"
                role="tab"
                aria-selected={active}
                className={`dash-mobile-segment-btn${active ? ' dash-mobile-segment-btn--active' : ''}`}
                style={active ? { color: accentVar } : undefined}
                onClick={() => onPick(item.sectionKey)}
              >
                <span className="dash-mobile-segment-btn__label">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 ? (
                  <span className="dash-hub-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
