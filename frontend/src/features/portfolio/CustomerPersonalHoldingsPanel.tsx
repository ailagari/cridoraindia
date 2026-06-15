import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import { FileUploadTrigger, type FileUploadTriggerPhase } from '@/components/ui'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { InvoiceImportFlow } from '@/features/portfolio/InvoiceImportFlow'
import {
  createPersonalHolding,
  deletePersonalDocument,
  deletePersonalHolding,
  derivePurchasePricePerGram,
  describePersonalVaultCostSummary,
  fetchPersonalHoldings,
  PERSONAL_VAULT_GST_ON_GOLD_PERCENT,
  PERSONAL_VAULT_GST_ON_MAKING_PERCENT,
  fetchPersonalVaultDocuments,
  isGoldRateDerivedFromBill,
  openPersonalDocumentDownload,
  purchaseValueFromHolding,
  recalcRateFromBillOrValue,
  updatePersonalHolding,
  uploadPersonalDocument,
  type PersonalDocumentDTO,
  type PersonalHoldingDTO,
} from '@/lib/personalHoldingsApi'

function parseN(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function weightsMatch(a: string, b: string): boolean {
  const na = parseN(a)
  const nb = parseN(b)
  return na > 0 && nb > 0 && Math.abs(na - nb) < 0.000001
}

const CATS = [
  { v: 'ornament', l: 'Ornament' },
  { v: 'coin', l: 'Coin' },
  { v: 'bar', l: 'Bar' },
  { v: 'other', l: 'Other' },
]

const VAULT_PAGE_SIZE = 10

const DOC_TYPES = [
  { v: 'purchase_invoice', l: 'Purchase invoice' },
  { v: 'gold_certificate', l: 'Gold certificate' },
  { v: 'purity_certificate', l: 'Purity certificate' },
  { v: 'valuation_document', l: 'Valuation' },
  { v: 'warranty_card', l: 'Warranty' },
  { v: 'product_image', l: 'Product photo' },
  { v: 'other', l: 'Other' },
]

function formatLedgerType(t: string): string {
  switch (t) {
    case 'purchase_invoice':
      return 'Purchase invoice'
    default:
      return t.replace(/_/g, ' ')
  }
}

function categoryLabel(slug: string): string {
  return CATS.find((c) => c.v === slug)?.l ?? slug
}

function jewellerSuggestLabel(j: JewellerStorefrontDTO): string {
  const name = j.business_name.trim()
  const city = j.city.trim()
  const state = j.state.trim()
  if (!name) return ''
  if (city && state) return `${name}, ${city}, ${state}`
  if (city) return `${name}, ${city}`
  if (state) return `${name}, ${state}`
  return name
}

function PurchaseSourceJewellerField({
  value,
  onChange,
  disabled,
  jewellers,
  className,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  jewellers: JewellerStorefrontDTO[]
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const listId = `cridora-jeweller-src-${uid}`

  const options = useMemo(() => {
    const rows: { id: number; label: string }[] = []
    for (const j of jewellers) {
      const label = jewellerSuggestLabel(j)
      if (!label) continue
      rows.push({ id: j.id, label })
    }
    rows.sort((a, b) => a.label.localeCompare(b.label))
    return rows
  }, [jewellers])

  const inputCls = className ?? 'input pf-vault-form__input'

  return (
    <>
      <input
        className={inputCls}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jeweller or shop — suggestions from verified Cridora partners"
        autoComplete="off"
        disabled={disabled}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
    </>
  )
}

export function CustomerPersonalHoldingsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<PersonalHoldingDTO[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [addFormError, setAddFormError] = useState('')
  const [addFormSuccess, setAddFormSuccess] = useState('')
  const [editFormError, setEditFormError] = useState('')
  const [editFormSuccess, setEditFormSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [editBusy, setEditBusy] = useState(false)
  const submitInFlightRef = useRef(false)

  const [formOpen, setFormOpen] = useState(false)
  const [invoiceImportOpen, setInvoiceImportOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('ornament')
  const [weight, setWeight] = useState('')
  const [purity, setPurity] = useState('BIS 916')
  const [purchasePricePerGram, setPurchasePricePerGram] = useState('')
  const [purchaseValue, setPurchaseValue] = useState('')
  const [makingChargePercent, setMakingChargePercent] = useState('')
  const [purchaseSource, setPurchaseSource] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')
  const [approvedJewellers, setApprovedJewellers] = useState<JewellerStorefrontDTO[]>([])

  const [vaultPage, setVaultPage] = useState(1)
  const [vaultOpenIds, setVaultOpenIds] = useState<Set<number>>(() => new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eCategory, setECategory] = useState('ornament')
  const [eWeight, setEWeight] = useState('')
  const [ePurity, setEPurity] = useState('')
  const [ePurchasePrice, setEPurchasePrice] = useState('')
  const [ePurchaseValue, setEPurchaseValue] = useState('')
  const [eMakingChargePercent, setEMakingChargePercent] = useState('')
  const [ePurchaseSource, setEPurchaseSource] = useState('')
  const [ePurchaseDate, setEPurchaseDate] = useState('')
  const [eNotes, setENotes] = useState('')

  const addCostSummaryHint = useMemo(
    () =>
      describePersonalVaultCostSummary(
        weight,
        purchasePricePerGram,
        purchaseValue,
        makingChargePercent,
      ),
    [weight, purchasePricePerGram, purchaseValue, makingChargePercent],
  )
  const addRateFromBill = isGoldRateDerivedFromBill(weight, purchaseValue)
  const editRateFromBill = isGoldRateDerivedFromBill(eWeight, ePurchaseValue)

  const refresh = useCallback(async (): Promise<PersonalHoldingDTO[]> => {
    setLoadErr('')
    const r = await fetchPersonalHoldings({ documents: true })
    if (!r) {
      setLoadErr('Could not load personal holdings.')
      setRows([])
      return []
    }
    const list = r.results ?? []
    setRows(list)
    return list
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const totalVaultPages = Math.max(1, Math.ceil(rows.length / VAULT_PAGE_SIZE))
  const pageRows = useMemo(() => {
    const start = (vaultPage - 1) * VAULT_PAGE_SIZE
    return rows.slice(start, start + VAULT_PAGE_SIZE)
  }, [rows, vaultPage])

  useEffect(() => {
    setVaultPage((p) => {
      const max = Math.max(1, Math.ceil(rows.length / VAULT_PAGE_SIZE))
      if (p < 1) return 1
      if (p > max) return max
      return p
    })
  }, [rows.length])

  useEffect(() => {
    const start = (vaultPage - 1) * VAULT_PAGE_SIZE
    const allowed = new Set(rows.slice(start, start + VAULT_PAGE_SIZE).map((r) => r.id))
    setVaultOpenIds((prev) => {
      const n = new Set<number>()
      for (const id of prev) {
        if (allowed.has(id)) n.add(id)
      }
      return n
    })
  }, [vaultPage, rows])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await fetchVerifiedJewellers()
      if (!cancelled) {
        setApprovedJewellers(Array.isArray(list) ? list : [])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!addFormSuccess) return
    const t = window.setTimeout(() => setAddFormSuccess(''), 7000)
    return () => window.clearTimeout(t)
  }, [addFormSuccess])

  useEffect(() => {
    if (!editFormSuccess) return
    const t = window.setTimeout(() => setEditFormSuccess(''), 7000)
    return () => window.clearTimeout(t)
  }, [editFormSuccess])

  const openEdit = (h: PersonalHoldingDTO) => {
    const idx = rows.findIndex((r) => r.id === h.id)
    if (idx >= 0) {
      setVaultPage(Math.floor(idx / VAULT_PAGE_SIZE) + 1)
    }
    setVaultOpenIds((prev) => new Set(prev).add(h.id))
    setEditingId(h.id)
    setETitle(h.title)
    setECategory(h.category)
    setEWeight(h.weight_grams)
    setEPurity(h.purity)
    setEPurchasePrice(h.purchase_price_inr_per_gram ?? '')
    setEPurchaseValue(purchaseValueFromHolding(h))
    setEMakingChargePercent(h.making_charge_percent ?? '')
    setEPurchaseSource(h.purchase_source)
    setEPurchaseDate(h.purchase_date?.slice(0, 10) ?? '')
    setENotes(h.notes)
    setLoadErr('')
    setEditFormError('')
    setEditFormSuccess('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditFormError('')
    setEditFormSuccess('')
  }

  const resetAddFormFields = () => {
    setTitle('')
    setWeight('')
    setNotes('')
    setPurchaseSource('')
    setPurchaseDate('')
    setPurchasePricePerGram('')
    setPurchaseValue('')
    setMakingChargePercent('')
    setCategory('ornament')
    setPurity('BIS 916')
  }

  const finishAddSuccess = async (label: string, newId?: number) => {
    resetAddFormFields()
    setFormOpen(false)
    setVaultOpenIds(new Set())
    setAddFormError('')
    setAddFormSuccess(
      `“${label}” was saved to your vault. Open a card below to attach invoices or photos.`,
    )
    const list = await refresh()
    if (newId != null) {
      const refreshedIdx = list.findIndex((r) => r.id === newId)
      if (refreshedIdx >= 0) {
        setVaultPage(Math.floor(refreshedIdx / VAULT_PAGE_SIZE) + 1)
      }
    }
    onChanged?.()
  }

  const saveEdit = async () => {
    if (editingId == null) return
    setEditBusy(true)
    setLoadErr('')
    try {
      const res = await updatePersonalHolding(editingId, {
        title: eTitle.trim(),
        category: eCategory,
        weight_grams: eWeight.trim(),
        purity: ePurity.trim() || 'BIS 916',
        purchase_source: ePurchaseSource.trim(),
        purchase_date: ePurchaseDate.trim() || null,
        purchase_price_inr_per_gram:
          derivePurchasePricePerGram(eWeight, ePurchasePrice, ePurchaseValue, eMakingChargePercent)?.trim() ??
          null,
        making_charge_percent: eMakingChargePercent.trim() ? eMakingChargePercent.trim() : null,
        notes: eNotes.trim(),
      })
      if (!res.ok) {
        setEditFormError(res.detail)
        return
      }
      const savedId = editingId
      const label = res.data?.title?.trim() || eTitle.trim() || 'Record'
      setEditFormError('')
      setEditFormSuccess(`“${label}” was updated.`)
      await refresh()
      onChanged?.()
      window.setTimeout(() => {
        setEditingId((cur) => (cur === savedId ? null : cur))
        setVaultOpenIds((prev) => {
          const n = new Set(prev)
          n.delete(savedId)
          return n
        })
        setEditFormSuccess('')
      }, 1800)
    } catch {
      setEditFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setEditBusy(false)
    }
  }

  const submit = async () => {
    if (submitInFlightRef.current || busy) return
    submitInFlightRef.current = true
    setAddFormError('')
    setAddFormSuccess('')
    setBusy(true)
    const payload = {
      title: title.trim(),
      category,
      weight_grams: weight.trim(),
      purity: purity.trim() || 'BIS 916',
      purchase_source: purchaseSource.trim() || undefined,
      purchase_date: purchaseDate.trim() || undefined,
      purchase_price_inr_per_gram:
        derivePurchasePricePerGram(weight, purchasePricePerGram, purchaseValue, makingChargePercent) ||
        undefined,
      making_charge_percent: makingChargePercent.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      const res = await createPersonalHolding(payload)
      if (!res.ok) {
        const snapshot = await fetchPersonalHoldings({ documents: true })
        const recovered = snapshot?.results?.find(
          (h) =>
            h.title === payload.title &&
            h.category === payload.category &&
            weightsMatch(h.weight_grams, payload.weight_grams),
        )
        if (recovered && snapshot) {
          setRows(snapshot.results ?? [])
          await finishAddSuccess(recovered.title, recovered.id)
          return
        }
        setAddFormError(res.detail)
        return
      }
      const label = res.data?.title?.trim() || payload.title || 'Record'
      const newId = res.data?.id
      await finishAddSuccess(label, newId)
    } catch {
      setAddFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
      submitInFlightRef.current = false
    }
  }

  const removeHolding = async (id: number) => {
    if (!window.confirm('Remove this personal holding from your vault?')) return
    const r = await deletePersonalHolding(id)
    if (!r.ok) {
      setLoadErr(r.detail)
      return
    }
    if (editingId === id) setEditingId(null)
    setVaultOpenIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
    void refresh()
    onChanged?.()
  }

  const removeDoc = async (holdingId: number, docId: number) => {
    if (!window.confirm('Delete this document?')) return false
    const r = await deletePersonalDocument(holdingId, docId)
    if (!r.ok) {
      setLoadErr(r.detail)
      return false
    }
    void refresh()
    onChanged?.()
    return true
  }

  return (
    <div>
      <div className="pf-vault-hero pf-vault-hero--bar">
        <div className="pf-vault-hero__text">
          <span className="pf-vault-hero__eyebrow">Personal vault</span>
          <h3 className="pf-vault-hero__title">Gold Records Vault</h3>
          <p className="pf-vault-hero__sub">
            Your physical gold wealth, organised — bills, certificates, and live reference value. MVP is{' '}
            <strong>tracking &amp; records only</strong> (not redeemable or transferable on Cridora).
          </p>
          {rows.length > 0 ? (
            <p className="pf-vault-hero__stat">
              <span className="pf-vault-hero__stat-num tabular">{rows.length}</span>{' '}
              {rows.length === 1 ? 'piece' : 'pieces'} in this vault
            </p>
          ) : (
            <p className="pf-vault-hero__stat pf-vault-hero__stat--empty">Start by adding your first piece.</p>
          )}
        </div>
        <div className="pf-vault-hero__actions">
          <button
            type="button"
            className={
              invoiceImportOpen ? 'pf-vault-hero__cta pf-vault-hero__cta--muted' : 'pf-vault-hero__cta pf-vault-hero__cta--muted'
            }
            aria-expanded={invoiceImportOpen}
            aria-controls="pf-vault-invoice-import"
            onClick={() => {
              setInvoiceImportOpen((o) => {
                const next = !o
                if (next) {
                  setFormOpen(false)
                  setAddFormSuccess('')
                  setAddFormError('')
                  setLoadErr('')
                }
                return next
              })
            }}
          >
            {invoiceImportOpen ? 'Close import' : 'Import from invoice'}
          </button>
          <button
            type="button"
            className={formOpen ? 'pf-vault-hero__cta pf-vault-hero__cta--muted' : 'pf-vault-hero__cta'}
            aria-expanded={formOpen}
            aria-controls="pf-vault-add-form"
            onClick={() =>
              setFormOpen((o) => {
                const next = !o
                if (next) {
                  setInvoiceImportOpen(false)
                  setAddFormSuccess('')
                  setAddFormError('')
                  setLoadErr('')
                }
                return next
              })
            }
          >
            {formOpen ? (
              <>
                <span className="pf-vault-hero__cta-icon pf-vault-hero__cta-icon--close" aria-hidden>
                  ×
                </span>
                Close form
              </>
            ) : (
              <>
                <span className="pf-vault-hero__cta-icon" aria-hidden>
                  +
                </span>
                Add personal holding
              </>
            )}
          </button>
        </div>
      </div>

      {loadErr ? (
        <p className="form-error" role="alert">
          {loadErr}
        </p>
      ) : null}
      <InvoiceImportFlow
        open={invoiceImportOpen}
        onClose={() => setInvoiceImportOpen(false)}
        jewellers={approvedJewellers}
        onCreated={async (holding) => {
          setInvoiceImportOpen(false)
          await finishAddSuccess(holding.title, holding.id)
        }}
      />
      {formOpen ? (
        <form
          className="pf-vault-form"
          id="pf-vault-add-form"
          aria-labelledby="pf-vault-form-title"
          aria-busy={busy}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <header className="pf-vault-form__header">
            <span className="pf-vault-form__eyebrow">New record</span>
            <h4 id="pf-vault-form-title" className="pf-vault-form__title">
              Add to your vault
            </h4>
            <p className="pf-vault-form__lede">
              Capture what you own. Estimated value updates from the platform <strong className="tabular">22K</strong> reference rate — jeweller marks
              are not used for personal items.
            </p>
          </header>

          <div className="pf-vault-form__sections">
            <section className="pf-vault-form__section" aria-labelledby="pf-vault-section-item">
              <h5 id="pf-vault-section-item" className="pf-vault-form__section-title">
                Item
              </h5>
              <p className="pf-vault-form__section-hint">A clear name helps you find it in your vault later.</p>
              <label className="pf-vault-field">
                <span>Display title</span>
                <input
                  className="input pf-vault-form__input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Wedding necklace, BIS coin set…"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <div className="pf-vault-field">
                <span id="pf-vault-cat-label">Category</span>
                <div className="pf-vault-form__chips" role="group" aria-labelledby="pf-vault-cat-label">
                  {CATS.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      className={`pf-vault-form__chip${category === c.v ? ' pf-vault-form__chip--active' : ''}`}
                      aria-pressed={category === c.v}
                      onClick={() => setCategory(c.v)}
                      disabled={busy}
                    >
                      {c.l}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="pf-vault-form__section pf-vault-form__section--metal" aria-labelledby="pf-vault-section-metal">
              <h5 id="pf-vault-section-metal" className="pf-vault-form__section-title">
                Metal details
              </h5>
              <p className="pf-vault-form__section-hint">
                Know your bill? Enter <strong>weight</strong>, <strong>total paid</strong>, and <strong>making charge
                %</strong> if you have it. GST is applied automatically — {PERSONAL_VAULT_GST_ON_GOLD_PERCENT}% on gold
                metal and {PERSONAL_VAULT_GST_ON_MAKING_PERCENT}% on making charges (same as Cridora marketplace).
              </p>
              <div className="pf-vault-form__metal-grid">
                <label className="pf-vault-field">
                  <span>Weight</span>
                  <div className="pf-vault-form__suffix-wrap">
                    <input
                      className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
                      value={weight}
                      onChange={(e) => {
                        const next = e.target.value
                        setWeight(next)
                        const synced = recalcRateFromBillOrValue(
                          next,
                          purchasePricePerGram,
                          purchaseValue,
                          makingChargePercent,
                        )
                        setPurchasePricePerGram(synced.rate)
                        setPurchaseValue(synced.value)
                      }}
                      inputMode="decimal"
                      placeholder="0.000"
                      autoComplete="off"
                      disabled={busy}
                    />
                    <span className="pf-vault-form__suffix" aria-hidden>
                      g
                    </span>
                  </div>
                </label>
                <label className="pf-vault-field">
                  <span>Purity / hallmark</span>
                  <input
                    className="input pf-vault-form__input"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value)}
                    placeholder="BIS 916"
                    disabled={busy}
                  />
                </label>
                <label className="pf-vault-field">
                  <span>Total purchase value (₹, optional)</span>
                  <input
                    className="input pf-vault-form__input tabular"
                    value={purchaseValue}
                    onChange={(e) => {
                      const next = e.target.value
                      const synced = recalcRateFromBillOrValue(
                        weight,
                        purchasePricePerGram,
                        next,
                        makingChargePercent,
                      )
                      setPurchaseValue(synced.value)
                      setPurchasePricePerGram(synced.rate)
                    }}
                    inputMode="decimal"
                    placeholder="Total bill amount"
                    disabled={busy}
                  />
                </label>
                <label className="pf-vault-field">
                  <span>Making charge % (optional)</span>
                  <div className="pf-vault-form__suffix-wrap">
                    <input
                      className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
                      value={makingChargePercent}
                      onChange={(e) => {
                        const next = e.target.value
                        setMakingChargePercent(next)
                        const synced = recalcRateFromBillOrValue(
                          weight,
                          purchasePricePerGram,
                          purchaseValue,
                          next,
                        )
                        setPurchasePricePerGram(synced.rate)
                        setPurchaseValue(synced.value)
                      }}
                      inputMode="decimal"
                      placeholder="e.g. 12 — GST added automatically"
                      disabled={busy}
                    />
                    <span className="pf-vault-form__suffix" aria-hidden>
                      %
                    </span>
                  </div>
                </label>
                <label className="pf-vault-field pf-vault-field--wide">
                  <span>{addRateFromBill ? 'Gold rate (₹/g, calculated)' : 'Gold rate (₹/g, optional)'}</span>
                  <input
                    className="input pf-vault-form__input tabular"
                    value={purchasePricePerGram}
                    onChange={(e) => {
                      const next = e.target.value
                      const synced = recalcRateFromBillOrValue(weight, next, '', makingChargePercent)
                      setPurchasePricePerGram(synced.rate)
                      setPurchaseValue(synced.value)
                    }}
                    readOnly={addRateFromBill}
                    inputMode="decimal"
                    placeholder={addRateFromBill ? 'Calculated from bill' : 'If you know the gold rate'}
                    disabled={busy}
                    aria-readonly={addRateFromBill}
                  />
                </label>
              </div>
              {addCostSummaryHint ? (
                <p className="pf-vault-form__section-hint pf-vault-form__derived-rate" role="status">
                  {addCostSummaryHint}
                </p>
              ) : null}
            </section>

            <section className="pf-vault-form__section pf-vault-form__section--full" aria-labelledby="pf-vault-section-prov">
              <h5 id="pf-vault-section-prov" className="pf-vault-form__section-title">
                Optional provenance
              </h5>
              <p className="pf-vault-form__section-hint">
                Where you bought it and when — useful with invoices on the same card. Start typing a jeweller name to see{' '}
                <strong>verified Cridora partners</strong>; you can still enter any shop or text.
              </p>
              <div className="pf-vault-form__grid pf-vault-form__grid--prov">
                <label className="pf-vault-field">
                  <span>Jeweller / shop</span>
                  <PurchaseSourceJewellerField
                    value={purchaseSource}
                    onChange={setPurchaseSource}
                    disabled={busy}
                    jewellers={approvedJewellers}
                  />
                </label>
                <label className="pf-vault-field">
                  <span>Purchase date</span>
                  <input
                    className="input pf-vault-form__input"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="pf-vault-field pf-vault-field--wide">
                  <span>Private notes</span>
                  <textarea
                    className="input pf-vault-form__textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Engraving, locker ID, reminder for valuation…"
                    disabled={busy}
                  />
                </label>
              </div>
            </section>
          </div>

          {busy ? (
            <p className="pf-vault-form__saving" role="status" aria-live="polite">
              Saving to your vault…
            </p>
          ) : null}

          <footer className="pf-vault-form__footer">
            <p className="pf-vault-form__mvp">
              <span className="pf-vault-form__mvp-tag">MVP</span> Tracking &amp; records only — not redeemable or transferable on Cridora.
            </p>
            <FormSubmitFoot error={addFormError} success={addFormSuccess} className="pf-vault-form__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setFormOpen(false)
                  setAddFormError('')
                  setAddFormSuccess('')
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary pf-vault-form__submit"
                disabled={busy || !title.trim() || !weight.trim()}
              >
                {busy ? 'Saving…' : 'Add to vault'}
              </button>
            </FormSubmitFoot>
          </footer>
        </form>
      ) : null}
      {!formOpen && addFormSuccess ? (
        <p className="form-feedback form-feedback--success pf-vault-save-flash pf-vault-save-flash--hero" role="status">
          {addFormSuccess}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No personal holdings yet. Add your first piece to see live reference value.</p>
      ) : (
        <div className="pf-vault-holdings">
          <div className="pf-vault-acc-list" role="list">
            {pageRows.map((h) => {
              const accOpen = vaultOpenIds.has(h.id)
              const accPanelId = `pf-vault-acc-panel-${h.id}`
              const accLabelId = `pf-vault-acc-label-${h.id}`
              return (
                <div key={h.id} className="pf-vault-acc card" role="listitem">
                  <button
                    type="button"
                    className="pf-vault-acc__trigger"
                    id={accLabelId}
                    aria-expanded={accOpen}
                    aria-controls={accPanelId}
                    onClick={() => {
                      setVaultOpenIds((prev) => {
                        const n = new Set(prev)
                        if (n.has(h.id)) n.delete(h.id)
                        else n.add(h.id)
                        return n
                      })
                    }}
                  >
                    <span className="pf-vault-acc__trigger-main">
                      <span className="pf-vault-acc__title">{h.title}</span>
                      <span className="pf-vault-acc__meta">
                        {categoryLabel(h.category)}
                        <span aria-hidden="true"> · </span>
                        <span className="tabular">{h.weight_grams} g</span>
                        <span aria-hidden="true"> · </span>
                        {h.purity}
                        <span aria-hidden="true"> · </span>
                        <span className="tabular pf-vault-acc__est">
                          ₹{parseN(h.estimated_current_value_inr).toLocaleString('en-IN')}
                        </span>
                        <span className="pf-vault-acc__est-hint"> ref. est.</span>
                      </span>
                      {h.reference_gain_percent ? (
                        <span
                          className={`pf-vault-acc__gain${parseN(h.reference_gain_inr) < 0 ? ' pf-vault-acc__gain--down' : ''}`}
                        >
                          {parseN(h.reference_gain_inr) >= 0 ? '+' : ''}
                          {parseN(h.reference_gain_inr).toLocaleString('en-IN')} ({h.reference_gain_percent}%)
                        </span>
                      ) : null}
                      {h.purchase_price_inr_per_gram ? (
                        <span className="pf-vault-acc__basis">
                          ₹{parseN(h.purchase_price_inr_per_gram).toLocaleString('en-IN')}/g · metal ~₹
                          {parseN(h.purchase_cost_basis_inr).toLocaleString('en-IN')}
                          {h.making_charge_percent ? (
                            <>
                              {' '}
                              · MC {parseN(h.making_charge_percent).toLocaleString('en-IN')}%
                            </>
                          ) : null}
                        </span>
                      ) : null}
                      {h.purchase_jeweller_label ? (
                        <span className="pf-vault-acc__src">{h.purchase_jeweller_label}</span>
                      ) : h.purchase_source ? (
                        <span className="pf-vault-acc__src">{h.purchase_source}</span>
                      ) : null}
                    </span>
                    <span className="pf-vault-acc__trigger-side">
                      {h.is_cridorapay ? (
                        <span className="pf-vault-badge pf-vault-badge--verified">CridoraPay</span>
                      ) : null}
                      <span className={`pf-vault-badge pf-vault-badge--${h.verification_status}`}>{h.status_badge}</span>
                      <span className="pf-vault-acc__doc-count">
                        {h.document_count} doc{h.document_count === 1 ? '' : 's'}
                      </span>
                      <span className={`pf-vault-acc__chev${accOpen ? ' pf-vault-acc__chev--open' : ''}`} aria-hidden>
                        ▼
                      </span>
                    </span>
                  </button>
                  {accOpen ? (
                    <div
                      className="pf-vault-acc__panel"
                      id={accPanelId}
                      role="region"
                      aria-labelledby={accLabelId}
                    >
                      <div className="pf-vault-acc__toolbar">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(h)}
                          disabled={editingId === h.id}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeHolding(h.id)}>
                          Remove
                        </button>
                      </div>
                      {editingId === h.id ? (
                        <div className="pf-vault-edit" aria-busy={editBusy}>
                          <h5 className="pf-vault-form__section-title">Edit holding</h5>
                          <div className="pf-vault-form__grid">
                            <label className="pf-vault-field">
                              <span>Title</span>
                              <input className="input" value={eTitle} onChange={(e) => setETitle(e.target.value)} disabled={editBusy} />
                            </label>
                            <label className="pf-vault-field">
                              <span>Category</span>
                              <select className="input" value={eCategory} onChange={(e) => setECategory(e.target.value)} disabled={editBusy}>
                                {CATS.map((c) => (
                                  <option key={c.v} value={c.v}>
                                    {c.l}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="pf-vault-field">
                              <span>Weight (g)</span>
                              <input
                                className="input tabular"
                                value={eWeight}
                                onChange={(e) => {
                                  const next = e.target.value
                                  setEWeight(next)
                                  const synced = recalcRateFromBillOrValue(
                                    next,
                                    ePurchasePrice,
                                    ePurchaseValue,
                                    eMakingChargePercent,
                                  )
                                  setEPurchasePrice(synced.rate)
                                  setEPurchaseValue(synced.value)
                                }}
                                disabled={editBusy}
                              />
                            </label>
                            <label className="pf-vault-field">
                              <span>Purity</span>
                              <input className="input" value={ePurity} onChange={(e) => setEPurity(e.target.value)} disabled={editBusy} />
                            </label>
                            <label className="pf-vault-field">
                              <span>Total purchase value (₹, optional)</span>
                              <input
                                className="input tabular"
                                value={ePurchaseValue}
                                onChange={(e) => {
                                  const synced = recalcRateFromBillOrValue(
                                    eWeight,
                                    ePurchasePrice,
                                    e.target.value,
                                    eMakingChargePercent,
                                  )
                                  setEPurchaseValue(synced.value)
                                  setEPurchasePrice(synced.rate)
                                }}
                                placeholder="Total bill amount"
                                disabled={editBusy}
                              />
                            </label>
                            <label className="pf-vault-field">
                              <span>Making charge % (optional)</span>
                              <input
                                className="input tabular"
                                value={eMakingChargePercent}
                                onChange={(e) => {
                                  const next = e.target.value
                                  setEMakingChargePercent(next)
                                  const synced = recalcRateFromBillOrValue(
                                    eWeight,
                                    ePurchasePrice,
                                    ePurchaseValue,
                                    next,
                                  )
                                  setEPurchasePrice(synced.rate)
                                  setEPurchaseValue(synced.value)
                                }}
                                placeholder="e.g. 12 — GST added automatically"
                                disabled={editBusy}
                              />
                            </label>
                            <label className="pf-vault-field">
                              <span>{editRateFromBill ? 'Gold rate (₹/g, calculated)' : 'Gold rate (₹/g, optional)'}</span>
                              <input
                                className="input tabular"
                                value={ePurchasePrice}
                                onChange={(e) => {
                                  const synced = recalcRateFromBillOrValue(
                                    eWeight,
                                    e.target.value,
                                    '',
                                    eMakingChargePercent,
                                  )
                                  setEPurchasePrice(synced.rate)
                                  setEPurchaseValue(synced.value)
                                }}
                                readOnly={editRateFromBill}
                                placeholder={editRateFromBill ? 'Calculated from bill' : 'If you know the gold rate'}
                                disabled={editBusy}
                                aria-readonly={editRateFromBill}
                              />
                            </label>
                            <label className="pf-vault-field">
                              <span>Jeweller / shop</span>
                              <PurchaseSourceJewellerField
                                value={ePurchaseSource}
                                onChange={setEPurchaseSource}
                                disabled={editBusy}
                                jewellers={approvedJewellers}
                                className="input"
                              />
                            </label>
                            <label className="pf-vault-field">
                              <span>Purchase date</span>
                              <input
                                className="input"
                                type="date"
                                value={ePurchaseDate}
                                onChange={(e) => setEPurchaseDate(e.target.value)}
                                disabled={editBusy}
                              />
                            </label>
                            <label className="pf-vault-field pf-vault-field--wide">
                              <span>Notes</span>
                              <textarea className="input" rows={2} value={eNotes} onChange={(e) => setENotes(e.target.value)} disabled={editBusy} />
                            </label>
                          </div>
                          <FormSubmitFoot
                            error={editFormError}
                            success={editFormSuccess}
                            className="pf-vault-edit__actions"
                          >
                              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={editBusy}>
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={editBusy || !eTitle.trim() || !eWeight.trim()}
                                onClick={() => void saveEdit()}
                              >
                                {editBusy ? 'Saving…' : 'Save changes'}
                              </button>
                          </FormSubmitFoot>
                        </div>
                      ) : null}
                      <HoldingDocumentsPanel
                        documents={h.documents ?? []}
                        holdingId={h.id}
                        onDownload={(doc) => openPersonalDocumentDownload(h.id, doc.id)}
                        onDelete={async (doc) => removeDoc(h.id, doc.id)}
                        onChanged={() => {
                          void refresh()
                          onChanged?.()
                        }}
                        onError={(msg) => setLoadErr(msg)}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          {totalVaultPages > 1 ? (
            <nav className="pf-vault-pager" aria-label="Vault holdings pages">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={vaultPage <= 1}
                onClick={() => setVaultPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="pf-vault-pager__status">
                Page {vaultPage} of {totalVaultPages} ({rows.length} entries)
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={vaultPage >= totalVaultPages}
                onClick={() => setVaultPage((p) => Math.min(totalVaultPages, p + 1))}
              >
                Next
              </button>
            </nav>
          ) : null}
        </div>
      )}

    </div>

  )

}



function HoldingDocumentsPanel({

  documents,

  holdingId,

  onDownload,

  onDelete,

  onChanged,

  onError,

}: {

  documents: PersonalDocumentDTO[]

  holdingId: number

  onDownload: (doc: PersonalDocumentDTO) => void

  onDelete: (doc: PersonalDocumentDTO) => Promise<boolean>

  onChanged: () => void

  onError: (msg: string) => void

}) {

  const [docType, setDocType] = useState('purchase_invoice')

  const [feedback, setFeedback] = useState('')

  const [uploadPhase, setUploadPhase] = useState<FileUploadTriggerPhase>('idle')

  const [pickPreview, setPickPreview] = useState<{ url: string | null; name: string } | null>(null)

  const [replaceTarget, setReplaceTarget] = useState<PersonalDocumentDTO | null>(null)

  const fileGateBusy = uploadPhase === 'uploading' || uploadPhase === 'done'

  useEffect(() => {

    if (!feedback) return

    const t = window.setTimeout(() => setFeedback(''), 5000)

    return () => window.clearTimeout(t)

  }, [feedback])



  useEffect(() => {

    if (uploadPhase !== 'done' && uploadPhase !== 'error') return

    const ms = uploadPhase === 'done' ? 2200 : 4000

    const t = window.setTimeout(() => setUploadPhase('idle'), ms)

    return () => window.clearTimeout(t)

  }, [uploadPhase])



  const runUpload = async (file: File, type: string, replaceOf: PersonalDocumentDTO | null) => {

    let objectUrl: string | null = null

    if (file.type.startsWith('image/')) {

      objectUrl = URL.createObjectURL(file)

      setPickPreview({ url: objectUrl, name: file.name })

    } else {

      setPickPreview({ url: null, name: file.name })

    }

    setUploadPhase('uploading')

    setFeedback('')

    const fd = new FormData()

    fd.set('file', file)

    fd.set('document_type', type)

    try {

      const up = await uploadPersonalDocument(holdingId, fd)

      if (!up.ok) {

        onError(up.detail)

        setUploadPhase('error')

        return

      }

      if (replaceOf) {

        const del = await deletePersonalDocument(holdingId, replaceOf.id)

        if (!del.ok) {

          setFeedback(

            'New file is uploaded. We could not remove the old copy automatically — delete the duplicate file from the list if you still see it.',

          )

          setReplaceTarget(null)

          setUploadPhase('done')

          onChanged()

          return

        }

      }

      setFeedback(replaceOf ? 'File replaced.' : 'Uploaded.')

      setReplaceTarget(null)

      setUploadPhase('done')

      onChanged()

    } catch {

      onError('Could not reach the server.')

      setUploadPhase('error')

    } finally {

      if (objectUrl) URL.revokeObjectURL(objectUrl)

      setPickPreview(null)

    }

  }



  return (

    <div className="pf-vault-docs pf-vault-docs--inline">

      <div className="pf-vault-docs__head">

        <h5 className="pf-vault-form__section-title">Vault files</h5>

        {replaceTarget ? (

          <p className="pf-vault-docs__replace-hint" role="status">

            Replacing “{replaceTarget.original_filename || formatLedgerType(replaceTarget.document_type)}”. Choose a file below.

          </p>

        ) : null}

      </div>

      <p className="pf-vault-disclaimer">

        Cridora stores uploaded records for customer convenience and portfolio tracking only. They are not government-certified ownership

        proof.

      </p>

      {feedback ? (

        <p className="form-feedback form-feedback--success pf-vault-doc-feedback" role="status">

          {feedback}

        </p>

      ) : null}

      {pickPreview ? (

        <div className="ui-staging-preview" aria-live="polite">

          {pickPreview.url ? <img className="ui-staging-preview__thumb" src={pickPreview.url} alt="" /> : null}

          <p className="ui-staging-preview__meta">

            <strong>Selected:</strong> {pickPreview.name}

          </p>

        </div>

      ) : null}

      <div className="pf-vault-doc-add">

        <select className="input pf-vault-doc-add__type" value={docType} onChange={(e) => setDocType(e.target.value)} disabled={fileGateBusy}>

          {DOC_TYPES.map((d) => (

            <option key={d.v} value={d.v}>

              {d.l}

            </option>

          ))}

        </select>

        <FileUploadTrigger

          accept=".jpg,.jpeg,.png,.webp,.pdf"

          phase={uploadPhase}

          disabled={fileGateBusy}

          idleLabel={replaceTarget ? 'Choose replacement' : 'Upload file'}

          onFile={(f) => {

            const type = replaceTarget ? replaceTarget.document_type : docType

            void runUpload(f, type, replaceTarget)

          }}

        />

        {replaceTarget ? (

          <button type="button" className="btn btn-ghost btn-sm" disabled={fileGateBusy} onClick={() => setReplaceTarget(null)}>

            Cancel replace

          </button>

        ) : null}

      </div>

      {documents.length === 0 ? (

        <p className="pf-vault-docs__empty">No files yet — add invoices or photos here.</p>

      ) : (

        <ul className="pf-vault-doc-rows">

          {documents.map((d) => (

            <li key={d.id} className="pf-vault-doc-row">

              <div className="pf-vault-doc-row__main">

                <span className="pf-vault-doc-row__type">{formatLedgerType(d.document_type)}</span>

                <span className="pf-vault-doc-row__name">{d.original_filename || `File #${d.id}`}</span>

                <span className="pf-vault-doc-row__meta">{new Date(d.created_at).toLocaleDateString('en-IN')}</span>

                {d.invoice_number ? <span className="pf-vault-doc-row__meta">Invoice {d.invoice_number}</span> : null}

              </div>

              <div className="pf-vault-doc-row__actions">

                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDownload(d)}>

                  View

                </button>

                <button

                  type="button"

                  className="btn btn-ghost btn-sm"

                  disabled={fileGateBusy}

                  onClick={() => {

                    setReplaceTarget(d)

                    setDocType(d.document_type)

                    setFeedback('')

                  }}

                >

                  Change

                </button>

                <button

                  type="button"

                  className="btn btn-ghost btn-sm"

                  disabled={fileGateBusy}

                  onClick={() => void onDelete(d).then((ok) => ok && setFeedback('Removed.'))}

                >

                  Remove

                </button>

              </div>

            </li>

          ))}

        </ul>

      )}

    </div>

  )

}



export function CustomerVaultDocumentsTab() {

  const [rows, setRows] = useState<PersonalDocumentDTO[]>([])

  const [err, setErr] = useState('')



  const refresh = useCallback(async () => {

    setErr('')

    const r = await fetchPersonalVaultDocuments()

    if (!r) {

      setErr('Could not load documents.')

      setRows([])

      return

    }

    setRows(r.results ?? [])

  }, [])



  useEffect(() => {

    void refresh()

  }, [refresh])



  return (

    <div>

      <h3 className="pf-card__title" style={{ marginBottom: '0.35rem' }}>

        All vault documents

      </h3>

      <p className="pf-vault-disclaimer" style={{ marginBottom: '1rem' }}>

        Cridora stores uploaded records for customer convenience and portfolio tracking purposes only. Uploaded documents are not

        government-certified ownership proof.

      </p>

      {err ? <p className="form-error">{err}</p> : null}

      {rows.length === 0 ? (

        <p style={{ color: 'var(--text-muted)' }}>No documents yet.</p>

      ) : (

        <ul className="pf-vault-doc-grid">

          {rows.map((d) => (

            <li key={d.id} className="pf-vault-doc-card">

              <div className="pf-vault-doc-card__body">

                <span className="pf-vault-doc-type">{formatLedgerType(d.document_type)}</span>

                <span className="pf-vault-doc-name">{d.holding_title ?? 'Holding'}</span>

                <span className="pf-vault-doc-meta">{d.original_filename}</span>

                <span className="pf-vault-doc-meta">{new Date(d.created_at).toLocaleDateString('en-IN')}</span>

              </div>

              <div className="pf-vault-doc-actions">

                {d.holding_id != null ? (

                  <button

                    type="button"

                    className="btn btn-ghost btn-sm"

                    onClick={() => openPersonalDocumentDownload(d.holding_id!, d.id)}

                  >

                    View

                  </button>

                ) : null}

              </div>

            </li>

          ))}

        </ul>

      )}

    </div>

  )

}

