import type { ReactNode } from 'react'

import type { TablePageSize } from '@/hooks/useTablePagination'
import { useTablePagination } from '@/hooks/useTablePagination'

import { TablePagination } from './TablePagination'

type Align = 'left' | 'center' | 'right'

export type TableColumn<T> = {
  key: string
  header: ReactNode
  align?: Align
  render: (row: T) => ReactNode
}

type TableProps<T> = {
  columns: TableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string | number
  empty?: ReactNode
  compact?: boolean
  /** When set and rows exceed this count, Prev/Next paging is shown. */
  pageSize?: TablePageSize
}

export function Table<T>({ columns, rows, getRowKey, empty, compact, pageSize }: TableProps<T>) {
  const pagination = useTablePagination(rows.length, pageSize ?? 10, pageSize == null)

  const displayRows =
    pagination.active ? rows.slice(pagination.sliceStart, pagination.sliceEnd) : rows

  if (rows.length === 0) {
    return <div className="ds-table-empty">{empty ?? 'No records'}</div>
  }

  return (
    <div className="ds-table-wrap">
      <table className={['ds-table', compact ? 'ds-table--compact' : ''].filter(Boolean).join(' ')}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align ? `ds-table__cell--${col.align}` : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align ? `ds-table__cell--${col.align}` : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination.active ? (
        <TablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={rows.length}
          pageSize={pagination.pageSize}
          onPrev={() => pagination.setPage((p) => Math.max(0, p - 1))}
          onNext={() => pagination.setPage((p) => Math.min(pagination.totalPages - 1, p + 1))}
        />
      ) : null}
    </div>
  )
}
