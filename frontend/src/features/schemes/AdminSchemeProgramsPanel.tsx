import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DashboardPanel,
  DashboardWidget,
  EmptyState,
  Feedback,
  Input,
  PageHeader,
  TabBar,
} from '@/components/ui'
import {
  approveAdminSchemeRequest,
  createAdminSchemeTemplate,
  createFromPreset,
  deleteAdminSchemeTemplate,
  deprecateAdminSchemeTemplate,
  duplicateAdminSchemeTemplate,
  fetchAdminSchemeOverview,
  fetchAdminSchemeRequests,
  fetchAdminSchemeTemplates,
  fetchSchemePresets,
  publishAdminSchemeTemplate,
  previewAdminSchemeDesign,
  rejectAdminSchemeRequest,
  updateAdminSchemeTemplate,
  type SchemePresetDTO,
  type SchemeTemplateDTO,
} from '@/lib/schemesApi'
import { EMPTY_SCHEME_DESIGN } from '@/features/schemes/schemeDesignMapper'
import type { SchemeDesign } from '@/lib/schemesApi'
import { SchemeInputCard } from './SchemeInputCard'
import { SchemeBonusCard } from './SchemeBonusCard'
import { SchemeOutputCard } from './SchemeOutputCard'
import { SchemeFlowPreview } from './SchemeFlowPreview'

type Tab = 'templates' | 'designer' | 'requests'
type StatusFilter = 'all' | 'draft' | 'published' | 'deprecated'

function templateStatusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'draft') return 'warning'
  return 'neutral'
}

