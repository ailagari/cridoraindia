import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { authFetch } from '@/lib/api'

type TemplateRow = {
  id: number
  name: string
  category: string
  context: string
  locale: string
  title_template: string
  body_template: string
  variables: string[]
  is_active: boolean
}

type MomentGuide = {
  key: string
  label?: string
  when_fires?: string
  audience?: string
  suggested_variables?: string[]
  title_example?: string
  body_example?: string
}

type ContextGuide = {
  key: string
  label?: string
  use_when?: string
  set_via?: string
  note?: string
}

type UseCase = {
  title: string
  steps: string[]
  sample_key?: string
}

type SampleTemplate = {
  name: string
  category: string
  context: string
  locale: string
  title_template: string
  body_template: string
  variables: string[]
}

type GuidePayload = {
  moments: string[]
  contexts: string[]
  variables: Record<string, string[]>
  formatting_rules: string[]
  moment_guides: MomentGuide[]
  context_guides: ContextGuide[]
  use_cases: UseCase[]
  sample_templates: SampleTemplate[]
}

const sectionStyle: CSSProperties = {
  marginTop: '1.25rem',
  paddingTop: '1rem',
  borderTop: '1px solid var(--dash-border, #e8e8e8)',
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h4 className="dash-table-title" style={{ fontSize: '1rem', marginTop: 0 }}>
        {title}
      </h4>
      {children}
    </section>
  )
}

