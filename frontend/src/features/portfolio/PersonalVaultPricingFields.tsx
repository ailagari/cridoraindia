import { useEffect } from 'react'
import { PersonalVaultPuritySelect } from '@/features/portfolio/PersonalVaultPuritySelect'
import {
  type PersonalVaultPriceAnchor,
  syncPersonalVaultPricing,
} from '@/lib/personalHoldingsApi'

export type { PersonalVaultPriceAnchor }

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
}: PersonalVaultPricingFieldsProps) {
  const applySync = (
    nextAnchor: PersonalVaultPriceAnchor,
    nextWeight: string,
    nextValue: string,
    nextRate: string,
    nextMc: string,
  ) => {
    onAnchorChange(nextAnchor)
    const synced = syncPersonalVaultPricing(nextAnchor, nextWeight, nextValue, nextRate, nextMc)
    onPurchaseValueChange(synced.total)
    onPurchasePricePerGramChange(synced.rate)
  }

  useEffect(() => {
    if (!billingTaxReady) return
    const synced = syncPersonalVaultPricing(anchor, weight, purchaseValue, purchasePricePerGram, makingChargePercent)
    onPurchaseValueChange(synced.total)
    onPurchasePricePerGramChange(synced.rate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync once GST settings load
  }, [billingTaxReady])

  const handleValueChange = (nextValue: string) => {
    applySync('total', weight, nextValue, purchasePricePerGram, makingChargePercent)
  }

  const handleRateChange = (nextRate: string) => {
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

  const rateCalculated = anchor === 'total' && purchaseValue.trim() !== ''
  const totalCalculated = anchor === 'rate' && purchasePricePerGram.trim() !== ''

  return (
    <>
      <p className="pf-vault-form__section-hint">
        Enter <strong>weight</strong> and either <strong>total paid</strong> or <strong>gold rate per gram</strong>,
        plus optional <strong>making charge %</strong>. The other amount is calculated with {gstGoldPct}% GST on gold
        metal and {gstMakingPct}% GST on making charges.
      </p>

      <div className={gridClassName}>
        <label className="pf-vault-field">
          <span>Weight</span>
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

        <label className="pf-vault-field">
          <span>{totalCalculated ? 'Total purchase value (₹, calculated)' : 'Total purchase value (₹)'}</span>
          <input
            className="input pf-vault-form__input tabular"
            value={purchaseValue}
            onChange={(e) => handleValueChange(e.target.value)}
            readOnly={totalCalculated}
            aria-readonly={totalCalculated}
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

        <label className="pf-vault-field pf-vault-field--wide">
          <span>{rateCalculated ? 'Gold rate (₹/g, calculated)' : 'Gold rate (₹/g)'}</span>
          <input
            className="input pf-vault-form__input tabular"
            value={purchasePricePerGram}
            onChange={(e) => handleRateChange(e.target.value)}
            readOnly={rateCalculated}
            aria-readonly={rateCalculated}
            inputMode="decimal"
            placeholder={rateCalculated ? 'Calculated from bill' : 'e.g. 13890'}
            disabled={disabled}
          />
        </label>
      </div>

      {costSummaryHint ? (
        <p className="pf-vault-form__section-hint pf-vault-form__derived-rate" role="status">
          {costSummaryHint}
        </p>
      ) : null}
    </>
  )
}
