import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminUpiFraudReports,
  reviewAdminUpiFraudReport,
  type UpiFraudReportRow,
} from '@/features/upi/upiPaymentApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminUpiFraudReportsPanel() {
  const [rows, setRows] = useState<UpiFraudReportRow[]>([])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const out = await fetchAdminUpiFraudReports('open')
    if (!out.ok) {
      setErr(out.detail)
      setRows([])
      return
    }
    setRows(out.data.results)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, LIVE_BALANCE_POLL_MS, busyId == null)

  const markReviewed = async (id: number) => {
    setBusyId(id)
    const out = await reviewAdminUpiFraudReport(id)
    setBusyId(null)
    if (!out.ok) {
      setErr(out.detail)
      return
    }
    await load()
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        UPI fraud reports filed by jewellers or customers during manual payment review.
      </p>
      {err ? <p className="form-error">{err}</p> : null}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No open fraud reports.</p>
      ) : (
        <div className="jeweller-purchases-wrap">
          <table className="jeweller-purchases-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Reference</th>
                <th scope="col">Amount</th>
                <th scope="col">Reporter</th>
                <th scope="col">Note</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtWhen(r.created_at)}</td>
                  <td className="tabular">{r.reference}</td>
                  <td className="tabular">{r.amount_inr ? `₹${r.amount_inr}` : '—'}</td>
                  <td>{r.reported_by_name || r.reported_by_email}</td>
                  <td>{r.note}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn--sm"
                      disabled={busyId != null}
                      onClick={() => void markReviewed(r.id)}
                    >
                      Mark reviewed
                    </button>
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
