import { DeferredFilePicker } from '@/components/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchJewellerCustodyVaults,
  fetchJewellerCustomerVaultLedger,
  type JewellerCustodyVaultRowDTO,
  type JewellerVaultLedgerEntryDTO,
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

function formatLedgerTxnType(t: string | null | undefined): string {
  const raw = (t ?? '').trim()
  if (!raw) return 'Activity'
  switch (raw) {
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
    case 'deposit':
      return 'Gold deposit'
    case 'personal':
      return 'Personal holding'
    default:
      return raw.replace(/_/g, ' ')
  }
}

function formatLedgerRowDate(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim()
  if (!raw) return '—'
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return raw
  return new Date(ms).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Match customer portfolio ledger (date-only in table). */
function fmtLedgerDateShort(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim()
  if (!raw) return '—'
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return raw.slice(0, 10)
  return new Date(t).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

function ledgerPillClass(t: string | null | undefined): string {
  const base = 'pf-ledger-pill'
  switch ((t ?? '').trim()) {
    case 'transfer_out':
    case 'sellback':
      return `${base} pf-ledger-pill--sell`
    case 'transfer_in':
      return `${base} pf-ledger-pill--credit`
    case 'golden_scheme':
      return `${base} pf-ledger-pill--fee`
    case 'deposit':
      return `${base} pf-ledger-pill--xfer`
    case 'personal':
      return `${base} pf-ledger-pill--xfer`
    case 'fractional':
    default:
      return `${base} pf-ledger-pill--buy`
  }
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

function counterpartyLine(entry: JewellerVaultLedgerEntryDTO): string {
  const label = (entry.counterparty_label ?? '').trim()
  if (!label) return ''
  if (entry.transaction_type === 'transfer_out') return ` · To ${label}`
  if (entry.transaction_type === 'transfer_in') return ` · From ${label}`
  return ` · ${label}`
}

function JewellerVaultLedgerTable({ payload }: { payload: JewellerVaultLedgerPayloadDTO }) {
  if (payload.entries.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        No ledger entries for this filter.
      </p>
    )
  }

  return (
    <>
      <p className="pf-card__meta jeweller-vault-ledger-inline__lede">
        Activity at your custodian vault for this customer.{' '}
        <strong className="tabular">
          Est. ₹ column uses ₹{formatInrLedger(payload.reference_rate_inr_per_gram)}/g reference (same basis as card).
        </strong>{' '}
        Purchase value for fractional rows is metal ₹ before GST (invoice total includes GST).
      </p>
      <div className="pf-ledger-scroll jeweller-vault-ledger-scroll">
        <table className="pf-ledger-table jeweller-vault-ledger-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Reference</th>
              <th scope="col">Grams</th>
              <th scope="col">Metal</th>
              <th scope="col">Purchase ₹</th>
              <th className="tabular" scope="col">
                Est. ₹
              </th>
            </tr>
          </thead>
          <tbody>
            {payload.entries.map((e, index) => {
              const cp = counterpartyLine(e)
              const ref = (e.reference ?? '').trim() || `row-${index}`
              const occurred = (e.occurred_at ?? '').trim() || `t-${index}`
              return (
                <tr key={`${ref}-${occurred}-${index}`} className="pf-ledger-row">
                  <td className="pf-ledger-date" data-label="Date" title={formatLedgerRowDate(e.occurred_at)}>
                    {fmtLedgerDateShort(e.occurred_at)}
                  </td>
                  <td data-label="Type">
                    <span className={ledgerPillClass(e.transaction_type)}>
                      {formatLedgerTxnType(e.transaction_type)}
                    </span>
                    {cp ? <span className="jeweller-vault-ledger-counterparty">{cp}</span> : null}
                  </td>
                  <td className="tabular" data-label="Reference">
                    {e.reference ?? '—'}
                  </td>
                  <td className="tabular pf-ledger-grams" data-label="Grams">
                    {parseG(e.grams).toFixed(6)} g
                  </td>
                  <td data-label="Metal">{e.metal_type ?? '—'}</td>
                  <td className="tabular pf-ledger-inr pf-ledger-inr--mute" data-label="Purchase ₹">
                    {e.purchase_value_inr != null ? `₹${formatInrLedger(e.purchase_value_inr)}` : '—'}
                  </td>
                  <td className="tabular pf-ledger-inr" data-label="Est. ₹">
                    ₹{formatInrLedger(e.current_value_inr)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function JewellerCustomerVaultsPanel() {
  const [rows, setRows] = useState<JewellerCustodyVaultRowDTO[]>([])
  const [gramsTotal, setGramsTotal] = useState('0')
  const [inrTotal, setInrTotal] = useState('0')
  const [loadErr, setLoadErr] = useState('')
  const [ledgerByCustomer, setLedgerByCustomer] = useState<Record<number, LedgerRowState>>({})
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [expandedLedgerIds, setExpandedLedgerIds] = useState<number[]>([])
  const ledgerFilterRef = useRef(ledgerFilter)
  const expandedLedgerRef = useRef(expandedLedgerIds)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    ledgerFilterRef.current = ledgerFilter
  }, [ledgerFilter])

  useEffect(() => {
    expandedLedgerRef.current = expandedLedgerIds
  }, [expandedLedgerIds])

  const customerIdKey = useMemo(
    () =>
      rows
        .map((r) => r.customer_id)
        .filter((id) => Number.isFinite(id))
        .sort((a, b) => a - b)
        .join(','),
    [rows],
  )

  const refresh = useCallback(async () => {
    setLoadErr('')
    const payload = await fetchJewellerCustodyVaults()
    if (!payload) {
      setLoadErr('Could not load customer vaults.')
      setRows([])
      return
    }
    setRows(payload.results ?? [])
    setGramsTotal(payload.custodian_vault_grams_total ?? payload.custodian_fractional_grams_total ?? '0')
    setInrTotal(payload.custodian_estimated_value_inr_total ?? '0')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const ensureLedger = useCallback(
    async (customerId: number) => {
      const requestedFilter = ledgerFilterRef.current
      let skipFetch = false
      setLedgerByCustomer((prev) => {
        const cur = prev[customerId]
        if (cur?.status === 'loading') {
          skipFetch = true
          return prev
        }
        if (cur?.status === 'ok' && cur.filter === requestedFilter) {
          skipFetch = true
          return prev
        }
        return { ...prev, [customerId]: { status: 'loading' } }
      })
      if (skipFetch) return
      const data = await fetchJewellerCustomerVaultLedger(customerId, requestedFilter)
      if (ledgerFilterRef.current !== requestedFilter) {
        return
      }
      if (!data) {
        setLedgerByCustomer((prev) => ({
          ...prev,
          [customerId]: { status: 'error', message: 'Could not load ledger.' },
        }))
        return
      }
      setLedgerByCustomer((prev) => ({
        ...prev,
        [customerId]: { status: 'ok', data, filter: requestedFilter },
      }))
    },
    [],
  )

  const toggleLedger = useCallback(
    (customerId: number) => {
      setExpandedLedgerIds((prev) => {
        const open = prev.includes(customerId)
        if (open) return prev.filter((id) => id !== customerId)
        void ensureLedger(customerId)
        return [...prev, customerId]
      })
    },
    [ensureLedger],
  )

  useEffect(() => {
    setExpandedLedgerIds((prev) => prev.filter((id) => customerIdKey.split(',').includes(String(id))))
  }, [customerIdKey])

  useEffect(() => {
    setLedgerByCustomer({})
    for (const customerId of expandedLedgerRef.current) {
      if (Number.isFinite(customerId)) void ensureLedger(customerId)
    }
  }, [ledgerFilter, ensureLedger])

  const sampleRateIso = rows[0]?.jeweller_metal_rate_last_updated_at

  return (
    <div className="dash-panel-max pf-scope">
      <p className="dash-panel-lead">
        Customers with <strong>vaulted metal</strong> under your showroom (custodian): fractional, gold deposit, and Golden
        scheme grams. Values use your reference ₹/g marks; Cridora ledger remains authoritative for transfers and redemptions.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger jeweller-vault-add-card">
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Add personal holding</h3>
            <p className="pf-card__meta">
              Verified customers only · appears in their Gold Records Vault as “Purchased From” your showroom.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddOpen((x) => !x)}>
            {addOpen ? 'Close' : 'Open'}
          </button>
        </header>
        {addOpen ? <JewellerPersonalHoldingInline onDone={() => void refresh()} /> : null}
      </article>

      <article className="pf-card pf-card--lift pf-card--wide pf-card--ledger pf-card--ledger-table-wrap jeweller-vault-filter-card">
        <header className="pf-card__head pf-ledger-head">
          <div>
            <h3 className="pf-card__title">Ledger filter</h3>
            <p className="pf-card__meta">
              Applied to every customer&apos;s transaction ledger below (same table styling as the saver portfolio ledger).
            </p>
          </div>
        </header>
        <div className="pf-ledger-filter" role="group" aria-label="Ledger filter">
          {(
            [
              ['all', 'All'],
              ['fractional', 'Fractional'],
              ['transfer_in', 'Transfer in'],
              ['transfer_out', 'Transfer out'],
              ['sellback', 'Sellback'],
              ['personal', 'Personal'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-sm${ledgerFilter === id ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => setLedgerFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </article>

      <div className="pf-grid pf-grid--kpis pf-stagger" style={{ marginBottom: '1.25rem' }}>
        <div className="pf-kpi pf-kpi--gold pf-kpi--shimmer">
          <span className="pf-kpi__eyebrow">Customers with balance</span>
          <p className="pf-kpi__value">{rows.length}</p>
          <span className="pf-kpi__hint">Non-zero fractional vaults here</span>
        </div>
        <div className="pf-kpi pf-kpi--ocean pf-kpi--pulse">
          <span className="pf-kpi__eyebrow">Total vaulted (custody)</span>
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
          No customer vault balances here yet. Completed counter purchases, verified gold deposits, or scheme credits will appear
          after they post to the ledger.
        </p>
      ) : (
        <div className="jeweller-vault-customer-grid pf-stagger">
          {rows.map((v) => (
            <article key={`cust-${v.customer_id}`} className="pf-card pf-card--lift pf-card--wide jeweller-vault-customer-card">
              <header className="jeweller-vault-customer-card__head">
                <div>
                  <h3 className="pf-card__title jeweller-vault-customer-card__title">{v.customer_label || 'Customer'}</h3>
                  <p className="pf-card__meta" style={{ marginTop: '0.35rem' }}>
                    Member ID <span className="tabular">{v.customer_member_id?.trim() ? v.customer_member_id : '—'}</span>
                  </p>
                </div>
                <div className="jeweller-vault-customer-card__grams">
                  <p className="jeweller-vault-customer-card__grams-label">Total vault</p>
                  <p className="jeweller-vault-customer-card__grams-value tabular">
                    {parseG(v.vault_total_grams ?? v.fractional_grams).toFixed(6)} g
                  </p>
                </div>
              </header>
              <p className="jeweller-vault-customer-card__meta-line" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Fractional <span className="tabular">{v.fractional_grams} g</span>
                {parseG(v.deposit_grams ?? '0') > 0 || (v.deposit_grams && v.deposit_grams !== '0') ? (
                  <>
                    {' · '}Deposit <span className="tabular">{v.deposit_grams ?? '0'} g</span>
                  </>
                ) : null}
                {parseG(v.golden_scheme_grams ?? '0') > 0 || (v.golden_scheme_grams && v.golden_scheme_grams !== '0') ? (
                  <>
                    {' · '}Scheme <span className="tabular">{v.golden_scheme_grams ?? '0'} g</span>
                  </>
                ) : null}
              </p>
              <p className="jeweller-vault-customer-card__value-line">
                Est. value{' '}
                <strong className="tabular jeweller-vault-customer-card__inr">
                  ₹
                  {parseG(v.estimated_total_vault_value_inr ?? v.estimated_fractional_value_inr ?? '0').toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </strong>{' '}
                @ ₹
                {parseG(v.jeweller_metal_rate_inr_per_gram ?? '0').toLocaleString('en-IN', {
                  maximumFractionDigits: 2,
                })}
                /g
              </p>

              <section className="jeweller-vault-ledger-inline" aria-label="Transaction ledger">
                <div className="jeweller-vault-ledger-inline__head">
                  <h4 className="jeweller-vault-ledger-inline__title">Transaction ledger</h4>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={expandedLedgerIds.includes(v.customer_id)}
                    onClick={() => toggleLedger(v.customer_id)}
                  >
                    {expandedLedgerIds.includes(v.customer_id) ? 'Hide' : 'View ledger'}
                  </button>
                </div>
                {expandedLedgerIds.includes(v.customer_id) ? (
                  <div className="jeweller-vault-ledger-inline__body">
                    {(() => {
                      const st = ledgerByCustomer[v.customer_id] ?? { status: 'idle' as const }
                      if (st.status === 'idle' || st.status === 'loading') {
                        return (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Loading ledger…
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
                      return <JewellerVaultLedgerTable payload={st.data} />
                    })()}
                  </div>
                ) : null}
              </section>
            </article>
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
