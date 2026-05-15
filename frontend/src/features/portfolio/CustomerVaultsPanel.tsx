import { useCallback, useEffect, useState } from 'react'
import { fetchGoldWallet, type VaultRowDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatJewellerMetalRateAsOf } from '@/features/marketplace/productPricing'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function CustomerVaultsPanel() {
  const [vaults, setVaults] = useState<VaultRowDTO[]>([])
  const [memberId, setMemberId] = useState('')
  const [totalGrams, setTotalGrams] = useState('0')
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load vaults.')
      setVaults([])
      return
    }
    setVaults(w.vaults ?? [])
    setMemberId(w.cridora_member_id ?? '')
    setTotalGrams(w.balance_grams ?? '0')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const rows = vaults.filter((v) => parseG(v.fractional_grams) > 0)

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Each row is a <strong>vault</strong> with a partnered jeweller (custodian). Fractional gold you buy at counter is
        credited here; vault ID appears when your Cridora handle and the jeweller code are both set.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-grid pf-grid--kpis pf-stagger pf-scope" style={{ marginBottom: '1.25rem' }}>
        <div className="pf-kpi pf-kpi--gold pf-kpi--shimmer">
          <span className="pf-kpi__eyebrow">Member ID</span>
          <p className="pf-kpi__value" style={{ fontSize: '1rem' }}>
            {memberId || '—'}
          </p>
        </div>
        <div className="pf-kpi pf-kpi--ocean pf-kpi--pulse">
          <span className="pf-kpi__eyebrow">Total fractional</span>
          <p className="pf-kpi__value">{totalGrams} g</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No vault balances yet. Complete a fractional purchase to open a vault.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {rows.map((v) => (
            <div key={`${v.custodian_id}`} className="card" style={{ padding: '1.15rem 1.25rem', borderRadius: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{v.custodian_label || `Jeweller #${v.custodian_id}`}</h3>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Custodian ID <span className="tabular">{v.custodian_id}</span>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
                    FRACTIONAL
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '1.35rem', fontWeight: 800 }} className="tabular">
                    {v.fractional_grams} g
                  </p>
                </div>
              </div>
              <div
                style={{
                  marginTop: '0.85rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-soft)',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  display: 'grid',
                  gap: '0.35rem',
                }}
              >
                <p style={{ margin: 0 }}>
                  Vault ID{' '}
                  <strong style={{ color: 'var(--text)', wordBreak: 'break-all' }}>
                    {v.vault_public_id?.trim() ? v.vault_public_id : '— (set handle & jeweller code)'}
                  </strong>
                </p>
                <p style={{ margin: 0 }}>
                  Est. value{' '}
                  <strong className="tabular" style={{ color: 'var(--gold-light)' }}>
                    ₹{parseG(v.estimated_fractional_value_inr ?? '0').toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </strong>{' '}
                  @ ₹{parseG(v.jeweller_metal_rate_inr_per_gram ?? '0').toLocaleString('en-IN', { maximumFractionDigits: 2 })}/g
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem' }}>
                  Rate as of {formatJewellerMetalRateAsOf(v.jeweller_metal_rate_last_updated_at) ?? '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
