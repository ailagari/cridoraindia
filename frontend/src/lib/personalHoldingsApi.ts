import { authFetch, authUpload, apiUrl, getStoredAccess } from '@/lib/api'
import type { PortfolioTotalsDTO } from '@/lib/goldTransferApi'

import { ornamentBillFromMetal, ornamentBillFromTotal } from '@/lib/goldBillingTax'
import { DEFAULT_PERSONAL_VAULT_PURITY, normalizePersonalVaultPurity } from '@/lib/personalVaultPurity'
import {
  DEFAULT_GST_ON_GOLD_PERCENT,
  DEFAULT_GST_ON_MAKING_PERCENT,
  resolveGstOnGoldPercent,
  resolveGstOnMakingPercent,
} from '@/lib/platformBillingTax'

export type { PortfolioTotalsDTO }

export function parsePersonalHoldingNumber(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Defaults until platform billing-tax API loads; use resolve* at runtime in UI copy. */
export const PERSONAL_VAULT_GST_ON_GOLD_PERCENT = DEFAULT_GST_ON_GOLD_PERCENT
export const PERSONAL_VAULT_GST_ON_MAKING_PERCENT = DEFAULT_GST_ON_MAKING_PERCENT

export type PersonalVaultBillBreakdown = {
  metalInr: string
  makingInr: string
  gstOnGoldInr: string
  gstOnMakingInr: string
  totalInr: string
  ratePerGram: string
}

export function breakdownPersonalVaultBill(
  weightStr: string,
  opts: { rateStr?: string; totalStr?: string; makingChargePercentStr?: string },
): PersonalVaultBillBreakdown | null {
  const w = parsePersonalHoldingNumber(weightStr)
  if (w <= 0) return null
  const mcPct = parsePersonalHoldingNumber(opts.makingChargePercentStr ?? '')

  if (opts.totalStr?.trim()) {
    const total = parsePersonalHoldingNumber(opts.totalStr)
    if (total <= 0) return null
    const raw = ornamentBillFromTotal(w, total, mcPct)
    if (!raw) return null
    return {
      metalInr: raw.metalInr.toFixed(2),
      makingInr: raw.makingInr.toFixed(2),
      gstOnGoldInr: raw.gstOnGoldInr.toFixed(2),
      gstOnMakingInr: raw.gstOnMakingInr.toFixed(2),
      totalInr: total.toFixed(2),
      ratePerGram: raw.ratePerGram.toFixed(4),
    }
  }

  if (opts.rateStr?.trim()) {
    const rate = parsePersonalHoldingNumber(opts.rateStr)
    if (rate <= 0) return null
    const raw = ornamentBillFromMetal(w * rate, mcPct)
    if (!raw) return null
    return {
      metalInr: raw.metalInr.toFixed(2),
      makingInr: raw.makingInr.toFixed(2),
      gstOnGoldInr: raw.gstOnGoldInr.toFixed(2),
      gstOnMakingInr: raw.gstOnMakingInr.toFixed(2),
      totalInr: raw.totalInr.toFixed(2),
      ratePerGram: rate.toFixed(4),
    }
  }

  return null
}

export function formatPurchaseValueFromRate(
  weightStr: string,
  rateStr: string,
  makingChargePercentStr = '',
): string {
  const bd = breakdownPersonalVaultBill(weightStr, { rateStr, makingChargePercentStr })
  return bd?.totalInr ?? ''
}

export function formatRateFromPurchaseValue(
  weightStr: string,
  valueStr: string,
  makingChargePercentStr = '',
): string {
  const bd = breakdownPersonalVaultBill(weightStr, { totalStr: valueStr, makingChargePercentStr })
  return bd?.ratePerGram ?? ''
}

export type PersonalVaultPriceAnchor = 'total' | 'rate'

/** @deprecated Use PersonalVaultPriceAnchor */
export type PersonalVaultPricingMode = PersonalVaultPriceAnchor

export function syncPersonalVaultPricing(
  anchor: PersonalVaultPriceAnchor,
  weightStr: string,
  totalStr: string,
  rateStr: string,
  makingChargePercentStr: string,
): { total: string; rate: string } {
  if (anchor === 'total' && totalStr.trim()) {
    return {
      total: totalStr,
      rate: formatRateFromPurchaseValue(weightStr, totalStr, makingChargePercentStr),
    }
  }
  if (anchor === 'rate' && rateStr.trim()) {
    return {
      rate: rateStr,
      total: formatPurchaseValueFromRate(weightStr, rateStr, makingChargePercentStr),
    }
  }
  return { total: totalStr, rate: rateStr }
}

export function buildPersonalVaultPurchasePayload(
  anchor: PersonalVaultPriceAnchor,
  weightStr: string,
  rateStr: string,
  valueStr: string,
  makingChargePercentStr: string,
): {
  purchase_price_inr_per_gram?: string
  purchase_total_inr?: string | null
  making_charge_percent?: string | null
} {
  const mc = makingChargePercentStr.trim() || null
  const synced = syncPersonalVaultPricing(anchor, weightStr, valueStr, rateStr, makingChargePercentStr)

  if (anchor === 'total') {
    const value = valueStr.trim()
    return {
      purchase_price_inr_per_gram: synced.rate || undefined,
      purchase_total_inr: value || null,
      making_charge_percent: mc,
    }
  }

  const rate = rateStr.trim()
  return {
    purchase_price_inr_per_gram: rate || undefined,
    purchase_total_inr: synced.total || null,
    making_charge_percent: mc,
  }
}

export function derivePurchasePricePerGram(
  weightStr: string,
  rateStr: string,
  valueStr: string,
  makingChargePercentStr = '',
): string | undefined {
  const w = parsePersonalHoldingNumber(weightStr)
  const v = parsePersonalHoldingNumber(valueStr)
  // Bill total is the source of truth when provided — backs out making charge to get metal ₹/g.
  if (w > 0 && v > 0) {
    return formatRateFromPurchaseValue(weightStr, valueStr, makingChargePercentStr)
  }
  const rate = rateStr.trim()
  if (rate) return rate
  return undefined
}

export function isDerivedGoldRateFromPurchaseValue(
  weightStr: string,
  rateStr: string,
  valueStr: string,
  makingChargePercentStr = '',
): boolean {
  const w = parsePersonalHoldingNumber(weightStr)
  const v = parsePersonalHoldingNumber(valueStr)
  if (w <= 0 || v <= 0) return false
  const derived = formatRateFromPurchaseValue(weightStr, valueStr, makingChargePercentStr)
  if (!derived) return false
  const entered = rateStr.trim()
  if (!entered) return true
  return Math.abs(parsePersonalHoldingNumber(entered) - parsePersonalHoldingNumber(derived)) < 0.0001
}

export function describeDerivedGoldRate(
  weightStr: string,
  valueStr: string,
  makingChargePercentStr = '',
): string {
  const bd = breakdownPersonalVaultBill(weightStr, {
    totalStr: valueStr,
    makingChargePercentStr,
  })
  if (!bd) return ''
  const rateInr = parsePersonalHoldingNumber(bd.ratePerGram).toLocaleString('en-IN')
  const gstGold = parsePersonalHoldingNumber(bd.gstOnGoldInr).toLocaleString('en-IN')
  const gstMc = parsePersonalHoldingNumber(bd.gstOnMakingInr).toLocaleString('en-IN')
  const mc = parsePersonalHoldingNumber(makingChargePercentStr)
  if (mc > 0) {
    return `Gold rate ₹${rateInr}/g — from bill after ${mc}% making, ${resolveGstOnGoldPercent()}% GST on gold (₹${gstGold}), ${resolveGstOnMakingPercent()}% GST on making (₹${gstMc}).`
  }
  return `Gold rate ₹${rateInr}/g — from bill after ${resolveGstOnGoldPercent()}% GST on gold (₹${gstGold}).`
}

function inrLabel(n: string): string {
  return parsePersonalHoldingNumber(n).toLocaleString('en-IN')
}

/** Live bill summary for the vault form (from bill total or from gold rate). */
export function describePersonalVaultCostSummary(
  weightStr: string,
  rateStr: string,
  valueStr: string,
  makingChargePercentStr: string,
): string {
  const bd = valueStr.trim()
    ? breakdownPersonalVaultBill(weightStr, { totalStr: valueStr, makingChargePercentStr })
    : rateStr.trim()
      ? breakdownPersonalVaultBill(weightStr, { rateStr, makingChargePercentStr })
      : null
  if (!bd) return ''

  const mc = parsePersonalHoldingNumber(makingChargePercentStr)
  const bits = [
    `Metal ₹${inrLabel(bd.metalInr)}`,
    `GST on gold (${resolveGstOnGoldPercent()}%): ₹${inrLabel(bd.gstOnGoldInr)}`,
  ]
  if (mc > 0) {
    bits.push(
      `Making (${mc}%): ₹${inrLabel(bd.makingInr)}`,
      `GST on making (${resolveGstOnMakingPercent()}%): ₹${inrLabel(bd.gstOnMakingInr)}`,
    )
  }
  bits.push(`Bill total: ₹${inrLabel(bd.totalInr)}`)
  if (valueStr.trim()) {
    bits.push(`Gold rate ₹${inrLabel(bd.ratePerGram)}/g`)
  }
  return bits.join(' · ')
}

export function isGoldRateDerivedFromBill(weightStr: string, valueStr: string): boolean {
  return parsePersonalHoldingNumber(weightStr) > 0 && valueStr.trim() !== ''
}

/** When bill total is known, derive ₹/g (making charge + GST included). */
export function recalcRateFromBillOrValue(
  weightStr: string,
  rateStr: string,
  valueStr: string,
  makingChargePercentStr: string,
): { rate: string; value: string } {
  if (valueStr.trim()) {
    const synced = syncPersonalVaultPricing('total', weightStr, valueStr, rateStr, makingChargePercentStr)
    return { rate: synced.rate, value: synced.total }
  }
  if (rateStr.trim()) {
    const synced = syncPersonalVaultPricing('rate', weightStr, valueStr, rateStr, makingChargePercentStr)
    return { rate: synced.rate, value: synced.total }
  }
  return { rate: '', value: '' }
}

/** Re-derive gold ₹/g from a user-entered bill total without changing the total. */
export function recalcRateOnlyFromBillTotal(
  weightStr: string,
  valueStr: string,
  makingChargePercentStr: string,
): string {
  return syncPersonalVaultPricing('total', weightStr, valueStr, '', makingChargePercentStr).rate
}

export function purchaseValueFromHolding(h: {
  purchase_total_inr?: string | null
  purchase_cost_basis_inr: string
  purchase_price_inr_per_gram: string | null
  making_charge_percent?: string | null
  weight_grams: string
}): string {
  const stored = (h.purchase_total_inr ?? '').trim()
  if (stored) return stored

  const basis = parsePersonalHoldingNumber(h.purchase_cost_basis_inr)
  if (basis > 0 && h.purchase_price_inr_per_gram) {
    return formatPurchaseValueFromRate(
      h.weight_grams,
      h.purchase_price_inr_per_gram,
      h.making_charge_percent ?? '',
    )
  }
  const w = parsePersonalHoldingNumber(h.weight_grams)
  const r = parsePersonalHoldingNumber(h.purchase_price_inr_per_gram ?? '')
  if (w > 0 && r > 0) {
    return formatPurchaseValueFromRate(h.weight_grams, h.purchase_price_inr_per_gram ?? '', h.making_charge_percent ?? '')
  }
  return ''
}

async function readResponseJson<T extends object>(res: Response): Promise<T | null> {
  const text = await res.text()
  const t = text.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as T
  } catch {
    return null
  }
}

