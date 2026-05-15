import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { CustomerJewellersBrowsePanel } from '@/features/marketplace/CustomerJewellersBrowsePanel'
import { CustomerProductsBrowsePanel } from '@/features/marketplace/CustomerProductsBrowsePanel'
import { GoldTransferPanel } from '@/features/gold/GoldTransferPanel'
import { CustomerDepositInfoPanel } from '@/features/invest/CustomerDepositInfoPanel'
import { FractionalPurchasePanel } from '@/features/invest/FractionalPurchasePanel'
import { CustomerKycWorkflow } from '@/features/customer/CustomerKycWorkflow'
import { CustomerPortfolioPanel } from '@/features/portfolio/CustomerPortfolioPanel'
import { CustomerVaultsPanel } from '@/features/portfolio/CustomerVaultsPanel'
import { CustomerSellbackPanel } from '@/features/redeem/CustomerSellbackPanel'
import { useAuth } from '@/context/AuthContext'
import { LIVE_PROFILE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
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

  useLivePoll(refreshProfile, LIVE_PROFILE_POLL_MS, true)

  const normalized = normalizeCustomerSection(rawSection)
  const active = normalized ?? CUSTOMER_DEFAULT_SECTION

  const setSection = useCallback(
    (key: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (key === CUSTOMER_DEFAULT_SECTION) {
            next.delete('section')
          } else {
            next.set('section', key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  useEffect(() => {
    if (!rawSection) return
    const n = normalizeCustomerSection(rawSection)
    if (n && n !== rawSection) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('section', n)
          return next
        },
        { replace: true },
      )
    } else if (!n) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('section')
          return next
        },
        { replace: true },
      )
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
      {active === 'portfolio_holdings' ? <CustomerVaultsPanel /> : null}
      {active === 'shop_jewellers' ? <CustomerJewellersBrowsePanel /> : null}
      {active === 'shop_products' ? <CustomerProductsBrowsePanel /> : null}
      {active === 'invest_fractional' ? <FractionalPurchasePanel /> : null}
      {active === 'invest_deposit' ? <CustomerDepositInfoPanel /> : null}
      {active === 'redeem_hub' ? (
        <>
          <CustomerSellbackPanel />
          <ComingSoon
            title="More liquidity options"
            children="Ornament redemption, loans, and emergency funds will plug in here next."
          />
        </>
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
