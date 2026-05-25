import { useCallback, useEffect, useState } from 'react'
import {
  fetchJewellerOrnamentRedemptions,
  type JewellerOrnamentRedemptionRowDTO,
} from '@/lib/jewellerOrnamentRedemptionsApi'
import { formatInr } from '@/features/marketplace/productPricing'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function parseNum(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function fmtWhen(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function cashMethodLabel(method: string): string {
  if (!method) return '—'
  return method.replace(/_/g, ' ')
}

export function JewellerOrnamentRedemptionsPanel() {
  const [rows, setRows] = useState<JewellerOrnamentRedemptionRowDTO[]>([])
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const out = await fetchJewellerOrnamentRedemptions()
    if (!out.ok) {
      setLoadErr(out.detail)
      setRows([])
      return
    }
    setRows(out.results)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  return (
    <div className="dash-panel-max" style={{ marginTop: '2rem' }}>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Ornament redemptions (catalog)</h2>
      <p className="dash-panel-lead" style={{ marginBottom: '1rem' }}>
        Customers who completed checkout on your marketplace SKUs — vault grams debited and any cash balance
        collected at the counter. Use the reference when they collect the piece.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void refresh()}>
          Refresh list
        </button>
      </div>

      {loadErr ? (
        <p className="form-error" role="alert" style={{ marginBottom: '1rem' }}>
          {loadErr}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No catalog ornament orders yet.</p>
      ) : (
        <div className="jeweller-purchases-wrap">
          <table className="jeweller-purchases-table jeweller-purchases-table--compact-4">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Customer</th>
                <th scope="col">Product &amp; reference</th>
                <th scope="col">Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const grams = parseNum(r.grams_charged)
                const cash = parseNum(r.cash_paid_inr)
                const invoice = parseNum(r.final_invoice_inr)
                const gstSaved = parseNum(r.gst_on_gold_saved_inr)
                const label = r.customer.name || r.customer.email
                return (
                  <tr key={r.id}>
                    <td data-label="When" className="tabular" style={{ whiteSpace: 'nowrap' }}>
                      {fmtWhen(r.created_at)}
                    </td>
                    <td data-label="Customer">
                      <div className="jeweller-purchases-customer-stack">
                        <strong className="jeweller-purchases-customer-name">{label}</strong>
                        <span className="jeweller-purchases-customer-email">{r.customer.email}</span>
                        {r.customer.cridora_member_id ? (
                          <span className="jeweller-purchases-member">
                            Member ID <strong className="tabular">{r.customer.cridora_member_id}</strong>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Product">
                      <strong>{r.product_name}</strong>
                      <div style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span className="tabular">{r.reference}</span>
                        {r.same_store_checkout ? ' · Same-store vault' : null}
                      </div>
                    </td>
                    <td data-label="Payment">
                      <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span>
                          Invoice <strong className="tabular">₹{formatInr(invoice)}</strong>
                        </span>
                        {grams > 0 ? (
                          <span>
                            Vault <strong className="tabular">{grams.toFixed(3)} g</strong>
                          </span>
                        ) : null}
                        {cash > 0 ? (
                          <span>
                            Cash/UPI <strong className="tabular">₹{formatInr(cash)}</strong>
                            {r.cash_payment_method ? ` · ${cashMethodLabel(r.cash_payment_method)}` : null}
                          </span>
                        ) : null}
                        {gstSaved > 0 ? (
                          <span style={{ color: 'var(--success)', fontSize: '0.78rem' }}>
                            GST relief on vaulted gold −₹{formatInr(gstSaved)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
