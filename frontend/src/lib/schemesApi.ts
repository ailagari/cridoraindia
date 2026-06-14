import { authFetch } from '@/lib/api'

export type SchemeDesign = {
  input: Record<string, unknown>
  plan_timeline: Record<string, unknown>
  output: Record<string, unknown>
  jeweller_can_override?: string[]
}

export type SchemeTemplateDTO = {
  id: number
  slug: string
  name: string
  description: string
  category: string
  icon_key?: string
  sort_order?: number
  scheme_design: SchemeDesign
  flow_summary: string
  status: string
  published_at: string | null
  created_at?: string
  updated_at?: string
}

export type SchemeOfferingDTO = {
  id: number
  display_name: string
  customer_facing_note: string
  flow_summary: string
  category: string
  template_id: number
  template_slug: string
  status: string
  scheme_design: SchemeDesign
  jeweller_overrides_allowed: string[]
}

export type SchemeEnrollmentDTO = {
  id: number
  status: string
  current_cycle_number: number
  current_plan_month: number
  cycle_anchor_date: string
  started_at: string
  offering: SchemeOfferingDTO
  jeweller: { id: number; business_name: string }
  balances: {
    inr_balance: string
    gold_grams_balance: string
    making_charge_credit_inr: string
  }
  month_buckets: Array<{
    month_index: number
    calendar_month: string
    monthly_total_inr: string
    monthly_total_grams: string
    deposit_count: number
    is_customer_month: boolean
    is_bonus_month: boolean
  }>
}

export type SchemeContributionDTO = {
  id: number
  reference: string
  enrollment_id: number
  calendar_month: string
  deposit_sequence_in_month: number
  amount_inr: string
  gold_grams: string
  gold_value_inr_pre_gst: string
  gst_percent: string
  gst_inr: string
  making_charge_inr: string
  metal_rate_inr_per_gram: string
  payment_method: string
  status: string
  customer_note: string
  created_at: string
  completed_at: string | null
  payee_upi_vpa?: string
  payment_note?: string
  payment_expires_at?: string | null
  upi_utr?: string
  otp?: string
  otp_expires_at?: string
  otp_ttl_seconds?: number
  payment?: {
    reference: string
    payee_vpa: string
    payee_name: string
    amount_inr: string
    payment_note: string
    upi_uri: string
    payment_expires_at: string | null
    expired: boolean
  }
}

export type SchemePresetDTO = {
  key: string
  label: string
  description: string
}

