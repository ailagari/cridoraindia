import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  analyzeInvoice,
  buildPersonalVaultPurchasePayload,
  computeInvoiceItemMissingFields,
  createPersonalHolding,
  describePersonalVaultCostSummary,
  INVOICE_MISSING_FIELD_LABELS,
  uploadPersonalDocument,
  type InvoiceExtractDTO,
  type InvoiceExtractItemDTO,
  type InvoiceMissingField,
  type PersonalHoldingDTO,
} from '@/lib/personalHoldingsApi'
import { fetchPlatformBillingTax, resolveGstOnGoldPercent, resolveGstOnMakingPercent } from '@/lib/platformBillingTax'
import { normalizePersonalVaultPurity } from '@/lib/personalVaultPurity'
import {
  PersonalVaultPricingFields,
  type PersonalVaultPriceAnchor,
} from '@/features/portfolio/PersonalVaultPricingFields'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'

const CATS = [
  { v: 'ornament', l: 'Ornament' },
  { v: 'coin', l: 'Coin' },
  { v: 'bar', l: 'Bar' },
  { v: 'other', l: 'Other' },
]

const ACCEPT = 'image/*,application/pdf'

type FlowPhase = 'picking' | 'analyzing' | 'review' | 'creating' | 'done'

type ReviewItem = {
  key: string
  include: boolean
  title: string
  category: string
  weight: string
  purity: string
  purchasePricePerGram: string
  purchaseValue: string
  makingChargePercent: string
  priceAnchor: PersonalVaultPriceAnchor
  confidence: 'high' | 'medium' | 'low'
  missingFields: InvoiceMissingField[]
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

function reviewItemFromExtract(it: InvoiceExtractItemDTO, index: number): ReviewItem {
  const priceAnchor: PersonalVaultPriceAnchor =
    it.price_mode === 'total' || (it.purchase_total_inr && !it.purchase_price_inr_per_gram)
      ? 'total'
      : 'rate'
  return {
    key: `item-${index}-${it.title.slice(0, 24) || index}`,
    include: true,
    title: it.title,
    category: CATS.some((c) => c.v === it.category) ? it.category : 'other',
    weight: it.weight_grams,
    purity: normalizePersonalVaultPurity(it.purity),
    purchasePricePerGram: it.purchase_price_inr_per_gram ?? '',
    purchaseValue: it.purchase_total_inr ?? '',
    makingChargePercent: it.making_charge_percent ?? '',
    priceAnchor,
    confidence: it.confidence,
    missingFields: it.missing_fields.length
      ? it.missing_fields
      : computeInvoiceItemMissingFields(it),
  }
}

function refreshMissingFields(item: ReviewItem): ReviewItem {
  return {
    ...item,
    missingFields: computeInvoiceItemMissingFields({
      title: item.title,
      weight_grams: item.weight,
      purchase_price_inr_per_gram: item.purchasePricePerGram || null,
      purchase_total_inr: item.purchaseValue || null,
    }),
  }
}

function buildInvoiceDocumentForm(file: File, invoiceNum: string): FormData {
  const fd = new FormData()
  fd.set('file', file)
  fd.set('document_type', 'purchase_invoice')
  if (invoiceNum.trim()) {
    fd.set('invoice_number', invoiceNum.trim())
  }
  return fd
}

function missingFieldsMessage(fields: InvoiceMissingField[]): string {
  if (fields.length === 0) return ''
  const labels = fields.map((f) => INVOICE_MISSING_FIELD_LABELS[f])
  return `Please fill in: ${labels.join(', ')}.`
}

type InvoiceImportFlowProps = {
  open: boolean
  onClose: () => void
  onCreated: (holdings: PersonalHoldingDTO[]) => void
  jewellers?: JewellerStorefrontDTO[]
}

export function InvoiceImportFlow({
  open,
  onClose,
  onCreated,
  jewellers = [],
}: InvoiceImportFlowProps) {
  const isMobileLayout = usePublicLayoutMax767()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<'environment' | undefined>(undefined)
  const itemKeyRef = useRef(0)

  const [phase, setPhase] = useState<FlowPhase>('picking')
  const [error, setError] = useState('')
  const [notLegibleReason, setNotLegibleReason] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)

  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [purchaseSource, setPurchaseSource] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [billingTaxReady, setBillingTaxReady] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const activeItem = reviewItems[activeItemIndex] ?? null
  const includedItems = useMemo(
    () => reviewItems.filter((it) => it.include),
    [reviewItems],
  )

  const costSummaryHint = useMemo(
    () =>
      activeItem
        ? describePersonalVaultCostSummary(
            activeItem.weight,
            activeItem.purchasePricePerGram,
            activeItem.purchaseValue,
            activeItem.makingChargePercent,
          )
        : '',
    [activeItem, billingTaxReady],
  )

  const allMissingSummary = useMemo(() => {
    const lines: string[] = []
    includedItems.forEach((it, idx) => {
      if (it.missingFields.length > 0) {
        const label = it.title.trim() || `Item ${idx + 1}`
        lines.push(`${label}: ${missingFieldsMessage(it.missingFields)}`)
      }
    })
    return lines
  }, [includedItems])

  const canSave =
    includedItems.length > 0 &&
    includedItems.every(
      (it) =>
        it.title.trim() &&
        it.weight.trim() &&
        Number.parseFloat(it.weight) > 0,
    )

  const resetFlow = useCallback(() => {
    setPhase('picking')
    setError('')
    setNotLegibleReason('')
    setSourceFile(null)
    setReviewItems([])
    setActiveItemIndex(0)
    setPurchaseSource('')
    setPurchaseDate('')
    setInvoiceNumber('')
    setConfidence('medium')
    setSavedCount(0)
    itemKeyRef.current = 0
  }, [])

  useEffect(() => {
    if (!open) {
      resetFlow()
    }
  }, [open, resetFlow])

  useEffect(() => {
    void fetchPlatformBillingTax().then(() => setBillingTaxReady(true))
  }, [])

  const applyExtract = (data: InvoiceExtractDTO) => {
    itemKeyRef.current += 1
    const items = data.items.map((it, i) => reviewItemFromExtract(it, i))
    setReviewItems(items)
    setActiveItemIndex(0)
    setPurchaseSource(data.purchase_source)
    setPurchaseDate(data.purchase_date ?? '')
    setInvoiceNumber(data.invoice_number ?? '')
    setConfidence(data.confidence)
  }

  const updateActiveItem = (patch: Partial<ReviewItem>) => {
    setReviewItems((prev) =>
      prev.map((it, i) => {
        if (i !== activeItemIndex) return it
        return refreshMissingFields({ ...it, ...patch })
      }),
    )
  }

  const triggerFilePick = (capture?: 'environment') => {
    captureRef.current = capture
    const el = fileInputRef.current
    if (!el) return
    if (capture) {
      el.setAttribute('capture', capture)
    } else {
      el.removeAttribute('capture')
    }
    el.click()
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    setSourceFile(file)
    setError('')
    setNotLegibleReason('')
    setPhase('analyzing')
    try {
      const res = await analyzeInvoice(file)
      if (!res.ok) {
        if (res.notLegible) {
          setNotLegibleReason(res.reason ?? res.detail)
          setPhase('picking')
          return
        }
        setError(res.detail)
        setPhase('picking')
        return
      }
      applyExtract(res.data)
      setPhase('review')
    } catch {
      setError('Could not reach the server.')
      setPhase('picking')
    }
  }

  const confirmCreate = async () => {
    const toSave = reviewItems.filter((it) => it.include)
    if (toSave.length === 0) {
      setError('Select at least one item to save.')
      return
    }

    for (let i = 0; i < toSave.length; i += 1) {
      const it = toSave[i]
      if (!it.title.trim()) {
        setError(`Item ${i + 1}: title is required.`)
        setActiveItemIndex(reviewItems.indexOf(it))
        return
      }
      if (!it.weight.trim() || Number.parseFloat(it.weight) <= 0) {
        setError(`Item ${i + 1}: weight must be greater than zero.`)
        setActiveItemIndex(reviewItems.indexOf(it))
        return
      }
    }

    setError('')
    setPhase('creating')
    const createdHoldings: PersonalHoldingDTO[] = []

    try {
      for (let i = 0; i < toSave.length; i += 1) {
        const it = toSave[i]
        const purchase = buildPersonalVaultPurchasePayload(
          it.priceAnchor,
          it.weight,
          it.purchasePricePerGram,
          it.purchaseValue,
          it.makingChargePercent,
        )
        const created = await createPersonalHolding({
          title: it.title.trim(),
          category: it.category,
          weight_grams: it.weight.trim(),
          purity: normalizePersonalVaultPurity(it.purity),
          purchase_source: purchaseSource.trim() || undefined,
          purchase_date: purchaseDate.trim() || undefined,
          purchase_price_inr_per_gram: purchase.purchase_price_inr_per_gram,
          purchase_total_inr: purchase.purchase_total_inr ?? undefined,
          making_charge_percent: purchase.making_charge_percent ?? undefined,
        })
        if (!created.ok) {
          setError(`${it.title.trim() || `Item ${i + 1}`}: ${created.detail}`)
          setActiveItemIndex(reviewItems.indexOf(it))
          setPhase('review')
          return
        }
        if (created.data) {
          createdHoldings.push(created.data)
        }
      }

      if (sourceFile && createdHoldings.length > 0) {
        const attachFailures: string[] = []
        for (const holding of createdHoldings) {
          const up = await uploadPersonalDocument(
            holding.id,
            buildInvoiceDocumentForm(sourceFile, invoiceNumber),
          )
          if (!up.ok) {
            attachFailures.push(holding.title.trim() || `Item #${holding.id}`)
          }
        }
        if (attachFailures.length > 0) {
          setError(
            `${createdHoldings.length} item(s) saved, but invoice file could not be attached for: ${attachFailures.join(', ')}.`,
          )
          setPhase('review')
          onCreated(createdHoldings)
          return
        }
      }

      setSavedCount(createdHoldings.length)
      setPhase('done')
      onCreated(createdHoldings)
    } catch {
      setError('Could not reach the server.')
      setPhase('review')
    }
  }

  if (!open) {
    return null
  }

  const jewellerOptions = jewellers
    .map((j) => ({ id: j.id, label: jewellerSuggestLabel(j) }))
    .filter((o) => o.label)
    .sort((a, b) => a.label.localeCompare(b.label))

  const listId = `cridora-invoice-jeweller-${fileInputId.replace(/:/g, '')}`
  const busy = phase === 'analyzing' || phase === 'creating'
  const multiItem = reviewItems.length > 1

  return (
    <section
      className="pf-vault-form pf-vault-form--import"
      id="pf-vault-invoice-import"
      aria-labelledby="pf-vault-invoice-import-title"
      aria-busy={busy}
    >
      <header className="pf-vault-form__header">
        <span className="pf-vault-form__eyebrow">Smart import</span>
        <h4 id="pf-vault-invoice-import-title" className="pf-vault-form__title">
          Import from invoice
        </h4>
        <p className="pf-vault-form__lede">
          Upload a purchase bill photo, PDF, or screenshot. We read item tables and line details — you confirm before saving.
        </p>
        <button type="button" className="btn btn-ghost btn-sm pf-vault-form__close" onClick={onClose} disabled={busy}>
          Close
        </button>
      </header>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        className="ui-file-trigger__input"
        accept={ACCEPT}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ''
          void handleFile(f)
        }}
      />

      {phase === 'picking' ? (
        <div className="pf-vault-import-pick">
          {notLegibleReason ? (
            <p className="form-error" role="alert">
              {notLegibleReason} Please try a clearer photo or PDF.
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {isMobileLayout ? (
            <div className="pf-vault-import-pick__actions">
              <button
                type="button"
                className="pf-vault-import-pick__btn pf-vault-import-pick__btn--primary"
                onClick={() => triggerFilePick('environment')}
              >
                <span className="pf-vault-import-pick__btn-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 7h3l2-3h6l2 3h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </span>
                <span className="pf-vault-import-pick__btn-text">
                  <strong>Take photo</strong>
                  <span>Use your camera to capture the bill</span>
                </span>
              </button>
              <button
                type="button"
                className="pf-vault-import-pick__btn"
                onClick={() => triggerFilePick()}
              >
                <span className="pf-vault-import-pick__btn-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 3v12M7 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 19h16" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="pf-vault-import-pick__btn-text">
                  <strong>Upload file</strong>
                  <span>Photo or PDF from your gallery</span>
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pf-vault-import-pick__btn pf-vault-import-pick__btn--primary pf-vault-import-pick__btn--wide"
              onClick={() => triggerFilePick()}
            >
              <span className="pf-vault-import-pick__btn-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3v12M7 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 19h16" strokeLinecap="round" />
                </svg>
              </span>
              <span className="pf-vault-import-pick__btn-text">
                <strong>Choose invoice</strong>
                <span>Photo or PDF from your device</span>
              </span>
            </button>
          )}
          {sourceFile ? (
            <p className="ui-file-row__meta">Last file: {sourceFile.name}</p>
          ) : null}
        </div>
      ) : null}

      {phase === 'analyzing' ? (
        <p className="pf-vault-form__lede" role="status">
          Reading invoice…
        </p>
      ) : null}

      {phase === 'review' || phase === 'creating' ? (
        <form
          className="pf-vault-form__sections"
          onSubmit={(e) => {
            e.preventDefault()
            void confirmCreate()
          }}
        >
          {multiItem ? (
            <p className="pf-vault-form__section-hint" role="status">
              Found {reviewItems.length} items on this bill. Review each one below before saving.
            </p>
          ) : null}
          {confidence === 'low' ? (
            <p className="pf-vault-form__section-hint" role="status">
              Low confidence read — please check all fields before saving.
            </p>
          ) : null}
          {allMissingSummary.length > 0 ? (
            <div className="pf-vault-import-missing" role="alert">
              <strong>Some details could not be read from the bill.</strong>
              <ul className="pf-vault-import-missing__list">
                {allMissingSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="pf-vault-form__section">
            <h5 className="pf-vault-form__section-title">Bill details</h5>
            <label className="pf-vault-field">
              <span>Purchase source</span>
              <input
                className="input pf-vault-form__input"
                list={jewellerOptions.length > 0 ? listId : undefined}
                value={purchaseSource}
                onChange={(e) => setPurchaseSource(e.target.value)}
                disabled={busy}
                placeholder="Shop or jeweller name"
              />
              {jewellerOptions.length > 0 ? (
                <datalist id={listId}>
                  {jewellerOptions.map((o) => (
                    <option key={o.id} value={o.label} />
                  ))}
                </datalist>
              ) : null}
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
            <label className="pf-vault-field">
              <span>Invoice number (optional)</span>
              <input
                className="input pf-vault-form__input"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={busy}
              />
            </label>
          </section>

          {multiItem ? (
            <div className="pf-vault-import-items" role="tablist" aria-label="Invoice items">
              {reviewItems.map((it, idx) => {
                const label = it.title.trim() || `Item ${idx + 1}`
                const needsInput = it.include && it.missingFields.length > 0
                return (
                  <button
                    key={it.key}
                    type="button"
                    role="tab"
                    aria-selected={activeItemIndex === idx}
                    className={`pf-vault-form__chip pf-vault-import-items__tab${
                      activeItemIndex === idx ? ' pf-vault-form__chip--active' : ''
                    }${needsInput ? ' pf-vault-import-items__tab--needs-input' : ''}${
                      !it.include ? ' pf-vault-import-items__tab--excluded' : ''
                    }`}
                    onClick={() => setActiveItemIndex(idx)}
                    disabled={busy}
                  >
                    {label}
                    {needsInput ? ' *' : ''}
                  </button>
                )
              })}
            </div>
          ) : null}

          {activeItem ? (
            <section className="pf-vault-form__section">
              {multiItem ? (
                <div className="pf-vault-import-item-toolbar">
                  <h5 className="pf-vault-form__section-title">
                    {activeItem.title.trim() || `Item ${activeItemIndex + 1}`}
                  </h5>
                  <label className="pf-vault-import-item-toolbar__include">
                    <input
                      type="checkbox"
                      checked={activeItem.include}
                      disabled={busy}
                      onChange={(e) =>
                        updateActiveItem({ include: e.target.checked })
                      }
                    />
                    Include in import
                  </label>
                </div>
              ) : null}
              {activeItem.include && activeItem.missingFields.length > 0 ? (
                <p className="pf-vault-import-missing pf-vault-import-missing--inline" role="status">
                  {missingFieldsMessage(activeItem.missingFields)}
                </p>
              ) : null}
              {!activeItem.include ? (
                <p className="pf-vault-form__section-hint">
                  This row is excluded and will not be saved.
                </p>
              ) : (
                <>
                  <label
                    className={`pf-vault-field${
                      activeItem.missingFields.includes('title')
                        ? ' pf-vault-field--needs-input'
                        : ''
                    }`}
                  >
                    <span>Display title</span>
                    <input
                      className="input pf-vault-form__input"
                      value={activeItem.title}
                      onChange={(e) => updateActiveItem({ title: e.target.value })}
                      disabled={busy}
                      placeholder="e.g. Gold chain, 22K ring"
                    />
                  </label>
                  <div className="pf-vault-field">
                    <span>Category</span>
                    <div className="pf-vault-form__chips" role="group">
                      {CATS.map((c) => (
                        <button
                          key={c.v}
                          type="button"
                          className={`pf-vault-form__chip${
                            activeItem.category === c.v ? ' pf-vault-form__chip--active' : ''
                          }`}
                          aria-pressed={activeItem.category === c.v}
                          onClick={() => updateActiveItem({ category: c.v })}
                          disabled={busy}
                        >
                          {c.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PersonalVaultPricingFields
                    anchor={activeItem.priceAnchor}
                    onAnchorChange={(anchor) => updateActiveItem({ priceAnchor: anchor })}
                    weight={activeItem.weight}
                    onWeightChange={(weight) => updateActiveItem({ weight })}
                    purity={activeItem.purity}
                    onPurityChange={(purity) => updateActiveItem({ purity })}
                    purchaseValue={activeItem.purchaseValue}
                    onPurchaseValueChange={(purchaseValue) =>
                      updateActiveItem({ purchaseValue })
                    }
                    makingChargePercent={activeItem.makingChargePercent}
                    onMakingChargePercentChange={(makingChargePercent) =>
                      updateActiveItem({ makingChargePercent })
                    }
                    purchasePricePerGram={activeItem.purchasePricePerGram}
                    onPurchasePricePerGramChange={(purchasePricePerGram) =>
                      updateActiveItem({ purchasePricePerGram })
                    }
                    gstGoldPct={resolveGstOnGoldPercent()}
                    gstMakingPct={resolveGstOnMakingPercent()}
                    costSummaryHint={costSummaryHint}
                    billingTaxReady={billingTaxReady}
                    disabled={busy}
                    weightNeedsInput={activeItem.missingFields.includes('weight_grams')}
                    priceNeedsInput={activeItem.missingFields.includes('purchase_price')}
                  />
                </>
              )}
            </section>
          ) : null}

          <footer className="pf-vault-form__footer">
            <FormSubmitFoot error={error} className="pf-vault-form__actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => resetFlow()}
              >
                Upload different file
              </button>
              <button
                type="submit"
                className="btn btn-primary pf-vault-form__submit"
                disabled={busy || !canSave}
              >
                {phase === 'creating'
                  ? 'Saving…'
                  : includedItems.length > 1
                    ? `Save ${includedItems.length} items to vault`
                    : 'Save to vault'}
              </button>
            </FormSubmitFoot>
          </footer>
        </form>
      ) : null}

      {phase === 'done' ? (
        <p className="pf-vault-form__lede" role="status">
          {savedCount > 1
            ? `${savedCount} items saved to your vault.`
            : 'Saved to your vault.'}
        </p>
      ) : null}
    </section>
  )
}
