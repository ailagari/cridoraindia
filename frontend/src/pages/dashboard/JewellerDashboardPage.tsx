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
      {active.startsWith('cust_') ? (
        <JewellerComing
          title="Customer management"
          body="Customer roster, KYC posture, holdings by type, and liability snapshots once jeweller-scoped ledger APIs land."
        />
      ) : null}
      {active === 'mkt_products' ? <JewellerMarketplacePanel /> : null}
      {active === 'mkt_schemes' ? (
        <JewellerComing
          title="GoldNest"
          body="GoldNest today is one recurring plan shape per jeweller: contributions, live accumulation, maturity tracking, benefits, and optional making-charge perks — publish only after Cridora admin approval."
        />
      ) : null}
      {active === 'mkt_rates' ? (
        <JewellerComing
          title="Live gold & sellback"
          body="Publish live gold rate and customer-facing sellback; ornament redemption and cash sellback read these values. The sellback preview (live rate, deductions, amount receivable) follows the cash redemption logic customers see at checkout."
        />
      ) : null}
      {active === 'mkt_rules' ? (
        <JewellerComing
          title="Lock-in & redemption"
          body="Configure lock-in tiers (15 days–12 months or none), minimum redeemable quantity, same-store making-charge discounts (0%, reduced, flat MC, eligible categories), and cross-redemption fee disclosures."
        />
      ) : null}
      {active === 'txn_purchases' ? (
        <div className="dash-panel-max">
          <JewellerFractionalVerifyPanel />
        </div>
      ) : null}
      {active.startsWith('txn_') && active !== 'txn_transfers' && active !== 'txn_purchases' ? (
        <JewellerComing
          title="Operations"
          body="Sellback, ornament redemption queues, zero-interest gold loans (2% processing, max loan %, eligible holdings), transfers, and settlement batches — mirrored from treasury when transaction APIs connect. Counter fractional gold purchases are verified under Purchases."
        />
      ) : null}
      {active === 'txn_transfers' ? <GoldTransferPanel roleLabel="jeweller" /> : null}
      {active === 'prof_kyb' ? (
        <div className="dash-panel-max">
          <JewellerKybWorkflow />
        </div>
      ) : null}
      {active === 'prof_payouts' ? <JewellerPlaceholder kind="payments" /> : null}
      {active === 'prof_shop' ? (
        <JewellerComing
          title="Showroom & credibility"
          body="Logo, trust copy, credibility score inputs, city, live and sellback rates shown on jeweller cards, and feature tags (instant redemption, 0% MC, loans, GoldNest, emergency funds, cross-redemption)."
        />
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
          <p className="dash-spot__sub">Verified jewellers join the live savings and redemption network; storefront and listings stay private until Cridora admin approval.</p>
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
          <p className="dash-spot__value">KYB uploads</p>
          <p className="dash-spot__sub">{me?.shop_address ?? 'Complete registrations in KYB documents tab.'}</p>
        </div>
      </div>
    </div>
  )
}

function JewellerPlaceholder({ kind }: { kind: 'catalog' | 'payments' }) {
  return (
    <div className="dash-panel-max">
      <div className={`dash-coming dash-coming--${kind}`}>
        <h2 className="dash-coming__title">{kind === 'catalog' ? 'Catalogue' : 'Payouts'}</h2>
        <p className="dash-coming__text">
          Payout rails and jeweller settlement batches follow the shared ledger model once payment APIs ship on this stack.
        </p>
      </div>
    </div>
  )
}

function JewellerComing({ title, body }: { title: string; body: string }) {
  return (
    <div className="dash-panel-max">
      <div className="dash-coming dash-coming--catalog">
        <h2 className="dash-coming__title">{title}</h2>
        <p className="dash-coming__text">{body}</p>
      </div>
    </div>
  )
}
