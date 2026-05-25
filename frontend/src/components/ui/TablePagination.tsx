import { Button } from './Button'

type Props = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPrev: () => void
  onNext: () => void
  /** Extra class on the wrapping nav */
  className?: string
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPrev,
  onNext,
  className,
}: Props) {
  if (totalItems <= pageSize) return null
  const from = totalItems === 0 ? 0 : page * pageSize + 1
  const to = Math.min(totalItems, page * pageSize + pageSize)
  const navCls = ['ds-table-pagination', className].filter(Boolean).join(' ')

  return (
    <nav className={navCls} aria-label="Pagination">
      <span className="ds-table-pagination__range">
        {from}-{to} / {totalItems}
      </span>
      <div className="ds-table-pagination__controls">
        <Button type="button" variant="ghost" size="sm" disabled={page <= 0} onClick={onPrev}>
          Previous
        </Button>
        <span className="ds-table-pagination__page tabular" aria-live="polite">
          Page {page + 1}/{totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
