import { useEffect } from 'react'
import { PersonalVaultPuritySelect } from '@/features/portfolio/PersonalVaultPuritySelect'
import {
  type PersonalVaultPriceAnchor,
  syncPersonalVaultPricing,
} from '@/lib/personalHoldingsApi'

export type { PersonalVaultPriceAnchor }

const PRICING_MODES: { v: PersonalVaultPriceAnchor; l: string }[] = [
  { v: 'total', l: 'Bill total + making charge %' },
  { v: 'rate', l: 'Rate per gram + making charge %' },
]

export function detectPersonalVaultPriceAnchor(h: {
  purchase_total_inr?: string | null
  purchase_price_inr_per_gram?: string | null
}): PersonalVaultPriceAnchor {
  if ((h.purchase_total_inr ?? '').trim()) return 'total'
  return 'rate'
}

type PersonalVaultPricingFieldsProps = {
  anchor: PersonalVaultPriceAnchor
  onAnchorChange: (anchor: PersonalVaultPriceAnchor) => void
  weight: string
  onWeightChange: (weight: string) => void
  purity: string
  onPurityChange: (purity: string) => void
  purchaseValue: string
  onPurchaseValueChange: (value: string) => void
  makingChargePercent: string
  onMakingChargePercentChange: (mc: string) => void
  purchasePricePerGram: string
  onPurchasePricePerGramChange: (rate: string) => void
  gstGoldPct: number
  gstMakingPct: number
  costSummaryHint: string
  billingTaxReady?: boolean
  disabled?: boolean
  gridClassName?: string
  weightNeedsInput?: boolean
  priceNeedsInput?: boolean
}