function parseApiDetail(parsed: Record<string, unknown> | null, fallback: string): string {
  if (!parsed) return fallback
  const detail = parsed.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const parts: string[] = []
  for (const v of Object.values(parsed)) {
    if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
    else if (typeof v === 'string' && v) parts.push(v)
  }
  return parts.join(' ') || fallback
}

function parsePersonalHoldingId(parsed: Record<string, unknown> | null): number | null {
  if (!parsed) return null
  const id = parsed.id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number.parseInt(id, 10)
  return null
}

export type PersonalPurchaseBillBreakdownDTO = {
  metal_inr: string
  making_inr: string
  gst_on_gold_inr: string
  gst_on_making_inr: string
  purchase_total_inr: string
  metal_rate_inr_per_gram: string
  gst_on_gold_percent: string
  gst_on_making_percent: string
}

export type PersonalHoldingDTO = {
  id: number
  holding_type: string
  title: string
  category: string
  weight_grams: string
  purity: string
  purchase_date: string | null
  purchase_source: string
  purchase_price_inr_per_gram: string | null
  purchase_total_inr: string | null
  making_charge_percent: string | null
  purchase_cost_basis_inr: string
  reference_gain_inr: string
  reference_gain_percent: string
  estimated_current_value_inr: string
  is_self_declared: boolean
  verification_status: string
  status_badge: string
  created_by_type: string
  created_by_id: number | null
  jeweller_id: number | null
  jeweller_name: string
  purchase_jeweller_label: string
  notes: string
  document_count: number
  created_at: string
  updated_at: string
  mvp_note: string
  purchase_bill_breakdown?: PersonalPurchaseBillBreakdownDTO | null
  is_cridorapay?: boolean
  cridorapay_reference?: string
  documents?: PersonalDocumentDTO[]
}

