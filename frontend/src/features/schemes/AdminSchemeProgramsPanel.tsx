import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import {
  createAdminSchemeTemplate,
  createFromPreset,
  fetchAdminSchemeRequests,
  fetchAdminSchemeTemplates,
  fetchSchemePresets,
  publishAdminSchemeTemplate,
  previewAdminSchemeDesign,
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

export function AdminSchemeProgramsPanel() {
  const [tab, setTab] = useState<Tab>('templates')
  const [templates, setTemplates] = useState<SchemeTemplateDTO[]>([])
  const [presets, setPresets] = useState<SchemePresetDTO[]>([])
  const [requests, setRequests] = useState<
    Array<{ id: number; jeweller_name: string; title: string; status: string; description: string }>
  >([])
  const [design, setDesign] = useState<SchemeDesign>(EMPTY_SCHEME_DESIGN)
  const [name, setName] = useState('New scheme')
  const [editingId, setEditingId] = useState<number | null>(null)
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

  const saveDraft = async () => {
    setBusy(true)
    setErr('')
    try {
      if (editingId) {
        await updateAdminSchemeTemplate(editingId, { name, scheme_design: design })
      } else {
        const t = await createAdminSchemeTemplate({ name, description: '', scheme_design: design })
        setEditingId(t.id)
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

  const loadPreset = async (key: string) => {
    setBusy(true)
    try {
      const t = await createFromPreset(key)
      setEditingId(t.id)
      setName(t.name)
      setDesign(t.scheme_design)
      setTab('designer')
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Preset failed')
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
          <ul className="dash-list">
            {templates.map((t) => (
              <li key={t.id} className="dash-list-item">
                <div>
                  <strong>{t.name}</strong>
                  <span className="dash-muted"> — {t.status}</span>
                  <p className="dash-muted" style={{ margin: '0.25rem 0 0' }}>
                    {t.flow_summary}
                  </p>
                </div>
                <div className="dash-list-actions">
                  {t.status === 'draft' ? (
                    <Button size="sm" onClick={() => void publish(t.id)} disabled={busy}>
                      Publish
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(t.id)
                      setName(t.name)
                      setDesign(t.scheme_design)
                      setTab('designer')
                    }}
                  >
                    Open
                  </Button>
                </div>
              </li>
            ))}
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
          <SchemeInputCard design={design} onChange={setDesign} />
          <SchemeBonusCard design={design} onChange={setDesign} />
          <SchemeOutputCard design={design} onChange={setDesign} />
          <SchemeFlowPreview design={design} preview={preview} />
          <Card style={{ gridColumn: '1 / -1' }}>
            <Input label="Scheme name" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <Button onClick={() => void saveDraft()} disabled={busy}>
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
                <span className="dash-badge">{r.status}</span>
              </li>
            ))}
            {requests.length === 0 ? <p className="dash-muted">No pending requests.</p> : null}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
