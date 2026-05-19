import type { ReactNode } from 'react'
import { Badge, type TableColumn } from '@/components/ui'

export type TransactionRowData = {
  id: string | number
  title: ReactNode
  meta?: ReactNode
  amount?: ReactNode
  status?: string
  action?: ReactNode
}

export function TransactionRow({ row }: { row: TransactionRowData }) {
  return (
    <div className="transaction-row">
      <div className="transaction-row__main">
        <span className="transaction-row__title">{row.title}</span>
        {row.meta ? <span className="transaction-row__meta">{row.meta}</span> : null}
      </div>
      {row.amount ? <span className="transaction-row__amount tabular">{row.amount}</span> : null}
      {row.status ? <Badge tone="neutral">{row.status}</Badge> : null}
      {row.action ? <div className="transaction-row__action">{row.action}</div> : null}
    </div>
  )
}

export const transactionTableColumns: TableColumn<TransactionRowData>[] = [
  { key: 'title', header: 'Transaction', render: (row) => row.title },
  { key: 'amount', header: 'Amount', align: 'right', render: (row) => row.amount ?? '—' },
  { key: 'status', header: 'Status', render: (row) => (row.status ? <Badge tone="neutral">{row.status}</Badge> : '—') },
]
