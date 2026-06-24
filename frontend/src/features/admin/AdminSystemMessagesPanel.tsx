import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api'

type SystemMessageRow = {
  id: number
  key: string
  name: string
  group: string
  locale: string
  description: string
  title_template: string
  body_template: string
  alternative_titles: string[]
  alternative_bodies: string[]
  variables: string[]
  is_active: boolean
  updated_at: string | null
}

type CatalogMeta = {
  groups: string[]
  group_labels: Record<string, string>
  locales: string[]
}

const GROUP_LABELS: Record<string, string> = {
  transaction: 'Transactions & OTP',
  gold: 'Gold rate alerts',
  corridorapay: 'CridoraPay',
  portfolio: 'Portfolio & holdings',
}

function groupLabel(key: string, meta: CatalogMeta | null): string {
  return meta?.group_labels?.[key] || GROUP_LABELS[key] || key
}

type EditState = {
  title_template: string
  body_template: string
  alternative_titles: string[]
  alternative_bodies: string[]
  is_active: boolean
}

export function AdminSystemMessagesPanel() {
  const [rows, setRows] = useState<SystemMessageRow[]>([])
  const [meta, setMeta] = useState<CatalogMeta | null>(null)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterLocale, setFilterLocale] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null)

  const load = useCallback(async () => {
    setErr('')
    const params = new URLSearchParams()
    if (filterGroup) params.set('group', filterGroup)
    if (filterLocale) params.set('locale', filterLocale)
    const qs = params.toString()
    const [listRes, catRes] = await Promise.all([
      authFetch(`/api/v1/admin/system-notification-messages/${qs ? `?${qs}` : ''}`),
      authFetch('/api/v1/admin/system-notification-messages/catalog/'),
    ])
    const listData = (await listRes.json().catch(() => ({}))) as {
      results?: SystemMessageRow[]
      detail?: string
    }
    const catData = (await catRes.json().catch(() => ({}))) as CatalogMeta & { detail?: string }
    if (!listRes.ok) {
      setErr(listData.detail || 'Could not load system messages.')
      return
    }
    setRows(listData.results || [])
    if (catRes.ok) setMeta(catData)
  }, [filterGroup, filterLocale])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, SystemMessageRow[]>()
    for (const row of rows) {
      const g = row.group || 'other'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(row)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  function openEdit(row: SystemMessageRow) {
    setExpandedId(row.id)
    setEdit({
      title_template: row.title_template,
      body_template: row.body_template,
      alternative_titles: [...(row.alternative_titles || [])],
      alternative_bodies: [...(row.alternative_bodies || [])],
      is_active: row.is_active,
    })
    setPreview(null)
    setOkMsg('')
  }

  async function saveRow(id: number) {
    if (!edit) return
    setSaveBusy(true)
    setErr('')
    setOkMsg('')
    try {
      const res = await authFetch(`/api/v1/admin/system-notification-messages/${id}/`, {
        method: 'PATCH',
        jsonBody: {
          title_template: edit.title_template.trim(),
          body_template: edit.body_template.trim(),
          alternative_titles: edit.alternative_titles.map((s) => s.trim()).filter(Boolean),
          alternative_bodies: edit.alternative_bodies.map((s) => s.trim()).filter(Boolean),
          is_active: edit.is_active,
        },
      })
      const data = (await res.json().catch(() => ({}))) as SystemMessageRow & { detail?: string }
      if (!res.ok) {
        setErr(typeof data.detail === 'string' ? data.detail : 'Save failed.')
        return
      }
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...data } : row)))
      setEdit({
        title_template: data.title_template,
        body_template: data.body_template,
        alternative_titles: [...(data.alternative_titles || [])],
        alternative_bodies: [...(data.alternative_bodies || [])],
        is_active: data.is_active,
      })
      setOkMsg('Saved. The system will use this wording (and rotate alternatives) on the next send.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function runPreview(id: number) {
    if (!edit) return
    setErr('')
    const res = await authFetch('/api/v1/admin/system-notification-messages/preview/', {
      method: 'POST',
      jsonBody: {
        message_id: id,
        title_template: edit.title_template,
        body_template: edit.body_template,
      },
    })
    const data = (await res.json().catch(() => ({}))) as {
      title?: string
      body?: string
      detail?: string
    }
    if (!res.ok) {
      setErr(data.detail || 'Preview failed.')
      return
    }
    setPreview({ title: data.title || '', body: data.body || '' })
  }

  function updateAltBody(idx: number, value: string) {
    if (!edit) return
    const next = [...edit.alternative_bodies]
    next[idx] = value
    setEdit({ ...edit, alternative_bodies: next })
  }

  function addAltBody() {
    if (!edit) return
    setEdit({ ...edit, alternative_bodies: [...edit.alternative_bodies, ''] })
  }

  function removeAltBody(idx: number) {
    if (!edit) return
    setEdit({
      ...edit,
      alternative_bodies: edit.alternative_bodies.filter((_, i) => i !== idx),
    })
  }

  function updateAltTitle(idx: number, value: string) {
    if (!edit) return
    const next = [...edit.alternative_titles]
    next[idx] = value
    setEdit({ ...edit, alternative_titles: next })
  }

  function addAltTitle() {
    if (!edit) return
    setEdit({ ...edit, alternative_titles: [...edit.alternative_titles, ''] })
  }

  function removeAltTitle(idx: number) {
    if (!edit) return
    setEdit({
      ...edit,
      alternative_titles: edit.alternative_titles.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="dash-panel-max">
      <div className="card">
        <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
          System notification copy
        </h3>
        <p className="dash-coming__text" style={{ maxWidth: 720, marginBottom: '1rem' }}>
          Every automated push and inbox message the platform sends directly — OTP flows, gold
          alerts, CridoraPay, portfolio updates. Edit the primary wording here. Add alternative
          texts and the system will pick a different version each time it sends.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label htmlFor="sys-msg-group">Category</label>
            <select
              id="sys-msg-group"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="">All categories</option>
              {(meta?.groups || Object.keys(GROUP_LABELS)).map((g) => (
                <option key={g} value={g}>
                  {groupLabel(g, meta)}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 120 }}>
            <label htmlFor="sys-msg-locale">Language</label>
            <select
              id="sys-msg-locale"
              value={filterLocale}
              onChange={(e) => setFilterLocale(e.target.value)}
            >
              <option value="">All</option>
              <option value="en">English</option>
              <option value="ml">Malayalam</option>
            </select>
          </div>
        </div>

        {err ? <p className="form-error">{err}</p> : null}
        {okMsg ? <p style={{ color: 'var(--ok)' }}>{okMsg}</p> : null}

        {rows.length === 0 ? (
          <p className="dash-footnote">
            No system messages loaded. Run migrations to seed defaults.
          </p>
        ) : (
          grouped.map(([group, items]) => (
            <section key={group} style={{ marginTop: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>{groupLabel(group, meta)}</h4>
              <div className="admin-tpl-cards">
                {items.map((row) => {
                  const open = expandedId === row.id
                  return (
                    <div key={row.id} className="admin-tpl-card">
                      <div className="admin-tpl-card-head">
                        <div>
                          <strong>{row.name}</strong>
                          <p className="dash-footnote" style={{ margin: '0.2rem 0 0' }}>
                            <code>{row.key}</code> · {row.locale}
                            {row.is_active ? '' : ' · inactive'}
                            {(row.alternative_bodies?.length || 0) > 0
                              ? ` · ${row.alternative_bodies.length} alt. bodies`
                              : ''}
                          </p>
                          {row.description ? (
                            <p
                              className="dash-footnote"
                              style={{ margin: '0.35rem 0 0', maxWidth: 640 }}
                            >
                              {row.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => (open ? setExpandedId(null) : openEdit(row))}
                        >
                          {open ? 'Close' : 'Edit'}
                        </button>
                      </div>
                      {!open ? (
                        <>
                          {row.title_template ? (
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                              <strong>Title:</strong> {row.title_template}
                            </p>
                          ) : null}
                          {row.body_template ? (
                            <p
                              style={{
                                margin: '0.25rem 0 0',
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {row.body_template}
                            </p>
                          ) : null}
                        </>
                      ) : null}

                      {open && edit ? (
                        <div style={{ marginTop: '1rem' }}>
                          {row.variables.length > 0 ? (
                            <p className="dash-footnote" style={{ marginBottom: '0.5rem' }}>
                              Variables:{' '}
                              {row.variables.map((v) => (
                                <code key={v} style={{ marginRight: '0.35rem' }}>
                                  {`{{${v}}}`}
                                </code>
                              ))}
                            </p>
                          ) : null}

                          <div className="field">
                            <label htmlFor={`sys-title-${row.id}`}>Title</label>
                            <input
                              id={`sys-title-${row.id}`}
                              value={edit.title_template}
                              onChange={(e) =>
                                setEdit({ ...edit, title_template: e.target.value })
                              }
                              maxLength={180}
                              placeholder="Leave empty if this message has no title"
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`sys-body-${row.id}`}>Primary body</label>
                            <textarea
                              id={`sys-body-${row.id}`}
                              className="dash-textarea"
                              rows={3}
                              value={edit.body_template}
                              onChange={(e) =>
                                setEdit({ ...edit, body_template: e.target.value })
                              }
                              placeholder="Leave empty if title-only (e.g. gold alert title)"
                            />
                          </div>

                          <div style={{ marginTop: '0.75rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                              }}
                            >
                              <strong style={{ fontSize: '0.9rem' }}>Alternative titles</strong>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={addAltTitle}
                              >
                                + Add
                              </button>
                            </div>
                            {edit.alternative_titles.map((alt, idx) => (
                              <div
                                key={`alt-t-${idx}`}
                                style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}
                              >
                                <input
                                  value={alt}
                                  onChange={(e) => updateAltTitle(idx, e.target.value)}
                                  placeholder="Alternate title wording"
                                  style={{ flex: 1 }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => removeAltTitle(idx)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <div style={{ marginTop: '0.75rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                              }}
                            >
                              <strong style={{ fontSize: '0.9rem' }}>Alternative bodies</strong>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={addAltBody}
                              >
                                + Add
                              </button>
                            </div>
                            <p className="dash-footnote" style={{ margin: '0.25rem 0 0.5rem' }}>
                              Each send randomly picks the primary or one alternative so customers
                              see varied wording.
                            </p>
                            {edit.alternative_bodies.map((alt, idx) => (
                              <div key={`alt-b-${idx}`} style={{ marginTop: '0.35rem' }}>
                                <textarea
                                  className="dash-textarea"
                                  rows={2}
                                  value={alt}
                                  onChange={(e) => updateAltBody(idx, e.target.value)}
                                  placeholder="Alternate body wording"
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => removeAltBody(idx)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginTop: '0.75rem',
                              fontSize: '0.88rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={edit.is_active}
                              onChange={(e) =>
                                setEdit({ ...edit, is_active: e.target.checked })
                              }
                            />
                            Active
                          </label>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              marginTop: '1rem',
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={saveBusy}
                              onClick={() => void saveRow(row.id)}
                            >
                              {saveBusy ? 'Saving…' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => void runPreview(row.id)}
                            >
                              Preview with sample data
                            </button>
                          </div>

                          {preview ? (
                            <div className="admin-msg-preview-inline" style={{ marginTop: '1rem' }}>
                              <strong>Preview</strong>
                              {preview.title ? (
                                <p style={{ margin: '0.5rem 0 0' }}>
                                  <strong>{preview.title}</strong>
                                </p>
                              ) : null}
                              {preview.body ? (
                                <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>
                                  {preview.body}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
