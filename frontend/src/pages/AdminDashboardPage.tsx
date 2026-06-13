import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import { LIVE_ADMIN_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { AdminPortfolioPanel } from '@/features/portfolio/AdminPortfolioPanel'
import { AdminPersonalHoldingsPanel } from '@/features/portfolio/AdminPersonalHoldingsPanel'
import { AdminPrimaryCustomersTable } from '@/features/portfolio/JewellerPrimaryCustomersPanel'
import { AdminFractionalOtpPolicyPanel } from '@/features/admin/AdminFractionalOtpPolicyPanel'
import { AdminFeatureRolloutPanel } from '@/features/admin/AdminFeatureRolloutPanel'
import { ChangePasswordPanel } from '@/features/auth/ChangePasswordPanel'
import { AdminNotificationsHubPanel } from '@/features/admin/AdminNotificationsHubPanel'
import { NotificationSettingsPanel } from '@/features/settings/NotificationSettingsPanel'
import { AdminGoldTickerPanel, AdminMarketplaceCatalogSetupPanel } from '@/features/marketplace/AdminMarketplaceSection'
import { AdminGoldRatesAdsPanel } from '@/features/marketplace/AdminGoldRatesAdsPanel'
import { AdminTreasuryPanel } from '@/features/treasury/AdminTreasuryPanel'
import { AdminUpiFraudReportsPanel } from '@/features/treasury/AdminUpiFraudReportsPanel'
import { TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'

import { ADMIN_DEFAULT_SECTION, ADMIN_NAV_GROUPS, normalizeAdminSection } from '@/lib/mobileNav/adminNav'
import {
  fetchPlatformFeatures,
  filterAdminNav,
  type PlatformFeaturesPayload,
} from '@/lib/platformFeatures'

function adminTitle(section: string): string {
  const item = ADMIN_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.sectionKey === section)
  const hub = ADMIN_NAV_GROUPS.find((g) => g.items.some((i) => i.sectionKey === section))
  if (item && hub) return `${hub.label} · ${item.label}`
  return item?.label ?? 'Admin'
}

type QueueUser = {
  id: number
  email: string
  first_name?: string
  last_name?: string
  user_type: string
  kyc_status: string
  is_active?: boolean
  joined?: string
  phone?: string
  business_name?: string
  gstin?: string
  city?: string
  bank_status?: string | null
  documents_uploaded?: string[]
  can_approve_kyc?: boolean
  can_approve_kyb?: boolean
}

type RecentGoldDeposit = {
  id: number
  reference: string
  status: string
  grams: string
  customer_email: string
  customer_member_id: string
  jeweller_business: string
  created_at: string
}

type RecentFractionalOrder = {
  id: number
  reference: string
  order_reference: string
  status: string
  payment_method: string
  grams: string
  total_inr: string
  upi_utr: string
  reconciliation_score: number | null
  customer_email: string
  customer_member_id: string
  jeweller_business: string
  created_at: string
}

type OverviewPayload = {
  stats: {
    total_users: number
    total_customers: number
    total_jewellers: number
    pending_kyc_identity: number
    pending_kyb_identity: number
    kyc_review_queue_count: number
    kyb_review_queue_count: number
    customer_fractional_grams_total?: string
    jeweller_custodial_liability_grams_total?: string
    fractional_orders_pending_counter?: number
    fractional_orders_pending_upi?: number
    fractional_orders_pending_review?: number
    fractional_orders_cancelled?: number
    fractional_orders_completed?: number
    gold_deposit_pending_otp?: number
    gold_deposit_completed?: number
    ledger_note?: string
  }
  kyc_queue: QueueUser[]
  kyb_queue: QueueUser[]
  payments: unknown[]
  transactions: unknown[]
  recent_users: QueueUser[]
  recent_gold_deposits?: RecentGoldDeposit[]
  recent_fractional_orders?: RecentFractionalOrder[]
}

type DocInfo = {
  id: number
  doc_type: string
  file_url: string | null
  original_filename?: string
  status: string
  rejection_reason?: string
  uploaded_at?: string
  reviewed_at?: string | null
}

type InspectProfile = {
  id?: number
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  user_type?: string
  kyc_status?: string
  kyc_verified_at?: string | null
  date_joined?: string
  is_active?: boolean
  business_name?: string
  gstin?: string
  shop_address?: string
  city?: string
  state?: string
  pincode?: string
  jeweller_code?: string
  cridora_member_id?: string
}

function fmtStatGrams(s: string | undefined): string {
  if (s == null || String(s).trim() === '') return '—'
  const n = Number.parseFloat(String(s))
  if (!Number.isFinite(n)) return String(s)
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 6 })} g`
}

function fmtDisplay(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}

function fmtDateTime(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const t = Date.parse(String(v))
  if (Number.isNaN(t)) return String(v)
  return new Date(t).toLocaleString()
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar card',
  pan: 'PAN card',
  selfie_photo: 'Live selfie / photograph',
  pan_business: 'Business PAN',
  gst_certificate: 'GST registration certificate',
  shop_establishment: 'Shop & Establishment registration',
  trade_license: 'Municipal trade / shop licence',
  bis_hallmark: 'BIS hallmark licence',
  incorporation_certificate: 'Certificate of incorporation',
  partnership_deed: 'Partnership deed / LLP agreement',
  address_proof_shop: 'Business address proof',
  proprietor_aadhaar: 'Proprietor / partner Aadhaar',
  proprietor_pan: 'Proprietor / partner PAN',
  msme_udyam: 'MSME Udyam registration',
  iec_import_export: 'IEC (import-export)',
}

function labelDocType(key: string): string {
  return DOC_TYPE_LABELS[key] ?? key.replace(/_/g, ' ')
}

function docStatusTone(status: string): string {
  if (status === 'verified') return 'ok'
  if (status === 'rejected') return 'bad'
  return 'wait'
}

const BANK_FIELD_LABELS: Record<string, string> = {
  account_holder_name: 'Account holder',
  account_number: 'Account number',
  ifsc_code: 'IFSC',
  bank_name: 'Bank',
  branch: 'Branch',
  status: 'Status',
  created_at: 'Added',
  updated_at: 'Updated',
}

function profileInspectAccountRows(p: InspectProfile): { label: string; value: string }[] {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return [
    { label: 'Email', value: fmtDisplay(p.email) },
    { label: 'Name', value: name || '—' },
    { label: 'Phone', value: fmtDisplay(p.phone) },
    { label: 'Account type', value: fmtDisplay(p.user_type) },
    { label: 'Verification status', value: fmtDisplay(p.kyc_status) },
    { label: 'Verified at', value: fmtDateTime(p.kyc_verified_at) },
    { label: 'Joined', value: fmtDateTime(p.date_joined) },
    { label: 'Active', value: fmtDisplay(p.is_active) },
  ]
}

function profileInspectBusinessRows(p: InspectProfile): { label: string; value: string }[] {
  return [
    { label: 'Business name', value: fmtDisplay(p.business_name) },
    { label: 'GSTIN', value: fmtDisplay(p.gstin) },
    { label: 'Shop address', value: fmtDisplay(p.shop_address) },
    { label: 'City', value: fmtDisplay(p.city) },
    { label: 'State', value: fmtDisplay(p.state) },
    { label: 'PIN', value: fmtDisplay(p.pincode) },
    { label: 'Jeweller code', value: fmtDisplay(p.jeweller_code) },
    { label: 'Cridora member ID', value: fmtDisplay(p.cridora_member_id) },
  ]
}

function bankInspectRows(bank: Record<string, unknown>): { label: string; value: string }[] {
  return Object.entries(bank).map(([k, v]) => ({
    label: BANK_FIELD_LABELS[k] ?? k.replace(/_/g, ' '),
    value: /_at$/.test(k) ? fmtDateTime(v) : fmtDisplay(v),
  }))
}

function InspectKv({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="admin-inspect-kv">
      {rows.map((r) => (
        <div key={r.label} className="admin-inspect-kv__row">
          <dt className="admin-inspect-kv__dt">{r.label}</dt>
          <dd className="admin-inspect-kv__dd">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function inspectHeadMetaLine(p: InspectProfile, fallbackUserId: number): string {
  const parts: string[] = []
  const idVal = p.id != null ? Number(p.id) : fallbackUserId
  if (!Number.isNaN(idVal)) parts.push(`User ID ${idVal}`)
  const rawType = (p.user_type ?? '').trim()
  if (rawType) {
    const pretty = rawType === 'jeweller' ? 'Jeweller' : rawType.charAt(0).toUpperCase() + rawType.slice(1)
    parts.push(pretty)
  }
  const joined = fmtDateTime(p.date_joined)
  if (joined !== '—') parts.push(`Joined ${joined}`)
  return parts.join(' · ')
}

function formatDocTimeline(d: DocInfo): string | null {
  const uploaded = d.uploaded_at ? fmtDateTime(d.uploaded_at) : null
  const reviewed = d.reviewed_at ? fmtDateTime(d.reviewed_at) : null
  const chunks: string[] = []
  if (uploaded && uploaded !== '—') chunks.push(`Uploaded ${uploaded}`)
  if (reviewed && reviewed !== '—') chunks.push(`Reviewed ${reviewed}`)
  return chunks.length ? chunks.join(' · ') : null
}

function adminPipelineStatusBadgeClass(status: string): string {
  const s = String(status ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
  if (/(complete|completed|filled|paid|success|credited)/.test(s)) return 'bdg bdg-ok'
  if (/(cancel|fail|reject|void|expired)/.test(s)) return 'bdg bdg-grey'
  if (/(pending|progress|review|queued|processing|otp|await)/.test(s)) return 'bdg bdg-warn'
  return 'bdg bdg-info'
}

export function AdminDashboardPage() {
  const { refreshProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const rawSection = params.get('section')
  const normalized = normalizeAdminSection(rawSection)
  const active = normalized ?? ADMIN_DEFAULT_SECTION

  const setSection = useCallback(
    (key: string) => setParams(key === ADMIN_DEFAULT_SECTION ? {} : { section: key }, { replace: true }),
    [setParams],
  )

  useEffect(() => {
    if (!rawSection) return
    const n = normalizeAdminSection(rawSection)
    if (n && n !== rawSection) setParams({ section: n }, { replace: true })
    else if (!n) setParams({}, { replace: true })
  }, [rawSection, setParams])

  const [features, setFeatures] = useState<PlatformFeaturesPayload | null>(null)

  useEffect(() => {
    void fetchPlatformFeatures().then(setFeatures)
  }, [])

  useEffect(() => {
    if (!features?.admin_sections) return
    if (features.admin_sections[active] === false) {
      setSection(ADMIN_DEFAULT_SECTION)
    }
  }, [features, active, setSection])

  const head = useMemo(() => adminTitle(active), [active])
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [modalUserId, setModalUserId] = useState<number | null>(null)
  const [modalDetail, setModalDetail] = useState<{
    profile: Record<string, unknown>
    documents: DocInfo[]
    bank: Record<string, unknown> | null
  } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reuploadDocId, setReuploadDocId] = useState<number | null>(null)
  const [reuploadReason, setReuploadReason] = useState('')
  const [modalError, setModalError] = useState('')
  const [resetPasswordResult, setResetPasswordResult] = useState<string | null>(null)

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const fetchOverview = useCallback(async () => {
    setLoadError('')
    const res = await authFetch('/api/v1/admin/overview/')
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    if (!res.ok) {
      setLoadError(body.detail ?? 'Could not load admin overview.')
      setData(null)
      return
    }
    setData(body as OverviewPayload)
  }, [])

  useEffect(() => {
    void fetchOverview()
  }, [fetchOverview])

  useLivePoll(fetchOverview, LIVE_ADMIN_POLL_MS, true)

  const openUserModal = useCallback(async (userId: number) => {
    setModalUserId(userId)
    setModalDetail(null)
    setModalError('')
    setRejectReason('')
    setReuploadDocId(null)
    setReuploadReason('')
    setResetPasswordResult(null)
    const res = await authFetch(`/api/v1/admin/users/${userId}/documents/`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setModalError((j as { detail?: string }).detail ?? 'Failed to load user files.')
      return
    }
    setModalDetail(
      j as {
        profile: Record<string, unknown>
        documents: DocInfo[]
        bank: Record<string, unknown> | null
      },
    )
  }, [])

  const closeModal = useCallback(() => {
    setModalUserId(null)
    setModalDetail(null)
    setModalError('')
    setRejectReason('')
    setReuploadDocId(null)
    setReuploadReason('')
    setResetPasswordResult(null)
  }, [])

  const runKycAction = useCallback(
    async (userId: number, action: 'approve' | 'reject') => {
      if (action === 'reject' && !rejectReason.trim()) {
        setModalError('Add a rejection reason.')
        return
      }
      setBusyId(userId)
      setModalError('')
      const res = await authFetch(`/api/v1/admin/users/${userId}/kyc/${action}/`, {
        method: 'POST',
        jsonBody: action === 'reject' ? { reason: rejectReason.trim() } : {},
      })
      const j = await res.json().catch(() => ({}))
      setBusyId(null)
      if (!res.ok) {
        setModalError((j as { detail?: string }).detail ?? 'Action failed.')
        return
      }
      await fetchOverview()
      if (modalUserId === userId) {
        await openUserModal(userId)
      }
    },
    [rejectReason, fetchOverview, openUserModal, modalUserId],
  )

  const runKybAction = useCallback(
    async (userId: number, action: 'approve' | 'reject') => {
      if (action === 'reject' && !rejectReason.trim()) {
        setModalError('Add a rejection reason.')
        return
      }
      setBusyId(userId)
      setModalError('')
      const res = await authFetch(`/api/v1/admin/users/${userId}/kyb/${action}/`, {
        method: 'POST',
        jsonBody: action === 'reject' ? { reason: rejectReason.trim() } : {},
      })
      const j = await res.json().catch(() => ({}))
      setBusyId(null)
      if (!res.ok) {
        setModalError((j as { detail?: string }).detail ?? 'Action failed.')
        return
      }
      await fetchOverview()
      if (modalUserId === userId) {
        await openUserModal(userId)
      }
    },
    [rejectReason, fetchOverview, openUserModal, modalUserId],
  )

  const runVerificationRevoke = useCallback(
    async (userId: number) => {
      setBusyId(userId)
      setModalError('')
      const res = await authFetch(`/api/v1/admin/users/${userId}/verification/revoke/`, {
        method: 'POST',
        jsonBody: {},
      })
      const j = await res.json().catch(() => ({}))
      setBusyId(null)
      if (!res.ok) {
        setModalError((j as { detail?: string }).detail ?? 'Revoke failed.')
        return
      }
      await fetchOverview()
      if (modalUserId === userId) {
        await openUserModal(userId)
      }
    },
    [fetchOverview, openUserModal, modalUserId],
  )

  const runDocumentReuploadRequest = useCallback(
    async (userId: number, docId: number, reason: string) => {
      const trimmed = reason.trim()
      if (!trimmed) {
        setModalError('Enter a reason for the re-upload request.')
        return
      }
      setBusyId(userId)
      setModalError('')
      const res = await authFetch(
        `/api/v1/admin/users/${userId}/documents/${docId}/request-reupload/`,
        {
          method: 'POST',
          jsonBody: { reason: trimmed },
        },
      )
      const j = await res.json().catch(() => ({}))
      setBusyId(null)
      if (!res.ok) {
        setModalError((j as { detail?: string }).detail ?? 'Request failed.')
        return
      }
      setReuploadDocId(null)
      setReuploadReason('')
      await fetchOverview()
      if (modalUserId === userId) {
        await openUserModal(userId)
      }
    },
    [fetchOverview, openUserModal, modalUserId],
  )

  const adminNavGroups = useMemo(() => {
    const base = !data?.stats
      ? ADMIN_NAV_GROUPS
      : ADMIN_NAV_GROUPS.map((group) => {
          const kyc = data.stats.kyc_review_queue_count ?? 0
          const kyb = data.stats.kyb_review_queue_count ?? 0
          const queueTotal = kyc + kyb
          return {
            ...group,
            items: group.items.map((item) => {
              if (item.sectionKey === 'users_kyc_kyb' && queueTotal > 0) {
                return { ...item, badge: queueTotal }
              }
              return { ...item }
            }),
          }
        })
    return filterAdminNav(base, features?.admin_sections)
  }, [data, features])

  const runFreeze = useCallback(
    async (userId: number, freeze: boolean) => {
      setBusyId(userId)
      const res = await authFetch(`/api/v1/admin/users/${userId}/freeze/`, {
        method: 'POST',
        jsonBody: { freeze },
      })
      setBusyId(null)
      if (!res.ok) {
        void res.json().catch(() => undefined)
        return
      }
      await fetchOverview()
    },
    [fetchOverview],
  )

  const runResetPassword = useCallback(async (userId: number) => {
    if (
      !window.confirm(
        'Generate a new temporary password for this user? Existing sessions will be signed out.',
      )
    ) {
      return
    }
    setBusyId(userId)
    setModalError('')
    setResetPasswordResult(null)
    const res = await authFetch(`/api/v1/admin/users/${userId}/reset-password/`, {
      method: 'POST',
      jsonBody: {},
    })
    const j = (await res.json().catch(() => ({}))) as {
      detail?: string
      temporary_password?: string
    }
    setBusyId(null)
    if (!res.ok) {
      setModalError(j.detail ?? 'Password reset failed.')
      return
    }
    if (j.temporary_password) {
      setResetPasswordResult(j.temporary_password)
    }
  }, [])

  return (
    <DashboardLayout
      role="admin"
      navGroups={adminNavGroups}
      activeSection={active}
      onSectionChange={setSection}
      title={head}
    >
      <div className="dash-panel-max">
        {loadError ? <p className="form-error">{loadError}</p> : null}

        {active === 'ops_overview' && data ? (
          <>
            <div className="ph">
              <h1>Operations overview</h1>
              <p>Live posture across users, verification queues, vaulted metal, and order intake.</p>
            </div>

            <div className="row wrap mb20" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setSection('users_kyc_kyb')}
              >
                Review KYC / KYB (
                {(data.stats.kyc_review_queue_count ?? 0) + (data.stats.kyb_review_queue_count ?? 0)})
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSection('ops_portfolio')}>
                Portfolio metrics
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSection('plat_gold')}>
                Gold ticker
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSection('plat_control')}>
                Fractional OTP policy
              </button>
            </div>

            <p className="t-fa fs11 mb20" style={{ marginBottom: 18 }}>
              Platform total:{' '}
              <strong className="tn">{data.stats.total_users}</strong> accounts
            </p>

            {data.stats.ledger_note ? <div className="notice n-info mb20">{data.stats.ledger_note}</div> : null}

            <div className="stat-row mb20">
              <div className="stat a">
                <div className="stat-lbl">Total users</div>
                <div className="stat-val tn">{data.stats.total_users}</div>
                <div className="stat-sub">
                  {data.stats.total_customers} customers · {data.stats.total_jewellers} jewellers
                </div>
              </div>
              <div className="stat b">
                <div className="stat-lbl">KYC queue</div>
                <div className="stat-val tn">{data.stats.kyc_review_queue_count}</div>
                <div className="stat-sub">Customers awaiting review</div>
              </div>
              <div className="stat c">
                <div className="stat-lbl">KYB queue</div>
                <div className="stat-val tn">{data.stats.kyb_review_queue_count}</div>
                <div className="stat-sub">Jewellers awaiting review</div>
              </div>
              <div className="stat d">
                <div className="stat-lbl">Identity pending</div>
                <div className="stat-val tn">
                  {data.stats.pending_kyc_identity} / {data.stats.pending_kyb_identity}
                </div>
                <div className="stat-sub">Customer / jeweller</div>
              </div>
            </div>

            <div className="stat-row mb20">
              <div className="stat a">
                <div className="stat-lbl">Customer vault grams</div>
                <div className="stat-val tn c-gold">{fmtStatGrams(data.stats.customer_fractional_grams_total)}</div>
              </div>
              <div className="stat b">
                <div className="stat-lbl">Jeweller liability grams</div>
                <div className="stat-val tn">{fmtStatGrams(data.stats.jeweller_custodial_liability_grams_total)}</div>
              </div>
              <div className="stat c">
                <div className="stat-lbl">Counter pending buys</div>
                <div className="stat-val tn">{data.stats.fractional_orders_pending_counter ?? 0}</div>
              </div>
              <div className="stat d">
                <div className="stat-lbl">UPI in flight</div>
                <div className="stat-val tn">{data.stats.fractional_orders_pending_upi ?? 0}</div>
              </div>
            </div>

            <div className="stat-row mb20">
              <div className="stat a">
                <div className="stat-lbl">Awaiting jeweller review</div>
                <div className="stat-val tn">{data.stats.fractional_orders_pending_review ?? 0}</div>
              </div>
              <div className="stat b">
                <div className="stat-lbl">Fractional completed</div>
                <div className="stat-val tn">{data.stats.fractional_orders_completed ?? 0}</div>
              </div>
              <div className="stat c">
                <div className="stat-lbl">Fractional cancelled</div>
                <div className="stat-val tn">{data.stats.fractional_orders_cancelled ?? 0}</div>
              </div>
              <div className="stat d">
                <div className="stat-lbl">Gold deposits</div>
                <div className="stat-val tn">{data.stats.gold_deposit_completed ?? 0}</div>
                <div className="stat-sub">{data.stats.gold_deposit_pending_otp ?? 0} OTP pending</div>
              </div>
            </div>

            <div className="g2 mb20">
              <div className="card">
                <div className="card-p">
                  <div className="sec-hd">
                    <div>
                      <div className="sec-title">Recent fractional orders</div>
                      <div className="sec-sub">Latest buy flow and settlement signals</div>
                    </div>
                  </div>
                  {data.recent_fractional_orders && data.recent_fractional_orders.length > 0 ? (
                    <AdminOverviewRecentFractionalTable orders={data.recent_fractional_orders} />
                  ) : (
                    <div className="empty">
                      <p>No recent fractional orders.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-p">
                  <div className="sec-hd">
                    <div>
                      <div className="sec-title">Recent gold deposit intakes</div>
                      <div className="sec-sub">In-person deposit references and custody handoffs</div>
                    </div>
                  </div>
                  {data.recent_gold_deposits && data.recent_gold_deposits.length > 0 ? (
                    <AdminOverviewRecentGoldDepositsTable deposits={data.recent_gold_deposits} />
                  ) : (
                    <div className="empty">
                      <p>No recent gold deposits.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {active === 'ops_personal_vault' ? <AdminPersonalHoldingsPanel /> : null}

        {active === 'ops_portfolio' && data ? <AdminPortfolioPanel stats={data.stats} onNavigate={setSection} /> : null}

        {active === 'ops_portfolio' && !data && !loadError ? (
          <p className="dash-footnote" style={{ padding: '1rem 0' }}>
            Loading portfolio…
          </p>
        ) : null}

        {active === 'users_kyc_kyb' && data ? (
          <>
            <div className="admin-dash-widgets" style={{ marginBottom: '1rem' }}>
              <div className="admin-dash-stat admin-dash-stat--amber">
                <span className="admin-dash-stat__eyebrow">KYC pending</span>
                <p className="admin-dash-stat__value">{data.stats.kyc_review_queue_count}</p>
                <p className="admin-dash-stat__sub">
                  {data.stats.total_customers} customers · {data.stats.pending_kyc_identity} awaiting identity
                </p>
              </div>
              <div className="admin-dash-stat admin-dash-stat--iris">
                <span className="admin-dash-stat__eyebrow">KYB pending</span>
                <p className="admin-dash-stat__value">{data.stats.kyb_review_queue_count}</p>
                <p className="admin-dash-stat__sub">
                  {data.stats.total_jewellers} jewellers · {data.stats.pending_kyb_identity} awaiting identity
                </p>
              </div>
            </div>
            <QueueTable
              title="Customers awaiting KYC review"
              rows={data.kyc_queue}
              kind="kyc"
              busyId={busyId}
              onInspect={(id) => void openUserModal(id)}
              onApproveInline={(id) => void runKycAction(id, 'approve')}
            />
            <QueueTable
              title="Jewellers awaiting KYB review"
              rows={data.kyb_queue}
              kind="kyb"
              busyId={busyId}
              onInspect={(id) => void openUserModal(id)}
              onApproveInline={(id) => void runKybAction(id, 'approve')}
            />
          </>
        ) : null}

        {active === 'users_customers' && data ? (
          <UserDirectoryTable
            title="Customers"
            users={data.recent_users.filter((u) => u.user_type === 'customer')}
            busyId={busyId}
            onFreeze={runFreeze}
            onInspect={(id) => void openUserModal(id)}
          />
        ) : null}

        {active === 'users_jewellers' && data ? (
          <UserDirectoryTable
            title="Jewellers"
            users={data.recent_users.filter((u) => u.user_type === 'jeweller')}
            busyId={busyId}
            onFreeze={runFreeze}
            onInspect={(id) => void openUserModal(id)}
          />
        ) : null}

        {active === 'fin_hub' ? <AdminTreasuryPanel mode="ledger" /> : null}

        {active === 'fin_settlement' ? <AdminTreasuryPanel mode="settlement" /> : null}

        {active === 'fin_payments' ? <AdminTreasuryPanel mode="payments" /> : null}
        {active === 'fin_fraud_reports' ? <AdminUpiFraudReportsPanel /> : null}

        {active === 'plat_gold' ? <AdminGoldTickerPanel /> : null}
        {active === 'plat_gold_rates' ? <AdminGoldRatesAdsPanel /> : null}

        {active === 'mkt_products' ? <AdminMarketplaceCatalogSetupPanel /> : null}

        {active === 'mkt_programs' ? (
          <div className="dash-coming dash-coming--payments">
            <h2 className="dash-coming__title">Programs & risk</h2>
            <p className="dash-coming__text">
              Scheme approvals, marketplace moderation, and risk surveillance consolidate on this track.
            </p>
          </div>
        ) : null}

        {active === 'plat_festival' ? <AdminNotificationsHubPanel /> : null}

        {active === 'plat_control' ? <AdminFractionalOtpPolicyPanel /> : null}

        {active === 'plat_features' ? <AdminFeatureRolloutPanel /> : null}

        {active === 'plat_security' ? (
          <ChangePasswordPanel />
        ) : null}

        {active === 'plat_account' ? (
          <NotificationSettingsPanel
            title="Account settings"
            description="Notification preferences for your admin account. To send campaigns or configure system gold alerts, open Pushes & alerts."
          />
        ) : null}
      </div>

      {modalUserId != null ? (
        <div className="dash-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="dash-modal card admin-inspect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-inspect-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-inspect-head">
              <div className="admin-inspect-head__main">
                <h2 id="admin-inspect-dialog-title" className="admin-inspect-head__title">
                  {modalDetail
                    ? fmtDisplay((modalDetail.profile as InspectProfile).email) !== '—'
                      ? String((modalDetail.profile as InspectProfile).email)
                      : `User #${modalUserId}`
                    : `Loading…`}
                </h2>
                {modalDetail ? (
                  <>
                    <p className="admin-inspect-head__meta">
                      {inspectHeadMetaLine(modalDetail.profile as InspectProfile, modalUserId)}
                    </p>
                    <div className="admin-inspect-badges">
                      <span className={`kyb-pill kyb-pill--${docStatusTone(String((modalDetail.profile as InspectProfile).kyc_status ?? ''))}`}>
                        {(modalDetail.profile as InspectProfile).kyc_status ?? '—'}
                      </span>
                      <span className="kyb-pill kyb-pill--mute">
                        {(modalDetail.profile as InspectProfile).user_type ?? '—'}
                      </span>
                      {(modalDetail.profile as InspectProfile).is_active === false ? (
                        <span className="kyb-pill kyb-pill--bad">frozen</span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
              <button type="button" className="btn btn-ghost kyb-btn-sm" onClick={closeModal}>
                Close
              </button>
            </div>
            {modalError ? <p className="form-error">{modalError}</p> : null}
            {!modalDetail && !modalError ? (
              <p className="admin-inspect-empty">Loading profile and documents…</p>
            ) : null}
            {modalDetail ? (
              <>
                <div className="admin-inspect-panels">
                  <div className="admin-inspect-panel">
                    <h3 className="admin-inspect-panel__title">Account</h3>
                    <InspectKv rows={profileInspectAccountRows(modalDetail.profile as InspectProfile)} />
                    {(modalDetail.profile as InspectProfile).user_type !== 'admin' ? (
                      <div className="kyb-actions" style={{ marginTop: 'var(--sp-3)' }}>
                        <button
                          type="button"
                          className="btn btn-ghost kyb-btn-sm"
                          disabled={busyId === modalUserId}
                          onClick={() => void runResetPassword(modalUserId)}
                        >
                          Reset password
                        </button>
                      </div>
                    ) : null}
                    {resetPasswordResult ? (
                      <div
                        className="card"
                        style={{
                          marginTop: 'var(--sp-3)',
                          padding: 'var(--sp-3)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 600 }}>Temporary password (shown once)</p>
                        <p
                          style={{
                            margin: 'var(--sp-2) 0',
                            fontFamily: 'monospace',
                            fontSize: '1.1rem',
                            wordBreak: 'break-all',
                          }}
                        >
                          {resetPasswordResult}
                        </p>
                        <p className="dash-footnote" style={{ margin: 0 }}>
                          Copy and share securely with the user. They can sign in and change it in account settings.
                        </p>
                        <button
                          type="button"
                          className="btn btn-ghost kyb-btn-sm"
                          style={{ marginTop: 'var(--sp-2)' }}
                          onClick={() => {
                            void navigator.clipboard.writeText(resetPasswordResult)
                          }}
                        >
                          Copy password
                        </button>
                      </div>
                    ) : null}
                    {(modalDetail.profile as InspectProfile).user_type === 'jeweller' ? (
                      <>
                        <h3 className="admin-inspect-panel__title">Business</h3>
                        <InspectKv rows={profileInspectBusinessRows(modalDetail.profile as InspectProfile)} />
                        {modalUserId != null ? (
                          <AdminPrimaryCustomersTable
                            jewellerId={modalUserId}
                            onInspectCustomer={(customerId) => void openUserModal(customerId)}
                          />
                        ) : null}
                      </>
                    ) : null}
                    {modalDetail.bank ? (
                      <>
                        <h3 className="admin-inspect-panel__title">Bank account</h3>
                        <InspectKv rows={bankInspectRows(modalDetail.bank as Record<string, unknown>)} />
                      </>
                    ) : (
                      (modalDetail.profile as InspectProfile).user_type === 'customer' ? (
                        <>
                          <h3 className="admin-inspect-panel__title">Bank account</h3>
                          <p className="admin-inspect-empty">No bank profile on file.</p>
                        </>
                      ) : null
                    )}
                  </div>
                  <div className="admin-inspect-panel">
                    <h3 className="admin-inspect-panel__title">
                      Documents
                      {modalDetail.documents.length > 0 ? (
                        <span className="admin-inspect-panel__count">({modalDetail.documents.length})</span>
                      ) : null}
                    </h3>
                    {modalDetail.documents.length === 0 ? (
                      <p className="admin-inspect-empty">No documents uploaded yet.</p>
                    ) : (
                      <ul className="admin-inspect-doc-list">
                        {modalDetail.documents.map((d) => {
                          const timeline = formatDocTimeline(d)
                          return (
                            <li key={d.id} className="admin-inspect-doc">
                              <div className="admin-inspect-doc__head">
                                <p className="admin-inspect-doc__name">{labelDocType(d.doc_type)}</p>
                                <span className={`kyb-pill kyb-pill--${docStatusTone(d.status)}`}>{d.status}</span>
                              </div>
                              {timeline ? <p className="admin-inspect-doc__meta">{timeline}</p> : null}
                              <p
                                className={
                                  d.file_url
                                    ? 'admin-inspect-doc__file'
                                    : 'admin-inspect-doc__file admin-inspect-doc__nofile'
                                }
                              >
                                {d.file_url
                                  ? `File: ${d.original_filename?.trim() ? d.original_filename : 'uploaded'}`
                                  : 'No file uploaded'}
                              </p>
                              {d.rejection_reason ? (
                                <p className="admin-inspect-doc__note">{d.rejection_reason}</p>
                              ) : null}
                              <div className="admin-inspect-doc__actions">
                                {d.file_url ? (
                                  <a
                                    href={d.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary kyb-btn-sm"
                                  >
                                    Open file
                                  </a>
                                ) : null}
                                {(modalDetail.profile as InspectProfile).user_type !== 'admin' ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost kyb-btn-sm"
                                    disabled={busyId === modalUserId}
                                    onClick={() => {
                                      setReuploadDocId(d.id)
                                      setReuploadReason('')
                                      setModalError('')
                                    }}
                                  >
                                    Ask re-upload
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {reuploadDocId != null ? (
                      <div className="admin-inspect-reupload">
                        <p className="admin-inspect-reupload__lead">
                          Selected:{' '}
                          <strong>
                            {labelDocType(
                              modalDetail.documents.find((x) => x.id === reuploadDocId)?.doc_type ?? 'document',
                            )}
                          </strong>
                          . The account returns to <strong>pending</strong> and loses verified marketplace visibility until you review again.
                        </p>
                        <label className="field" htmlFor="reup-reason" style={{ marginTop: '0.65rem' }}>
                          Reason (stored on the document)
                        </label>
                        <textarea
                          id="reup-reason"
                          className="dash-textarea"
                          rows={2}
                          value={reuploadReason}
                          onChange={(e) => setReuploadReason(e.target.value)}
                          placeholder="e.g. Document expired — please upload a clearer scan."
                        />
                        <div className="admin-inspect-reupload__actions">
                          <button
                            type="button"
                            className="btn btn-primary kyb-btn-sm"
                            disabled={busyId === modalUserId || modalUserId == null}
                            onClick={() => {
                              if (modalUserId != null && reuploadDocId != null) {
                                void runDocumentReuploadRequest(modalUserId, reuploadDocId, reuploadReason)
                              }
                            }}
                          >
                            Submit re-upload request
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost kyb-btn-sm"
                            disabled={busyId === modalUserId}
                            onClick={() => {
                              setReuploadDocId(null)
                              setReuploadReason('')
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="admin-inspect-review">
                  <label className="admin-inspect-review__label" htmlFor="rej">
                    Rejection note (required only when rejecting KYC or KYB)
                  </label>
                  <textarea
                    id="rej"
                    className="dash-textarea"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Visible to the customer or jeweller in follow-up flows."
                  />
                </div>
                <div className="admin-inspect-actions">
                  {(modalDetail.profile as InspectProfile).user_type === 'admin' ? (
                    <p className="admin-inspect-actions__hint">Admin accounts cannot be changed from this dialog.</p>
                  ) : (
                    <>
                      <div className="admin-inspect-actions__group">
                        <p className="admin-inspect-actions__legend">Decision</p>
                        {(modalDetail.profile as InspectProfile).user_type === 'customer' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busyId === modalUserId}
                              onClick={() => modalUserId && void runKycAction(modalUserId, 'approve')}
                            >
                              Approve KYC
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-admin-reject"
                              disabled={busyId === modalUserId}
                              onClick={() => modalUserId && void runKycAction(modalUserId, 'reject')}
                            >
                              Reject KYC
                            </button>
                          </>
                        ) : null}
                        {(modalDetail.profile as InspectProfile).user_type === 'jeweller' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busyId === modalUserId}
                              onClick={() => modalUserId && void runKybAction(modalUserId, 'approve')}
                            >
                              Approve KYB
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-admin-reject"
                              disabled={busyId === modalUserId}
                              onClick={() => modalUserId && void runKybAction(modalUserId, 'reject')}
                            >
                              Reject KYB
                            </button>
                          </>
                        ) : null}
                      </div>
                      <div className="admin-inspect-actions__group">
                        <p className="admin-inspect-actions__legend">After approval</p>
                        <p className="admin-inspect-actions__hint">
                          Use revoke or document re-upload if you need to pull verification back for review.
                        </p>
                        {(modalDetail.profile as InspectProfile).user_type === 'customer' ||
                        (modalDetail.profile as InspectProfile).user_type === 'jeweller' ? (
                          <button
                            type="button"
                            className="btn btn-ghost kyb-btn-sm btn-admin-revoke"
                            disabled={busyId === modalUserId}
                            onClick={() => modalUserId && void runVerificationRevoke(modalUserId)}
                          >
                            Revoke verification
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

const ADMIN_OVERVIEW_TABLE_PAGE = 10

function AdminOverviewRecentFractionalTable({ orders }: { orders: RecentFractionalOrder[] }) {
  const pg = useTablePagination(orders.length, ADMIN_OVERVIEW_TABLE_PAGE)
  const slice = pg.active ? orders.slice(pg.sliceStart, pg.sliceEnd) : orders
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl tbl-sm">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Status</th>
              <th>Method</th>
              <th>Amount</th>
              <th>UTR / Score</th>
              <th>Customer</th>
              <th>Jeweller</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((o) => {
              const inrAmt = Number.parseFloat(o.total_inr)
              const inrLabel = Number.isFinite(inrAmt)
                ? inrAmt.toLocaleString('en-IN')
                : fmtDisplay(o.total_inr)
              return (
                <tr key={o.id}>
                  <td className="tx tabular">
                    {o.reference}
                    {o.order_reference ? (
                      <span className="t-mu" style={{ display: 'block', marginTop: 4 }}>
                        {o.order_reference}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span className={adminPipelineStatusBadgeClass(o.status)}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{o.payment_method}</td>
                  <td className="tabular">
                    ₹{inrLabel}
                    <span className="t-mu" style={{ display: 'block', marginTop: 4 }}>
                      {o.grams} g
                    </span>
                  </td>
                  <td>
                    {o.upi_utr || '—'}
                    {o.reconciliation_score != null ? (
                      <span className="t-mu" style={{ display: 'block', marginTop: 4 }}>
                        {o.reconciliation_score}%
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {o.customer_email}
                    {o.customer_member_id ? (
                      <span className="t-mu" style={{ display: 'block', marginTop: 4 }}>
                        {o.customer_member_id}
                      </span>
                    ) : null}
                  </td>
                  <td>{o.jeweller_business}</td>
                  <td>{fmtDateTime(o.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pg.active ? (
        <TablePagination
          page={pg.page}
          totalPages={pg.totalPages}
          totalItems={orders.length}
          pageSize={pg.pageSize}
          onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
          onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
          className="tbl-inline-pagination"
        />
      ) : null}
    </>
  )
}

function AdminOverviewRecentGoldDepositsTable({ deposits }: { deposits: RecentGoldDeposit[] }) {
  const pg = useTablePagination(deposits.length, ADMIN_OVERVIEW_TABLE_PAGE)
  const slice = pg.active ? deposits.slice(pg.sliceStart, pg.sliceEnd) : deposits
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl tbl-sm">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Status</th>
              <th>Grams</th>
              <th>Customer</th>
              <th>Jeweller</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((d) => (
              <tr key={d.id}>
                <td className="tx tabular">{d.reference}</td>
                <td>
                  <span className={adminPipelineStatusBadgeClass(d.status)}>{d.status.replace(/_/g, ' ')}</span>
                </td>
                <td className="tabular">{d.grams}</td>
                <td>
                  {d.customer_email}
                  {d.customer_member_id ? (
                    <span className="t-mu" style={{ display: 'block', marginTop: 4 }}>
                      {d.customer_member_id}
                    </span>
                  ) : null}
                </td>
                <td>{d.jeweller_business}</td>
                <td>{fmtDateTime(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pg.active ? (
        <TablePagination
          page={pg.page}
          totalPages={pg.totalPages}
          totalItems={deposits.length}
          pageSize={pg.pageSize}
          onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
          onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
          className="tbl-inline-pagination"
        />
      ) : null}
    </>
  )
}

function QueueTable({
  title,
  rows,
  kind,
  busyId,
  onInspect,
  onApproveInline,
}: {
  title: string
  rows: QueueUser[]
  kind: 'kyc' | 'kyb'
  busyId: number | null
  onInspect: (id: number) => void
  onApproveInline: (id: number) => void
}) {
  const pg = useTablePagination(rows.length, ADMIN_OVERVIEW_TABLE_PAGE)
  const pageRows = pg.active ? rows.slice(pg.sliceStart, pg.sliceEnd) : rows
  return (
    <>
      <h2 className="dash-table-title">{title}</h2>
      <div className="dash-table-scroll card">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Files</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-muted)', padding: '1.25rem' }}>
                  {kind === 'kyc'
                    ? 'Queue clear — no customers awaiting KYC review right now.'
                    : 'Queue clear — no jewellers awaiting KYB verification right now.'}
                </td>
              </tr>
            ) : (
              pageRows.map((u) => {
                const canApprove =
                  kind === 'kyc' ? u.can_approve_kyc === true : u.can_approve_kyb === true
                return (
                  <tr key={u.id}>
                    <td>{`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="kyb-pill kyb-pill--wait">{u.kyc_status}</span>
                      {kind === 'kyc' && u.bank_status ? (
                        <> · bank: <span className="kyb-pill kyb-pill--mute">{u.bank_status}</span></>
                      ) : null}
                    </td>
                    <td className="tabular">{(u.documents_uploaded ?? []).length}</td>
                    <td>
                      <div className="kyb-actions">
                        <button type="button" className="btn btn-ghost kyb-btn-sm" onClick={() => onInspect(u.id)}>
                          Inspect
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary kyb-btn-sm"
                          disabled={busyId === u.id || !canApprove}
                          onClick={() => onApproveInline(u.id)}
                        >
                          Quick approve
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {pg.active ? (
          <TablePagination
            page={pg.page}
            totalPages={pg.totalPages}
            totalItems={rows.length}
            pageSize={pg.pageSize}
            onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
            onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
            className="tbl-inline-pagination"
          />
        ) : null}
      </div>
    </>
  )
}

function UserDirectoryTable({
  title,
  users,
  busyId,
  onFreeze,
  onInspect,
}: {
  title: string
  users: QueueUser[]
  busyId: number | null
  onFreeze: (id: number, freeze: boolean) => void
  onInspect?: (id: number) => void
}) {
  const pg = useTablePagination(users.length, ADMIN_OVERVIEW_TABLE_PAGE)
  const pageUsers = pg.active ? users.slice(pg.sliceStart, pg.sliceEnd) : users
  return (
    <>
      <h2 className="dash-table-title">{title}</h2>
      <div className="dash-table-scroll card">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Type</th>
              <th>KYC/KYB</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.user_type}</td>
                <td>
                  <span className={`kyb-pill kyb-pill--${u.kyc_status === 'verified' ? 'ok' : 'wait'}`}>
                    {u.kyc_status}
                  </span>
                </td>
                <td>{u.is_active ? 'yes' : 'no'}</td>
                <td>
                  {u.user_type !== 'admin' ? (
                    <div className="kyb-actions">
                      {onInspect ? (
                        <button type="button" className="btn btn-ghost kyb-btn-sm" onClick={() => onInspect(u.id)}>
                          Inspect
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost kyb-btn-sm"
                        disabled={busyId === u.id}
                        onClick={() => onFreeze(u.id, u.is_active ?? true)}
                      >
                        {u.is_active === false ? 'Unfreeze' : 'Freeze'}
                      </button>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pg.active ? (
          <TablePagination
            page={pg.page}
            totalPages={pg.totalPages}
            totalItems={users.length}
            pageSize={pg.pageSize}
            onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
            onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
            className="tbl-inline-pagination"
          />
        ) : null}
      </div>
    </>
  )
}
