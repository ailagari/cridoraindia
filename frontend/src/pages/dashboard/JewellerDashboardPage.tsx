import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { JewellerBusinessProfilePanel } from '@/features/jeweller/JewellerBusinessProfilePanel'
import { JewellerKybWorkflow } from '@/features/jeweller/JewellerKybWorkflow'
import { JewellerPortfolioPanel } from '@/features/portfolio/JewellerPortfolioPanel'
import { JewellerCustomerVaultsPanel } from '@/features/portfolio/JewellerCustomerVaultsPanel'
import { GoldTransferPanel } from '@/features/gold/GoldTransferPanel'
import { JewellerMarketplacePanel } from '@/features/marketplace/JewellerMarketplacePanel'
import { JewellerRatesSchemesPanel } from '@/features/marketplace/JewellerRatesSchemesPanel'
import { JewellerGoldDepositPanel } from '@/features/invest/JewellerGoldDepositPanel'
import { JewellerFractionalVerifyPanel } from '@/features/invest/JewellerFractionalVerifyPanel'
import { JewellerCrossRedemptionInboxPanel } from '@/features/crossRedemption/JewellerCrossRedemptionInboxPanel'
import { JewellerSellbacksPanel } from '@/features/redeem/JewellerSellbacksPanel'
import { JewellerOrnamentRedemptionsPanel } from '@/features/marketplace/JewellerOrnamentRedemptionsPanel'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import { LIVE_PROFILE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  JEWELLER_DEFAULT_SECTION,
  JEWELLER_NAV_GROUPS,
  normalizeJewellerSection,
} from '@/lib/mobileNav/jewellerNav'

function jewellerTitle(section: string): string {
  const item = JEWELLER_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.sectionKey === section)
  const hub = JEWELLER_NAV_GROUPS.find((g) => g.items.some((i) => i.sectionKey === section))
  if (item && hub) return `${hub.label} · ${item.label}`
  return item?.label ?? 'Jeweller'
}

type MeJson = {
  business_name?: string
  gstin?: string
  city?: string
  shop_address?: string
}

export function JewellerDashboardPage() {
  const { refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const rawSection = params.get('section')

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useLivePoll(refreshProfile, LIVE_PROFILE_POLL_MS, true)

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

  const head = useMemo(() => jewellerTitle(active), [active])

  return (
    <DashboardLayout
      role="jeweller"
      navGroups={JEWELLER_NAV_GROUPS}
      activeSection={active}
      onSectionChange={setSection}
      title={head}
    >
      {active === 'desk_overview' ? (
        <>
          <JewellerOverview />
          <JewellerPortfolioPanel />
        </>
      ) : null}
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
      {active === 'txn_purchases' ? (
        <div className="dash-panel-max">
          <JewellerFractionalVerifyPanel />
        </div>
      ) : null}
      {active === 'txn_ops' ? (
        <>
          <JewellerSellbacksPanel />
          <JewellerCrossRedemptionInboxPanel />
          <JewellerOrnamentRedemptionsPanel />
        </>
      ) : null}
      {active === 'txn_transfers' ? <GoldTransferPanel roleLabel="jeweller" /> : null}
      {active === 'prof_kyb' ? (
        <div className="dash-panel-max">
          <JewellerKybWorkflow />
        </div>
      ) : null}
      {active === 'prof_more' ? <JewellerBusinessProfilePanel /> : null}
    </DashboardLayout>
  )
}

function JewellerOverview() {
  const { user } = useAuth()
  const [me, setMe] = useState<MeJson | null>(null)

  const refreshMe = useCallback(async () => {
    const r = await authFetch('/api/v1/auth/me/')
    const data = r.ok ? ((await r.json()) as MeJson) : null
    if (data && typeof data === 'object') {
      setMe(data)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe, user?.id])

  useLivePoll(refreshMe, LIVE_PROFILE_POLL_MS, true)

  const tone =
    user?.kyc_status === 'verified' ? 'ok' : user?.kyc_status === 'rejected' ? 'bad' : 'wait'

  return (
    <div className="dash-panel-max">
      <div className="dash-hero-cards">
        <div className={`dash-spot dash-spot--${tone}`}>
          <span className="dash-spot__eyebrow">KYB status</span>
          <p className="dash-spot__value">{user?.kyc_status}</p>
          <p className="dash-spot__sub">
            After KYB approval, your shop appears on public jeweller directory pages; SKU listings still follow admin review.
          </p>
        </div>
        <div className="dash-spot dash-spot--gold">
          <span className="dash-spot__eyebrow">Business profile</span>
          <p className="dash-spot__value">{me?.business_name ?? 'Your showroom'}</p>
          <p className="dash-spot__sub">
            GSTIN {me?.gstin ?? '—'} · {me?.city ?? '—'}
          </p>
        </div>
        <div className="dash-spot dash-spot--violet">
          <span className="dash-spot__eyebrow">Next steps</span>
          <p className="dash-spot__value">KYB documents</p>
          <p className="dash-spot__sub">{me?.shop_address ?? 'Complete uploads under KYB.'}</p>
        </div>
      </div>
    </div>
  )
}
