import { useCallback, useEffect, useState } from 'react'
import { LegalDisclosureStrip } from '@/features/crossRedemption/LegalDisclosureStrip'
import { authFetch } from '@/lib/api'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type CrossRow = {
  id: number
  public_reference: string
  inbox_status: string
  grams: string
  estimated_value_inr: string
  party?: string
  needs_source_approval?: boolean
  workflow_state?: string
  lease_holder?: string
  auth_expires_at?: string | null
}

export function JewellerCrossRedemptionInboxPanel() {
  const [rows, setRows] = useState<CrossRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [msg, setMsg] = useState('')
  const [otpById, setOtpById] = useState<Record<number, string>>({})

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

  const post = async (path: string, jsonBody?: Record<string, unknown>) => {
    const res = await authFetch(path, {
      method: 'POST',
      ...(jsonBody !== undefined ? { jsonBody } : {}),
    })
    const data = (await res.json().catch(() => ({}))) as { detail?: string; otp_code?: string }
    if (!res.ok) {
      setMsg(typeof data.detail === 'string' ? data.detail : 'Action failed.')
      return null
    }
    return data
  }

  const requestOtp = async (id: number) => {
    setMsg('')
    const data = await post(`/api/v1/jeweller/cross-redemption/${id}/source/request-otp/`)
    if (!data) return
    if (data.otp_code) {
      setMsg(`Approval code: ${data.otp_code} (enter below to approve)`)
    } else {
      setMsg('Code sent.')
    }
  }

  const approve = async (id: number) => {
    setMsg('')
    const otp = (otpById[id] ?? '').trim()
    const data = await post(`/api/v1/jeweller/cross-redemption/${id}/source/approve/`, { otp })
    if (!data) return
    setMsg('Approved.')
    await refresh()
  }

  const reject = async (id: number) => {
    setMsg('')
    const data = await post(`/api/v1/jeweller/cross-redemption/${id}/source/reject/`)
    if (!data) return
    setMsg('Rejected.')
    await refresh()
  }

  const pending = rows.filter((r) => r.party === 'source' && r.needs_source_approval)

  return (
    <div className="dash-panel-max" style={{ marginTop: '1.25rem' }}>
      <h3 className="dash-coming__title" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
        Cross-redemption approvals
      </h3>
      <p className="dash-coming__text" style={{ marginBottom: '0.75rem' }}>
        As source jeweller, you approve grams leaving your vault. Request a code, enter it, then approve.
      </p>
      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {msg ? (
        <p className="dash-form-success" style={{ marginBottom: '0.75rem' }}>
          {msg}
        </p>
      ) : null}

      {pending.length === 0 ? (
        <p className="dash-coming__text">No pending approvals.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {pending.map((r) => (
            <div
              key={r.id}
              className="dash-coming dash-coming--payments"
              style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}
            >
              <strong>{r.public_reference}</strong>
              <span style={{ marginLeft: 8, opacity: 0.85 }}>
                {r.grams} g · ₹{r.estimated_value_inr}
              </span>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  onClick={() => void requestOtp(r.id)}
                >
                  Get code
                </button>
                <input
                  className="form-input"
                  style={{ width: 100, padding: '0.25rem 0.4rem', fontSize: '0.8rem' }}
                  placeholder="6-digit"
                  inputMode="numeric"
                  value={otpById[r.id] ?? ''}
                  onChange={(e) => setOtpById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  onClick={() => void approve(r.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  onClick={() => void reject(r.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h4 className="dash-coming__title" style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
        All traffic
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Role</th>
              <th>Status</th>
              <th>Grams</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.public_reference}</td>
                <td>{r.party}</td>
                <td>{r.inbox_status}</td>
                <td>{r.grams}</td>
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
