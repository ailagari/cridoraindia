import type { SchemeDesign } from '@/lib/schemesApi'

export type SchemePreviewData = {
  flow_nodes?: Array<{ id: string; label: string; detail: string }>
  example?: {
    sample_deposit_inr: number
    customer_months: number
    estimated_pool_inr: number
    bonus_label: string
  }
  deposit_quote?: Record<string, string>
  flow_summary?: string
  valid?: boolean
}

const REDEEM_LABELS: Record<string, string> = {
  jewellery_cash_pool: 'Jewellery bill (INR pool)',
  gold_grams: 'Vault gold grams',
  cash_convert_to_gold: 'INR pool converted to gold at redemption',
  jewellery_from_gold: 'Jewellery from gold balance + making charge',
}

const BONUS_CREDIT_LABELS: Record<string, string> = {
  cash_pool: 'INR pool',
  gold_grams: 'Gold grams',
  making_charge_credit: 'Making charge credit',
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function flowNode(preview: SchemePreviewData | null, id: string) {
  return preview?.flow_nodes?.find((n) => n.id === id)
}

export function buildTimelinePreview(
  design: SchemeDesign,
  preview: SchemePreviewData | null,
): { title: string; lines: string[] } {
  const tl = design.plan_timeline
  const sample = preview?.example?.sample_deposit_inr ?? 5000

  if (!tl.fixed_duration) {
    return {
      title: 'Plan preview',
      lines: [
        'Open-ended plan — no fixed month count.',
        'Customers deposit anytime; monthly buckets track calendar months.',
        'Redemption follows output rules when the customer is ready.',
      ],
    }
  }

  const months = Number(tl.customer_months) || 11
  const bonusMonth = Number(tl.jeweller_bonus_month) || months + 1
  const lines: string[] = [
    `${months} customer saving months — deposits roll into each calendar month.`,
    `Example: ${fmtInr(sample)} per month → about ${fmtInr(sample * months)} from customer deposits.`,
  ]

  if (tl.bonus_enabled) {
    const bonusNode = flowNode(preview, 'bonus')
    const bonusDetail = bonusNode?.detail ?? preview?.example?.bonus_label
    lines.push(`Month ${bonusMonth} is the jeweller bonus month.`)
    if (bonusDetail) lines.push(bonusDetail)
    if (tl.bonus_credit_as) {
      lines.push(`Bonus credited as ${BONUS_CREDIT_LABELS[String(tl.bonus_credit_as)] ?? tl.bonus_credit_as}.`)
    }
    if (preview?.example?.estimated_pool_inr != null) {
      lines.push(`Illustrative total pool after bonus ≈ ${fmtInr(preview.example.estimated_pool_inr)}.`)
    }
  } else {
    lines.push('No jeweller bonus month on this plan.')
  }

  if (tl.after_plan_ends === 'new_cycle') {
    lines.push('After the plan ends, a new cycle can start automatically.')
  }

  return { title: 'Plan preview', lines }
}

export function buildOutputPreview(
  design: SchemeDesign,
  preview: SchemePreviewData | null,
): { title: string; lines: string[] } {
  const out = design.output
  const redeemKey = String(out.redeem_as ?? 'jewellery_cash_pool')
  const outputNode = flowNode(preview, 'output')
  const lines: string[] = [
    `Redeem as: ${REDEEM_LABELS[redeemKey] ?? redeemKey}.`,
  ]

  if (outputNode?.detail) {
    lines.push(outputNode.detail)
  } else if (preview?.example?.estimated_pool_inr != null && design.input.payment_type !== 'gold') {
    lines.push(`Illustrative redeemable pool ≈ ${fmtInr(preview.example.estimated_pool_inr)}.`)
  } else if (design.input.payment_type === 'gold') {
    lines.push('Customer redeems from accumulated vault gold grams.')
  }

  if (out.lock_until_plan_complete) {
    lines.push('Redemption is locked until the plan cycle completes.')
  } else {
    lines.push('Customer may redeem before the plan completes (if balance allows).')
  }

  if (out.allow_topup) {
    lines.push('Top-up at counter is allowed when redeeming.')
  }

  return { title: 'Redemption preview', lines }
}

export function buildInputPreview(
  design: SchemeDesign,
  preview: SchemePreviewData | null,
): { title: string; lines: string[] } {
  const quote = preview?.deposit_quote
  const inp = design.input
  const lines: string[] = []

  if (inp.payment_type === 'gold') {
    lines.push('Each deposit buys gold grams (GST/MC per scheme rules).')
  } else {
    lines.push('Each deposit adds to the customer INR pool.')
  }

  if (quote?.total_inr) {
    lines.push(`Sample ₹5,000 deposit → total charged ${fmtInr(Number(quote.total_inr))}.`)
    if (quote.gold_grams && quote.gold_grams !== '0.000000') {
      lines.push(`Gold credited: ${quote.gold_grams} g`)
    }
    if (quote.gst_inr && quote.gst_inr !== '0.00') {
      lines.push(`GST on gold: ${fmtInr(Number(quote.gst_inr))}`)
    }
    if (quote.making_charge_inr && quote.making_charge_inr !== '0.00') {
      lines.push(`Making charge: ${fmtInr(Number(quote.making_charge_inr))}`)
    }
    if (quote.gst_on_making_charge_inr && quote.gst_on_making_charge_inr !== '0.00') {
      lines.push(`GST on making charge: ${fmtInr(Number(quote.gst_on_making_charge_inr))}`)
    }
  } else {
    lines.push('Adjust inputs to see a sample deposit breakdown.')
  }

  if (inp.min_deposit_inr) {
    lines.push(`Minimum deposit: ${fmtInr(Number(inp.min_deposit_inr))}.`)
  }

  return { title: 'Deposit preview', lines }
}
