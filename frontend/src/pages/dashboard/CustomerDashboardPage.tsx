import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { CustomerJewellersBrowsePanel } from '@/features/marketplace/CustomerJewellersBrowsePanel'
import { CustomerProductsBrowsePanel } from '@/features/marketplace/CustomerProductsBrowsePanel'
import { CustomerVaultAddressesPanel } from '@/features/gold/CustomerVaultAddressesPanel'
import { GoldTransferPanel } from '@/features/gold/GoldTransferPanel'
import { CustomerDepositInfoPanel } from '@/features/invest/CustomerDepositInfoPanel'
import { FractionalPurchasePanel } from '@/features/invest/FractionalPurchasePanel'
import { CustomerAccountDetailsPanel } from '@/features/customer/CustomerAccountDetailsPanel'
import { NotificationSettingsPanel } from '@/features/settings/NotificationSettingsPanel'
import { CustomerKycWorkflow } from '@/features/customer/CustomerKycWorkflow'
import { ChangePasswordPanel } from '@/features/auth/ChangePasswordPanel'
import { CustomerSchemeHubPanel } from '@/features/schemes/CustomerSchemeHubPanel'
import { CustomerPortfolioPanel } from '@/features/portfolio/CustomerPortfolioPanel'
import { CustomerVaultsPanel } from '@/features/portfolio/CustomerVaultsPanel'
import { CustomerCridoraPayPanel } from '@/features/cridorapay/CustomerCridoraPayPanel'
import { CustomerCrossRedemptionPanel } from '@/features/crossRedemption/CustomerCrossRedemptionPanel'
import { CustomerGoldLoanPanel } from '@/features/redeem/CustomerGoldLoanPanel'
import { CustomerSellbackPanel } from '@/features/redeem/CustomerSellbackPanel'
import { useAuth } from '@/context/AuthContext'
import { LIVE_PROFILE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  CUSTOMER_DEFAULT_SECTION,
  CUSTOMER_NAV_GROUPS,
  normalizeCustomerSection,
} from '@/lib/mobileNav/customerNav'
import {
  fetchPlatformFeatures,
  filterCustomerNav,
  type PlatformFeaturesPayload,
} from '@/lib/platformFeatures'

function customerTitle(section: string): string {
  const row = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.sectionKey === section)
  if (row) {
    const hub = CUSTOMER_NAV_GROUPS.find((g) => g.items.some((i) => i.sectionKey === section))
    return hub ? `${hub.label} · ${row.label}` : row.label
  }
  return 'Dashboard'
}

export function CustomerDashboardPage() {
  const { refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const rawSection = params.get('section')
  const [features, setFeatures] = useState<PlatformFeaturesPayload | null>(null)

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    void fetchPlatformFeatures().then(setFeatures)
  }, [])

  useLivePoll(refreshProfile, LIVE_PROFILE_POLL_MS, true)

  const navGroups = useMemo(
    () => filterCustomerNav(CUSTOMER_NAV_GROUPS, features?.customer_sections),
    [features],
  )

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

  useEffect(() => {
    if (!features?.customer_sections) return
    if (features.customer_sections[active] === false) {
      setSection(CUSTOMER_DEFAULT_SECTION)
    }
  }, [features, active, setSection])

  const head = useMemo(() => customerTitle(active), [active])

  return (
    <DashboardLayout
      role="customer"
      navGroups={navGroups}
      activeSection={active}
      onSectionChange={setSection}
      title={head}
    >
      {active === 'portfolio_overview' || active === 'portfolio_personal' ? (
        <CustomerPortfolioPanel defaultPortfolioTab={active === 'portfolio_personal' ? 'personal' : undefined} />
      ) : null}
      {active === 'portfolio_holdings' ? <CustomerVaultsPanel /> : null}
      {active === 'portfolio_vault_ids' ? <CustomerVaultAddressesPanel /> : null}
      {active === 'shop_jewellers' ? <CustomerJewellersBrowsePanel /> : null}
      {active === 'shop_products' ? <CustomerProductsBrowsePanel /> : null}
      {active === 'invest_fractional' ? <FractionalPurchasePanel /> : null}
      {active === 'invest_cridorapay' ? <CustomerCridoraPayPanel /> : null}
      {active === 'invest_deposit' ? <CustomerDepositInfoPanel /> : null}
      {active === 'invest_scheme' ? <CustomerSchemeHubPanel /> : null}
      {active === 'redeem_cash' ? <CustomerSellbackPanel /> : null}
      {active === 'redeem_transfer' ? <GoldTransferPanel roleLabel="customer" /> : null}
      {active === 'redeem_loan' ? <CustomerGoldLoanPanel /> : null}
      {active === 'redeem_emergency' ? <CustomerCrossRedemptionPanel /> : null}
      {active === 'profile_cridora_id' || active === 'profile_qr' ? <CustomerVaultAddressesPanel /> : null}
      {active === 'profile_security' ? <ChangePasswordPanel /> : null}
      {active === 'profile_personal' ? <CustomerAccountDetailsPanel /> : null}
      {active === 'profile_notifications' ? (
        <NotificationSettingsPanel title="Notifications" description="Manage push delivery and the types of alerts you receive." />
      ) : null}
      {active === 'profile_kyc' ? (
        <div className="dash-panel-max">
          <CustomerKycWorkflow />
        </div>
      ) : null}
    </DashboardLayout>
  )
}