export type PersonalDocumentDTO = {
  id: number
  document_type: string
  original_filename: string
  invoice_number: string
  document_title: string
  remarks: string
  uploaded_by_type: string
  uploaded_by_id: number | null
  created_at: string
  mime_hint: string
  holding_id?: number
  holding_title?: string
}

export type PortfolioLedgerEntryDTO = {
  occurred_at: string
  transaction_type: string
  reference: string
  grams: string
  label: string
  jeweller_name: string
  current_value_inr: string
}

export async function fetchPersonalHolding(id: number): Promise<PersonalHoldingDTO | null> {
  const res = await authFetch(`/api/v1/portfolio/personal-holdings/${id}/`)
  if (!res.ok) return null
  return (await res.json()) as PersonalHoldingDTO
}

export async function fetchPersonalHoldings(opts?: {
  documents?: boolean
}): Promise<{ results: PersonalHoldingDTO[]; reference_gold_inr_per_gram_22k?: string } | null> {
  const q = opts?.documents ? '?documents=1' : ''
  const res = await authFetch(`/api/v1/portfolio/personal-holdings/${q}`)
  if (!res.ok) return null
  return (await res.json()) as { results: PersonalHoldingDTO[]; reference_gold_inr_per_gram_22k?: string }
}

export async function fetchPersonalVaultDocuments(): Promise<{ results: PersonalDocumentDTO[] } | null> {
  const res = await authFetch('/api/v1/portfolio/personal-holdings/documents/')
  if (!res.ok) return null
  return (await res.json()) as { results: PersonalDocumentDTO[] }
}

