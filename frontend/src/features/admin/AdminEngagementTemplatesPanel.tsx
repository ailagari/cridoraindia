import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type TemplateRow = {
  id: number
  name: string
  category: string
  context: string
  locale: string
  title_template: string
  body_template: string
  is_active: boolean
}

type VariableCatalog = {
  moments: string[]
  contexts: string[]
  variables: Record<string, string[]>
}

export function AdminEngagementTemplatesPanel() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [catalog, setCatalog] = useState<VariableCatalog | null>(null)
  const [err, setErr] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewBody, setPreviewBody] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const [tRes, vRes] = await Promise.all([
      authFetch('/api/v1/admin/notification-templates/'),
      authFetch('/api/v1/admin/notification-variables/'),
    ])
    const tData = (await tRes.json().catch(() => ({}))) as { results?: TemplateRow[]; detail?: string }
    const vData = (await vRes.json().catch(() => ({}))) as VariableCatalog
    if (!tRes.ok) {
      setErr(tData.detail || 'Failed to load templates')
      return
    }
    setRows(tData.results || [])
    if (vRes.ok) setCatalog(vData)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runPreview(id: number) {
    const res = await authFetch('/api/v1/admin/notification-templates/preview/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: id }),
    })
    const data = (await res.json().catch(() => ({}))) as { title?: string; body?: string; detail?: string }
    if (!res.ok) {
      setErr(data.detail || 'Preview failed')
      return
    }
    setPreviewTitle(data.title || '')
    setPreviewBody(data.body || '')
    setSelectedId(id)
  }

  return (
    <div className="card">
      <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
        Engagement templates
      </h3>
      <p className="dash-coming__text">
        Copy is keyed by moment + context + locale. Use <code>festival</code> context with{' '}
        <code>{'{{festival_name}}'}</code> — not separate contexts per holiday.
      </p>
      {err ? <p className="form-error">{err}</p> : null}
      {catalog ? (
        <p className="dash-coming__text" style={{ fontSize: '0.85rem' }}>
          Moments: {catalog.moments.join(', ')} · Contexts: {catalog.contexts.join(', ')}
        </p>
      ) : null}
      <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Moment</th>
              <th>Context</th>
              <th>Locale</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.category}</td>
                <td>{r.context}</td>
                <td>{r.locale}</td>
                <td>{r.name}</td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void runPreview(r.id)}>
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedId != null ? (
        <div className="card" style={{ marginTop: '1rem', background: 'var(--dash-surface-muted, #f8f8f8)' }}>
          <strong>Preview (template #{selectedId})</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            <strong>{previewTitle}</strong>
          </p>
          <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{previewBody}</p>
        </div>
      ) : null}
      <p className="dash-coming__text" style={{ marginTop: '1rem' }}>
        Seed defaults: <code>python manage.py seed_engagement_templates</code>
      </p>
    </div>
  )
}