export function AdminSchemeProgramsPanel() {
  const [tab, setTab] = useState<Tab>('templates')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [templates, setTemplates] = useState<SchemeTemplateDTO[]>([])
  const [presets, setPresets] = useState<SchemePresetDTO[]>([])
  const [overview, setOverview] = useState<{
    templates_published: number
    active_enrollments: number
    pending_requests: number
  } | null>(null)
  const [requests, setRequests] = useState<
    Array<{ id: number; jeweller_name: string; title: string; status: string; description: string }>
  >([])
  const [design, setDesign] = useState<SchemeDesign>(EMPTY_SCHEME_DESIGN)
  const [name, setName] = useState('New scheme')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setErr('')
    try {
      const [t, p, r, o] = await Promise.all([
        fetchAdminSchemeTemplates(),
        fetchSchemePresets(),
        fetchAdminSchemeRequests('pending'),
        fetchAdminSchemeOverview(),
      ])
      setTemplates(t)
      setPresets(p)
      setRequests(r)
      setOverview(o)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const counts = useMemo(
    () => ({
      draft: templates.filter((t) => t.status === 'draft').length,
      published: templates.filter((t) => t.status === 'published').length,
      deprecated: templates.filter((t) => t.status === 'deprecated').length,
    }),
    [templates],
  )

  const filteredTemplates = useMemo(() => {
    if (statusFilter === 'all') return templates
    return templates.filter((t) => t.status === statusFilter)
  }, [templates, statusFilter])

  const isReadOnlyDesigner = editingStatus === 'published' || editingStatus === 'deprecated'

  const runPreview = async () => {
    try {
      const out = await previewAdminSchemeDesign(editingId, design)
      setPreview(out)
    } catch (e) {
      setPreview(null)
      setErr(e instanceof Error ? e.message : 'Preview failed')
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => void runPreview(), 400)
    return () => window.clearTimeout(t)
  }, [design, editingId])

  const openTemplate = (t: SchemeTemplateDTO) => {
    setEditingId(t.id)
    setEditingStatus(t.status)
    setName(t.name)
    setDesign(t.scheme_design)
    setTab('designer')
  }

  const startNewDraft = () => {
    setEditingId(null)
    setEditingStatus('draft')
    setName('New scheme')
    setDesign(EMPTY_SCHEME_DESIGN)
    setTab('designer')
  }

  const saveDraft = async () => {
    if (isReadOnlyDesigner) return
    setBusy(true)
    setErr('')
    try {
      if (editingId) {
        await updateAdminSchemeTemplate(editingId, { name, scheme_design: design })
      } else {
        const t = await createAdminSchemeTemplate({ name, description: '', scheme_design: design })
        setEditingId(t.id)
        setEditingStatus('draft')
      }
      await reload()
      setTab('templates')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const publish = async (id: number) => {
    setBusy(true)
    try {
      await publishAdminSchemeTemplate(id)
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  const deprecate = async (id: number) => {
    if (!window.confirm('Deprecate this scheme? Jewellers can no longer adopt it from the catalog.')) return
    setBusy(true)
    try {
      await deprecateAdminSchemeTemplate(id)
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Deprecate failed')
    } finally {
      setBusy(false)
    }
  }

  const removeDraft = async (id: number) => {
    if (!window.confirm('Delete this draft permanently?')) return
    setBusy(true)
    try {
      await deleteAdminSchemeTemplate(id)
      if (editingId === id) startNewDraft()
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (id: number, sourceName: string) => {
    setBusy(true)
    try {
      const t = await duplicateAdminSchemeTemplate(id, `${sourceName} (copy)`)
      openTemplate(t)
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Duplicate failed')
    } finally {
      setBusy(false)
    }
  }

  const loadPreset = async (key: string) => {
    setBusy(true)
    try {
      const t = await createFromPreset(key)
      openTemplate(t)
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Preset failed')
    } finally {
      setBusy(false)
    }
  }

  const reviewRequest = async (id: number, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Approve' : 'Reject'
    if (!window.confirm(`${label} this jeweller scheme request?`)) return
    setBusy(true)
    try {
      if (action === 'approve') await approveAdminSchemeRequest(id)
      else await rejectAdminSchemeRequest(id)
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : `${label} failed`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardPanel>
      <PageHeader
        eyebrow="Marketplace"
        title="Programs & risks"
        subtitle="Design investment scheme templates, publish to the jeweller catalog, and review custom scheme requests."
        actions={
          <Button variant="primary" size="sm" onClick={startNewDraft}>
            New draft
          </Button>
        }
      />

      <div className="admin-dash-widgets">
        <DashboardWidget
          label="Published templates"
          value={overview?.templates_published ?? counts.published}
          tone="gold"
          meta="Live in jeweller catalog"
        />
        <DashboardWidget
          label="Active enrollments"
          value={overview?.active_enrollments ?? '—'}
          tone="success"
          meta="Customers in scheme cycles"
        />
        <DashboardWidget
          label="Draft templates"
          value={counts.draft}
          meta="Awaiting publish"
        />
        <DashboardWidget
          label="Pending requests"
          value={overview?.pending_requests ?? requests.length}
          tone={requests.length > 0 ? 'gold' : 'default'}
          meta="Jeweller proposals"
          action={
            requests.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setTab('requests')}>
                Review
              </Button>
            ) : null
          }
        />
      </div>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <TabBar
          variant="segmented"
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            { key: 'templates', label: 'Templates' },
            { key: 'designer', label: 'Designer' },
            { key: 'requests', label: 'Requests', badge: requests.length },
          ]}
        />
      </Card>

      {err ? <Feedback tone="error">{err}</Feedback> : null}

      {tab === 'templates' ? (
        <>
          <Card>
            <CardHeader
              title="Scheme templates"
              action={
                <Button variant="primary" size="sm" onClick={startNewDraft}>
                  New draft
                </Button>
              }
            />
            <TabBar
              variant="segmented"
              active={statusFilter}
              onChange={(k) => setStatusFilter(k as StatusFilter)}
              tabs={[
                { key: 'all', label: `All (${templates.length})` },
                { key: 'draft', label: `Draft (${counts.draft})` },
                { key: 'published', label: `Published (${counts.published})` },
                { key: 'deprecated', label: `Deprecated (${counts.deprecated})` },
              ]}
            />
            <div style={{ display: 'grid', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
              {filteredTemplates.map((t) => (
                <div key={t.id} className="transaction-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                  <div className="transaction-row__main">
                    <span className="transaction-row__title">{t.name}</span>
                    <span className="transaction-row__meta">{t.flow_summary || 'No flow summary yet'}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Badge tone={templateStatusTone(t.status)}>{t.status}</Badge>
                    {t.status === 'draft' ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => void publish(t.id)} disabled={busy} loading={busy}>
                          Publish
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void removeDraft(t.id)} disabled={busy}>
                          Delete
                        </Button>
                      </>
                    ) : null}
                    {t.status === 'published' ? (
                      <Button size="sm" variant="ghost" onClick={() => void deprecate(t.id)} disabled={busy}>
                        Deprecate
                      </Button>
                    ) : null}
                    {t.status === 'published' || t.status === 'deprecated' ? (
                      <Button size="sm" variant="secondary" onClick={() => void duplicate(t.id, t.name)} disabled={busy}>
                        Duplicate
                      </Button>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => openTemplate(t)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 ? (
                <EmptyState
                  title="No schemes match this filter"
                  description="Create a new draft or start from a preset below."
                  action={
                    <Button variant="primary" size="sm" onClick={startNewDraft}>
                      New draft
                    </Button>
                  }
                />
              ) : null}
            </div>
          </Card>

          <Card style={{ marginTop: 'var(--sp-4)' }}>
            <CardHeader title="Quick-start presets" />
            <p className="dash-coming__text" style={{ marginTop: 0, marginBottom: 'var(--sp-3)' }}>
              Seed a draft from a platform preset, then customise in the designer before publishing.
            </p>
            <div className="pf-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-3)' }}>
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="transaction-row"
                  style={{
                    gridTemplateColumns: '1fr',
                    textAlign: 'left',
                    border: '1px solid var(--silk-06)',
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                  disabled={busy}
                  onClick={() => void loadPreset(p.key)}
                >
                  <span className="transaction-row__title">{p.label}</span>
                  <span className="transaction-row__meta">{p.description}</span>
                </button>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'designer' ? (
        <div className="onboarding-flow">
          {isReadOnlyDesigner ? (
            <div className="notice n-info">
              This scheme is <strong>{editingStatus}</strong> and cannot be edited in place. Duplicate it as a draft to
              make changes, then publish the new version.
              <div style={{ marginTop: 'var(--sp-3)' }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => editingId && void duplicate(editingId, name)}
                  disabled={busy || !editingId}
                >
                  Duplicate as draft
                </Button>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader
              title={editingId ? `Editing: ${name}` : 'New scheme draft'}
              action={
                <Button onClick={() => void saveDraft()} disabled={busy || isReadOnlyDesigner} loading={busy} variant="primary">
                  Save draft
                </Button>
              }
            />
            <div className="ds-form ds-form--compact">
              <Input
                label="Scheme name"
                value={name}
                placeholder="e.g. 11+1 Jewellery Pool"
                onChange={(e) => !isReadOnlyDesigner && setName(e.target.value)}
                disabled={isReadOnlyDesigner}
              />
            </div>
          </Card>

          <div className="pf-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}>
            <SchemeInputCard design={design} onChange={isReadOnlyDesigner ? () => {} : setDesign} disabled={isReadOnlyDesigner} />
            <SchemeBonusCard design={design} onChange={isReadOnlyDesigner ? () => {} : setDesign} disabled={isReadOnlyDesigner} />
            <SchemeOutputCard design={design} onChange={isReadOnlyDesigner ? () => {} : setDesign} disabled={isReadOnlyDesigner} />
            <SchemeFlowPreview design={design} preview={preview} />
          </div>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <Card>
          <CardHeader title="Jeweller scheme requests" />
          <p className="dash-coming__text" style={{ marginTop: 0, marginBottom: 'var(--sp-3)' }}>
            Custom scheme proposals from jewellers awaiting admin review.
          </p>
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {requests.map((r) => (
              <div key={r.id} className="transaction-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <div className="transaction-row__main">
                  <span className="transaction-row__title">{r.title}</span>
                  <span className="transaction-row__meta">
                    {r.jeweller_name}
                    {r.description ? ` · ${r.description}` : ''}
                  </span>
                </div>
                <div className="transaction-row__action" style={{ gap: 'var(--sp-2)' }}>
                  <Badge tone="warning">{r.status}</Badge>
                  <Button size="sm" variant="primary" onClick={() => void reviewRequest(r.id, 'approve')} disabled={busy}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void reviewRequest(r.id, 'reject')} disabled={busy}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {requests.length === 0 ? (
              <EmptyState
                title="No pending requests"
                description="Jeweller proposals will appear here when submitted from the scheme catalog."
              />
            ) : null}
          </div>
        </Card>
      ) : null}
    </DashboardPanel>
  )
}