export type ActiveGoldLotDTO = {
  occurred_at: string
  source_type: string
  source_label: string
  reference: string
  jeweller_name: string
  grams: string
  price_inr_per_gram: string
  cost_inr: string
  live_value_inr: string
  pnl_inr: string
  pnl_percent: string
  counterparty_label?: string
  note?: string
}

export type ActiveGoldLedgerSummaryDTO = {
  lot_count: number
  vault_balance_grams?: string
  total_grams: string
  total_cost_inr: string
  total_live_value_inr: string
  total_pnl_inr: string
  total_pnl_percent: string
}

export async function fetchActiveGoldLedger(): Promise<{
  summary: ActiveGoldLedgerSummaryDTO
  lots: ActiveGoldLotDTO[]
} | null> {
  const res = await authFetch('/api/v1/portfolio/active-ledger/')
  if (!res.ok) return null
  return (await res.json()) as { summary: ActiveGoldLedgerSummaryDTO; lots: ActiveGoldLotDTO[] }
}

export async function fetchPortfolioLedger(filter: string): Promise<{ entries: PortfolioLedgerEntryDTO[] } | null> {
  const q = filter.trim() ? `?filter=${encodeURIComponent(filter)}` : ''
  const res = await authFetch(`/api/v1/portfolio/ledger/${q}`)
  if (!res.ok) return null
  return (await res.json()) as { entries: PortfolioLedgerEntryDTO[] }
}

export type InvoiceMissingField = 'title' | 'weight_grams' | 'purchase_price'

export type InvoiceExtractItemDTO = {
  title: string
  category: string
  weight_grams: string
  purity: string
  price_mode: 'rate' | 'total'
  purchase_price_inr_per_gram: string | null
  purchase_total_inr: string | null
  making_charge_percent: string | null
  confidence: 'high' | 'medium' | 'low'
  missing_fields: InvoiceMissingField[]
}

