import type { ReactNode } from 'react'

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
}

export function Table<T>({ columns, rows, getRowKey, empty, compact }: TableProps<T>) {
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
          {rows.map((row) => (
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
    </div>
  )
}
