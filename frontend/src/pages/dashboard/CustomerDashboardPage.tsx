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

function ComingSoon({ title, children }: { title: string; children: string }) {
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
        <ComingSoon title="Vaults & ledgers" children="Per-jeweller balances (fractional, deposit, schemes) appear here as ledger APIs roll out." />
      ) : null}
      {active.startsWith('shop_') ? (
        <ComingSoon
          title="Marketplace"
          children="Browse verified jewellers and BIS 916 products on the public site — this hub links deeper workflows when they are connected."
        />
      ) : null}
      {active === 'invest_fractional' ? (
        <div className="dash-panel-max">
          <FractionalPurchasePanel />
        </div>
      ) : null}
      {active === 'redeem_hub' ? (
        <ComingSoon
          title="Redeem & liquidity"
          children="Ornament redemption, cash sellback, loans, and emergency liquidity — coordinated with your vault balances."
        />
      ) : null}
      {active === 'redeem_transfer' ? <GoldTransferPanel roleLabel="customer" /> : null}
      {active === 'profile_kyc' ? (
        <div className="dash-panel-max">
          <CustomerKycWorkflow />
        </div>
      ) : null}
      {active === 'profile_more' ? (
        <ComingSoon title="Account" children="Security, notifications, and payout preferences — consolidated here as services go live." />
      ) : null}
    </DashboardLayout>
  )
}