async function schemesFetch<T>(
  path: string,
  init?: RequestInit & { jsonBody?: Record<string, unknown> },
): Promise<T> {
  const { jsonBody, ...rest } = init ?? {}
  const res = await authFetch(path, {
    ...rest,
    ...(jsonBody !== undefined ? { method: rest.method ?? 'POST', jsonBody } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as T & { detail?: string }
  if (!res.ok) {
    throw new Error(data.detail != null ? String(data.detail) : 'Request failed')
  }
  return data as T
}

// Admin
export function fetchAdminSchemeTemplates(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return schemesFetch<SchemeTemplateDTO[]>(`/api/v1/admin/schemes/templates/${q}`)
}

export function createAdminSchemeTemplate(body: {
  name: string
  description?: string
  scheme_design: SchemeDesign
}) {
  return schemesFetch<SchemeTemplateDTO>('/api/v1/admin/schemes/templates/', {
    method: 'POST',
    jsonBody: body,
  })
}

export function updateAdminSchemeTemplate(id: number, body: Partial<SchemeTemplateDTO>) {
  return schemesFetch<SchemeTemplateDTO>(`/api/v1/admin/schemes/templates/${id}/`, {
    method: 'PATCH',
    jsonBody: body,
  })
}

export function publishAdminSchemeTemplate(id: number) {
  return schemesFetch<SchemeTemplateDTO>(`/api/v1/admin/schemes/templates/${id}/publish/`, {
    method: 'POST',
    jsonBody: {},
  })
}

export function previewAdminSchemeDesign(
  id: number | null,
  scheme_design: SchemeDesign,
  sample_deposit_inr = 5000,
) {
  const path = id
    ? `/api/v1/admin/schemes/templates/${id}/preview/`
    : '/api/v1/admin/schemes/templates/0/preview/'
  return schemesFetch<Record<string, unknown>>(path, {
    method: 'POST',
    jsonBody: { scheme_design, sample_deposit_inr },
  })
}

export function fetchSchemePresets() {
  return schemesFetch<SchemePresetDTO[]>('/api/v1/admin/schemes/templates/presets/')
}

export function createFromPreset(key: string, name?: string) {
  return schemesFetch<SchemeTemplateDTO>(`/api/v1/admin/schemes/templates/from-preset/${key}/`, {
    method: 'POST',
    jsonBody: { name },
  })
}

export function fetchAdminSchemeRequests(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return schemesFetch<
    Array<{
      id: number
      jeweller_name: string
      title: string
      description: string
      status: string
      admin_notes: string
      created_at: string
    }>
  >(`/api/v1/admin/schemes/requests/${q}`)
}

// Jeweller
export function fetchJewellerSchemeCatalog(params?: { q?: string; category?: string }) {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.category) sp.set('category', params.category)
  const q = sp.toString() ? `?${sp}` : ''
  return schemesFetch<SchemeTemplateDTO[]>(`/api/v1/jeweller/schemes/catalog/${q}`)
}

export function fetchJewellerSchemeOfferings() {
  return schemesFetch<SchemeOfferingDTO[]>('/api/v1/jeweller/schemes/offerings/')
}

export function createJewellerSchemeOffering(body: {
  template_id: number
  display_name?: string
  customer_facing_note?: string
  jeweller_overrides?: Record<string, unknown>
}) {
  return schemesFetch<SchemeOfferingDTO>('/api/v1/jeweller/schemes/offerings/', {
    method: 'POST',
    jsonBody: body,
  })
}

export function fetchJewellerPendingSchemeContributions() {
  return schemesFetch<{ results: SchemeContributionDTO[] }>(
    '/api/v1/jeweller/schemes/contributions/pending/',
  )
}

export function fetchJewellerPendingSchemeUpi() {
  return schemesFetch<{ results: SchemeContributionDTO[] }>(
    '/api/v1/jeweller/schemes/contributions/pending-upi/',
  )
}

export function verifySchemeContributionOtp(id: number, otp: string) {
  return schemesFetch<SchemeContributionDTO>(
    `/api/v1/jeweller/schemes/contributions/${id}/verify/`,
    { method: 'POST', jsonBody: { otp } },
  )
}

export function approveSchemeContribution(id: number) {
  return schemesFetch<SchemeContributionDTO>(
    `/api/v1/jeweller/schemes/contributions/${id}/approve/`,
    { method: 'POST', jsonBody: {} },
  )
}

export function rejectSchemeContribution(id: number) {
  return schemesFetch<SchemeContributionDTO>(
    `/api/v1/jeweller/schemes/contributions/${id}/reject/`,
    { method: 'POST', jsonBody: {} },
  )
}

export function confirmSchemeBonus(id: number) {
  return schemesFetch<{ id: number; status: string }>(
    `/api/v1/jeweller/schemes/cycles/${id}/confirm-bonus/`,
    { method: 'POST', jsonBody: {} },
  )
}

// Customer
export function fetchCustomerSchemeOfferings(jewellerId: number) {
  return schemesFetch<SchemeOfferingDTO[]>(
    `/api/v1/schemes/offerings/?jeweller_id=${jewellerId}`,
  )
}

export function fetchCustomerSchemeEnrollments(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return schemesFetch<SchemeEnrollmentDTO[]>(`/api/v1/schemes/enrollments/${q}`)
}

export function enrollCustomerScheme(offeringId: number) {
  return schemesFetch<SchemeEnrollmentDTO>('/api/v1/schemes/enrollments/', {
    method: 'POST',
    jsonBody: { offering_id: offeringId },
  })
}

export function quoteSchemeContribution(enrollmentId: number, amountInr: string) {
  return schemesFetch<Record<string, string>>('/api/v1/schemes/contributions/quote/', {
    method: 'POST',
    jsonBody: { enrollment_id: enrollmentId, amount_inr: amountInr },
  })
}

export function createSchemeContribution(body: {
  enrollment_id: number
  amount_inr: string
  payment_method: 'upi' | 'counter'
  customer_note?: string
}) {
  return schemesFetch<SchemeContributionDTO>('/api/v1/schemes/contributions/', {
    method: 'POST',
    jsonBody: body,
  })
}

export function issueSchemeCounterOtp(contributionId: number) {
  return schemesFetch<SchemeContributionDTO>(
    `/api/v1/schemes/contributions/${contributionId}/counter-otp/`,
    { method: 'POST', jsonBody: {} },
  )
}

export function fetchSchemeContributionPayment(contributionId: number) {
  return schemesFetch<SchemeContributionDTO>(
    `/api/v1/schemes/contributions/${contributionId}/payment/`,
  )
}

export function submitSchemeContributionUtr(contributionId: number, utr: string) {
  return schemesFetch<SchemeContributionDTO>(
    `/api/v1/schemes/contributions/${contributionId}/submit-utr/`,
    { method: 'POST', jsonBody: { utr } },
  )
}
