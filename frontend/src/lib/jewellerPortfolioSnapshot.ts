import { jewellerFractionalOrdersDesk } from '@/lib/fractionalPurchaseApi'
import { jewellerGoldDepositPending } from '@/lib/goldDepositApi'
import {
  fetchGoldWallet,
  fetchJewellerCustodyVaults,
  fetchJewellerPrimaryCustomers,
  fetchJewellerSellbacks,
  type LiabilityCreditRowDTO,
} from '@/lib/goldTransferApi'
import { fetchJewellerOrnamentRedemptions } from '@/lib/jewellerOrnamentRedemptionsApi'
import { authFetch } from '@/lib/api'

function parseN(s: string | undefined): number {
  const n = Number.parseFloat(s ?? '')
  return Number.isFinite(n) ? n : 0
}

export type JewellerPortfolioSnapshot = {
  liabilityGrams: number
  vaultGrams: number
  custodyGrams: number
  custodyValueInr: number
  depositGrams: number
  fractionalGrams: number
  schemeGrams: number
  customerCount: number
  primaryCustomerCount: number
  primaryVaultGramsTotal: number
  primaryEstimatedValueInr: number
  investmentSalesInr: number
  ornamentRevenueInr: number
  depositValueInr: number
  totalSalesInr: number
  pendingPurchases: number
  pendingDeposits: number
  pendingSellbacks: number
  pendingCross: number
  pendingTotal: number
  recentCredits: LiabilityCreditRowDTO[]
  ledgerRevenueInr: number
  loanOutstandingInr: number
  activeLoanCount: number
  pendingLoanCount: number
}

export async function fetchJewellerPortfolioSnapshot(): Promise<JewellerPortfolioSnapshot | null> {
  const [wallet, custody, primaryCustomers, purchaseDesk, pendingDeposits, ornaments, sellbacks, crossInbox] =
    await Promise.all([
      fetchGoldWallet(),
      fetchJewellerCustodyVaults(),
      fetchJewellerPrimaryCustomers(),
      jewellerFractionalOrdersDesk(),
      jewellerGoldDepositPending(),
      fetchJewellerOrnamentRedemptions(),
      fetchJewellerSellbacks(),
      authFetch('/api/v1/jeweller/cross-redemption/inbox/').then(async (res) => {
        if (!res.ok) return [] as unknown[]
        const body = (await res.json()) as { results?: unknown[] }
        return Array.isArray(body.results) ? body.results : []
      }),
    ])

  if (!wallet) return null

  let depositGrams = 0
  let fractionalGrams = 0
  let schemeGrams = 0
  let depositValueInr = 0
  for (const row of custody?.results ?? []) {
    depositGrams += parseN(row.deposit_grams)
    fractionalGrams += parseN(row.fractional_grams)
    schemeGrams += parseN(row.golden_scheme_grams)
    depositValueInr += parseN(row.estimated_total_vault_value_inr)
  }

  const pendingPurchaseRows = purchaseDesk.ok ? purchaseDesk.data.pending : []
  const pendingActionCount = purchaseDesk.ok ? purchaseDesk.data.summary.pending_action_count : 0
  const investmentSalesInr = pendingPurchaseRows.reduce((s, r) => s + parseN(r.total_inr), 0)
  const ornamentRows = ornaments.ok ? ornaments.results : []
  const ornamentRevenueInr = ornamentRows.reduce((s, r) => s + parseN(r.final_invoice_inr), 0)
  const pendingSellbacks = (sellbacks?.results ?? []).filter(
    (r) => r.status === 'pending' || r.status === 'accepted',
  ).length

  const pendingCross = crossInbox.filter((r) => {
    const row = r as { inbox_status?: string }
    const st = (row.inbox_status ?? '').toLowerCase()
    return st.includes('pending') || st.includes('awaiting') || st.includes('otp')
  }).length

  const depositPendingInr = pendingDeposits.reduce((s, r) => s + parseN(r.estimated_value_inr), 0)
  const ledgerRevenueInr = parseN(wallet.jeweller_total_revenue_inr)
  const loanOutstandingInr = parseN(
    wallet.jeweller_portfolio?.loan_summary?.total_principal_outstanding_inr,
  )
  const activeLoanCount = wallet.jeweller_portfolio?.loan_summary?.active_loan_count ?? 0
  const pendingLoanCount = wallet.jeweller_portfolio?.loan_summary?.pending_request_count ?? 0

  return {
    liabilityGrams: parseN(wallet.custodial_liability_grams),
    vaultGrams: parseN(wallet.balance_grams),
    custodyGrams: parseN(custody?.custodian_vault_grams_total),
    custodyValueInr: parseN(custody?.custodian_estimated_value_inr_total),
    depositGrams,
    fractionalGrams,
    schemeGrams,
    customerCount: custody?.results?.length ?? 0,
    primaryCustomerCount: primaryCustomers?.primary_customer_count ?? 0,
    primaryVaultGramsTotal: parseN(primaryCustomers?.primary_vault_grams_total),
    primaryEstimatedValueInr: parseN(primaryCustomers?.primary_estimated_value_inr_total),
    investmentSalesInr,
    ornamentRevenueInr,
    depositValueInr: depositPendingInr > 0 ? depositPendingInr : depositValueInr,
    totalSalesInr: investmentSalesInr + ornamentRevenueInr,
    pendingPurchases: pendingActionCount,
    pendingDeposits: pendingDeposits.length,
    pendingSellbacks,
    pendingCross,
    pendingTotal: pendingActionCount + pendingDeposits.length + pendingSellbacks + pendingCross,
    recentCredits: wallet.recent_liability_credits ?? [],
    ledgerRevenueInr,
    loanOutstandingInr,
    activeLoanCount,
    pendingLoanCount,
  }
}
