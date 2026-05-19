export type DashSegmentItem = {
  id: string
  label: string
}

type Props = {
  items: DashSegmentItem[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}

export function DashSegmentPair({ items, value, onChange, ariaLabel, className }: Props) {
  return (
    <div
      className={`dash-segment-pair${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`dash-mobile-segment-btn${active ? ' dash-mobile-segment-btn--active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span className="dash-mobile-segment-btn__label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
