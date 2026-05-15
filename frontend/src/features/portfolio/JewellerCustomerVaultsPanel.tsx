import { useCallback, useEffect, useState } from 'react'
import { fetchJewellerCustodyVaults, type JewellerCustodyVaultRowDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatJewellerMetalRateAsOf } from '@/features/marketplace/productPricing'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function JewellerCustomerVaultsPanel() {
  const [rows, setRows] = useState<JewellerCustodyVaultRowDTO[]>([])
  const [gramsTotal, setGramsTotal] = useState('0')
  const [inrTotal, setInrTotal] = useState('0')
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const payload = await fetchJewellerCustodyVaults()
    if (!payload) {
      setLoadErr('Could not load customer vaults.')
      setRows([])
      return
    }
    setRows(payload.results ?? [])
    setGramsTotal(payload.custodian_fractional_grams_total ?? '0')
    setInrTotal(payload.custodian_estimated_value_inr_total ?? '0')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const sampleRateIso = rows[0]?.jeweller_metal_rate_last_updated_at

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead">
        Customers with <strong>fractional gold</strong> vaulted under your showroom (custodian). Values use your reference ₹/g marks;
        Cridora ledger remains authoritative for transfers and redemptions.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="pf-grid pf-grid--kpis pf-stagger" style={{ marginBottom: '1.25rem' }}>
        <div className="pf-kpi pf-kpi--gold pf-kpi--shimmer">
          <span className="pf-kpi__eyebrow">Customers with balance</span>
          <p className="pf-kpi__value">{rows.length}</p>
          <span className="pf-kpi__hint">Non-zero fractional vaults here</span>
        </div>
        <div className="pf-kpi pf-kpi--ocean pf-kpi--pulse">
          <span className="pf-kpi__eyebrow">Total fractional (custody)</span>
          <p className="pf-kpi__value tabular">{gramsTotal} g</p>
          <span className="pf-kpi__hint">Across listed vaults</span>
        </div>
        <div className="pf-kpi pf-kpi--iris pf-kpi--pulse">
          <span className="pf-kpi__eyebrow">Est. value @ your ₹/g</span>
          <p className="pf-kpi__value tabular">
            ₹{parseG(inrTotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="pf-kpi__hint">
            Rate as of {formatJewellerMetalRateAsOf(sampleRateIso) ?? '—'}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No customer fractional balances custodied here yet. Completed counter purchases will appear after OTP verification.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {rows.map((v) => (
            <div key={`cust-${v.customer_id}`} className="card" style={{ padding: '1.15rem 1.25rem', borderRadius: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{v.customer_label || 'Customer'}</h3>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Member ID <span className="tabular">{v.customer_member_id?.trim() ? v.customer_member_id : '—'}</span>
                    {v.customer_email ? (
                      <>
                        {' '}
                        · <span style={{ wordBreak: 'break-all' }}>{v.customer_email}</span>
                      </>
                    ) : null}
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
                    {v.vault_public_id?.trim() ? v.vault_public_id : '—'}
                  </strong>
                </p>
                <p style={{ margin: 0 }}>
                  Est. value{' '}
                  <strong className="tabular" style={{ color: 'var(--gold-light)' }}>
                    ₹
                    {parseG(v.estimated_fractional_value_inr ?? '0').toLocaleString('en-IN', {
                      maximumFractionDigits: 0,
                    })}
                  </strong>{' '}
                  @ ₹
                  {parseG(v.jeweller_metal_rate_inr_per_gram ?? '0').toLocaleString('en-IN', {
                    maximumFractionDigits: 2,
                  })}
                  /g
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
