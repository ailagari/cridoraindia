import { useCallback, useEffect, useMemo, useState } from 'react'
import { LegalDisclosureStrip } from '@/features/crossRedemption/LegalDisclosureStrip'
import { authFetch } from '@/lib/api'
import { fetchGoldWallet, type GoldWalletDTO } from '@/lib/goldTransferApi'
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
}

export function CustomerCrossRedemptionPanel() {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [rows, setRows] = useState<CrossRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [sourceId, setSourceId] = useState<number | ''>('')
  const [destId, setDestId] = useState('')
  const [grams, setGrams] = useState('')
  const [inr, setInr] = useState('')

  const refreshWallet = useCallback(async () => {
    const w = await fetchGoldWallet()
    setWallet(w)
  }, [])

  const refreshList = useCallback(async () => {
    setLoadErr('')
    try {
      const res = await authFetch('/api/v1/cross-redemption/')
      const data = (await res.json().catch(() => ({}))) as { results?: CrossRow[] }
      if (!res.ok) {
        setLoadErr('Could not load cross-redemption requests.')
        return
      }
      setRows(data.results ?? [])
    } catch {
      setLoadErr('Could not load cross-redemption requests.')
    }
  }, [])

  useEffect(() => {
    void refreshWallet()
    void refreshList()
  }, [refreshWallet, refreshList])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)
  useLivePoll(refreshList, LIVE_BALANCE_POLL_MS, true)

  const vaultOpts = useMemo(() => {
    const v = wallet?.vaults ?? []
    return v.filter((x) => Number.parseFloat(x.fractional_grams || '0') > 0)
  }, [wallet])

  useEffect(() => {
    if (sourceId !== '') return
    if (vaultOpts.length === 0) return
    setSourceId(vaultOpts[0].custodian_id)
  }, [vaultOpts, sourceId])

  const submitAuthorize = async () => {
    setMsg('')
    setBusy(true)
    try {
      const dest = Number.parseInt(destId.trim(), 10)
      if (!Number.isFinite(dest) || dest <= 0) {
        setMsg('Enter a valid destination jeweller id.')
        return
      }
      if (sourceId === '' || typeof sourceId !== 'number') {
        setMsg('Pick a source vault.')
        return
      }
      const res = await authFetch('/api/v1/cross-redemption/authorize/', {
        method: 'POST',
        jsonBody: {
          source_jeweller_id: sourceId,
          destination_jeweller_id: dest,
          grams,
          estimated_value_inr: inr,
        },
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string
        status?: string
        ux_status?: string
      }
      if (!res.ok) {
        setMsg(typeof data.detail === 'string' ? data.detail : 'Request failed.')
        return
      }
      setMsg(
        data.status === 'APPROVE'
          ? `Authorised — status: ${data.ux_status ?? 'Processing'}.`
          : 'Not authorised (limits or balance).',
      )
      await refreshList()
    } finally {
      setBusy(false)
    }
  }

  const cancelOne = async (id: number) => {
    setMsg('')
    const res = await authFetch(`/api/v1/cross-redemption/${id}/cancel/`, { method: 'POST' })
    const data = (await res.json().catch(() => ({}))) as { detail?: string }
    if (!res.ok) {
      setMsg(typeof data.detail === 'string' ? data.detail : 'Cancel failed.')
      return
    }
    setMsg('Request cancelled.')
    await refreshList()
  }

  return (
    <div className="dash-panel-max">
      <h2 className="dash-coming__title" style={{ marginBottom: '0.35rem' }}>
        Cross-redemption (vault jeweller → other jeweller)
      </h2>
      <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
        Start a supervised move of grams between jewellers where you custody gold. Status words below are simplified for
        display only.
      </p>
      {loadErr ? (
        <p className="form-error" style={{ marginBottom: '0.75rem' }}>
          {loadErr}
        </p>
      ) : null}
      <div className="dash-coming dash-coming--payments" style={{ marginBottom: '1rem', padding: '1rem 1.1rem' }}>
        <h3 className="dash-coming__title" style={{ fontSize: '1rem' }}>
          New request
        </h3>
        <label className="form-label" style={{ display: 'block', marginTop: '0.5rem' }}>
          Source jeweller (your vault with balance)
        </label>
        <select
          className="form-input"
          value={sourceId === '' ? '' : String(sourceId)}
          onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : '')}
        >
          {vaultOpts.map((v) => (
            <option key={v.custodian_id} value={v.custodian_id}>
              {v.custodian_label || `Jeweller #${v.custodian_id}`} — {v.fractional_grams} g
            </option>
          ))}
        </select>
        <label className="form-label" style={{ display: 'block', marginTop: '0.65rem' }}>
          Destination jeweller user id
        </label>
        <input
          className="form-input"
          value={destId}
          onChange={(e) => setDestId(e.target.value)}
          placeholder="e.g. 42"
          inputMode="numeric"
        />
        <label className="form-label" style={{ display: 'block', marginTop: '0.65rem' }}>
          Grams
        </label>
        <input className="form-input" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="0.500000" />
        <label className="form-label" style={{ display: 'block', marginTop: '0.65rem' }}>
          Estimated value (INR snapshot)
        </label>
        <input className="form-input" value={inr} onChange={(e) => setInr(e.target.value)} placeholder="100000.00" />
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '0.85rem' }}
          disabled={busy}
          onClick={() => void submitAuthorize()}
        >
          Authorise
        </button>
        <LegalDisclosureStrip title="Cross-redemption disclosure" />
      </div>
      {msg ? (
        <p className="dash-form-success" style={{ marginBottom: '0.75rem' }}>
          {msg}
        </p>
      ) : null}
      <h3 className="dash-coming__title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
        Your requests
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>Id</th>
              <th>Display status</th>
              <th>Grams</th>
              <th>INR</th>
              <th>Source → Dest</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.ux_status}</td>
                <td>{r.grams}</td>
                <td>{r.estimated_value_inr}</td>
                <td>
                  {r.source_jeweller_id} → {r.destination_jeweller_id}
                </td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => void cancelOne(r.id)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="dash-coming__text">No requests yet.</p> : null}
      </div>
    </div>
  )
}
