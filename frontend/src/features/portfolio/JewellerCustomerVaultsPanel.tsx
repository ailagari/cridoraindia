import { DeferredFilePicker } from '@/components/ui'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchJewellerCustodyVaults,
  fetchJewellerCustomerVaultLedger,
  type JewellerCustodyVaultRowDTO,
  type JewellerVaultLedgerPayloadDTO,
} from '@/lib/goldTransferApi'
import { jewellerCreatePersonalHolding, jewellerLookupCustomer } from '@/lib/personalHoldingsApi'
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
    case 'sellback':
      return 'Cash sellback'
    case 'golden_scheme':
      return 'Golden scheme'
    case 'personal':
      return 'Personal holding'
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
  | { status: 'ok'; data: JewellerVaultLedgerPayloadDTO; filter: string }

export function JewellerCustomerVaultsPanel() {
  const [rows, setRows] = useState<JewellerCustodyVaultRowDTO[]>([])
  const [gramsTotal, setGramsTotal] = useState('0')
  const [inrTotal, setInrTotal] = useState('0')
  const [loadErr, setLoadErr] = useState('')
  const [ledgerByCustomer, setLedgerByCustomer] = useState<Record<number, LedgerRowState>>({})
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)

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

  const ensureLedger = useCallback(
    async (customerId: number) => {
      let skipFetch = false
      setLedgerByCustomer((prev) => {
        const cur = prev[customerId]
        if (cur?.status === 'loading') {
          skipFetch = true
          return prev
        }
        if (cur?.status === 'ok' && cur.filter === ledgerFilter) {
          skipFetch = true
          return prev
        }
        return { ...prev, [customerId]: { status: 'loading' } }
      })
      if (skipFetch) return
      const data = await fetchJewellerCustomerVaultLedger(customerId, ledgerFilter)
      if (!data) {
        setLedgerByCustomer((prev) => ({
          ...prev,
          [customerId]: { status: 'error', message: 'Could not load ledger.' },
        }))
        return
      }
      setLedgerByCustomer((prev) => ({
        ...prev,
        [customerId]: { status: 'ok', data, filter: ledgerFilter },
      }))
    },
    [ledgerFilter],
  )

  const sampleRateIso = rows[0]?.jeweller_metal_rate_last_updated_at

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead">
        Customers with <strong>fractional gold</strong> vaulted under your showroom (custodian). Values use your reference ₹/g marks;
        Cridora ledger remains authoritative for transfers and redemptions.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="card" style={{ padding: '1rem 1.15rem', borderRadius: 16, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Add Personal Holding</h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Verified customers only · appears in their Gold Records Vault as “Purchased From” your showroom.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setAddOpen((x) => !x)}>
            {addOpen ? 'Close' : 'Open'}
          </button>
        </div>
        {addOpen ? <JewellerPersonalHoldingInline onDone={() => void refresh()} /> : null}
      </div>

      <div className="pf-ledger-filter" role="group" aria-label="Ledger default filter" style={{ marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Ledger filter:</span>
        {(
          [
            ['all', 'All'],
            ['fractional', 'Fractional'],
            ['deposit', 'Deposit'],
            ['golden_scheme', 'Golden scheme'],
            ['personal', 'Personal'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-sm${ledgerFilter === id ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => {
              setLedgerFilter(id)
              setLedgerByCustomer({})
            }}
          >
            {label}
          </button>
        ))}
      </div>

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

function JewellerPersonalHoldingInline({ onDone }: { onDone: () => void }) {
  const [memberId, setMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerLabel, setCustomerLabel] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('ornament')
  const [weight, setWeight] = useState('')
  const [purity, setPurity] = useState('BIS 916')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [invoiceMediaFile, setInvoiceMediaFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  useEffect(() => {
    if (!formSuccess) return
    const t = window.setTimeout(() => setFormSuccess(''), 7000)
    return () => window.clearTimeout(t)
  }, [formSuccess])

  const runLookup = async () => {
    setLookupErr('')
    const r = await jewellerLookupCustomer({
      cridora_member_id: memberId.trim() || undefined,
      phone: phone.trim() || undefined,
    })
    if (!r.found || !r.customer) {
      setLookupErr(r.detail ?? 'Customer not found.')
      setCustomerId(null)
      setCustomerLabel('')
      return
    }
    setCustomerId(r.customer.id)
    setCustomerLabel(`${r.customer.label} · ${r.customer.cridora_member_id}`)
  }

  const submit = async () => {
    setFormErr('')
    setFormSuccess('')
    if (customerId == null) {
      setFormErr('Look up a verified customer first.')
      return
    }
    setBusy(true)
    const fd = new FormData()
    fd.set('customer_id', String(customerId))
    fd.set('title', title.trim())
    fd.set('category', category)
    fd.set('weight_grams', weight.trim())
    fd.set('purity', purity.trim() || 'BIS 916')
    if (invoiceNumber.trim()) fd.set('invoice_number', invoiceNumber.trim())
    if (productImageFile) fd.set('product_image', productImageFile)
    if (invoiceMediaFile) fd.set('invoice_file', invoiceMediaFile)
    const res = await jewellerCreatePersonalHolding(fd)
    setBusy(false)
    if (!res.ok) {
      setFormErr(res.detail)
      return
    }
    setTitle('')
    setWeight('')
    setInvoiceNumber('')
    setProductImageFile(null)
    setInvoiceMediaFile(null)
    setFormSuccess(`Added “${res.data.title}” to the customer’s Gold Records Vault.`)
    onDone()
  }

  return (
    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
        <label className="pf-vault-field" style={{ flex: '1 1 160px' }}>
          <span>Cridora ID</span>
          <input className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="CRI…" />
        </label>
        <label className="pf-vault-field" style={{ flex: '1 1 160px' }}>
          <span>Phone</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone" />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => void runLookup()}>
          Find customer
        </button>
      </div>
      {lookupErr ? <p className="form-error">{lookupErr}</p> : null}
      {customerId != null ? (
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 650, color: 'var(--gold-light)' }}>
          Selected: {customerLabel}
        </p>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
        <label className="pf-vault-field">
          <span>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="pf-vault-field">
          <span>Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ornament">Ornament</option>
            <option value="coin">Coin</option>
            <option value="bar">Bar</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="pf-vault-field">
          <span>Grams</span>
          <input className="input tabular" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="pf-vault-field">
          <span>Purity</span>
          <input className="input" value={purity} onChange={(e) => setPurity(e.target.value)} />
        </label>
        <label className="pf-vault-field">
          <span>Invoice # (optional)</span>
          <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </label>
      </div>
      <div className="jeweller-vault-files" style={{ display: 'grid', gap: '0.75rem', maxWidth: '520px' }}>
        <DeferredFilePicker
          label="Product photo"
          accept=".jpg,.jpeg,.png,.webp"
          file={productImageFile}
          onChange={setProductImageFile}
          disabled={busy}
        />
        <DeferredFilePicker
          label="Invoice PDF or photo"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          file={invoiceMediaFile}
          onChange={setInvoiceMediaFile}
          disabled={busy}
        />
      </div>
      {formSuccess ? (
        <p className="form-feedback form-feedback--success" role="status">
          {formSuccess}
        </p>
      ) : null}
      {formErr ? <p className="form-error">{formErr}</p> : null}
      <button type="button" className="btn btn-primary" disabled={busy || customerId == null} onClick={() => void submit()}>
        Add to customer vault
      </button>
    </div>
  )
}