export type InvoiceExtractDTO = {
  is_legible: true
  purchase_date: string | null
  purchase_source: string
  invoice_number: string | null
  confidence: 'high' | 'medium' | 'low'
  item_count: number
  items: InvoiceExtractItemDTO[]
}

const INVOICE_MISSING_FIELDS = new Set<InvoiceMissingField>([
  'title',
  'weight_grams',
  'purchase_price',
])

function normalizeInvoiceMissingFields(raw: unknown): InvoiceMissingField[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (f): f is InvoiceMissingField =>
      typeof f === 'string' && INVOICE_MISSING_FIELDS.has(f as InvoiceMissingField),
  )
}

function normalizeInvoiceExtractItem(raw: Record<string, unknown>): InvoiceExtractItemDTO {
  const priceMode = raw.price_mode === 'total' ? 'total' : 'rate'
  const rate =
    raw.purchase_price_inr_per_gram != null
      ? String(raw.purchase_price_inr_per_gram).trim()
      : ''
  const total =
    raw.purchase_total_inr != null ? String(raw.purchase_total_inr).trim() : ''
  const mc =
    raw.making_charge_percent != null ? String(raw.making_charge_percent).trim() : ''
  const item: InvoiceExtractItemDTO = {
    title: String(raw.title ?? '').trim(),
    category: String(raw.category ?? 'ornament').trim(),
    weight_grams: String(raw.weight_grams ?? '').trim(),
    purity: normalizePersonalVaultPurity(String(raw.purity ?? DEFAULT_PERSONAL_VAULT_PURITY)),
    price_mode: total && !rate ? 'total' : priceMode,
    purchase_price_inr_per_gram: rate || null,
    purchase_total_inr: total || null,
    making_charge_percent: mc || null,
    confidence:
      raw.confidence === 'high' || raw.confidence === 'low' ? raw.confidence : 'medium',
    missing_fields: normalizeInvoiceMissingFields(raw.missing_fields),
  }
  if (item.missing_fields.length === 0) {
    item.missing_fields = computeInvoiceItemMissingFields(item)
  }
  return item
}

export function computeInvoiceItemMissingFields(
  item: Pick<
    InvoiceExtractItemDTO,
    'title' | 'weight_grams' | 'purchase_price_inr_per_gram' | 'purchase_total_inr'
  >,
): InvoiceMissingField[] {
  const missing: InvoiceMissingField[] = []
  if (!item.title.trim()) missing.push('title')
  if (!item.weight_grams.trim() || Number.parseFloat(item.weight_grams) <= 0) {
    missing.push('weight_grams')
  }
  if (!item.purchase_price_inr_per_gram?.trim() && !item.purchase_total_inr?.trim()) {
    missing.push('purchase_price')
  }
  return missing
}

export const INVOICE_MISSING_FIELD_LABELS: Record<InvoiceMissingField, string> = {
  title: 'Display title',
  weight_grams: 'Weight (grams)',
  purchase_price: 'Purchase price (rate or bill total)',
}

export async function analyzeInvoice(
  file: File,
): Promise<
  | { ok: true; data: InvoiceExtractDTO }
  | { ok: false; detail: string; notLegible?: boolean; reason?: string }
> {
  const fd = new FormData()
  fd.set('file', file)
  const res = await authUpload('/api/v1/portfolio/invoice-import/analyze/', fd)
  const parsed = await readResponseJson<
    InvoiceExtractDTO & {
      detail?: string
      reason?: string
      is_legible?: boolean
      items?: Record<string, unknown>[]
    }
  >(res)
  if (res.status === 422) {
    const reason =
      parsed && typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason
        : 'Photo is not clear enough. Please upload a sharper image.'
    return { ok: false, notLegible: true, reason, detail: reason }
  }
  if (!res.ok) {
    return { ok: false, detail: parseApiDetail(parsed, 'Could not read invoice.') }
  }
  if (!parsed || parsed.is_legible !== true) {
    return {
      ok: false,
      notLegible: true,
      reason: 'Could not read invoice details.',
      detail: 'Could not read invoice details.',
    }
  }

  let items: InvoiceExtractItemDTO[] = []
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    items = parsed.items.map((it) => normalizeInvoiceExtractItem(it))
  } else {
    items = [
      normalizeInvoiceExtractItem({
        title: (parsed as { title?: string }).title,
        category: (parsed as { category?: string }).category,
        weight_grams: (parsed as { weight_grams?: string }).weight_grams,
        purity: (parsed as { purity?: string }).purity,
        price_mode: 'rate',
        purchase_price_inr_per_gram: (parsed as { purchase_price_inr_per_gram?: string })
          .purchase_price_inr_per_gram,
        purchase_total_inr: null,
        making_charge_percent: null,
        confidence: parsed.confidence,
      }),
    ]
  }

  return {
    ok: true,
    data: {
      is_legible: true,
      purchase_date: parsed.purchase_date ?? null,
      purchase_source: String(parsed.purchase_source ?? '').trim(),
      invoice_number:
        parsed.invoice_number != null ? String(parsed.invoice_number).trim() : null,
      confidence:
        parsed.confidence === 'high' || parsed.confidence === 'low'
          ? parsed.confidence
          : 'medium',
      item_count: items.length,
      items,
    },
  }
}

