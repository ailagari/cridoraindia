import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api'

type SystemMessageRow = {
  id: number
  key: string
  name: string
  locale: string
  description: string
  title_template: string
  body_template: string
  alternative_titles: string[]
  alternative_bodies: string[]
  variables: string[]
  is_active: boolean
}

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

type LocaleDraft = {
  title_template: string
  body_template: string
  alternative_titles: string[]
  alternative_bodies: string[]
  is_active: boolean
}

const TRAY_KEYS = [
  'gold_rate_alert_title_up',
  'gold_rate_alert_title_down',
  'gold_hourly_push_title_up',
  'gold_hourly_push_title_down',
  'gold_price_move_body_up',
  'gold_price_move_body_down',
  'gold_rate_alert_title',
  'gold_hourly_push_title',
  'gold_price_move_body',
] as const

const TRAY_KEY_LABELS: Record<string, string> = {
  gold_rate_alert_title_up: 'Big move — rate increased (tray title)',
  gold_rate_alert_title_down: 'Big move — rate decreased (tray title)',
  gold_hourly_push_title_up: 'Hourly digest — rate up (tray title)',
  gold_hourly_push_title_down: 'Hourly digest — rate down (tray title)',
  gold_price_move_body_up: 'Rate increased (tray body)',
  gold_price_move_body_down: 'Rate decreased (tray body)',
  gold_rate_alert_title: 'Big move — legacy title (fallback)',
  gold_hourly_push_title: 'Hourly digest — legacy title (fallback)',
  gold_price_move_body: 'Price move — legacy body (fallback)',
}

const INBOX_MOMENTS = [
  'market_rate_increase',
  'market_rate_decrease',
  'portfolio_value_up',
  'portfolio_value_down',
  'personal_collection_growth',
  'personal_collection_down',
  'holding_appreciation',
  'holding_value_down',
  'portfolio_growth',
] as const

const INBOX_MOMENT_LABELS: Record<string, string> = {
  market_rate_increase: 'Gold rate increased (customer inbox)',
  market_rate_decrease: 'Gold rate decreased (customer inbox)',
  portfolio_value_up: 'Total portfolio value up',
  portfolio_value_down: 'Total portfolio value down',
  personal_collection_growth: 'Personal holdings — collective up',
  personal_collection_down: 'Personal holdings — collective down',
  holding_appreciation: 'One holding gained value',
  holding_value_down: 'One holding value down',
  portfolio_growth: 'Portfolio gain vs cost',
}

const emptyDraft = (): LocaleDraft => ({
  title_template: '',
  body_template: '',
  alternative_titles: [],
  alternative_bodies: [],
  is_active: true,
})

function draftFromSystem(row: SystemMessageRow): LocaleDraft {
  return {
    title_template: row.title_template,
    body_template: row.body_template,
    alternative_titles: [...(row.alternative_titles || [])],
    alternative_bodies: [...(row.alternative_bodies || [])],
    is_active: row.is_active,
  }
}

function draftFromTemplate(row: TemplateRow): LocaleDraft {
  return {
    title_template: row.title_template,
    body_template: row.body_template,
    alternative_titles: [],
    alternative_bodies: [],
    is_active: row.is_active,
  }
}

function VariableHints({ variables }: { variables: string[] }) {
  if (!variables.length) return null
  return (
    <p className="dash-footnote" style={{ marginBottom: '0.5rem' }}>
      Variables:{' '}
      {variables.map((v) => (
        <code key={v} style={{ marginRight: '0.35rem' }}>
          {`{{${v}}}`}
        </code>
      ))}
    </p>
  )
}

