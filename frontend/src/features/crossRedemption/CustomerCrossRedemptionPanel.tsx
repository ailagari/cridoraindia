import { useCallback, useEffect, useMemo, useState } from 'react'
import { LegalDisclosureStrip } from '@/features/crossRedemption/LegalDisclosureStrip'
import { authFetch } from '@/lib/api'
import { fetchGoldWallet, type GoldWalletDTO } from '@/lib/goldTransferApi'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

type CrossRow = {
  id: number
  public_reference: string
  ux_status: string
  grams: string
  estimated_value_inr: string
  source_jeweller_id: number
  destination_jeweller_id: number
  source_label: string
  destination_label: string
  auth_expires_at: string | null
  can_cancel?: boolean
}

export function CustomerCrossRedemptionPanel() {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [rows, setRows] = useState<CrossRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [sourceId, setSourceId] = useState<number | ''>('')
  const [destId, setDestId] = useState<number | ''>('')
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
    void fetchVerifiedJewellers().then(setJewellers)
  }, [refreshWallet, refreshList])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)
  useLivePoll(refreshList, LIVE_BALANCE_POLL_MS, true)

  const vaultOpts = useMemo(() => {
    const v = wallet?.vaults ?? []
    return v.filter((x) => Number.parseFloat(x.fractional_grams || '0') > 0)
  }, [wallet])

  const destOpts = useMemo(() => {
    if (sourceId === '') return jewellers
    return jewellers.filter((j) => j.id !== sourceId)
  }, [jewellers, sourceId])

  useEffect(() => {
    if (sourceId !== '') return
    if (vaultOpts.length === 0) return
    setSourceId(vaultOpts[0].custodian_id)
  }, [vaultOpts, sourceId])

  useEffect(() => {
    if (destId === '') return
    if (sourceId !== '' && destId === sourceId) setDestId('')
  }, [sourceId, destId])

  const submitAuthorize = async () => {
    setMsg('')
    setBusy(true)
    try {
      if (destId === '' || typeof destId !== 'number') {
        setMsg('Pick a destination jeweller.')
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
          destination_jeweller_id: destId,
          grams,
          estimated_value_inr: inr,
        },
      })
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string
        status?: string
        ux_status?: string
        public_reference?: string
      }
      if (!res.ok) {
        setMsg(typeof data.detail === 'string' ? data.detail : 'Request failed.')
        return
      }
      if (data.status === 'REJECT') {
        setMsg('Not authorised — check balance or limits.')
      } else if (data.status === 'PENDING') {
        setMsg(
          `${data.public_reference ?? 'Request'} submitted. Your source jeweller must approve before grams move.`,
        )
      } else {
        setMsg(`${data.public_reference ?? 'Request'} approved — ${data.ux_status ?? 'Processing'}.`)
      }
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
        Cross-redemption
      </h2>
      <p className="dash-coming__text" style={{ marginBottom: '1rem' }}>
        Move vault grams to another jeweller. Your source jeweller approves; settlement is deferred (T+1).
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
          From (your vault)
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
          To (destination jeweller)
        </label>
        <select
          className="form-input"
          value={destId === '' ? '' : String(destId)}
          onChange={(e) => setDestId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select jeweller</option>
          {destOpts.map((j) => (
            <option key={j.id} value={j.id}>
              {j.business_name}
              {j.city ? ` · ${j.city}` : ''}
            </option>
          ))}
        </select>
        <label className="form-label" style={{ display: 'block', marginTop: '0.65rem' }}>
          Grams
        </label>
        <input className="form-input" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="0.500000" />
        <label className="form-label" style={{ display: 'block', marginTop: '0.65rem' }}>
          Estimated value (INR)
        </label>
        <input className="form-input" value={inr} onChange={(e) => setInr(e.target.value)} placeholder="100000.00" />
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '0.85rem' }}
          disabled={busy}
          onClick={() => void submitAuthorize()}
        >
          Submit
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
              <th>Reference</th>
              <th>Status</th>
              <th>Grams</th>
              <th>Route</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.public_reference}</td>
                <td>{r.ux_status}</td>
                <td>{r.grams}</td>
                <td>
                  {r.source_label} → {r.destination_label}
                </td>
                <td>
                  {r.can_cancel !== false ? (
                    <button type="button" className="btn btn-ghost" onClick={() => void cancelOne(r.id)}>
                      Cancel
                    </button>
                  ) : null}
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
