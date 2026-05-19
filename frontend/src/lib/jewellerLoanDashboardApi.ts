import { authFetch } from '@/lib/api'

export type JewellerLoanRepaymentDTO = {
  id: number
  amount_inr: string
  principal_after_inr: string
  created_at: string
}

export type JewellerLoanOpenRepaymentDTO = {
  id: number
  reference: string
  amount_inr: string
  status: string
  created_at: string
  updated_at: string
}

export type JewellerLoanBookRowDTO = {
  id: number
  reference: string
  status: string
  customer_id: number
  customer_label: string
  customer_phone: string
  customer_member_id: string
  grams: string
  collateral_locked_grams: string
  collateral_fractional_grams: string
  collateral_deposit_grams: string
  collateral_value_inr: string
  ltv_percent: string
  gross_principal_inr: string
  principal_paid_inr: string
  principal_outstanding_inr: string
  processing_fee_inr: string
  net_disbursement_inr: string
  term_months: number
  payment_method: string
  created_at: string
  updated_at: string
  disbursed_at: string
  due_at: string
  collateral_released: string
  repayments: JewellerLoanRepaymentDTO[]
  total_repaid_inr: string
  open_repayment_request: JewellerLoanOpenRepaymentDTO | null
}

export type JewellerLoanDashboardSummaryDTO = {
  total_loan_count: string
  active_loan_count: string
  repaid_loan_count: string
  pending_disbursement_count: string
  pending_repayment_count: string
  total_gross_principal_disbursed_inr: string
  total_net_cash_disbursed_inr: string
  total_principal_repaid_inr: string
  total_principal_outstanding_inr: string
  total_collateral_locked_grams: string
}

export type JewellerLoanLedgerRowDTO = {
  occurred_at: string
  transaction_type: string
  reference: string
  grams: string
  customer_label: string
  customer_id: number
  amount_inr: string
  principal_outstanding_inr: string
  loan_status: string
  label: string
}

export type JewellerLoanCustomerBucketDTO = {
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

export type JewellerLoanPendingRepaymentDTO = {
  id: number
  reference: string
  loan_id: number
  loan_reference: string
  amount_inr: string
  status: string
  customer_id: number
  customer_label: string
  principal_outstanding_inr: string
  created_at: string
  updated_at: string
}

export type JewellerLoanDashboardDTO = {
  summary: JewellerLoanDashboardSummaryDTO
  loans: JewellerLoanBookRowDTO[]
  repayment_ledger: JewellerLoanLedgerRowDTO[]
  customers: JewellerLoanCustomerBucketDTO[]
  pending_disbursements: JewellerLoanBookRowDTO[]
  pending_repayments: JewellerLoanPendingRepaymentDTO[]
}

export async function fetchJewellerLoanDashboard(): Promise<JewellerLoanDashboardDTO | null> {
  const res = await authFetch('/api/v1/jeweller/loans/dashboard/')
  if (!res.ok) return null
  return (await res.json()) as JewellerLoanDashboardDTO
}
