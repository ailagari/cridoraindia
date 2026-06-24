import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  suggested_variables?: string[]
}

type GuidePayload = {
  moments: string[]
  contexts: string[]
  variables: Record<string, string[]>
  moment_guides: MomentGuide[]
  context_guides: { key: string; label?: string; use_when?: string }[]
  sample_templates: {
    name: string
    category: string
    context: string
    locale: string
    title_template: string
    body_template: string
    variables: string[]
  }[]
  formatting_rules: string[]
}

const MOMENT_LABELS: Record<string, string> = {
  portfolio_growth: 'Portfolio gain vs cost',
  portfolio_milestone: 'Portfolio milestone',
  portfolio_value_up: 'Total portfolio value up',
  portfolio_value_down: 'Total portfolio value down',
  personal_collection_growth: 'Personal holdings — collective up',
  personal_collection_down: 'Personal holdings — collective down',
  holding_appreciation: 'One holding gained value',
  holding_value_down: 'One holding value down',
  holding_milestone: 'Holding milestone',
  market_awareness: 'Gold rate moved (legacy)',
  market_rate_increase: 'Gold rate increased',
  market_rate_decrease: 'Gold rate decreased',
}

const CONTEXT_LABELS: Record<string, string> = {
  default: 'Everyday',
  festival: 'Festival season',
  educational: 'Educational tip',
  jeweller_campaign: 'Jeweller campaign',
}

function momentLabel(key: string): string {
  return MOMENT_LABELS[key] || key.replace(/_/g, ' ')
}

function contextLabel(key: string): string {
  return CONTEXT_LABELS[key] || key
}