export async function createPersonalHolding(body: {
  title: string
  category: string
  weight_grams: string
  purity?: string
  purchase_source?: string
  purchase_date?: string
  purchase_price_inr_per_gram?: string
  purchase_total_inr?: string
  making_charge_percent?: string
  notes?: string
}): Promise<
  { ok: true; data: PersonalHoldingDTO | null } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/portfolio/personal-holdings/', {
    method: 'POST',
    jsonBody: body as unknown as Record<string, unknown>,
  })
  const parsed = await readResponseJson<PersonalHoldingDTO & { detail?: string }>(res)
  if (!res.ok) {
    return { ok: false, detail: parseApiDetail(parsed, 'Could not create holding.') }
  }
  const id = parsePersonalHoldingId(parsed)
  if (id != null && parsed) {
    return { ok: true, data: { ...parsed, id } as PersonalHoldingDTO }
  }
  return { ok: true, data: null }
}

export function describeHoldingPurchaseSummary(h: PersonalHoldingDTO): string {
  const stored = (h.purchase_total_inr ?? '').trim()
  const rate = h.purchase_price_inr_per_gram
  const mc = (h.making_charge_percent ?? '').trim()
  const mcNum = parsePersonalHoldingNumber(mc)

  if (stored) {
    const parts = [`Paid ₹${parsePersonalHoldingNumber(stored).toLocaleString('en-IN')}`]
    if (rate) parts.push(`₹${parsePersonalHoldingNumber(rate).toLocaleString('en-IN')}/g`)
    if (mcNum > 0) parts.push(`MC ${mcNum.toLocaleString('en-IN')}%`)
    return parts.join(' · ')
  }

  if (!rate) return ''
  const parts = [`₹${parsePersonalHoldingNumber(rate).toLocaleString('en-IN')}/g`]
  if (mcNum > 0) {
    const total = purchaseValueFromHolding(h)
    if (total) parts.push(`~₹${parsePersonalHoldingNumber(total).toLocaleString('en-IN')} total`)
    parts.push(`MC ${mcNum.toLocaleString('en-IN')}%`)
  }
  return parts.join(' · ')
}

export function describeHoldingBillBreakdown(h: PersonalHoldingDTO): string {
  const bd = h.purchase_bill_breakdown
  const storedTotal = (h.purchase_total_inr ?? '').trim()
  if (bd) {
    const billTotal = storedTotal || bd.purchase_total_inr
    const bits = [
      `Metal ₹${parsePersonalHoldingNumber(bd.metal_inr).toLocaleString('en-IN')}`,
      `GST on gold (${bd.gst_on_gold_percent}%): ₹${parsePersonalHoldingNumber(bd.gst_on_gold_inr).toLocaleString('en-IN')}`,
    ]
    if (parsePersonalHoldingNumber(bd.making_inr) > 0) {
      bits.push(
        `Making: ₹${parsePersonalHoldingNumber(bd.making_inr).toLocaleString('en-IN')}`,
        `GST on making (${bd.gst_on_making_percent}%): ₹${parsePersonalHoldingNumber(bd.gst_on_making_inr).toLocaleString('en-IN')}`,
      )
    }
    bits.push(`Bill total: ₹${parsePersonalHoldingNumber(billTotal).toLocaleString('en-IN')}`)
    return bits.join(' · ')
  }
  if (!h.purchase_price_inr_per_gram) return ''
  return describePersonalVaultCostSummary(
    h.weight_grams,
    h.purchase_price_inr_per_gram,
    purchaseValueFromHolding(h),
    h.making_charge_percent ?? '',
  )
}

