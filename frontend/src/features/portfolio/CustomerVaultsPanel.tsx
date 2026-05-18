import { useCallback, useEffect, useState } from 'react'
import { fetchGoldWallet, vaultRowEstimatedInr, vaultRowTotalGrams, type VaultRowDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatJewellerMetalRateAsOf } from '@/features/marketplace/productPricing'
import { formatVaultCardDisplay } from '@/lib/vaultRoutingDisplay'

function parseG(s: string | undefined): number {
  if (s == null || String(s).trim() === '') return 0
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

  const rows = vaults.filter((v) => vaultRowTotalGrams(v) > 0)

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Each row is a <strong>vault</strong> with a partnered jeweller (custodian). Counter buys credit <strong>fractional</strong>{' '}
        grams; verified <strong>gold deposit</strong> and <strong>Golden scheme</strong> balances show here too when present. Vault
        ID appears when your Cridora handle and the jeweller code are both set.
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
          <span className="pf-kpi__eyebrow">Total vaulted gold</span>
          <p className="pf-kpi__value pf-kpi__value--grams">{totalGrams} g</p>
          <span className="pf-kpi__hint">Fractional + deposit + scheme (all partners)</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No vault balances yet. Buy fractional gold at counter, complete a gold deposit with OTP, or join a scheme with a
          verified jeweller.
        </p>
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
                    TOTAL VAULT
                  </p>
                  <p className="pf-vault-card__grams-glow tabular">{vaultRowTotalGrams(v).toFixed(6)} g</p>
                </div>
              </div>
              <div
                style={{
                  marginTop: '0.65rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  display: 'grid',
                  gap: '0.25rem',
                }}
              >
                <p style={{ margin: 0 }}>
                  Fractional <strong className="tabular">{parseG(v.fractional_grams).toFixed(6)} g</strong> · Deposit{' '}
                  <strong className="tabular">{parseG(v.deposit_grams).toFixed(6)} g</strong> · Golden scheme{' '}
                  <strong className="tabular">{parseG(v.golden_scheme_grams).toFixed(6)} g</strong>
                </p>
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
                    {v.vault_public_id?.trim() ? formatVaultCardDisplay(v.vault_public_id) : '— (card pending)'}
                  </strong>
                </p>
                <p style={{ margin: 0 }}>
                  Board mark ₹{parseG(v.jeweller_metal_rate_inr_per_gram).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/g
                  {' · '}
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-faint)' }}>Indicative ₹ value (all types)</span>{' '}
                  <strong className="tabular pf-vault-card__inr-value">
                    ₹{vaultRowEstimatedInr(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </strong>
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