export function AdminEngagementTemplatesPanel() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [guide, setGuide] = useState<GuidePayload | null>(null)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewBody, setPreviewBody] = useState('')
  const [previewId, setPreviewId] = useState<number | null>(null)

  const [formName, setFormName] = useState('')
  const [formMoment, setFormMoment] = useState('market_awareness')
  const [formContext, setFormContext] = useState('default')
  const [formLocale, setFormLocale] = useState('en')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')

  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [insertTarget, setInsertTarget] = useState<'title' | 'body'>('body')

  const allVariables = collectGuideVariables(guide)

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

  function insertVariable(varName: string) {
    const token = `{{${varName}}}`
    if (insertTarget === 'title') {
      const el = titleRef.current
      setFormTitle((prev) => prev + (el && document.activeElement === el ? '' : prev.endsWith(' ') ? '' : ' ') + token)
      if (el) {
        const next = (formTitle + ' ' + token).trim()
        setFormTitle(next)
        el.focus()
      }
    } else {
      const el = bodyRef.current
      const next = (formBody + (formBody && !formBody.endsWith(' ') ? ' ' : '') + token).trim()
      setFormBody(next)
      el?.focus()
    }
  }

  async function runPreview(id: number) {
    setErr('')
    const res = await authFetch('/api/v1/admin/notification-templates/preview/', {
      method: 'POST',
      jsonBody: { template_id: id },
    })
    const data = (await res.json().catch(() => ({}))) as { title?: string; body?: string; detail?: string }
    if (!res.ok) {
      setErr(data.detail || 'Preview failed')
      return
    }
    setPreviewTitle(data.title || '')
    setPreviewBody(data.body || '')
    setPreviewId(id)
  }

  function applySample(s: GuidePayload['sample_templates'][0]) {
    setFormName(s.name)
    setFormMoment(s.category)
    setFormContext(s.context)
    setFormLocale(s.locale)
    setFormTitle(s.title_template)
    setFormBody(s.body_template)
    setOkMsg(`Loaded sample "${s.name}". Edit and save below.`)
  }

  async function createTemplate(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setOkMsg('')
    setCreateBusy(true)
    try {
      const vars = [...formTitle.matchAll(/\{\{(\w+)\}\}/g), ...formBody.matchAll(/\{\{(\w+)\}\}/g)].map(
        (m) => m[1],
      )
      const uniqueVars = [...new Set(vars)]
      const res = await authFetch('/api/v1/admin/notification-templates/', {
        method: 'POST',
        jsonBody: {
          name: formName.trim(),
          category: formMoment,
          context: formContext,
          locale: formLocale,
          title_template: formTitle.trim(),
          body_template: formBody.trim(),
          variables: uniqueVars,
          is_active: true,
        },
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setErr(typeof data.detail === 'string' ? data.detail : `Create failed (${res.status})`)
        return
      }
      setOkMsg('Template saved. It applies to matching automatic alerts immediately.')
      setFormName('')
      setFormTitle('')
      setFormBody('')
      await load()
    } finally {
      setCreateBusy(false)
    }
  }

  const suggestedVars =
    guide?.moment_guides.find((m) => m.key === formMoment)?.suggested_variables ?? []

  return (
    <div className="dash-panel-max">
      <div className="card">
        <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
          Message templates
        </h3>
        <p className="dash-coming__text" style={{ maxWidth: 680, marginBottom: '1rem' }}>
          Templates power automatic alerts (gold moves, portfolio gains, festivals). Use plain
          language and short titles. Variables like <code>{'{{holding_name}}'}</code> fill in real
          customer details.
        </p>

        <button type="button" className="btn btn-ghost" onClick={() => setShowReference((v) => !v)}>
          {showReference ? 'Hide' : 'Show'} technical reference
        </button>

        {err ? <p className="form-error">{err}</p> : null}
        {okMsg ? <p style={{ color: 'var(--ok)' }}>{okMsg}</p> : null}

        {showReference && guide ? (
          <div style={{ marginTop: '1rem', fontSize: '0.88rem' }}>
            <p className="dash-footnote">
              Unique key: <strong>when</strong> + <strong>tone</strong> + <strong>language</strong>
            </p>
            <ul className="dash-coming__text">
              {guide.formatting_rules.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {guide && guide.sample_templates.length > 0 ? (
          <div style={{ marginTop: '1.25rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Start from a sample</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {guide.sample_templates.map((s) => (
                <button
                  key={`${s.category}-${s.context}-${s.locale}-${s.name}`}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => applySample(s)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form onSubmit={(e) => void createTemplate(e)} style={{ marginTop: '1.5rem' }}>
          <h4 style={{ marginTop: 0 }}>Create or edit wording</h4>
          <div className="field">
            <label htmlFor="tpl-name">Internal name</label>
            <input
              id="tpl-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Festival greeting — English"
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="tpl-moment">When it runs</label>
              <select id="tpl-moment" value={formMoment} onChange={(e) => setFormMoment(e.target.value)}>
                {(guide?.moments || Object.keys(MOMENT_LABELS)).map((m) => (
                  <option key={m} value={m}>
                    {momentLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tpl-ctx">Tone</label>
              <select id="tpl-ctx" value={formContext} onChange={(e) => setFormContext(e.target.value)}>
                {(guide?.contexts || Object.keys(CONTEXT_LABELS)).map((c) => (
                  <option key={c} value={c}>
                    {contextLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tpl-locale">Language</label>
              <select id="tpl-locale" value={formLocale} onChange={(e) => setFormLocale(e.target.value)}>
                <option value="en">English</option>
                <option value="ml">Malayalam</option>
              </select>
            </div>
          </div>

          <p className="dash-footnote" style={{ margin: '0.5rem 0' }}>
            Click a variable to insert into {insertTarget === 'title' ? 'title' : 'body'}:
          </p>
          <div className="admin-tpl-var-bar">
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => setInsertTarget('title')}>
              Edit title
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => setInsertTarget('body')}>
              Edit body
            </button>
            {suggestedVars.map((v) => (
              <button
                key={v}
                type="button"
                className="admin-tpl-var-chip"
                onClick={() => insertVariable(v)}
              >
                {`{{${v}}}`}
              </button>
            ))}
            {allVariables.map((v) =>
              suggestedVars.includes(v) ? null : (
                <button key={v} type="button" className="admin-tpl-var-chip" onClick={() => insertVariable(v)}>
                  {`{{${v}}}`}
                </button>
              ),
            )}
          </div>

          <div className="field">
            <label htmlFor="tpl-title">Title (keep short for phone)</label>
            <input
              id="tpl-title"
              ref={titleRef}
              value={formTitle}
              onFocus={() => setInsertTarget('title')}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Gold rate alert"
              maxLength={180}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="tpl-body">Message body</label>
            <textarea
              id="tpl-body"
              ref={bodyRef}
              className="dash-textarea"
              rows={4}
              value={formBody}
              onFocus={() => setInsertTarget('body')}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Gold rate moved {{gold_change_percent}} — now {{gold_price}}."
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={createBusy}>
            {createBusy ? 'Saving…' : 'Save template'}
          </button>
        </form>

        {previewId != null ? (
          <div className="admin-msg-preview-inline">
            <strong>Preview (template #{previewId})</strong>
            <p style={{ margin: '0.5rem 0 0' }}>
              <strong>{previewTitle}</strong>
            </p>
            <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{previewBody}</p>
          </div>
        ) : null}

        <h4 style={{ marginTop: '1.5rem' }}>Active templates ({rows.length})</h4>
        {rows.length === 0 ? (
          <p className="dash-footnote">No templates yet. Use a sample above or run seed on the server.</p>
        ) : (
          <div className="admin-tpl-cards">
            {rows.map((r) => (
              <div key={r.id} className="admin-tpl-card">
                <div className="admin-tpl-card-head">
                  <div>
                    <strong>{r.name}</strong>
                    <p className="dash-footnote" style={{ margin: '0.2rem 0 0' }}>
                      {momentLabel(r.category)} · {contextLabel(r.context)} · {r.locale}
                      {r.is_active ? '' : ' · inactive'}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void runPreview(r.id)}>
                    Preview
                  </button>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                  <strong>Title:</strong> {r.title_template}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {r.body_template}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function collectGuideVariables(guide: GuidePayload | null): string[] {
  if (!guide) return []
  const out = new Set<string>()
  for (const list of Object.values(guide.variables)) {
    for (const v of list) out.add(v)
  }
  return [...out].sort()
}
