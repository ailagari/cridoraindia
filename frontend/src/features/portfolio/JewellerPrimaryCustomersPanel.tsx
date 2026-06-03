import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminJewellerPrimaryCustomers,
  fetchJewellerPrimaryCustomers,
  type JewellerPrimaryCustomerRowDTO,
  type JewellerPrimaryCustomersPayloadDTO,
} from '@/lib/goldTransferApi'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function JewellerPrimaryCustomersPanel() {
  const [data, setData] = useState<JewellerPrimaryCustomersPayloadDTO | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const payload = await fetchJewellerPrimaryCustomers()
    if (!payload) {
      setData(null)
      setErr('Could not load primary customers.')
      return
    }
    setData(payload)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows: JewellerPrimaryCustomerRowDTO[] = data?.results ?? []

  return (
    <section className="card" style={{ marginTop: 'var(--sp-5)' }}>
      <h2 className="dash-table-title">Primary customers</h2>
      <p className="dash-footnote">
        Customers who chose your shop as their primary jeweller. Gold column is vault balance held at your shop.
      </p>
      {err ? <p className="form-error">{err}</p> : null}
      {data ? (
        <p className="dash-footnote">
          {data.primary_customer_count} primary · {parseG(data.primary_vault_grams_total).toFixed(4)} g · ₹
          {formatInr(data.primary_estimated_value_inr_total)}
        </p>
      ) : null}
      <div className="dash-table-scroll">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Member ID</th>
              <th>Gold at shop (g)</th>
              <th>Est. value (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: 'var(--text-muted)' }}>
                  No primary customers yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.customer_id}>
                  <td>{row.customer_label}</td>
                  <td>{row.customer_member_id || '—'}</td>
                  <td>{parseG(row.vault_total_grams).toFixed(4)}</td>
                  <td>{formatInr(row.estimated_total_vault_value_inr)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function AdminPrimaryCustomersTable({
  jewellerId,
  onInspectCustomer,
}: {
  jewellerId: number
  onInspectCustomer?: (customerId: number) => void
}) {
  const [data, setData] = useState<JewellerPrimaryCustomersPayloadDTO | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setErr('')
    setData(null)
    void fetchAdminJewellerPrimaryCustomers(jewellerId).then((payload) => {
      if (cancelled) return
      if (!payload) {
        setErr('Could not load primary customers.')
        return
      }
      setData(payload)
    })
    return () => {
      cancelled = true
    }
  }, [jewellerId])

  const rows = data?.results ?? []

  return (
    <>
      <h3 className="admin-inspect-panel__title">Primary customers</h3>
      {err ? <p className="form-error">{err}</p> : null}
      {data ? (
        <p className="dash-footnote">
          {data.primary_customer_count} listed as primary · {parseG(data.primary_vault_grams_total).toFixed(4)} g at
          this shop
        </p>
      ) : null}
      <div className="dash-table-scroll">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Member ID</th>
              <th>Gold (g)</th>
              <th>Est. ₹</th>
              {onInspectCustomer ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={onInspectCustomer ? 5 : 4} style={{ color: 'var(--text-muted)' }}>
                  No primary customers.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.customer_id}>
                  <td>{row.customer_label}</td>
                  <td>{row.customer_member_id || '—'}</td>
                  <td>{parseG(row.vault_total_grams).toFixed(4)}</td>
                  <td>{formatInr(row.estimated_total_vault_value_inr)}</td>
                  {onInspectCustomer ? (
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost kyb-btn-sm"
                        onClick={() => onInspectCustomer(row.customer_id)}
                      >
                        Inspect
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
