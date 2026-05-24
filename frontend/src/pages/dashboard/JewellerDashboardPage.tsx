import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { JewellerBusinessProfilePanel } from '@/features/jeweller/JewellerBusinessProfilePanel'
import { JewellerKybWorkflow } from '@/features/jeweller/JewellerKybWorkflow'
import { JewellerPortfolioOverviewPanel } from '@/features/portfolio/JewellerPortfolioOverviewPanel'
import { JewellerCustomerVaultsPanel } from '@/features/portfolio/JewellerCustomerVaultsPanel'
import { GoldTransferPanel } from '@/features/gold/GoldTransferPanel'
import { JewellerMarketplacePanel } from '@/features/marketplace/JewellerMarketplacePanel'
import { JewellerRatesSchemesPanel } from '@/features/marketplace/JewellerRatesSchemesPanel'
import { JewellerGoldDepositPanel } from '@/features/invest/JewellerGoldDepositPanel'
import { JewellerUnifiedPurchaseDesk } from '@/features/invest/JewellerUnifiedPurchaseDesk'
import { JewellerOnHoldPaymentsPanel } from '@/features/invest/JewellerOnHoldPaymentsPanel'
import { JewellerCridoraPayPanel } from '@/features/cridorapay/JewellerCridoraPayPanel'
import { JewellerCrossRedemptionInboxPanel } from '@/features/crossRedemption/JewellerCrossRedemptionInboxPanel'
import { JewellerSellbacksPanel } from '@/features/redeem/JewellerSellbacksPanel'
import { JewellerLoanDashboardPanel } from '@/features/loans/JewellerLoanDashboardPanel'
import { JewellerOrnamentRedemptionsPanel } from '@/features/marketplace/JewellerOrnamentRedemptionsPanel'
import { JewellerSettlementsPanel } from '@/features/treasury/JewellerSettlementsPanel'
import { ChangePasswordPanel } from '@/features/auth/ChangePasswordPanel'
import { useAuth } from '@/context/AuthContext'
import { LIVE_PROFILE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  JEWELLER_DEFAULT_SECTION,
  JEWELLER_NAV_GROUPS,
  normalizeJewellerSection,
} from '@/lib/mobileNav/jewellerNav'
import {
  fetchPlatformFeatures,
  filterJewellerNav,
  isFeatureEnabled,
  type PlatformFeaturesPayload,
} from '@/lib/platformFeatures'

function jewellerTitle(section: string): string {
  const hub = JEWELLER_NAV_GROUPS.find((g) => g.items.some((i) => i.sectionKey === section))
  if (section === JEWELLER_DEFAULT_SECTION) return hub?.label ?? 'Portfolio'
  const item = JEWELLER_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.sectionKey === section)
  if (item && hub) return `${hub.label} · ${item.label}`
  return item?.label ?? 'Jeweller'
}

export function JewellerDashboardPage() {
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
    () => filterJewellerNav(JEWELLER_NAV_GROUPS, features?.jeweller_sections),
    [features],
  )

  const flags = features?.flags

  const normalized = normalizeJewellerSection(rawSection)
  const active = normalized ?? JEWELLER_DEFAULT_SECTION

  const setSection = useCallback(
    (key: string) => setParams(key === JEWELLER_DEFAULT_SECTION ? {} : { section: key }, { replace: true }),
    [setParams],
  )

  useEffect(() => {
    if (!rawSection) return
    const n = normalizeJewellerSection(rawSection)
    if (n && n !== rawSection) setParams({ section: n }, { replace: true })
    else if (!n) setParams({}, { replace: true })
  }, [rawSection, setParams])

  useEffect(() => {
    if (!features?.jeweller_sections) return
    if (features.jeweller_sections[active] === false) {
      setSection(JEWELLER_DEFAULT_SECTION)
    }
  }, [features, active, setSection])

  const head = useMemo(() => jewellerTitle(active), [active])

  return (
    <DashboardLayout
      role="jeweller"
      navGroups={navGroups}
      activeSection={active}
      onSectionChange={setSection}
      title={head}
    >
      {active === 'portfolio' ? <JewellerPortfolioOverviewPanel onNavigate={setSection} /> : null}
      {active === 'cust_hub' ? <JewellerCustomerVaultsPanel /> : null}
      {active === 'mkt_products' ? <JewellerMarketplacePanel /> : null}
      {active === 'mkt_policy' ? (
        <div className="dash-panel-max">
          <JewellerRatesSchemesPanel />
        </div>
      ) : null}
      {active === 'txn_deposits' ? (
        <div className="dash-panel-max">
          <JewellerGoldDepositPanel />
        </div>
      ) : null}
      {active === 'txn_cridorapay' ? (
        <div className="dash-panel-max">
          <JewellerCridoraPayPanel />
        </div>
      ) : null}
      {active === 'txn_purchases' ? (
        <div className="dash-panel-max">
          <JewellerUnifiedPurchaseDesk />
        </div>
      ) : null}
      {active === 'txn_on_hold' ? (
        <div className="dash-panel-max">
          <JewellerOnHoldPaymentsPanel />
        </div>
      ) : null}
      {active === 'txn_loans' ? (
        <div className="dash-panel-max">
          <JewellerLoanDashboardPanel />
        </div>
      ) : null}
      {active === 'txn_ops' ? (
        <>
          {isFeatureEnabled(flags, 'sellback_cash') || isFeatureEnabled(flags, 'sellback_upi') ? (
            <JewellerSellbacksPanel />
          ) : null}
          {isFeatureEnabled(flags, 'cross_redemption') ? <JewellerCrossRedemptionInboxPanel /> : null}
          {isFeatureEnabled(flags, 'marketplace_redemption') ? <JewellerOrnamentRedemptionsPanel /> : null}
        </>
      ) : null}
      {active === 'fin_settlements' ? (
        <div className="dash-panel-max">
          <JewellerSettlementsPanel />
        </div>
      ) : null}
      {active === 'txn_transfers' ? <GoldTransferPanel roleLabel="jeweller" /> : null}
      {active === 'prof_kyb' ? (
        <div className="dash-panel-max">
          <JewellerKybWorkflow />
        </div>
      ) : null}
      {active === 'prof_security' ? (
        <ChangePasswordPanel />
      ) : null}
      {active === 'prof_more' ? <JewellerBusinessProfilePanel /> : null}
    </DashboardLayout>
  )
}
