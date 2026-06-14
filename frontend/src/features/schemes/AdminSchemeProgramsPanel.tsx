import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import {
  approveAdminSchemeRequest,
  createAdminSchemeTemplate,
  createFromPreset,
  deleteAdminSchemeTemplate,
  deprecateAdminSchemeTemplate,
  duplicateAdminSchemeTemplate,
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

export function AdminSchemeProgramsPanel() {
  const [tab, setTab] = useState<Tab>('templates')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [templates, setTemplates] = useState<SchemeTemplateDTO[]>([])
  const [presets, setPresets] = useState<SchemePresetDTO[]>([])
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
      const [t, p, r] = await Promise.all([
        fetchAdminSchemeTemplates(),
        fetchSchemePresets(),
        fetchAdminSchemeRequests('pending'),
      ])
      setTemplates(t)
      setPresets(p)
      setRequests(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

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
    <div className="dash-panel-max">
      <div className="dash-segment-row" style={{ marginBottom: '1rem' }}>
        {(['templates', 'designer', 'requests'] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            className={tab === k ? 'dash-segment is-active' : 'dash-segment'}
            onClick={() => setTab(k)}
          >
            {k === 'templates' ? 'Templates' : k === 'designer' ? 'Designer' : 'Requests'}
          </button>
        ))}
      </div>

      {err ? <p className="form-error">{err}</p> : null}

      {tab === 'templates' ? (
        <Card>
          <h2 className="dash-card-title">Published & draft schemes</h2>
          <div className="dash-segment-row" style={{ marginBottom: '0.75rem' }}>
            {(['all', 'draft', 'published', 'deprecated'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={statusFilter === f ? 'dash-segment is-active' : 'dash-segment'}
                onClick={() => setStatusFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <Button size="sm" onClick={startNewDraft}>
              New draft
            </Button>
          </div>
          <ul className="dash-list">
            {filteredTemplates.map((t) => (
              <li key={t.id} className="dash-list-item">
                <div>
                  <strong>{t.name}</strong>
                  <span className="dash-muted"> — {t.status}</span>
                  <p className="dash-muted" style={{ margin: '0.25rem 0 0' }}>
                    {t.flow_summary}
                  </p>
                </div>
                <div className="dash-list-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {t.status === 'draft' ? (
                    <>
                      <Button size="sm" onClick={() => void publish(t.id)} disabled={busy}>
                        Publish
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void removeDraft(t.id)} disabled={busy}>
                        Delete
                      </Button>
                    </>
                  ) : null}
                  {t.status === 'published' ? (
                    <Button size="sm" variant="secondary" onClick={() => void deprecate(t.id)} disabled={busy}>
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
              </li>
            ))}
            {filteredTemplates.length === 0 ? (
              <p className="dash-muted">No schemes match this filter.</p>
            ) : null}
          </ul>
          <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {presets.map((p) => (
              <Button key={p.key} size="sm" variant="secondary" onClick={() => void loadPreset(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === 'designer' ? (
        <div className="scheme-designer-grid">
          {isReadOnlyDesigner ? (
            <Card style={{ gridColumn: '1 / -1' }}>
              <p className="dash-muted">
                This scheme is {editingStatus}. Published schemes cannot be edited directly.
              </p>
              <Button
                size="sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => editingId && void duplicate(editingId, name)}
                disabled={busy || !editingId}
              >
                Duplicate as draft to edit
              </Button>
            </Card>
          ) : null}
          <SchemeInputCard design={design} onChange={isReadOnlyDesigner ? () => {} : setDesign} />
          <SchemeBonusCard design={design} onChange={isReadOnlyDesigner ? () => {} : setDesign} />
          <SchemeOutputCard design={design} onChange={isReadOnlyDesigner ? () => {} : setDesign} />
          <SchemeFlowPreview design={design} preview={preview} />
          <Card style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Scheme name"
              value={name}
              onChange={(e) => !isReadOnlyDesigner && setName(e.target.value)}
              disabled={isReadOnlyDesigner}
            />
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <Button onClick={() => void saveDraft()} disabled={busy || isReadOnlyDesigner}>
                Save draft
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <Card>
          <h2 className="dash-card-title">Jeweller scheme requests</h2>
          <ul className="dash-list">
            {requests.map((r) => (
              <li key={r.id} className="dash-list-item">
                <div>
                  <strong>{r.title}</strong> — {r.jeweller_name}
                  <p className="dash-muted">{r.description || 'No description'}</p>
                </div>
                <div className="dash-list-actions" style={{ display: 'flex', gap: '0.35rem' }}>
                  <Button size="sm" onClick={() => void reviewRequest(r.id, 'approve')} disabled={busy}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void reviewRequest(r.id, 'reject')}
                    disabled={busy}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
            {requests.length === 0 ? <p className="dash-muted">No pending requests.</p> : null}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
