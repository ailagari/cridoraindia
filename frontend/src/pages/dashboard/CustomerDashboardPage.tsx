import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { GoldTransferPanel } from '@/features/gold/GoldTransferPanel'
import { FractionalPurchasePanel } from '@/features/invest/FractionalPurchasePanel'
import { CustomerKycWorkflow } from '@/features/customer/CustomerKycWorkflow'
import { CustomerPortfolioPanel } from '@/features/portfolio/CustomerPortfolioPanel'
import { useAuth } from '@/context/AuthContext'
import {
  CUSTOMER_DEFAULT_SECTION,
  CUSTOMER_NAV_GROUPS,
  normalizeCustomerSection,
} from '@/lib/mobileNav/customerNav'

function customerTitle(section: string): string {
  const row = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.sectionKey === section)
  if (row) {
    const hub = CUSTOMER_NAV_GROUPS.find((g) => g.items.some((i) => i.sectionKey === section))
    return hub ? `${hub.label} · ${row.label}` : row.label
  }
  return 'Dashboard'
}

function HubPlaceholder({ title, children }: { title: string; children: string }) {
  return (
    <div className="dash-panel-max">
      <div className="dash-coming dash-coming--payments">
        <h2 className="dash-coming__title">{title}</h2>
        <p className="dash-coming__text">{children}</p>
      </div>
    </div>
  )
}

export function CustomerDashboardPage() {
  const { refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const rawSection = params.get('section')

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const normalized = normalizeCustomerSection(rawSection)
  const active = normalized ?? CUSTOMER_DEFAULT_SECTION

  const setSection = useCallback(
    (key: string) => {
      setParams(key === CUSTOMER_DEFAULT_SECTION ? {} : { section: key }, { replace: true })
    },
    [setParams],
  )

  useEffect(() => {
    if (!rawSection) return
    const n = normalizeCustomerSection(rawSection)
    if (n && n !== rawSection) {
      setParams({ section: n }, { replace: true })
    } else if (!n) {
      setParams({}, { replace: true })
    }
  }, [rawSection, setParams])

  const head = useMemo(() => customerTitle(active), [active])

  return (
    <DashboardLayout
      role="customer"
      navGroups={CUSTOMER_NAV_GROUPS}
      activeSection={active}
      onSectionChange={setSection}
      title={head}
    >
      {active === 'portfolio_overview' ? <CustomerPortfolioPanel /> : null}
      {active === 'portfolio_holdings' ? (
        <HubPlaceholder
          title="Holdings & ledgers"
          children="Per-jeweller ledgers for fractional gold, gold deposit, and GoldNest — grams, dates, lock-in, live value, and redemption eligibility once APIs expose full detail."
        />
      ) : null}
      {active === 'portfolio_pnl' ? (
        <HubPlaceholder
          title="Profit / loss"
          children="Live P/L vs invested amount and period filters tie to the same live gold rate feed as your overview; tax lots follow when transaction history exports ship."
        />
      ) : null}
      {active === 'portfolio_locked' ? (
        <HubPlaceholder
          title="Lock-in"
          children="During jeweller-configured lock-in (15 days–12 months): no cash redemption, transfer, loan, or emergency draw on affected grams — schedules and redeemable balances surface here."
        />
      ) : null}
      {active === 'portfolio_activity' ? (
        <HubPlaceholder
          title="Activity"
          children="Unified timeline for fractional buys, deposits, GoldNest instalments, transfers, ornament and cash redemption, loans, and emergency fund use — instant gram debits across every path."
        />
      ) : null}
      {active.startsWith('shop_') ? (
        <HubPlaceholder
          title="Marketplace"
          children="Jeweller network: compare live rate, sellback, lock-in, same-store making-charge benefits, and cross-redemption fees. Product catalogue: BIS 916 ornaments with “Use your gold” pricing. Prefer full web marketplace until this hub is API-complete."
        />
      ) : null}
      {active === 'invest_fractional' ? (
        <div className="dash-panel-max">
          <FractionalPurchasePanel />
        </div>
      ) : null}
      {active.startsWith('invest_') && active !== 'invest_fractional' ? (
        <HubPlaceholder
          title="Grow gold"
          children="Fractional purchase lives on this hub under “Fractional purchase”. Verified gold deposit and single-structure GoldNest (recurring contributions, maturity, optional making-charge benefits) — payment and jeweller policy hooks land with backend milestones."
        />
      ) : null}
      {active.startsWith('redeem_') && active !== 'redeem_transfer' ? (
        <HubPlaceholder
          title="Use gold"
          children="Ornament redemption (same-jeweller MC benefits vs cross-jeweller fees), cash sellback via your jeweller’s rate and deductions, zero-interest gold loans (2% processing), Cridora username/phone transfers with double confirmation, and emergency liquidity up to 80% portfolio."
        />
      ) : null}
      {active === 'redeem_transfer' ? <GoldTransferPanel roleLabel="customer" /> : null}
      {active === 'profile_kyc' ? (
        <div className="dash-panel-max">
          <CustomerKycWorkflow />
        </div>
      ) : null}
      {active === 'profile_account' ? (
        <HubPlaceholder
          title="Account"
          children="Personal details, contact, and linked devices — profile service integration pending."
        />
      ) : null}
      {active === 'profile_security' ? (
        <HubPlaceholder
          title="Security"
          children="Password, passkeys, and session management will be configured here."
        />
      ) : null}
      {active === 'profile_notifications' ? (
        <HubPlaceholder
          title="Alerts"
          children="Push, email, and SMS preferences for ledger, price, and KYC events — use the header bell for the preview inbox until preferences API exists."
        />
      ) : null}
      {active === 'profile_payments' ? (
        <HubPlaceholder
          title="Payments & mandates"
          children="UPI mandates, settlement accounts, and INR receipts mirror Cridora v2 settlements when backends connect."
        />
      ) : null}
      {active === 'profile_settings' ? (
        <HubPlaceholder
          title="Settings"
          children="Locale, accessibility, theme, and data export toggles ship with platform settings rollout."
        />
      ) : null}
    </DashboardLayout>
  )
}
