import type { ReactNode } from 'react'

type SearchFilterBarProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  filters?: ReactNode
  action?: ReactNode
}

export function SearchFilterBar({
  value,
  onChange,
  placeholder = 'Search',
  filters,
  action,
}: SearchFilterBarProps) {
  return (
    <div className="search-filter-bar">
      <input
        className="search-filter-bar__input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {filters ? <div className="search-filter-bar__filters">{filters}</div> : null}
      {action ? <div className="search-filter-bar__action">{action}</div> : null}
    </div>
  )
}
