import { useCallback, useEffect, useState } from 'react'
import {
  fetchJewellerCustodyVaults,
  fetchJewellerCustomerVaultLedger,
  type JewellerCustodyVaultRowDTO,
  type JewellerVaultLedgerPayloadDTO,
} from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { formatJewellerMetalRateAsOf } from '@/features/marketplace/productPricing'

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function formatLedgerTxnType(t: string): string {
  switch (t) {
    case 'fractional':
      return 'Fractional purchase'
    case 'transfer_in':
      return 'Transfer in'
    case 'transfer_out':
      return 'Transfer out'
    case 'deposit':
      return 'Deposit'
    case 'redeem':
      return 'Redeem'
    default:
      return t.replace(/_/g, ' ')
  }
}

function formatLedgerRowDate(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatInrLedger(s: string | null | undefined): string {
  if (s == null || s === '') return '—'
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

type LedgerRowState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: JewellerVaultLedgerPayloadDTO }

export function JewellerCustomerVaultsPanel() {
  const [rows, setRows] = useState<JewellerCustodyVaultRowDTO[]>([])
  const [gramsTotal, setGramsTotal] = useState('0')
  const [inrTotal, setInrTotal] = useState('0')
  const [loadErr, setLoadErr] = useState('')
  const [ledgerByCustomer, setLedgerByCustomer] = useState<Record<number, LedgerRowState>>({})

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

  const ensureLedger = useCallback(async (customerId: number) => {
    let skipFetch = false
    setLedgerByCustomer((prev) => {
      const cur = prev[customerId]
      if (cur?.status === 'loading' || cur?.status === 'ok') {
        skipFetch = true
        return prev
      }
      return { ...prev, [customerId]: { status: 'loading' } }
    })
    if (skipFetch) return
    const data = await fetchJewellerCustomerVaultLedger(customerId)
    if (!data) {
      setLedgerByCustomer((prev) => ({
        ...prev,
        [customerId]: { status: 'error', message: 'Could not load ledger.' },
      }))
      return
    }
    setLedgerByCustomer((prev) => ({
      ...prev,
      [customerId]: { status: 'ok', data },
    }))
  }, [])

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

              <details
                className="jeweller-mkt-acc card jeweller-vault-ledger-acc"
                style={{ marginTop: '1rem' }}
                onToggle={(ev) => {
                  if (!ev.currentTarget.open) return
                  void ensureLedger(v.customer_id)
                }}
              >
                <summary>Transaction ledger</summary>
                <div className="jeweller-mkt-acc__body jeweller-vault-ledger-acc__body">
                  {(() => {
                    const st = ledgerByCustomer[v.customer_id] ?? { status: 'idle' as const }
                    if (st.status === 'idle' || st.status === 'loading') {
                      return (
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {st.status === 'loading' ? 'Loading ledger…' : 'Open to load ledger.'}
                        </p>
                      )
                    }
                    if (st.status === 'error') {
                      return (
                        <div>
                          <p className="form-error" style={{ margin: '0 0 0.65rem' }}>
                            {st.message}
                          </p>
                          <button type="button" className="btn btn-ghost" onClick={() => void ensureLedger(v.customer_id)}>
                            Retry
                          </button>
                        </div>
                      )
                    }
                    const payload = st.data
                    return (
                      <>
                        <p style={{ margin: '0 0 0.85rem', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                          Activity at your custodian vault for this customer.{' '}
                          <strong className="tabular">
                            Current value column uses ₹{formatInrLedger(payload.reference_rate_inr_per_gram)}/g reference (same basis as card estimate).
                          </strong>{' '}
                          Purchase value for fractional rows is metal ₹ before GST (invoice total includes GST).
                        </p>
                        {payload.entries.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            No ledger entries recorded yet.
                          </p>
                        ) : (
                          <div className="jeweller-vault-ledger-wrap">
                            <table className="jeweller-vault-ledger-table">
                              <thead>
                                <tr>
                                  <th scope="col">Date</th>
                                  <th scope="col">Type</th>
                                  <th scope="col">Grams</th>
                                  <th scope="col">Metal</th>
                                  <th scope="col">Purchase value</th>
                                  <th scope="col">Current value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {payload.entries.map((e) => (
                                  <tr key={`${e.reference}-${e.occurred_at}`}>
                                    <td data-label="Date">{formatLedgerRowDate(e.occurred_at)}</td>
                                    <td data-label="Type">
                                      <span>{formatLedgerTxnType(e.transaction_type)}</span>
                                      {e.counterparty_label.trim() ? (
                                        <span className="jeweller-vault-ledger-counterparty">
                                          {' · '}
                                          {e.transaction_type === 'transfer_out'
                                            ? `To ${e.counterparty_label}`
                                            : e.transaction_type === 'transfer_in'
                                              ? `From ${e.counterparty_label}`
                                              : e.counterparty_label}
                                        </span>
                                      ) : null}
                                    </td>
                                    <td data-label="Grams">
                                      <span className="tabular">{e.grams} g</span>
                                    </td>
                                    <td data-label="Metal">{e.metal_type}</td>
                                    <td data-label="Purchase value">
                                      {e.purchase_value_inr != null ? (
                                        <span className="tabular">₹{formatInrLedger(e.purchase_value_inr)}</span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td data-label="Current value">
                                      <span className="tabular">₹{formatInrLedger(e.current_value_inr)}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
