import { useMemo, useState, useEffect } from 'react'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { ornamentBillFromCalculator } from '@/lib/goldBillingTax'
import {
  fetchPlatformBillingTax,
  resolveGstOnGoldPercent,
  resolveGstOnMakingPercent,
} from '@/lib/platformBillingTax'
import type { KeralaGoldRatesPayload } from '@/lib/marketplaceApi'

export type WeightUnit = 'gram' | 'sovereign' | 'kg'
export type PurityKey = '24K' | '22K' | '18K'

const SOVEREIGN_GRAMS = 8
const KG_GRAMS = 1000

function fmtInr(n: number, digits = 0): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function parseNum(s: string | number | undefined | null): number | null {
  if (s == null) return null
  const n = typeof s === 'number' ? s : Number.parseFloat(String(s))
  return Number.isFinite(n) ? n : null
}

function gramsFromInput(weight: number, unit: WeightUnit): number {
  if (unit === 'sovereign') return weight * SOVEREIGN_GRAMS
  if (unit === 'kg') return weight * KG_GRAMS
  return weight
}

function rateForPurity(rates: KeralaGoldRatesPayload | null, purity: PurityKey): number | null {
  if (!rates) return null
  return parseNum(rates.gold[purity])
}

type Props = {
  rates: KeralaGoldRatesPayload | null
  sectionId?: string
  showHeading?: boolean
}

export function GoldJewelleryCalculator({ rates, sectionId = 'gr-calculator', showHeading = true }: Props) {
  const { t } = usePublicLocale()
  const [calcWeight, setCalcWeight] = useState('8')
  const [calcUnit, setCalcUnit] = useState<WeightUnit>('gram')
  const [calcPurity, setCalcPurity] = useState<PurityKey>('22K')
  const [calcMcMode, setCalcMcMode] = useState<'per_gram' | 'percent'>('per_gram')
  const [calcMc, setCalcMc] = useState('0')
  const [taxReady, setTaxReady] = useState(false)

  useEffect(() => {
    void fetchPlatformBillingTax().then(() => setTaxReady(true))
  }, [])

  const calcResult = useMemo(() => {
    const w = Number.parseFloat(calcWeight)
    if (!Number.isFinite(w) || w <= 0) return null
    const grams = gramsFromInput(w, calcUnit)
    const rate = rateForPurity(rates, calcPurity)
    if (rate == null) return null
    const mcVal = Number.parseFloat(calcMc) || 0
    return ornamentBillFromCalculator(grams, rate, mcVal, calcMcMode)
  }, [calcWeight, calcUnit, calcPurity, calcMc, calcMcMode, rates, taxReady])

  return (
    <section className="gr-section" aria-labelledby={sectionId}>
      {showHeading ? (
        <>
          <h2 id={sectionId} className="gr-section__title">
            {t('goldRates.calculator')}
          </h2>
          <p className="gr-section__lead">{t('goldRates.calculatorLead')}</p>
        </>
      ) : null}
      <div className="gr-calc">
        <div className="gr-calc__fields">
          <label className="gr-field">
            <span>{t('goldRates.calcWeight')}</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={calcWeight}
              onChange={(e) => setCalcWeight(e.target.value)}
            />
          </label>
          <label className="gr-field">
            <span>{t('goldRates.calcUnit')}</span>
            <select value={calcUnit} onChange={(e) => setCalcUnit(e.target.value as WeightUnit)}>
              <option value="gram">{t('goldRates.unitGram')}</option>
              <option value="sovereign">{t('goldRates.unitSovereign')}</option>
              <option value="kg">{t('goldRates.unitKg')}</option>
            </select>
          </label>
          <label className="gr-field">
            <span>{t('goldRates.calcPurity')}</span>
            <select value={calcPurity} onChange={(e) => setCalcPurity(e.target.value as PurityKey)}>
              <option value="24K">24K</option>
              <option value="22K">22K (916)</option>
              <option value="18K">18K</option>
            </select>
          </label>
          <label className="gr-field">
            <span>{t('goldRates.calcMcMode')}</span>
            <select
              value={calcMcMode}
              onChange={(e) => setCalcMcMode(e.target.value as 'per_gram' | 'percent')}
            >
              <option value="per_gram">{t('goldRates.mcPerGram')}</option>
              <option value="percent">{t('goldRates.mcPercent')}</option>
            </select>
          </label>
          <label className="gr-field">
            <span>{t('goldRates.calcMc')}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={calcMc}
              onChange={(e) => setCalcMc(e.target.value)}
            />
          </label>
        </div>
        <div className="gr-calc__result" aria-live="polite">
          {calcResult ? (
            <>
              <div className="gr-calc__row">
                <span>{t('goldRates.calcMetal')}</span>
                <strong>₹{fmtInr(calcResult.metalInr, 2)}</strong>
              </div>
              <div className="gr-calc__row">
                <span>{t('goldRates.calcMaking')}</span>
                <strong>₹{fmtInr(calcResult.makingInr, 2)}</strong>
              </div>
              <div className="gr-calc__row">
                <span>{t('goldRates.calcGstGold', { pct: resolveGstOnGoldPercent() })}</span>
                <strong>₹{fmtInr(calcResult.gstOnGoldInr, 2)}</strong>
              </div>
              {calcResult.makingInr > 0 ? (
                <div className="gr-calc__row">
                  <span>{t('goldRates.calcGstMaking', { pct: resolveGstOnMakingPercent() })}</span>
                  <strong>₹{fmtInr(calcResult.gstOnMakingInr, 2)}</strong>
                </div>
              ) : null}
              <div className="gr-calc__row gr-calc__row--total">
                <span>{t('goldRates.calcTotal')}</span>
                <strong>₹{fmtInr(calcResult.totalInr, 2)}</strong>
              </div>
              <p className="gr-calc__fine">
                {fmtInr(
                  Number.parseFloat(calcWeight) > 0
                    ? gramsFromInput(Number.parseFloat(calcWeight), calcUnit)
                    : 0,
                  calcUnit === 'gram' && Number.parseFloat(calcWeight) < 1 ? 3 : 2,
                )}{' '}
                g × ₹
                {fmtInr(rateForPurity(rates, calcPurity) ?? 0, 2)}/g ({calcPurity})
              </p>
            </>
          ) : (
            <p>{t('goldRates.calcWaiting')}</p>
          )}
        </div>
      </div>
    </section>
  )
}