function LocaleFields({
  locale,
  draft,
  variables,
  showAlternatives,
  onChange,
}: {
  locale: 'en' | 'ml'
  draft: LocaleDraft
  variables: string[]
  showAlternatives: boolean
  onChange: (next: LocaleDraft) => void
}) {
  const label = locale === 'en' ? 'English' : 'Malayalam'
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <strong style={{ fontSize: '0.9rem' }}>{label}</strong>
      <VariableHints variables={variables} />
      <div className="field">
        <label>Title</label>
        <input
          value={draft.title_template}
          onChange={(e) => onChange({ ...draft, title_template: e.target.value })}
          maxLength={180}
          placeholder="Short tray/inbox title"
        />
      </div>
      <div className="field">
        <label>Body</label>
        <textarea
          className="dash-textarea"
          rows={3}
          value={draft.body_template}
          onChange={(e) => onChange({ ...draft, body_template: e.target.value })}
          placeholder="Leave empty for title-only tray alerts"
        />
      </div>
      {showAlternatives ? (
        <>
          <p className="dash-footnote" style={{ margin: '0.25rem 0' }}>
            Alternative wordings rotate on each send.
          </p>
          {draft.alternative_titles.map((alt, idx) => (
            <div key={`at-${idx}`} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem' }}>
              <input
                value={alt}
                onChange={(e) => {
                  const next = [...draft.alternative_titles]
                  next[idx] = e.target.value
                  onChange({ ...draft, alternative_titles: next })
                }}
                placeholder="Alternate title"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  onChange({
                    ...draft,
                    alternative_titles: draft.alternative_titles.filter((_, i) => i !== idx),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              onChange({ ...draft, alternative_titles: [...draft.alternative_titles, ''] })
            }
          >
            + Alt title
          </button>
          {draft.alternative_bodies.map((alt, idx) => (
            <div key={`ab-${idx}`} style={{ marginTop: '0.35rem' }}>
              <textarea
                className="dash-textarea"
                rows={2}
                value={alt}
                onChange={(e) => {
                  const next = [...draft.alternative_bodies]
                  next[idx] = e.target.value
                  onChange({ ...draft, alternative_bodies: next })
                }}
                placeholder="Alternate body"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  onChange({
                    ...draft,
                    alternative_bodies: draft.alternative_bodies.filter((_, i) => i !== idx),
                  })
                }
              >
                Remove alt body
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: '0.35rem' }}
            onClick={() =>
              onChange({ ...draft, alternative_bodies: [...draft.alternative_bodies, ''] })
            }
          >
            + Alt body
          </button>
        </>
      ) : null}
      <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.88rem' }}>
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => onChange({ ...draft, is_active: e.target.checked })}
        />
        Active
      </label>
    </div>
  )
}

function buildSystemByKey(rows: SystemMessageRow[]) {
  const map = new Map<string, { en?: SystemMessageRow; ml?: SystemMessageRow }>()
  for (const row of rows) {
    const cur = map.get(row.key) || {}
    if (row.locale === 'ml') cur.ml = row
    else cur.en = row
    map.set(row.key, cur)
  }
  return map
}

function buildTemplatesByMoment(rows: TemplateRow[]) {
  const map = new Map<string, { en?: TemplateRow; ml?: TemplateRow }>()
  for (const row of rows) {
    if (row.context !== 'default') continue
    const cur = map.get(row.category) || {}
    if (row.locale === 'ml') cur.ml = row
    else cur.en = row
    map.set(row.category, cur)
  }
  return map
}

export function AdminGoldAlertCopyPanel() {
  const [systemRows, setSystemRows] = useState<SystemMessageRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const [trayOpen, setTrayOpen] = useState<string | null>(null)
  const [trayDrafts, setTrayDrafts] = useState<{ en: LocaleDraft; ml: LocaleDraft } | null>(null)
  const [trayMeta, setTrayMeta] = useState<{ en?: SystemMessageRow; ml?: SystemMessageRow }>({})

  const [inboxOpen, setInboxOpen] = useState<string | null>(null)
  const [inboxDrafts, setInboxDrafts] = useState<{ en: LocaleDraft; ml: LocaleDraft } | null>(null)
  const [inboxMeta, setInboxMeta] = useState<{ en?: TemplateRow; ml?: TemplateRow }>({})

  const load = useCallback(async () => {
    setErr('')
    const [sysRes, tplRes] = await Promise.all([
      authFetch('/api/v1/admin/system-notification-messages/?group=gold'),
      authFetch('/api/v1/admin/notification-templates/?context=default'),
    ])
    const sysData = (await sysRes.json().catch(() => ({}))) as {
      results?: SystemMessageRow[]
      detail?: string
    }
    const tplData = (await tplRes.json().catch(() => ({}))) as {
      results?: TemplateRow[]
      detail?: string
    }
    if (!sysRes.ok) {
      setErr(sysData.detail || 'Could not load tray message copy.')
      return null
    }
    if (!tplRes.ok) {
      setErr(tplData.detail || 'Could not load inbox templates.')
      return null
    }
    const nextSystemRows = sysData.results || []
    const goldTemplates = (tplData.results || []).filter((t) =>
      (INBOX_MOMENTS as readonly string[]).includes(t.category),
    )
    setSystemRows(nextSystemRows)
    setTemplates(goldTemplates)
    return { systemRows: nextSystemRows, templates: goldTemplates }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const systemByKey = useMemo(() => buildSystemByKey(systemRows), [systemRows])

  const templatesByMoment = useMemo(() => buildTemplatesByMoment(templates), [templates])

  function applyTrayEditor(key: string, rows: SystemMessageRow[]) {
    const pair = buildSystemByKey(rows).get(key)
    setTrayOpen(key)
    setTrayMeta(pair || {})
    setTrayDrafts({
      en: pair?.en ? draftFromSystem(pair.en) : emptyDraft(),
      ml: pair?.ml ? draftFromSystem(pair.ml) : emptyDraft(),
    })
  }

  function applyInboxEditor(moment: string, rows: TemplateRow[]) {
    const pair = buildTemplatesByMoment(rows).get(moment)
    setInboxOpen(moment)
    setInboxMeta(pair || {})
    setInboxDrafts({
      en: pair?.en ? draftFromTemplate(pair.en) : emptyDraft(),
      ml: pair?.ml ? draftFromTemplate(pair.ml) : emptyDraft(),
    })
  }

  function openTray(key: string) {
    setOkMsg('')
    applyTrayEditor(key, systemRows)
  }

  function openInbox(moment: string) {
    setOkMsg('')
    applyInboxEditor(moment, templates)
  }

  async function saveSystemRow(
    id: number | undefined,
    draft: LocaleDraft,
    createKey: string,
    locale: string,
  ): Promise<SystemMessageRow | void> {
    const payload = {
      title_template: draft.title_template.trim(),
      body_template: draft.body_template.trim(),
      alternative_titles: draft.alternative_titles.map((s) => s.trim()).filter(Boolean),
      alternative_bodies: draft.alternative_bodies.map((s) => s.trim()).filter(Boolean),
      is_active: draft.is_active,
    }
    if (id) {
      const res = await authFetch(`/api/v1/admin/system-notification-messages/${id}/`, {
        method: 'PATCH',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as SystemMessageRow & { detail?: string }
      if (!res.ok) {
        throw new Error(data.detail || 'Save failed.')
      }
      return data
    }
    const existing = systemRows.find((r) => r.key === createKey && r.locale === locale)
    if (existing) {
      return saveSystemRow(existing.id, draft, createKey, locale)
    }
    throw new Error(`No ${locale.toUpperCase()} row for ${createKey}. Run migrations to seed defaults.`)
  }

  async function saveTray(key: string) {
    if (!trayDrafts) return
    setBusyKey(`tray-${key}`)
    setErr('')
    setOkMsg('')
    try {
      let nextRows = [...systemRows]
      const mergeSaved = (saved: SystemMessageRow | void) => {
        if (!saved) return
        const idx = nextRows.findIndex((r) => r.id === saved.id)
        if (idx >= 0) nextRows[idx] = saved
        else nextRows.push(saved)
      }
      mergeSaved(await saveSystemRow(trayMeta.en?.id, trayDrafts.en, key, 'en'))
      mergeSaved(await saveSystemRow(trayMeta.ml?.id, trayDrafts.ml, key, 'ml'))
      const fresh = await load()
      nextRows = fresh?.systemRows ?? nextRows
      applyTrayEditor(key, nextRows)
      setOkMsg('Tray wording saved. Next alerts will use this copy.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusyKey('')
    }
  }

  async function saveTemplateRow(
    id: number | undefined,
    draft: LocaleDraft,
    moment: string,
    locale: string,
    existing?: TemplateRow,
  ): Promise<TemplateRow | void> {
    const title = draft.title_template.trim()
    const body = draft.body_template.trim()
    if (!title || !body) {
      throw new Error(`${locale.toUpperCase()} title and body are required.`)
    }
    const vars = [...title.matchAll(/\{\{(\w+)\}\}/g), ...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    const uniqueVars = [...new Set([...(existing?.variables || []), ...vars])]
    const payload = {
      title_template: title,
      body_template: body,
      variables: uniqueVars,
      is_active: draft.is_active,
    }
    if (id) {
      const res = await authFetch(`/api/v1/admin/notification-templates/${id}/`, {
        method: 'PATCH',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as TemplateRow & { detail?: string }
      if (!res.ok) {
        throw new Error(data.detail || 'Save failed.')
      }
      return data
    }
    const res = await authFetch('/api/v1/admin/notification-templates/', {
      method: 'POST',
      jsonBody: {
        name: `${INBOX_MOMENT_LABELS[moment] || moment} (${locale.toUpperCase()})`,
        category: moment,
        context: 'default',
        locale,
        ...payload,
      },
    })
    const data = (await res.json().catch(() => ({}))) as TemplateRow & { detail?: string }
    if (!res.ok) {
      throw new Error(data.detail || 'Create failed.')
    }
    return data
  }

  async function saveInbox(moment: string) {
    if (!inboxDrafts) return
    setBusyKey(`inbox-${moment}`)
    setErr('')
    setOkMsg('')
    try {
      let nextTemplates = [...templates]
      const mergeSaved = (saved: TemplateRow | void) => {
        if (!saved) return
        const idx = nextTemplates.findIndex((r) => r.id === saved.id)
        if (idx >= 0) nextTemplates[idx] = saved
        else nextTemplates.push(saved)
      }
      if (inboxDrafts.en.title_template.trim() && inboxDrafts.en.body_template.trim()) {
        mergeSaved(
          await saveTemplateRow(inboxMeta.en?.id, inboxDrafts.en, moment, 'en', inboxMeta.en),
        )
      }
      if (inboxDrafts.ml.title_template.trim() && inboxDrafts.ml.body_template.trim()) {
        mergeSaved(
          await saveTemplateRow(inboxMeta.ml?.id, inboxDrafts.ml, moment, 'ml', inboxMeta.ml),
        )
      }
      const fresh = await load()
      nextTemplates =
        fresh?.templates ??
        nextTemplates.filter((t) => (INBOX_MOMENTS as readonly string[]).includes(t.category))
      applyInboxEditor(moment, nextTemplates)
      setOkMsg('Inbox wording saved. Matching customers will see this on the next alert.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
        Alert message wording (English & Malayalam)
      </h3>
      <p className="dash-coming__text" style={{ maxWidth: 720, marginBottom: '1rem' }}>
        Edit the exact text customers see for automatic gold and portfolio alerts. Tray messages
        appear on the phone lock screen; inbox messages appear inside the app. Save both languages
        when Malayalam alerts are enabled.
      </p>

      {err ? <p className="form-error">{err}</p> : null}
      {okMsg ? <p style={{ color: 'var(--ok)' }}>{okMsg}</p> : null}

      <h4 style={{ marginTop: '0.5rem' }}>Tray alerts (push notifications)</h4>
      <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
        Titles and bodies for big-move and hourly gold pushes sent to all subscribers.
      </p>
      <div className="admin-tpl-cards">
        {TRAY_KEYS.map((key) => {
          const pair = systemByKey.get(key)
          const open = trayOpen === key
          const vars = pair?.en?.variables?.length
            ? pair.en.variables
            : pair?.ml?.variables || []
          return (
            <div key={key} className="admin-tpl-card">
              <div className="admin-tpl-card-head">
                <div>
                  <strong>{TRAY_KEY_LABELS[key] || key}</strong>
                  <p className="dash-footnote" style={{ margin: '0.2rem 0 0' }}>
                    <code>{key}</code>
                    {pair?.en ? ' · EN ✓' : ' · EN missing'}
                    {pair?.ml ? ' · ML ✓' : ' · ML missing'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => (open ? setTrayOpen(null) : openTray(key))}
                >
                  {open ? 'Close' : 'Edit EN & ML'}
                </button>
              </div>
              {open && trayOpen === key && trayDrafts ? (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    <LocaleFields
                      locale="en"
                      draft={trayDrafts.en}
                      variables={vars}
                      showAlternatives
                      onChange={(en) => setTrayDrafts({ ...trayDrafts, en })}
                    />
                    <LocaleFields
                      locale="ml"
                      draft={trayDrafts.ml}
                      variables={vars}
                      showAlternatives
                      onChange={(ml) => setTrayDrafts({ ...trayDrafts, ml })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                    disabled={busyKey === `tray-${key}`}
                    onClick={() => void saveTray(key)}
                  >
                    {busyKey === `tray-${key}` ? 'Saving…' : 'Save tray wording'}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <h4 style={{ marginTop: '1.5rem' }}>Inbox alerts (customers with holdings)</h4>
      <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
        Personalized messages when gold moves or portfolio value changes. Uses customer name and
        holding details where noted.
      </p>
      <div className="admin-tpl-cards">
        {INBOX_MOMENTS.map((moment) => {
          const pair = templatesByMoment.get(moment)
          const open = inboxOpen === moment
          const vars = pair?.en?.variables?.length
            ? pair.en.variables
            : pair?.ml?.variables || []
          return (
            <div key={moment} className="admin-tpl-card">
              <div className="admin-tpl-card-head">
                <div>
                  <strong>{INBOX_MOMENT_LABELS[moment] || moment}</strong>
                  <p className="dash-footnote" style={{ margin: '0.2rem 0 0' }}>
                    <code>{moment}</code>
                    {pair?.en ? ' · EN ✓' : ' · EN missing'}
                    {pair?.ml ? ' · ML ✓' : ' · ML missing'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => (open ? setInboxOpen(null) : openInbox(moment))}
                >
                  {open ? 'Close' : 'Edit EN & ML'}
                </button>
              </div>
              {open && inboxOpen === moment && inboxDrafts ? (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    <LocaleFields
                      locale="en"
                      draft={inboxDrafts.en}
                      variables={vars}
                      showAlternatives={false}
                      onChange={(en) => setInboxDrafts({ ...inboxDrafts, en })}
                    />
                    <LocaleFields
                      locale="ml"
                      draft={inboxDrafts.ml}
                      variables={vars}
                      showAlternatives={false}
                      onChange={(ml) => setInboxDrafts({ ...inboxDrafts, ml })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                    disabled={busyKey === `inbox-${moment}`}
                    onClick={() => void saveInbox(moment)}
                  >
                    {busyKey === `inbox-${moment}` ? 'Saving…' : 'Save inbox wording'}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
