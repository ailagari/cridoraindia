import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminJewellerPrimaryCustomers,
  fetchJewellerPrimaryCustomers,
  type JewellerPrimaryCustomerRowDTO,
  type JewellerPrimaryCustomersPayloadDTO,
} from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

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

  useLivePoll(load, LIVE_BALANCE_POLL_MS, true)

  const rows: JewellerPrimaryCustomerRowDTO[] = data?.results ?? []
  const withVault = rows.filter((row) => parseG(row.vault_total_grams) > 1e-9).length

  return (
    <section className="card" style={{ marginBottom: 'var(--sp-5)' }}>
      <h2 className="dash-table-title">Primary customer base</h2>
      <p className="dash-footnote">
        Customers who chose your shop as their <strong>primary jeweller</strong> at signup or in their dashboard. This is
        your default routing audience for transfers, marketplace benefits, and loyalty.
      </p>
      {err ? <p className="form-error">{err}</p> : null}
      {data ? (
        <div className="pf-grid pf-grid--kpis pf-stagger" style={{ margin: '1rem 0 1.25rem' }}>
          <div className="pf-kpi pf-kpi--gold pf-kpi--shimmer">
            <span className="pf-kpi__eyebrow">Primary customers</span>
            <p className="pf-kpi__value">{data.primary_customer_count}</p>
            <span className="pf-kpi__hint">Listed you as default jeweller</span>
          </div>
          <div className="pf-kpi pf-kpi--ocean pf-kpi--pulse">
            <span className="pf-kpi__eyebrow">With vault balance</span>
            <p className="pf-kpi__value">{withVault}</p>
            <span className="pf-kpi__hint">Primary customers holding gold here</span>
          </div>
          <div className="pf-kpi pf-kpi--iris pf-kpi--pulse">
            <span className="pf-kpi__eyebrow">Gold at your shop</span>
            <p className="pf-kpi__value tabular">{parseG(data.primary_vault_grams_total).toFixed(4)} g</p>
            <span className="pf-kpi__hint">₹{formatInr(data.primary_estimated_value_inr_total)} estimated</span>
          </div>
        </div>
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
                  No primary customers yet. Share your referral code or storefront invite link so customers can choose you
                  at signup.
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
