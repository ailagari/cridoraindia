import type { SchemeDesign } from '@/lib/schemesApi'

export const EMPTY_SCHEME_DESIGN: SchemeDesign = {
  input: {
    payment_type: 'cash',
    includes_gst: false,
    gst_percent: 3,
    includes_making_charge: false,
    making_charge_mode: 'none',
    min_deposit_inr: null,
    max_deposit_inr: null,
    suggested_rhythm: 'anytime',
  },
  plan_timeline: {
    fixed_duration: true,
    customer_months: 11,
    jeweller_bonus_month: 12,
    redemption_from: 'after_bonus',
    bonus_enabled: true,
    bonus_amount_mode: 'avg_all_months',
    bonus_avg_months: 11,
    bonus_fixed_inr: null,
    bonus_credit_as: 'cash_pool',
    after_plan_ends: 'new_cycle',
  },
  output: {
    redeem_as: 'jewellery_cash_pool',
    making_charge: 'full',
    making_charge_percent: null,
    gst: 'full',
    allow_topup: true,
    lock_until_plan_complete: true,
  },
  jeweller_can_override: ['min_deposit_inr', 'display_name'],
}

export function designFromPreset(presetDesign: SchemeDesign): SchemeDesign {
  return JSON.parse(JSON.stringify(presetDesign)) as SchemeDesign
}

export function flowSummaryFromDesign(design: SchemeDesign): string {
  const inp = design.input
  const tl = design.plan_timeline
  const pay = inp.payment_type === 'gold' ? 'Gold' : 'Cash'
  if (tl.fixed_duration) {
    const months = tl.customer_months ?? '?'
    const bonus = tl.bonus_enabled ? ` + jeweller month ${tl.jeweller_bonus_month}` : ''
    return `${pay} anytime · ${months} months${bonus}`
  }
  return `${pay} anytime · open plan`
}
