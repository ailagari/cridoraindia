import { useEffect, useMemo, useState } from 'react'

export type TablePageSize = 5 | 10

export type TablePaginationSlice = {
  page: number
  setPage: (next: number | ((p: number) => number)) => void
  totalPages: number
  pageSize: TablePageSize
  sliceStart: number
  sliceEnd: number
  active: boolean
}

/** Client-side slicing for lists/tables. When `disabled`, full range is always shown. */
export function useTablePagination(
  totalItems: number,
  pageSize: TablePageSize,
  disabled = false,
): TablePaginationSlice {
  const active = Boolean(!disabled && totalItems > pageSize)

  const [page, setPage] = useState(0)

  const totalPages = useMemo(() => {
    if (!active) return 1
    return Math.max(1, Math.ceil(totalItems / pageSize))
  }, [active, totalItems, pageSize])

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)))
  }, [totalPages])

  const safePage = Math.min(page, Math.max(0, totalPages - 1))

  const sliceStart = active ? safePage * pageSize : 0
  const sliceEnd = active ? Math.min(totalItems, sliceStart + pageSize) : totalItems

  return {
    page: safePage,
    setPage,
    totalPages,
    pageSize,
    sliceStart,
    sliceEnd,
    active,
  }
}
