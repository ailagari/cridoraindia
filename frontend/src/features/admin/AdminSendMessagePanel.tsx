import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { authFetch } from '@/lib/api'
import {
  NotificationPreviewStage,
  type PreviewTab,
} from '@/components/notifications/NotificationPreviewMocks'

type FestivalRow = {
  id: number
  title: string
  body: string
  image_url: string
  scheduled_at: string
  status: string
  push_recipient_count: number | null
  created_by_email: string
}

const AUDIENCES = [
  {
    id: 'ALL_APP_INSTALLS',
    label: 'All users',
    hint: 'Signed-in, guests, browser, mobile app, and PWA — everyone who turned on phone alerts',
  },
  {
    id: 'ALL_USERS',
    label: 'Signed-in customers only',
    hint: 'Cridora accounts only — respects each person\'s alert settings; guest browsers are not included',
  },
  { id: 'DEFAULT_JEWELLER_USERS', label: 'Jeweller customers', hint: 'Customers who chose this jeweller as default' },
  { id: 'SPECIFIC_JEWELLER_USERS', label: 'Jeweller buyers', hint: 'Customers who bought from this jeweller' },
] as const

type AudienceId = (typeof AUDIENCES)[number]['id']

function statusTone(s: string): string {
  if (s === 'sent') return 'ok'
  if (s === 'pending') return 'wait'
  if (s === 'failed') return 'bad'
  return 'mute'
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString()
}

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 5)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AdminSendMessagePanel() {
  const [rows, setRows] = useState<FestivalRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const [title, setTitle] = useState('Cridora')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<AudienceId>('ALL_APP_INSTALLS')
  const [pushReach, setPushReach] = useState<{
    total: number
    signedInBrowsers: number
    guestBrowsers: number
    mobileApps: number
  } | null>(null)
  const [jewellerId, setJewellerId] = useState('')
  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduleLocal)
  const [storeInbox, setStoreInbox] = useState(true)
  const [previewTab, setPreviewTab] = useState<PreviewTab>('phone')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [festName, setFestName] = useState('')
  const [personalize, setPersonalize] = useState(false)
  const [engagementMoment, setEngagementMoment] = useState('')

  const loadFestivals = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/festival-broadcasts/')
    const data = (await res.json().catch(() => ({}))) as { results?: FestivalRow[]; detail?: string }
    if (!res.ok) {
      setRows([])
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load messages.')
      return
    }
    setRows(Array.isArray(data.results) ? data.results : [])
  }, [])

  useEffect(() => {
    void loadFestivals()
  }, [loadFestivals])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await authFetch('/api/v1/admin/notification-stats/')
      const data = (await res.json().catch(() => ({}))) as {
        subscriptions?: {
          web_push?: number
          web_push_anonymous?: number
          native_fcm?: number
          total_push_devices?: number
        }
      }
      if (cancelled || !res.ok) return
      const s = data.subscriptions
      if (!s) return
      setPushReach({
        total: s.total_push_devices ?? 0,
        signedInBrowsers: s.web_push ?? 0,
        guestBrowsers: s.web_push_anonymous ?? 0,
        mobileApps: s.native_fcm ?? 0,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const needsJeweller =
    targetType === 'DEFAULT_JEWELLER_USERS' || targetType === 'SPECIFIC_JEWELLER_USERS'

  const selectedAudience = AUDIENCES.find((a) => a.id === targetType)

  const canSubmit =
    body.trim().length > 0 &&
    scheduledLocal.trim().length > 0 &&
    (!needsJeweller || jewellerId.trim().length > 0)

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaveErr('')
    const b = body.trim()
    if (!b) {
      setSaveErr('Write the message body.')
      return
    }
    if (!scheduledLocal.trim()) {
      setSaveErr('Choose when to send.')
      return
    }
    const when = new Date(scheduledLocal)
    if (Number.isNaN(when.getTime())) {
      setSaveErr('Invalid date or time.')
      return
    }
    if (needsJeweller && !jewellerId.trim()) {
      setSaveErr('Enter the jeweller account ID for this audience.')
      return
    }
    setBusy(true)
    try {
      const meta: Record<string, unknown> = {}
      if (needsJeweller) {
        meta.jeweller_id = Number.parseInt(jewellerId.trim(), 10)
      }
      const res = await authFetch('/api/v1/admin/festival-broadcasts/', {
        method: 'POST',
        jsonBody: {
          title: title.trim() || 'Cridora',
          body: b,
          image_url: imageUrl.trim(),
          scheduled_at: when.toISOString(),
          target_type: targetType,
          target_metadata: meta,
          store_in_inbox: storeInbox,
          festival_name: festName.trim(),
          engagement_moment: engagementMoment.trim(),
          engagement_context: festName.trim() ? 'festival' : '',
          personalize_per_user: personalize && Boolean(engagementMoment.trim()),
        },
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setSaveErr(typeof data.detail === 'string' ? data.detail : `Save failed (${res.status}).`)
        return
      }
      setBody('')
      setImageUrl('')
      setScheduledLocal(defaultScheduleLocal())
      await loadFestivals()
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: number) => {
    setCancelId(id)
    setSaveErr('')
    try {
      const res = await authFetch(`/api/v1/admin/festival-broadcasts/${id}/cancel/`, {
        method: 'POST',
        jsonBody: {},
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setSaveErr(typeof data.detail === 'string' ? data.detail : 'Cancel failed.')
        return
      }
      await loadFestivals()
    } finally {
      setCancelId(null)
    }
  }

  const previewTitle = (title.trim() || 'Cridora').slice(0, 45)
  const previewBody = body.trim() || 'Your message will appear here.'

  const audienceNote =
    targetType === 'ALL_APP_INSTALLS' && pushReach && pushReach.total > 0
      ? `About ${pushReach.total.toLocaleString()} devices (${pushReach.signedInBrowsers.toLocaleString()} signed-in browsers, ${pushReach.guestBrowsers.toLocaleString()} guests, ${pushReach.mobileApps.toLocaleString()} mobile).`
      : targetType === 'ALL_USERS'
        ? 'Guest browsers are not included — pick All users for them.'
        : selectedAudience?.hint ?? ''

  return (
    <div className="dash-panel-max admin-msg-page">
      <div className="card admin-msg-compose">
        <header className="admin-msg-compose__head">
          <h3 className="dash-coming__title" style={{ margin: 0 }}>
            Send a message
          </h3>
          <p className="dash-coming__text admin-msg-compose__intro">
            One calm phone alert at a time. Short, factual copy works best.
          </p>
        </header>

        <form className="admin-msg-form" onSubmit={(e) => void save(e)} noValidate>
          <div className="admin-msg-form__layout">
            <div className="admin-msg-form__fields">
              <div className="field">
                <label htmlFor="admin-msg-audience">Who receives this</label>
                <select
                  id="admin-msg-audience"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as AudienceId)}
                  disabled={busy}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {audienceNote ? (
                  <p className="admin-msg-field-hint" id="admin-msg-audience-hint">
                    {audienceNote}
                  </p>
                ) : null}
              </div>

              {needsJeweller ? (
                <div className="field">
                  <label htmlFor="admin-msg-jid">Jeweller account ID</label>
                  <input
                    id="admin-msg-jid"
                    type="number"
                    inputMode="numeric"
                    value={jewellerId}
                    onChange={(e) => setJewellerId(e.target.value)}
                    placeholder="Numeric jeweller user ID"
                    disabled={busy}
                  />
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="admin-msg-title">Title</label>
                <input
                  id="admin-msg-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Cridora"
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label htmlFor="admin-msg-body">Message</label>
                <textarea
                  id="admin-msg-body"
                  className="dash-textarea admin-msg-textarea"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. Warm Vishu wishes — gold rates refresh live on Cridora."
                  maxLength={2000}
                  disabled={busy}
                />
                <p className="admin-msg-field-hint">{body.trim().length}/2000</p>
              </div>

              <div className="field">
                <label htmlFor="admin-msg-when">Send at</label>
                <input
                  id="admin-msg-when"
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  disabled={busy}
                />
                <p className="admin-msg-field-hint">Your local time</p>
              </div>

              <label className="admin-msg-check">
                <input
                  type="checkbox"
                  checked={storeInbox}
                  onChange={(e) => setStoreInbox(e.target.checked)}
                  disabled={busy}
                />
                <span>Also show in customer bell (in-app inbox)</span>
              </label>

              <button
                type="button"
                className="btn btn-ghost admin-msg-more-toggle"
                onClick={() => setShowAdvanced((v) => !v)}
                disabled={busy}
              >
                {showAdvanced ? 'Hide options' : 'More options'}
              </button>
              {showAdvanced ? (
                <div className="admin-msg-advanced__body">
                  <div className="field">
                    <label htmlFor="admin-msg-img">Image URL (optional)</label>
                    <input
                      id="admin-msg-img"
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://…"
                      disabled={busy}
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="admin-msg-fest">Festival name (optional)</label>
                    <input
                      id="admin-msg-fest"
                      value={festName}
                      onChange={(e) => setFestName(e.target.value)}
                      placeholder="Vishu, Onam…"
                      disabled={busy}
                    />
                  </div>
                  <label className="admin-msg-check">
                    <input
                      type="checkbox"
                      checked={personalize}
                      onChange={(e) => setPersonalize(e.target.checked)}
                      disabled={busy}
                    />
                    <span>Personalize per customer (needs template)</span>
                  </label>
                  {personalize ? (
                    <div className="field">
                      <label htmlFor="admin-msg-moment">Template moment key</label>
                      <input
                        id="admin-msg-moment"
                        value={engagementMoment}
                        onChange={(e) => setEngagementMoment(e.target.value)}
                        placeholder="holding_appreciation"
                        disabled={busy}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {saveErr ? <p className="form-error">{saveErr}</p> : null}

              <button
                type="submit"
                className="btn btn-primary admin-msg-submit"
                disabled={busy || !canSubmit}
              >
                {busy ? 'Scheduling…' : 'Schedule message'}
              </button>
            </div>

            <aside className="admin-msg-form__preview" aria-label="Preview">
              <p className="admin-msg-preview-label">Preview</p>
              <div className="ad-preview-tabs admin-msg-preview-tabs">
                {(['phone', 'bell', 'browser'] as PreviewTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn btn-ghost ad-preview-tab${previewTab === t ? ' ad-preview-tab--active' : ''}`}
                    onClick={() => setPreviewTab(t)}
                  >
                    {t === 'phone' ? 'Phone' : t === 'bell' ? 'Bell' : 'Browser'}
                  </button>
                ))}
              </div>
              <div className="admin-msg-preview-stage">
                <NotificationPreviewStage
                  tab={previewTab}
                  payload={{
                    title: previewTitle,
                    body: previewBody.slice(0, 120),
                    brandingLabel: 'Cridora',
                    mode: 'name',
                  }}
                />
              </div>
            </aside>
          </div>
        </form>
      </div>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="card admin-msg-history">
        <h3 className="dash-table-title admin-msg-history__title">Scheduled &amp; recent</h3>

        {rows.length === 0 ? (
          <p className="admin-msg-history-empty">No messages scheduled yet.</p>
        ) : (
          <>
            <ul className="admin-msg-history-list">
              {rows.map((r) => (
                <li key={r.id} className="admin-msg-history-item">
                  <div className="admin-msg-history-item__top">
                    <span className={`kyb-pill kyb-pill--${statusTone(r.status)}`}>{r.status}</span>
                    <time className="admin-msg-history-item__when tabular">{fmtWhen(r.scheduled_at)}</time>
                  </div>
                  <p className="admin-msg-history-item__title">{r.title}</p>
                  <p className="admin-msg-history-item__body">{r.body}</p>
                  <div className="admin-msg-history-item__foot">
                    <span className="admin-msg-history-item__reach">
                      Reached {r.push_recipient_count ?? '—'}
                    </span>
                    {r.status === 'pending' ? (
                      <button
                        type="button"
                        className="btn btn-ghost kyb-btn-sm"
                        disabled={cancelId === r.id}
                        onClick={() => void cancel(r.id)}
                      >
                        {cancelId === r.id ? '…' : 'Cancel'}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <div className="dash-table-scroll admin-msg-history-table">
              <table className="admin-user-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Title</th>
                    <th>Preview</th>
                    <th>Status</th>
                    <th>Reached</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="tabular">{fmtWhen(r.scheduled_at)}</td>
                      <td>{r.title}</td>
                      <td className="admin-msg-history-table__preview">{r.body}</td>
                      <td>
                        <span className={`kyb-pill kyb-pill--${statusTone(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="tabular">{r.push_recipient_count ?? '—'}</td>
                      <td>
                        {r.status === 'pending' ? (
                          <button
                            type="button"
                            className="btn btn-ghost kyb-btn-sm"
                            disabled={cancelId === r.id}
                            onClick={() => void cancel(r.id)}
                          >
                            {cancelId === r.id ? '…' : 'Cancel'}
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
        )}
      </div>
    </div>
  )
}
