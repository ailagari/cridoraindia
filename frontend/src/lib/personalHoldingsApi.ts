import { authFetch, authUpload, apiUrl, getStoredAccess } from '@/lib/api'
import type { PortfolioTotalsDTO } from '@/lib/goldTransferApi'

export type { PortfolioTotalsDTO }

export function parsePersonalHoldingNumber(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function metalValueMultiplier(makingChargePercentStr: string): number {
  const mc = parsePersonalHoldingNumber(makingChargePercentStr)
  if (mc <= 0) return 1
  return 1 + mc / 100
}

export function formatPurchaseValueFromRate(
  weightStr: string,
  rateStr: string,
  makingChargePercentStr = '',
): string {
  const w = parsePersonalHoldingNumber(weightStr)
  const r = parsePersonalHoldingNumber(rateStr)
  if (w <= 0 || r <= 0) return ''
  const metal = w * r
  return (metal * metalValueMultiplier(makingChargePercentStr)).toFixed(2)
}

export function formatRateFromPurchaseValue(
  weightStr: string,
  valueStr: string,
  makingChargePercentStr = '',
): string {
  const w = parsePersonalHoldingNumber(weightStr)
  const v = parsePersonalHoldingNumber(valueStr)
  if (w <= 0 || v <= 0) return ''
  const metal = v / metalValueMultiplier(makingChargePercentStr)
  return (metal / w).toFixed(4)
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
  const w = parsePersonalHoldingNumber(weightStr)
  const v = parsePersonalHoldingNumber(valueStr)
  if (w <= 0 || v <= 0) return ''
  const rate = formatRateFromPurchaseValue(weightStr, valueStr, makingChargePercentStr)
  if (!rate) return ''
  const rateInr = parsePersonalHoldingNumber(rate).toLocaleString('en-IN')
  const mc = parsePersonalHoldingNumber(makingChargePercentStr)
  if (mc > 0) {
    return `Gold rate ₹${rateInr}/g calculated from bill total after ${mc}% making charge.`
  }
  return `Gold rate ₹${rateInr}/g calculated from bill total ÷ weight.`
}

export function isGoldRateDerivedFromBill(weightStr: string, valueStr: string): boolean {
  return parsePersonalHoldingNumber(weightStr) > 0 && valueStr.trim() !== ''
}

/** When bill total is known, always derive ₹/g from it (making charge strips out MC first). */
export function recalcRateFromBillOrValue(
  weightStr: string,
  rateStr: string,
  valueStr: string,
  makingChargePercentStr: string,
): { rate: string; value: string } {
  if (valueStr.trim()) {
    return {
      rate: formatRateFromPurchaseValue(weightStr, valueStr, makingChargePercentStr),
      value: valueStr,
    }
  }
  if (rateStr.trim()) {
    return {
      rate: rateStr,
      value: formatPurchaseValueFromRate(weightStr, rateStr, makingChargePercentStr),
    }
  }
  return { rate: '', value: '' }
}

export function purchaseValueFromHolding(h: {
  purchase_cost_basis_inr: string
  purchase_price_inr_per_gram: string | null
  making_charge_percent?: string | null
  weight_grams: string
}): string {
  const basis = parsePersonalHoldingNumber(h.purchase_cost_basis_inr)
  const mc = parsePersonalHoldingNumber(h.making_charge_percent ?? '')
  if (basis > 0) {
    if (mc > 0) return (basis * metalValueMultiplier(h.making_charge_percent ?? '')).toFixed(2)
    return h.purchase_cost_basis_inr
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

export type InvoiceExtractDTO = {
  is_legible: true
  title: string
  category: string
  weight_grams: string
  purity: string
  purchase_date: string | null
  purchase_source: string
  purchase_price_inr_per_gram: string | null
  invoice_number: string | null
  confidence: 'high' | 'medium' | 'low'
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
    InvoiceExtractDTO & { detail?: string; reason?: string; is_legible?: boolean }
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
  return {
    ok: true,
    data: {
      is_legible: true,
      title: String(parsed.title ?? '').trim(),
      category: String(parsed.category ?? 'ornament').trim(),
      weight_grams: String(parsed.weight_grams ?? '').trim(),
      purity: String(parsed.purity ?? 'BIS 916').trim() || 'BIS 916',
      purchase_date: parsed.purchase_date ?? null,
      purchase_source: String(parsed.purchase_source ?? '').trim(),
      purchase_price_inr_per_gram:
        parsed.purchase_price_inr_per_gram != null
          ? String(parsed.purchase_price_inr_per_gram).trim()
          : null,
      invoice_number:
        parsed.invoice_number != null ? String(parsed.invoice_number).trim() : null,
      confidence:
        parsed.confidence === 'high' || parsed.confidence === 'low'
          ? parsed.confidence
          : 'medium',
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
