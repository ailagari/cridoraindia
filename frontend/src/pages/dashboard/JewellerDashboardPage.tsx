import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { JewellerKybWorkflow } from '@/features/jeweller/JewellerKybWorkflow'
import { JewellerPortfolioPanel } from '@/features/portfolio/JewellerPortfolioPanel'
import { GoldTransferPanel } from '@/features/gold/GoldTransferPanel'
import { JewellerMarketplacePanel } from '@/features/marketplace/JewellerMarketplacePanel'
import { JewellerFractionalVerifyPanel } from '@/features/invest/JewellerFractionalVerifyPanel'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
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

function Coming({ title, body }: { title: string; body: string }) {
  return (
    <div className="dash-panel-max">
      <div className="dash-coming dash-coming--catalog">
        <h2 className="dash-coming__title">{title}</h2>
        <p className="dash-coming__text">{body}</p>
      </div>
    </div>
  )
}

export function JewellerDashboardPage() {
  const { refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const rawSection = params.get('section')

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

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
      {active === 'desk_overview' ? <JewellerOverview /> : null}
      {active === 'desk_portfolio' ? <JewellerPortfolioPanel /> : null}
      {active === 'cust_hub' ? (
        <Coming title="Customer vaults" body="Roster, holdings, and liabilities surface here when jeweller-scoped APIs connect." />
      ) : null}
      {active === 'mkt_products' ? <JewellerMarketplacePanel /> : null}
      {active === 'mkt_policy' ? (
        <Coming
          title="Rates & schemes"
          body="GoldNest, live rates, lock-in, and cross-redemption rules — publish only after Cridora approval."
        />
      ) : null}
      {active === 'txn_purchases' ? (
        <div className="dash-panel-max">
          <JewellerFractionalVerifyPanel />
        </div>
      ) : null}
      {active === 'txn_ops' ? (
        <Coming title="Redemptions & loans" body="Sellback queues, ornament redemption, and loan operations tie to the shared ledger." />
      ) : null}
      {active === 'txn_transfers' ? <GoldTransferPanel roleLabel="jeweller" /> : null}
      {active === 'prof_kyb' ? (
        <div className="dash-panel-max">
          <JewellerKybWorkflow />
        </div>
      ) : null}
      {active === 'prof_more' ? (
        <Coming title="Business profile" body="Payouts, showroom copy, and credibility inputs live here as storefront APIs expand." />
      ) : null}
    </DashboardLayout>
  )
}

function JewellerOverview() {
  const { user } = useAuth()
  const [me, setMe] = useState<MeJson | null>(null)

  useEffect(() => {
    let cancel = false
    void authFetch('/api/v1/auth/me/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancel && data && typeof data === 'object') {
          setMe(data as MeJson)
        }
      })
    return () => {
      cancel = true
    }
  }, [user?.id])

  const tone =
    user?.kyc_status === 'verified' ? 'ok' : user?.kyc_status === 'rejected' ? 'bad' : 'wait'

  return (
    <div className="dash-panel-max">
      <div className="dash-hero-cards">
        <div className={`dash-spot dash-spot--${tone}`}>
          <span className="dash-spot__eyebrow">KYB status</span>
          <p className="dash-spot__value">{user?.kyc_status}</p>
          <p className="dash-spot__sub">Verified jewellers join the live network; listings remain private until approval.</p>
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
