import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import { AdminPortfolioPanel } from '@/features/portfolio/AdminPortfolioPanel'
import { AdminGoldTickerPanel, AdminMarketplaceModerationPanel } from '@/features/marketplace/AdminMarketplaceSection'

import { ADMIN_DEFAULT_SECTION, ADMIN_NAV_GROUPS, normalizeAdminSection } from '@/lib/mobileNav/adminNav'

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

type OverviewPayload = {
  stats: {
    total_users: number
    total_customers: number
    total_jewellers: number
    pending_kyc_identity: number
    pending_kyb_identity: number
    kyc_review_queue_count: number
    kyb_review_queue_count: number
    ledger_note?: string
  }
  kyc_queue: QueueUser[]
  kyb_queue: QueueUser[]
  payments: unknown[]
  transactions: unknown[]
  recent_users: QueueUser[]
}

type DocInfo = {
  id: number
  doc_type: string
  file_url: string | null
  status: string
  rejection_reason?: string
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
  const [modalError, setModalError] = useState('')

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

  const openUserModal = useCallback(async (userId: number) => {
    setModalUserId(userId)
    setModalDetail(null)
    setModalError('')
    setRejectReason('')
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
      closeModal()
    },
    [rejectReason, fetchOverview, closeModal],
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
      closeModal()
    },
    [rejectReason, fetchOverview, closeModal],
  )

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

  return (
    <DashboardLayout
      role="admin"
      navGroups={ADMIN_NAV_GROUPS}
      activeSection={active}
      onSectionChange={setSection}
      title={head}
    >
      <div className="dash-panel-max">
        {loadError ? <p className="form-error">{loadError}</p> : null}

        {active === 'ops_overview' && data ? (
          <div className="admin-dash-widgets">
            <div className="admin-dash-stat admin-dash-stat--emerald">
              <span className="admin-dash-stat__eyebrow">Total users</span>
              <p className="admin-dash-stat__value">{data.stats.total_users}</p>
              <p className="admin-dash-stat__sub">
                {data.stats.total_customers} customers · {data.stats.total_jewellers} jewellers
              </p>
            </div>
            <div className="admin-dash-stat admin-dash-stat--amber">
              <span className="admin-dash-stat__eyebrow">KYC queue</span>
              <p className="admin-dash-stat__value">{data.stats.kyc_review_queue_count}</p>
              <p className="admin-dash-stat__sub">Customers with docs or bank submitted</p>
            </div>
            <div className="admin-dash-stat admin-dash-stat--iris">
              <span className="admin-dash-stat__eyebrow">KYB queue</span>
              <p className="admin-dash-stat__value">{data.stats.kyb_review_queue_count}</p>
              <p className="admin-dash-stat__sub">Jewellers with KYB uploads pending</p>
            </div>
            <div className="admin-dash-stat admin-dash-stat--cyan">
              <span className="admin-dash-stat__eyebrow">Identity pending</span>
              <p className="admin-dash-stat__value">
                {data.stats.pending_kyc_identity} / {data.stats.pending_kyb_identity}
              </p>
              <p className="admin-dash-stat__sub">Customer / jeweller accounts not yet verified</p>
            </div>
          </div>
        ) : null}

        {active === 'ops_overview' && data?.stats.ledger_note ? (
          <p className="dash-footnote">{data.stats.ledger_note}</p>
        ) : null}

        {active === 'ops_portfolio' && data ? (
          <AdminPortfolioPanel stats={data.stats} />
        ) : null}

        {active === 'ops_portfolio' && !data && !loadError ? (
          <p className="dash-footnote" style={{ padding: '1rem 0' }}>
            Loading portfolio…
          </p>
        ) : null}

        {active === 'ap_kyc' && data ? (
          <QueueTable
            title="Customers awaiting review"
            rows={data.kyc_queue}
            kind="kyc"
            busyId={busyId}
            onInspect={(id) => void openUserModal(id)}
            onApproveInline={(id) => void runKycAction(id, 'approve')}
          />
        ) : null}

        {active === 'ap_kyb' && data ? (
          <QueueTable
            title="Jewellers awaiting KYB"
            rows={data.kyb_queue}
            kind="kyb"
            busyId={busyId}
            onInspect={(id) => void openUserModal(id)}
            onApproveInline={(id) => void runKybAction(id, 'approve')}
          />
        ) : null}

        {active === 'people_users' && data ? (
          <UserDirectoryTable users={data.recent_users} busyId={busyId} onFreeze={runFreeze} />
        ) : null}

        {active === 'fin_payments' ? (
          <div className="dash-coming dash-coming--payments">
            <h2 className="dash-coming__title">Settlement monitoring</h2>
            <p className="dash-coming__text">
              Track INR settlements, UPI and card rails, cross-jeweller redemption liability, and jeweller payout batches for
              the live network. Lists stay empty until payment models are enabled.
            </p>
          </div>
        ) : null}

        {active === 'fin_ledger' ? (
          <div className="dash-coming dash-coming--ledger">
            <h2 className="dash-coming__title">Ledger &amp; reconciliation</h2>
            <p className="dash-coming__text">
              Gold gram ledger across buy, sellback, ornament redemption, loan use, transfer, and emergency rows — scoped to
              BIS 916 gold in India; feeds mirror settlement monitoring as they connect.
            </p>
          </div>
        ) : null}

        {active === 'plat_gold' ? <AdminGoldTickerPanel /> : null}

        {active === 'mkt_products' ? <AdminMarketplaceModerationPanel /> : null}

        {(active === 'mkt_schemes' ||
          active === 'mkt_offers' ||
          active === 'mkt_reports') ? (
          <div className="dash-coming dash-coming--payments">
            <h2 className="dash-coming__title">
              {active === 'mkt_schemes'
                ? 'GoldNest schemes'
                : active === 'mkt_offers'
                  ? 'Marketplace moderation'
                  : 'Risk monitoring'}
            </h2>
            <p className="dash-coming__text">
              {active === 'mkt_schemes'
                ? 'Review recurring GoldNest plans (one plan structure per jeweller today), benefits text, and disclosures before customers subscribe.'
                : active === 'mkt_offers'
                  ? 'Moderate listings, abusive content, and trust signals on jeweller and product surfaces before they reach the public network.'
                  : 'Settlement anomalies, cross-redemption exposure, default patterns on emergency draws, and jeweller concentration — dashboards plug into risk APIs when ready.'}
            </p>
          </div>
        ) : null}

        {active === 'plat_emergency' ? (
          <div className="dash-coming dash-coming--payments">
            <h2 className="dash-coming__title">Emergency fund monitoring</h2>
            <p className="dash-coming__text">
              Cridora-backed liquidity up to 80% of portfolio value: monitor active draws, temporarily locked holdings, and
              gold consumption on default — “instant liquidity without selling your gold.”
            </p>
          </div>
        ) : null}

        {active === 'plat_settings' ? (
          <div className="dash-coming dash-coming--ledger">
            <h2 className="dash-coming__title">Platform settings</h2>
            <p className="dash-coming__text">
              Feature flags, fee templates, launch scope (BIS 916, gold-only, India-only), and integration keys — Django admin
              stays canonical for sensitive toggles until these move in-app.
            </p>
          </div>
        ) : null}
      </div>

      {modalUserId != null ? (
        <div className="dash-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="dash-modal card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dash-modal-head">
              <h2 className="dash-modal-title">User #{modalUserId}</h2>
              <button type="button" className="btn btn-ghost kyb-btn-sm" onClick={closeModal}>
                Close
              </button>
            </div>
            {modalError ? <p className="form-error">{modalError}</p> : null}
            {!modalDetail && !modalError ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : null}
            {modalDetail ? (
              <>
                <div className="dash-modal-grid">
                  <div>
                    <h3 className="dash-modal-sub">Profile</h3>
                    <pre className="dash-json">{JSON.stringify(modalDetail.profile, null, 2)}</pre>
                  </div>
                  <div>
                    <h3 className="dash-modal-sub">Documents</h3>
                    <ul className="dash-doc-list">
                      {modalDetail.documents.map((d) => (
                        <li key={d.id}>
                          <span className="kyb-pill kyb-pill--wait">{d.doc_type}</span>{' '}
                          <span className="kyb-pill kyb-pill--mute">{d.status}</span>{' '}
                          {d.file_url ? (
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                              Open
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {modalDetail.bank ? (
                      <>
                        <h3 className="dash-modal-sub">Bank</h3>
                        <pre className="dash-json">{JSON.stringify(modalDetail.bank, null, 2)}</pre>
                      </>
                    ) : null}
                  </div>
                </div>
                <label className="field" htmlFor="rej" style={{ marginTop: '1rem' }}>
                  Rejection reason (required when rejecting)
                </label>
                <textarea
                  id="rej"
                  className="dash-textarea"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Visible to customer/jeweller in follow-up workflows"
                />
                <div className="dash-modal-actions">
                  {modalDetail.profile.user_type === 'customer' ? (
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
                        className="btn btn-ghost"
                        disabled={busyId === modalUserId}
                        style={{ borderColor: 'rgba(217,83,79,0.45)', color: '#f0a8a5' }}
                        onClick={() => modalUserId && void runKycAction(modalUserId, 'reject')}
                      >
                        Reject KYC
                      </button>
                    </>
                  ) : null}
                  {modalDetail.profile.user_type === 'jeweller' ? (
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
                        className="btn btn-ghost"
                        disabled={busyId === modalUserId}
                        style={{ borderColor: 'rgba(217,83,79,0.45)', color: '#f0a8a5' }}
                        onClick={() => modalUserId && void runKybAction(modalUserId, 'reject')}
                      >
                        Reject KYB
                      </button>
                    </>
                  ) : null}
                  {modalDetail.profile.user_type === 'admin' ? (
                    <p className="dash-footnote">Admin accounts cannot be modified from this modal.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
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
              rows.map((u) => {
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
      </div>
    </>
  )
}

function UserDirectoryTable({
  users,
  busyId,
  onFreeze,
}: {
  users: QueueUser[]
  busyId: number | null
  onFreeze: (id: number, freeze: boolean) => void
}) {
  return (
    <>
      <h2 className="dash-table-title">Recent registrations</h2>
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
            {users.map((u) => (
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
                    <button
                      type="button"
                      className="btn btn-ghost kyb-btn-sm"
                      disabled={busyId === u.id}
                      onClick={() => onFreeze(u.id, u.is_active ?? true)}
                    >
                      {u.is_active === false ? 'Unfreeze' : 'Freeze'}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
