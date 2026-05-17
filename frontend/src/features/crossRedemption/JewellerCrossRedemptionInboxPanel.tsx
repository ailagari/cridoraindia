import { useCallback, useEffect, useState } from 'react'
import { LegalDisclosureStrip } from '@/features/crossRedemption/LegalDisclosureStrip'
import { authFetch } from '@/lib/api'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type CrossRow = {
  id: number
  ux_status: string
  grams: string
  estimated_value_inr: string
  source_jeweller_id: number
  destination_jeweller_id: number
  deadline_at: string | null
  party?: string
  lease_holder?: string
  lease_until?: string | null
}

export function JewellerCrossRedemptionInboxPanel() {
  const [rows, setRows] = useState<CrossRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [msg, setMsg] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    try {
      const res = await authFetch('/api/v1/jeweller/cross-redemption/inbox/')
      const data = (await res.json().catch(() => ({}))) as { results?: CrossRow[] }
      if (!res.ok) {
        setLoadErr('Could not load inbox.')
        return
      }
      setRows(data.results ?? [])
    } catch {
      setLoadErr('Could not load inbox.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const run = async (path: string, jsonBody?: Record<string, unknown>) => {
    setMsg('')
    const res = await authFetch(path, {
      method: 'POST',
      ...(jsonBody !== undefined ? { jsonBody } : {}),
    })
    const data = (await res.json().catch(() => ({}))) as { detail?: string }
    if (!res.ok) {
      setMsg(typeof data.detail === 'string' ? data.detail : 'Action failed.')
      return
    }
    setMsg('Updated.')
    await refresh()
  }

  return (
    <div className="dash-panel-max" style={{ marginTop: '1.25rem' }}>
      <h3 className="dash-coming__title" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
        Cross-redemption inbox
      </h3>
      <p className="dash-coming__text" style={{ marginBottom: '0.75rem' }}>
        Approve or reject requests where you are source or destination. Display statuses are customer-facing only.
      </p>
      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {msg ? (
        <p className="dash-form-success" style={{ marginBottom: '0.75rem' }}>
          {msg}
        </p>
      ) : null}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Id</th>
              <th>Role</th>
              <th>Display status</th>
              <th>Grams</th>
              <th>INR</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.party}</td>
                <td>{r.ux_status}</td>
                <td>{r.grams}</td>
                <td>{r.estimated_value_inr}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {r.party === 'destination' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ marginRight: 6, padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                        onClick={() => void run(`/api/v1/jeweller/cross-redemption/${r.id}/destination/accept/`)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ marginRight: 6, padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                        onClick={() => void run(`/api/v1/jeweller/cross-redemption/${r.id}/destination/reject/`)}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {r.party === 'source' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ marginRight: 6, padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                        onClick={() => void run(`/api/v1/jeweller/cross-redemption/${r.id}/source/approve/`)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ marginRight: 6, padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                        onClick={() => void run(`/api/v1/jeweller/cross-redemption/${r.id}/source/reject/`)}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                    disabled={!r.lease_holder}
                    title={
                      r.lease_holder
                        ? 'Extend fulfillment lease'
                        : 'Lease not active — refresh list after accept'
                    }
                    onClick={() =>
                      void run(`/api/v1/jeweller/cross-redemption/${r.id}/fulfillment/heartbeat/`, {
                        lease_holder: r.lease_holder ?? '',
                      })
                    }
                  >
                    Heartbeat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="dash-coming__text">No cross-redemption traffic yet.</p> : null}
      </div>
      <LegalDisclosureStrip title="Cross-redemption disclosure" />
    </div>
  )
}