export function AdminEngagementTemplatesPanel() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [guide, setGuide] = useState<GuidePayload | null>(null)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewBody, setPreviewBody] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const [createBusy, setCreateBusy] = useState(false)
  const [formName, setFormName] = useState('')
  const [formMoment, setFormMoment] = useState('portfolio_growth')
  const [formContext, setFormContext] = useState('default')
  const [formLocale, setFormLocale] = useState('en')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formVars, setFormVars] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const [tRes, vRes] = await Promise.all([
      authFetch('/api/v1/admin/notification-templates/'),
      authFetch('/api/v1/admin/notification-variables/'),
    ])
    const tData = (await tRes.json().catch(() => ({}))) as { results?: TemplateRow[]; detail?: string }
    const vData = (await vRes.json().catch(() => ({}))) as GuidePayload & { detail?: string }
    if (!tRes.ok) {
      setErr(tData.detail || 'Failed to load templates')
      return
    }
    setRows(tData.results || [])
    if (vRes.ok) setGuide(vData)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runPreview(id: number) {
    setErr('')
    const res = await authFetch('/api/v1/admin/notification-templates/preview/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: id }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      title?: string
      body?: string
      detail?: string
    }
    if (!res.ok) {
      setErr(data.detail || 'Preview failed')
      return
    }
    setPreviewTitle(data.title || '')
    setPreviewBody(data.body || '')
    setSelectedId(id)
  }

  function applySample(s: SampleTemplate) {
    setFormName(s.name)
    setFormMoment(s.category)
    setFormContext(s.context)
    setFormLocale(s.locale)
    setFormTitle(s.title_template)
    setFormBody(s.body_template)
    setFormVars(s.variables.join(', '))
    setOkMsg(`Sample "${s.name}" loaded into the create form below.`)
  }

  async function createTemplate(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setOkMsg('')
    setCreateBusy(true)
    try {
      const variables = formVars
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      const res = await authFetch('/api/v1/admin/notification-templates/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          category: formMoment,
          context: formContext,
          locale: formLocale,
          title_template: formTitle.trim(),
          body_template: formBody.trim(),
          variables,
          is_active: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setErr(typeof data.detail === 'string' ? data.detail : `Create failed (${res.status})`)
        return
      }
      setOkMsg('Template created. It is live for matching events immediately.')
      setFormName('')
      setFormTitle('')
      setFormBody('')
      setFormVars('')
      await load()
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <div className="card">
        <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
          Engagement templates
        </h3>
        <p className="dash-coming__text">
          Notifications are built from <strong>facts</strong> (portfolio value, holding name, festival name) plus{' '}
          <strong>templates</strong> you edit here. No code deploy is needed to change wording — only to add new
          moments or variables.
        </p>
        <p className="dash-footnote" style={{ maxWidth: 720 }}>
          Lookup key: <strong>moment</strong> + <strong>context</strong> + <strong>locale</strong>. Example:{' '}
          <code>holding_appreciation</code> + <code>festival</code> + <code>en</code> for English Vishu copy.
        </p>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: '0.5rem' }}
          onClick={() => setShowGuide((v) => !v)}
        >
          {showGuide ? 'Hide guide' : 'Show full guide'}
        </button>

        {err ? <p className="form-error">{err}</p> : null}
        {okMsg ? (
          <p className="dash-footnote" style={{ color: 'var(--ok, #2ecc71)' }}>
            {okMsg}
          </p>
        ) : null}

        {showGuide && guide ? (
          <>
            <GuideSection title="How it works">
              <ol className="dash-coming__text" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>Gold price ingest or a scheduled campaign triggers an event.</li>
                <li>The system builds facts for each customer (names, ₹ values, festival name).</li>
                <li>
                  The active <strong>context</strong> is chosen (platform festival window, campaign, or default).
                </li>
                <li>
                  The matching template row is rendered: <code>{'{{variable}}'}</code> → real values.
                </li>
                <li>Result goes to inbox and tray (existing delivery — unchanged).</li>
              </ol>
            </GuideSection>

            <GuideSection title="Moments — when each template runs">
              <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
                <strong>Moment</strong> is stored as <code>category</code> on each row. Pick the moment that matches
                the story you want; context and locale select the wording variant.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Moment</th>
                      <th>When it fires</th>
                      <th>Good variables</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.moment_guides.map((m) => (
                      <tr key={m.key}>
                        <td>
                          <code>{m.key}</code>
                          {m.label ? (
                            <>
                              <br />
                              <span className="dash-footnote">{m.label}</span>
                            </>
                          ) : null}
                        </td>
                        <td style={{ maxWidth: 280 }}>{m.when_fires || '—'}</td>
                        <td>
                          {(m.suggested_variables || []).map((v) => (
                            <code key={v} style={{ marginRight: '0.35rem' }}>
                              {`{{${v}}}`}
                            </code>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GuideSection>

            <GuideSection title="Contexts — tone and season">
              <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
                Do <strong>not</strong> create a new context for every holiday. Use <code>festival</code> and set the
                holiday name in Gold alerts or the campaign (<code>{'{{festival_name}}'}</code>).
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Context</th>
                      <th>Use when</th>
                      <th>How to activate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.context_guides.map((c) => (
                      <tr key={c.key}>
                        <td>
                          <code>{c.key}</code>
                        </td>
                        <td>{c.use_when || '—'}</td>
                        <td>
                          {c.set_via || '—'}
                          {c.note ? (
                            <p className="dash-footnote" style={{ margin: '0.35rem 0 0' }}>
                              {c.note}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GuideSection>

            <GuideSection title="Variables reference">
              <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
                Copy-paste into title or body. Values are pre-formatted (₹, %) for the customer locale.
              </p>
              {Object.entries(guide.variables).map(([group, vars]) => (
                <div key={group} style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{group}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                    {vars.map((v) => (
                      <code
                        key={v}
                        style={{
                          padding: '0.15rem 0.4rem',
                          background: 'var(--dash-surface-muted, #f0f0f0)',
                          borderRadius: 4,
                          fontSize: '0.8rem',
                        }}
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </GuideSection>

            <GuideSection title="Formatting rules">
              <ul className="dash-coming__text" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {guide.formatting_rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </GuideSection>

            <GuideSection title="Sample templates (copy into create form)">
              <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
                Click <strong>Use sample</strong> to fill the create form. Adjust wording, then save. Unique key must
                not already exist.
              </p>
              {guide.sample_templates.map((s) => (
                <div
                  key={`${s.category}-${s.context}-${s.locale}`}
                  className="card"
                  style={{
                    marginBottom: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: 'var(--dash-surface-muted, #f8f8f8)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{s.name}</strong>
                    <code>
                      {s.category}/{s.context}/{s.locale}
                    </code>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => applySample(s)}>
                      Use sample
                    </button>
                  </div>
                  <p className="dash-footnote" style={{ margin: '0.5rem 0 0.15rem' }}>
                    <strong>Title:</strong> {s.title_template}
                  </p>
                  <p className="dash-footnote" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    <strong>Body:</strong> {s.body_template}
                  </p>
                </div>
              ))}
            </GuideSection>

            <GuideSection title="Use cases (step by step)">
              {guide.use_cases.map((uc) => (
                <div key={uc.title} style={{ marginBottom: '1rem' }}>
                  <strong>{uc.title}</strong>
                  {uc.sample_key ? (
                    <span className="dash-footnote">
                      {' '}
                      — template key <code>{uc.sample_key}</code>
                    </span>
                  ) : null}
                  <ol className="dash-footnote" style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem' }}>
                    {uc.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </GuideSection>
          </>
        ) : null}

        <GuideSection title="Create a new template">
          <form onSubmit={(e) => void createTemplate(e)}>
            <div className="field">
              <label htmlFor="tpl-name">Admin label (internal)</label>
              <input
                id="tpl-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Holding appreciation — Vishu 2026"
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div className="field">
                <label htmlFor="tpl-moment">Moment</label>
                <select id="tpl-moment" value={formMoment} onChange={(e) => setFormMoment(e.target.value)}>
                  {(guide?.moments || ['portfolio_growth']).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tpl-ctx">Context</label>
                <select id="tpl-ctx" value={formContext} onChange={(e) => setFormContext(e.target.value)}>
                  {(guide?.contexts || ['default']).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tpl-locale">Locale</label>
                <select id="tpl-locale" value={formLocale} onChange={(e) => setFormLocale(e.target.value)}>
                  <option value="en">en</option>
                  <option value="ml">ml</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="tpl-title">Title template</label>
              <input
                id="tpl-title"
                type="text"
                maxLength={180}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Portfolio value update"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-body">Body template</label>
              <textarea
                id="tpl-body"
                className="dash-textarea"
                rows={4}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Your {{holding_name}} is now {{holding_value}}…"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tpl-vars">Variables used (comma-separated, optional)</label>
              <input
                id="tpl-vars"
                type="text"
                value={formVars}
                onChange={(e) => setFormVars(e.target.value)}
                placeholder="holding_name, holding_value, festival_name"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={createBusy}>
              {createBusy ? 'Saving…' : 'Create template'}
            </button>
          </form>
        </GuideSection>

        <GuideSection title="Active templates">
          <p className="dash-footnote" style={{ marginBottom: '0.5rem' }}>
            Preview uses a real customer&apos;s facts when available. Seed defaults:{' '}
            <code>python manage.py seed_engagement_templates</code>
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Moment</th>
                  <th>Context</th>
                  <th>Locale</th>
                  <th>Name</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="dash-footnote">
                      No templates — run seed command on the server.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.category}</code>
                      </td>
                      <td>
                        <code>{r.context}</code>
                      </td>
                      <td>{r.locale}</td>
                      <td>{r.name}</td>
                      <td>{r.is_active ? 'Yes' : 'No'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void runPreview(r.id)}
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GuideSection>

        {selectedId != null ? (
          <div
            className="card"
            style={{ marginTop: '1rem', padding: '1rem', background: 'var(--dash-surface-muted, #f8f8f8)' }}
          >
            <strong>Preview (template #{selectedId})</strong>
            <p className="dash-footnote" style={{ margin: '0.5rem 0 0' }}>
              Tray may truncate long bodies (~120 chars).
            </p>
            <p style={{ margin: '0.5rem 0 0' }}>
              <strong>{previewTitle}</strong>
            </p>
            <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{previewBody}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
