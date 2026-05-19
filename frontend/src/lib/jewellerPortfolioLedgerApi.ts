import { authFetch } from '@/lib/api'

export type JewellerLedgerEntryDTO = {
  occurred_at: string
  transaction_type: string
  reference: string
  grams: string
  amount_inr: string
  label: string
  customer_label: string
  current_value_inr: string
  loan_status?: string
}

export type JewellerLoanCustomerSummaryDTO = {
  customer_id: number
  customer_label: string
  customer_member_id: string
  pending_count: number
  active_count: number
  total_principal_outstanding_inr: string
  total_collateral_locked_grams: string
  loans: {
    id: number
    reference: string
    status: string
    grams: string
    gross_principal_inr: string
    principal_paid_inr: string
    principal_outstanding_inr: string
    net_disbursement_inr: string
    term_months: number
    due_at: string
    updated_at: string
  }[]
}

export type JewellerPortfolioLedgerDTO = {
  entries: JewellerLedgerEntryDTO[]
  revenue_summary: {
    total_revenue_inr: string
    by_kind: Record<string, string>
  }
  loan_summary: {
    active_loan_count: number
    total_principal_outstanding_inr: string
    pending_request_count: number
  }
  loan_customers: JewellerLoanCustomerSummaryDTO[]
}

export async function fetchJewellerPortfolioLedger(
  filter: string,
): Promise<JewellerPortfolioLedgerDTO | null> {
  const q = filter.trim() ? `?filter=${encodeURIComponent(filter)}` : ''
  const res = await authFetch(`/api/v1/jeweller/portfolio/ledger/${q}`)
  if (!res.ok) return null
  return (await res.json()) as JewellerPortfolioLedgerDTO
}