export async function updatePersonalHolding(
  id: number,
  body: Partial<{
    title: string
    category: string
    weight_grams: string
    purity: string
    purchase_source: string
    purchase_date: string | null
    purchase_price_inr_per_gram: string | null
    purchase_total_inr?: string | null
    making_charge_percent: string | null
    notes: string
  }>,
): Promise<
  { ok: true; data: PersonalHoldingDTO | null } | { ok: false; detail: string }
> {
  const res = await authFetch(`/api/v1/portfolio/personal-holdings/${id}/`, {
    method: 'PATCH',
    jsonBody: body as unknown as Record<string, unknown>,
  })
  const parsed = await readResponseJson<PersonalHoldingDTO & { detail?: string }>(res)
  if (!res.ok) {
    return { ok: false, detail: parseApiDetail(parsed, 'Could not update holding.') }
  }
  const parsedId = parsePersonalHoldingId(parsed)
  if (parsedId != null && parsed) {
    return { ok: true, data: { ...parsed, id: parsedId } as PersonalHoldingDTO }
  }
  return { ok: true, data: null }
}

export async function uploadPersonalDocument(
  holdingId: number,
  form: FormData,
): Promise<{ ok: true; data: PersonalDocumentDTO } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/portfolio/personal-holdings/${holdingId}/documents/`, {
    method: 'POST',
    body: form,
  })
  const parsed = await readResponseJson<PersonalDocumentDTO & { detail?: string }>(res)
  if (!res.ok) {
    const detail =
      parsed && typeof parsed.detail === 'string' && parsed.detail.trim()
        ? parsed.detail
        : 'Upload failed.'
    return { ok: false, detail }
  }
  return { ok: true, data: (parsed ?? {}) as PersonalDocumentDTO }
}

export async function deletePersonalHolding(id: number): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/portfolio/personal-holdings/${id}/`, { method: 'DELETE' })
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { detail?: string }
    return { ok: false, detail: d.detail ?? 'Could not remove.' }
  }
  return { ok: true }
}

export async function deletePersonalDocument(
  holdingId: number,
  docId: number,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await authFetch(`/api/v1/portfolio/personal-holdings/${holdingId}/documents/${docId}/`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { detail?: string }
    return { ok: false, detail: d.detail ?? 'Could not delete.' }
  }
  return { ok: true }
}

export function openPersonalDocumentDownload(holdingId: number, docId: number): void {
  const token = getStoredAccess()
  const url = apiUrl(`/api/v1/portfolio/personal-holdings/${holdingId}/documents/${docId}/download/`)
  if (token) {
    void fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const o = URL.createObjectURL(blob)
        const x = document.createElement('a')
        x.href = o
        x.download = `document-${docId}`
        x.click()
        URL.revokeObjectURL(o)
      })
      .catch(() => {
        window.open(url, '_blank', 'noopener')
      })
    return
  }
  window.open(url, '_blank', 'noopener')
}

export type JewellerCustomerLookupDTO = {
  found: boolean
  customer?: { id: number; label: string; cridora_member_id: string; phone: string }
  detail?: string
}

export async function jewellerLookupCustomer(params: {
  cridora_member_id?: string
  phone?: string
}): Promise<JewellerCustomerLookupDTO> {
  const sp = new URLSearchParams()
  if (params.cridora_member_id?.trim()) sp.set('cridora_member_id', params.cridora_member_id.trim())
  if (params.phone?.trim()) sp.set('phone', params.phone.trim())
  const res = await authFetch(`/api/v1/jeweller/customers/lookup/?${sp.toString()}`)
  const data = (await res.json()) as JewellerCustomerLookupDTO & { detail?: string }
  if (!res.ok) return { found: false, detail: data.detail ?? 'Not found.' }
  return data
}

export async function jewellerCreatePersonalHolding(
  form: FormData,
): Promise<{ ok: true; data: PersonalHoldingDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/jeweller/personal-holdings/', { method: 'POST', body: form })
  const data = (await res.json()) as PersonalHoldingDTO & { detail?: string }
  if (!res.ok) return { ok: false, detail: data.detail ?? 'Could not add holding.' }
  return { ok: true, data: data as PersonalHoldingDTO }
}
