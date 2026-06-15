import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  analyzeInvoice,
  createPersonalHolding,
  derivePurchasePricePerGram,
  describePersonalVaultCostSummary,
  formatPurchaseValueFromRate,
  isGoldRateDerivedFromBill,
  recalcRateFromBillOrValue,
  uploadPersonalDocument,
  type InvoiceExtractDTO,
  type PersonalHoldingDTO,
} from '@/lib/personalHoldingsApi'

const CATS = [
  { v: 'ornament', l: 'Ornament' },
  { v: 'coin', l: 'Coin' },
  { v: 'bar', l: 'Bar' },
  { v: 'other', l: 'Other' },
]

const ACCEPT = 'image/*,application/pdf'

type FlowPhase = 'picking' | 'analyzing' | 'review' | 'creating' | 'done'

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  )
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
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

type InvoiceImportFlowProps = {
  open: boolean
  onClose: () => void
  onCreated: (holding: PersonalHoldingDTO) => void
  jewellers?: JewellerStorefrontDTO[]
}

export function InvoiceImportFlow({
  open,
  onClose,
  onCreated,
  jewellers = [],
}: InvoiceImportFlowProps) {
  const isMobile = useIsMobile()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<'environment' | undefined>(undefined)

  const [phase, setPhase] = useState<FlowPhase>('picking')
  const [error, setError] = useState('')
  const [notLegibleReason, setNotLegibleReason] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('ornament')
  const [weight, setWeight] = useState('')
  const [purity, setPurity] = useState('BIS 916')
  const [purchasePricePerGram, setPurchasePricePerGram] = useState('')
  const [purchaseValue, setPurchaseValue] = useState('')
  const [makingChargePercent, setMakingChargePercent] = useState('')
  const [purchaseSource, setPurchaseSource] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')

  const costSummaryHint = useMemo(
    () =>
      describePersonalVaultCostSummary(
        weight,
        purchasePricePerGram,
        purchaseValue,
        makingChargePercent,
      ),
    [weight, purchasePricePerGram, purchaseValue, makingChargePercent],
  )
  const rateFromBill = isGoldRateDerivedFromBill(weight, purchaseValue)

  const resetFlow = useCallback(() => {
    setPhase('picking')
    setError('')
    setNotLegibleReason('')
    setSourceFile(null)
    setTitle('')
    setCategory('ornament')
    setWeight('')
    setPurity('BIS 916')
    setPurchasePricePerGram('')
    setPurchaseValue('')
    setMakingChargePercent('')
    setPurchaseSource('')
    setPurchaseDate('')
    setInvoiceNumber('')
    setConfidence('medium')
  }, [])

  useEffect(() => {
    if (!open) {
      resetFlow()
    }
  }, [open, resetFlow])

  const applyExtract = (data: InvoiceExtractDTO) => {
    setTitle(data.title)
    setCategory(CATS.some((c) => c.v === data.category) ? data.category : 'other')
    setWeight(data.weight_grams)
    setPurity(data.purity)
    setPurchaseSource(data.purchase_source)
    setPurchaseDate(data.purchase_date ?? '')
    setPurchasePricePerGram(data.purchase_price_inr_per_gram ?? '')
    setPurchaseValue(formatPurchaseValueFromRate(data.weight_grams, data.purchase_price_inr_per_gram ?? ''))
    setInvoiceNumber(data.invoice_number ?? '')
    setConfidence(data.confidence)
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
    const t = title.trim()
    const w = weight.trim()
    if (!t) {
      setError('Title is required.')
      return
    }
    if (!w || Number.parseFloat(w) <= 0) {
      setError('Weight must be greater than zero.')
      return
    }
    setError('')
    setPhase('creating')
    try {
      const created = await createPersonalHolding({
        title: t,
        category,
        weight_grams: w,
        purity: purity.trim() || 'BIS 916',
        purchase_source: purchaseSource.trim() || undefined,
        purchase_date: purchaseDate.trim() || undefined,
        purchase_price_inr_per_gram:
          derivePurchasePricePerGram(weight, purchasePricePerGram, purchaseValue, makingChargePercent) || undefined,
        making_charge_percent: makingChargePercent.trim() || undefined,
      })
      if (!created.ok) {
        setError(created.detail)
        setPhase('review')
        return
      }
      const holdingId = created.data?.id
      if (holdingId != null && sourceFile) {
        const fd = new FormData()
        fd.set('file', sourceFile)
        fd.set('document_type', 'purchase_invoice')
        if (invoiceNumber.trim()) {
          fd.set('invoice_number', invoiceNumber.trim())
        }
        const up = await uploadPersonalDocument(holdingId, fd)
        if (!up.ok) {
          setError(
            `Holding saved, but invoice file could not be attached: ${up.detail}`,
          )
          setPhase('review')
          return
        }
      }
      if (created.data) {
        setPhase('done')
        onCreated(created.data)
      } else {
        setPhase('done')
        onClose()
      }
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
          Upload a purchase bill photo, PDF, or screenshot. We read the details — you confirm before saving.
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
          {isMobile ? (
            <div className="pf-vault-import-pick__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => triggerFilePick('environment')}
              >
                Take photo
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => triggerFilePick()}>
                Upload file
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => triggerFilePick()}>
              Choose invoice (photo or PDF)
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
          {confidence === 'low' ? (
            <p className="pf-vault-form__section-hint" role="status">
              Low confidence read — please check all fields before saving.
            </p>
          ) : null}
          <section className="pf-vault-form__section">
            <label className="pf-vault-field">
              <span>Display title</span>
              <input
                className="input pf-vault-form__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="pf-vault-field">
              <span>Category</span>
              <div className="pf-vault-form__chips" role="group">
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
            <div className="pf-vault-form__metal-grid">
              <label className="pf-vault-field">
                <span>Weight (g)</span>
                <input
                  className="input pf-vault-form__input tabular"
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
                  disabled={busy}
                />
              </label>
              <label className="pf-vault-field">
                <span>Purity</span>
                <input
                  className="input pf-vault-form__input"
                  value={purity}
                  onChange={(e) => setPurity(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="pf-vault-field">
                <span>Total purchase value (₹, optional)</span>
                <input
                  className="input pf-vault-form__input tabular"
                  value={purchaseValue}
                  onChange={(e) => {
                    const synced = recalcRateFromBillOrValue(
                      weight,
                      purchasePricePerGram,
                      e.target.value,
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
                <input
                  className="input pf-vault-form__input tabular"
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
              </label>
              <label className="pf-vault-field pf-vault-field--wide">
                <span>{rateFromBill ? 'Gold rate (₹/g, calculated)' : 'Gold rate (₹/g, optional)'}</span>
                <input
                  className="input pf-vault-form__input tabular"
                  value={purchasePricePerGram}
                  onChange={(e) => {
                    const synced = recalcRateFromBillOrValue(weight, e.target.value, '', makingChargePercent)
                    setPurchasePricePerGram(synced.rate)
                    setPurchaseValue(synced.value)
                  }}
                  readOnly={rateFromBill}
                  inputMode="decimal"
                  placeholder={rateFromBill ? 'Calculated from bill' : 'If you know the gold rate'}
                  disabled={busy}
                  aria-readonly={rateFromBill}
                />
              </label>
            </div>
            {costSummaryHint ? (
              <p className="pf-vault-form__section-hint pf-vault-form__derived-rate" role="status">
                {costSummaryHint}
              </p>
            ) : null}
            <label className="pf-vault-field">
              <span>Purchase source</span>
              <input
                className="input pf-vault-form__input"
                list={jewellerOptions.length > 0 ? listId : undefined}
                value={purchaseSource}
                onChange={(e) => setPurchaseSource(e.target.value)}
                disabled={busy}
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
                disabled={busy || !title.trim() || !weight.trim()}
              >
                {phase === 'creating' ? 'Saving…' : 'Save to vault'}
              </button>
            </FormSubmitFoot>
          </footer>
        </form>
      ) : null}

      {phase === 'done' ? (
        <p className="pf-vault-form__lede" role="status">
          Saved to your vault.
        </p>
      ) : null}
    </section>
  )
}
