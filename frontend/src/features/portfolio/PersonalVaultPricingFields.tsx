import { PersonalVaultPuritySelect } from '@/features/portfolio/PersonalVaultPuritySelect'
import {
  isGoldRateDerivedFromBill,
  recalcRateOnlyFromBillTotal,
} from '@/lib/personalHoldingsApi'

export type PersonalVaultPricingMode = 'bill' | 'rate'

const PRICING_MODES: { v: PersonalVaultPricingMode; l: string }[] = [
  { v: 'bill', l: 'From bill total' },
  { v: 'rate', l: 'Gold rate per gram' },
]

export function detectPersonalVaultPricingMode(h: {
  purchase_total_inr?: string | null
  purchase_price_inr_per_gram?: string | null
}): PersonalVaultPricingMode {
  if ((h.purchase_total_inr ?? '').trim()) return 'bill'
  if ((h.purchase_price_inr_per_gram ?? '').trim()) return 'rate'
  return 'bill'
}

type PersonalVaultPricingFieldsProps = {
  mode: PersonalVaultPricingMode
  onModeChange: (mode: PersonalVaultPricingMode) => void
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
  disabled?: boolean
  gridClassName?: string
}

export function PersonalVaultPricingFields({
  mode,
  onModeChange,
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
  disabled,
  gridClassName = 'pf-vault-form__metal-grid',
}: PersonalVaultPricingFieldsProps) {
  const billMode = mode === 'bill'
  const rateFromBill = billMode && isGoldRateDerivedFromBill(weight, purchaseValue)

  const syncFromBill = (nextWeight: string, nextValue: string, nextMc: string) => {
    onPurchaseValueChange(nextValue)
    onPurchasePricePerGramChange(
      nextValue.trim() ? recalcRateOnlyFromBillTotal(nextWeight, nextValue, nextMc) : '',
    )
  }

  const handleModeChange = (next: PersonalVaultPricingMode) => {
    if (next === mode) return
    if (next === 'rate') {
      onPurchaseValueChange('')
      onMakingChargePercentChange('')
    } else {
      onPurchasePricePerGramChange('')
    }
    onModeChange(next)
  }

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
              className={`pf-vault-form__chip${mode === m.v ? ' pf-vault-form__chip--active' : ''}`}
              aria-pressed={mode === m.v}
              onClick={() => handleModeChange(m.v)}
              disabled={disabled}
            >
              {m.l}
            </button>
          ))}
        </div>
      </div>

      <p className="pf-vault-form__section-hint">
        {billMode ? (
          <>
            Enter <strong>weight</strong>, <strong>total paid</strong>, and optional <strong>making charge
            %</strong>. GST is applied automatically — {gstGoldPct}% on gold metal and {gstMakingPct}% on
            making charges.
          </>
        ) : (
          <>
            Enter <strong>weight</strong> and the <strong>gold rate per gram</strong> from your bill or
            receipt. Making charge and bill total are not needed in this mode.
          </>
        )}
      </p>

      <div className={gridClassName}>
        <label className="pf-vault-field">
          <span>Weight</span>
          <div className="pf-vault-form__suffix-wrap">
            <input
              className="input pf-vault-form__input tabular pf-vault-form__input--with-suffix"
              value={weight}
              onChange={(e) => {
                const next = e.target.value
                onWeightChange(next)
                if (billMode) {
                  syncFromBill(next, purchaseValue, makingChargePercent)
                }
              }}
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

        {billMode ? (
          <>
            <label className="pf-vault-field">
              <span>Total purchase value (₹)</span>
              <input
                className="input pf-vault-form__input tabular"
                value={purchaseValue}
                onChange={(e) => syncFromBill(weight, e.target.value, makingChargePercent)}
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
                  onChange={(e) => syncFromBill(weight, purchaseValue, e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 12"
                  disabled={disabled}
                />
                <span className="pf-vault-form__suffix" aria-hidden>
                  %
                </span>
              </div>
            </label>
            {rateFromBill ? (
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
          <label className="pf-vault-field pf-vault-field--wide">
            <span>Gold rate (₹/g)</span>
            <input
              className="input pf-vault-form__input tabular"
              value={purchasePricePerGram}
              onChange={(e) => onPurchasePricePerGramChange(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 13890"
              disabled={disabled}
            />
          </label>
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

export function personalVaultCostSummaryForMode(
  mode: PersonalVaultPricingMode,
  weight: string,
  rate: string,
  value: string,
  makingChargePercent: string,
  describe: (
    weightStr: string,
    rateStr: string,
    valueStr: string,
    makingChargePercentStr: string,
  ) => string,
): string {
  if (mode === 'bill') {
    return describe(weight, rate, value, makingChargePercent)
  }
  if (!rate.trim()) return ''
  return describe(weight, rate, '', '')
}