export function PersonalVaultPricingFields({
  anchor,
  onAnchorChange,
  weight,
  onWeightChange,
  purity,
  onPurityChange,
  purchaseValue,
  onPurchaseValueChange,
  makingChargePercent,
  onMakingChargePercentChange,
  purchasePricePerGram,
  onPurchasePricePerGramChange,
  gstGoldPct,
  gstMakingPct,
  costSummaryHint,
  billingTaxReady = true,
  disabled,
  gridClassName = 'pf-vault-form__metal-grid',
  weightNeedsInput = false,
  priceNeedsInput = false,
}: PersonalVaultPricingFieldsProps) {
  const totalMode = anchor === 'total'

  const applySync = (
    nextAnchor: PersonalVaultPriceAnchor,
    nextWeight: string,
    nextValue: string,
    nextRate: string,
    nextMc: string,
  ) => {
    const synced = syncPersonalVaultPricing(nextAnchor, nextWeight, nextValue, nextRate, nextMc)
    onPurchaseValueChange(synced.total)
    onPurchasePricePerGramChange(synced.rate)
  }

  useEffect(() => {
    if (!billingTaxReady) return
    applySync(anchor, weight, purchaseValue, purchasePricePerGram, makingChargePercent)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync once GST settings load
  }, [billingTaxReady])

  const handleAnchorChange = (next: PersonalVaultPriceAnchor) => {
    if (next === anchor) return
    onAnchorChange(next)
    applySync(next, weight, purchaseValue, purchasePricePerGram, makingChargePercent)
  }

  const handleValueChange = (nextValue: string) => {
    onPurchaseValueChange(nextValue)
    applySync('total', weight, nextValue, purchasePricePerGram, makingChargePercent)
  }

  const handleRateChange = (nextRate: string) => {
    onPurchasePricePerGramChange(nextRate)
    applySync('rate', weight, purchaseValue, nextRate, makingChargePercent)
  }

  const handleMcChange = (nextMc: string) => {
    onMakingChargePercentChange(nextMc)
    applySync(anchor, weight, purchaseValue, purchasePricePerGram, nextMc)
  }

  const handleWeightChange = (nextWeight: string) => {
    onWeightChange(nextWeight)
    applySync(anchor, nextWeight, purchaseValue, purchasePricePerGram, makingChargePercent)
  }

  const showCalculatedRate = totalMode && purchaseValue.trim() !== ''
  const showCalculatedTotal = !totalMode && purchasePricePerGram.trim() !== ''

  return (
    <>
      <div className="pf-vault-field">
        <span id="pf-vault-pricing-mode-label">How do you want to enter purchase cost?</span>
        <div
          className="pf-vault-form__chips pf-vault-form__chips--pricing"
          role="group"
          aria-labelledby="pf-vault-pricing-mode-label"
        >
          {PRICING_MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              className={`pf-vault-form__chip${anchor === m.v ? ' pf-vault-form__chip--active' : ''}`}
              aria-pressed={anchor === m.v}
              onClick={() => handleAnchorChange(m.v)}
              disabled={disabled}
            >
              {m.l}
            </button>
          ))}
        </div>
      </div>

      <p className="pf-vault-form__section-hint">
        {totalMode ? (
          <>
            Enter <strong>weight</strong>, <strong>total paid</strong>, and optional <strong>making charge
            %</strong>. Gold rate per gram is calculated with {gstGoldPct}% GST on gold and {gstMakingPct}% GST on
            making charges.
          </>
        ) : (
          <>
            Enter <strong>weight</strong>, <strong>gold rate per gram</strong>, and optional <strong>making charge
            %</strong>. Total purchase value is calculated with {gstGoldPct}% GST on gold and {gstMakingPct}% GST on
            making charges.
          </>
        )}
      </p>

      <div className={gridClassName}>
        <label
          className={`pf-vault-field${weightNeedsInput ? ' pf-vault-field--needs-input' : ''}`}
        >
          <span>Weight{weightNeedsInput ? ' (required)' : ''}</span>
          <div className="pf-vault-form__suffix-wrap">
            <input
              className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
              value={weight}
              onChange={(e) => handleWeightChange(e.target.value)}
              inputMode="decimal"
              placeholder="0.000"
              autoComplete="off"
              disabled={disabled}
            />
            <span className="pf-vault-form__suffix" aria-hidden>
              g
            </span>
          </div>
        </label>
        <label className="pf-vault-field">
          <span>Purity</span>
          <PersonalVaultPuritySelect value={purity} onChange={onPurityChange} disabled={disabled} />
        </label>

        {totalMode ? (
          <>
            <label
              className={`pf-vault-field${priceNeedsInput ? ' pf-vault-field--needs-input' : ''}`}
            >
              <span>Total purchase value (₹){priceNeedsInput ? ' (required)' : ''}</span>
              <input
                className="input pf-vault-form__input tabular"
                value={purchaseValue}
                onChange={(e) => handleValueChange(e.target.value)}
                inputMode="decimal"
                placeholder="Total bill amount"
                disabled={disabled}
              />
            </label>
            <label className="pf-vault-field">
              <span>Making charge % (optional)</span>
              <div className="pf-vault-form__suffix-wrap">
                <input
                  className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
                  value={makingChargePercent}
                  onChange={(e) => handleMcChange(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 5.7"
                  disabled={disabled}
                />
                <span className="pf-vault-form__suffix" aria-hidden>
                  %
                </span>
              </div>
            </label>
            {showCalculatedRate ? (
              <label className="pf-vault-field pf-vault-field--wide">
                <span>Gold rate (₹/g, calculated)</span>
                <input
                  className="input pf-vault-form__input tabular"
                  value={purchasePricePerGram}
                  readOnly
                  aria-readonly
                  placeholder="Calculated from bill"
                  disabled={disabled}
                />
              </label>
            ) : null}
          </>
        ) : (
          <>
            <label
              className={`pf-vault-field${priceNeedsInput ? ' pf-vault-field--needs-input' : ''}`}
            >
              <span>Gold rate (₹/g){priceNeedsInput ? ' (required)' : ''}</span>
              <input
                className="input pf-vault-form__input tabular"
                value={purchasePricePerGram}
                onChange={(e) => handleRateChange(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 13890"
                disabled={disabled}
              />
            </label>
            <label className="pf-vault-field">
              <span>Making charge % (optional)</span>
              <div className="pf-vault-form__suffix-wrap">
                <input
                  className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
                  value={makingChargePercent}
                  onChange={(e) => handleMcChange(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 5.7"
                  disabled={disabled}
                />
                <span className="pf-vault-form__suffix" aria-hidden>
                  %
                </span>
              </div>
            </label>
            {showCalculatedTotal ? (
              <label className="pf-vault-field pf-vault-field--wide">
                <span>Total purchase value (₹, calculated)</span>
                <input
                  className="input pf-vault-form__input tabular"
                  value={purchaseValue}
                  readOnly
                  aria-readonly
                  placeholder="Calculated from rate"
                  disabled={disabled}
                />
              </label>
            ) : null}
          </>
        )}
      </div>

      {costSummaryHint ? (
        <p className="pf-vault-form__section-hint pf-vault-form__derived-rate" role="status">
          {costSummaryHint}
        </p>
      ) : null}
    </>
  )
}
