import type { GoldRatesAdSlotSpec } from '@/features/goldRates/goldRatesAdSpecs'
import { GOLD_RATES_AD_SLOT_SPECS } from '@/features/goldRates/goldRatesAdSpecs'

export const GOLD_CALCULATOR_AD_SLOT_SPECS: Record<string, GoldRatesAdSlotSpec> = {
  top_banner: GOLD_RATES_AD_SLOT_SPECS.top_banner,
  sidebar: GOLD_RATES_AD_SLOT_SPECS.sidebar,
  in_content_1: {
    ...GOLD_RATES_AD_SLOT_SPECS.in_content_1,
    label: 'After calculator',
  },
  in_content_2: {
    ...GOLD_RATES_AD_SLOT_SPECS.in_content_2,
    label: 'After live rates',
  },
  footer: GOLD_RATES_AD_SLOT_SPECS.footer,
}

export function getGoldCalculatorAdSlotSpec(slot: string | undefined): GoldRatesAdSlotSpec | undefined {
  if (!slot) return undefined
  return GOLD_CALCULATOR_AD_SLOT_SPECS[slot]
}
