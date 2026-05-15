import { useCallback, useEffect, useState } from 'react'
import { fetchJewellerSellbacks, type JewellerSellbackRowDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function fmtInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtWhen(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function JewellerSellbacksPanel() {
  const [rows, setRows] = useState<JewellerSellbackRowDTO[]>([])
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const payload = await fetchJewellerSellbacks()
    if (!payload) {
      setLoadErr('Could not load sellbacks.')
      setRows([])
      return
    }
    setRows(payload.results ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  return (
    <div className="dash-panel-max pf-scope">
      <h2 className="dash-panel-title">Cash sellbacks</h2>
      <p className="dash-panel-lead">
        Completed customer sellbacks against vault balances you custody. Grams and liability adjust automatically;
        settle cash with the customer per your showroom process.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {rows.length === 0 && !loadErr ? (
        <p style={{ color: 'var(--text-muted)' }}>No sellback records yet.</p>
      ) : (
        <div className="jeweller-sellbacks-wrap">
          <table className="jeweller-sellbacks-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Ref</th>
                <th scope="col">Customer</th>
                <th scope="col">Grams</th>
                <th scope="col">Buyback ₹/g</th>
                <th scope="col">Est. cash ₹</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="When">{fmtWhen(r.created_at)}</td>
                  <td data-label="Ref">
                    <strong className="tabular">{r.reference}</strong>
                  </td>
                  <td data-label="Customer">{r.customer_label}</td>
                  <td data-label="Grams">
                    <span className="tabular">{r.grams} g</span>
                  </td>
                  <td data-label="Buyback ₹/g">
                    <span className="tabular">₹{fmtInr(r.buyback_inr_per_gram_snapshot)}</span>
                  </td>
                  <td data-label="Est. cash ₹">
                    <span className="tabular">₹{fmtInr(r.cash_estimate_inr)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
