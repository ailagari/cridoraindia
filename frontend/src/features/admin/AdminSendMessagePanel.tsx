import { useCallback, useEffect, useState } from 'react'
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
  { id: 'ALL_USERS', label: 'All customers', hint: 'Signed-in Cridora customers' },
  { id: 'ALL_APP_INSTALLS', label: 'All phone alerts', hint: 'Everyone who enabled alerts' },
  { id: 'DEFAULT_JEWELLER_USERS', label: 'Jeweller customers', hint: 'Default jeweller set' },
  { id: 'SPECIFIC_JEWELLER_USERS', label: 'Jeweller buyers', hint: 'Purchased from jeweller' },
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

export function AdminSendMessagePanel() {
  const [step, setStep] = useState(1)
  const [rows, setRows] = useState<FestivalRow[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const [title, setTitle] = useState('Cridora')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<AudienceId>('ALL_USERS')
  const [jewellerId, setJewellerId] = useState('')
  const [scheduledLocal, setScheduledLocal] = useState('')
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
    if (scheduledLocal) return
    const d = new Date()
    d.setMinutes(d.getMinutes() + 5)
    d.setSeconds(0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    setScheduledLocal(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    )
  }, [scheduledLocal])

  const needsJeweller =
    targetType === 'DEFAULT_JEWELLER_USERS' || targetType === 'SPECIFIC_JEWELLER_USERS'

  const canNextStep1 = !needsJeweller || jewellerId.trim().length > 0
  const canNextStep2 = body.trim().length > 0

  const save = async () => {
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
      setStep(1)
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

  return (
    <div className="dash-panel-max">
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 className="dash-coming__title" style={{ marginTop: 0 }}>
          Send a message
        </h3>
        <p className="dash-coming__text" style={{ marginBottom: '1rem', maxWidth: 640 }}>
          Schedule a calm phone alert and optional in-app bell entry. Use factual, short copy — customers
          receive one alert at a time.
        </p>

        <div className="admin-msg-wizard-steps" aria-label="Steps">
          <span className={`admin-msg-wizard-step${step === 1 ? ' admin-msg-wizard-step--active' : step > 1 ? ' admin-msg-wizard-step--done' : ''}`}>
            1. Audience
          </span>
          <span className={`admin-msg-wizard-step${step === 2 ? ' admin-msg-wizard-step--active' : step > 2 ? ' admin-msg-wizard-step--done' : ''}`}>
            2. Message
          </span>
          <span className={`admin-msg-wizard-step${step === 3 ? ' admin-msg-wizard-step--active' : ''}`}>
            3. Schedule
          </span>
        </div>

        {step === 1 ? (
          <>
            <p className="dash-footnote" style={{ marginBottom: '0.65rem' }}>
              Who should receive this alert?
            </p>
            <div className="admin-msg-audience-cards">
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`admin-msg-audience-card${targetType === a.id ? ' admin-msg-audience-card--active' : ''}`}
                  onClick={() => setTargetType(a.id)}
                >
                  <strong>{a.label}</strong>
                  <span>{a.hint}</span>
                </button>
              ))}
            </div>
            {needsJeweller ? (
              <div className="field" style={{ marginTop: '1rem' }}>
                <label htmlFor="admin-msg-jid">Jeweller account ID</label>
                <input
                  id="admin-msg-jid"
                  type="number"
                  value={jewellerId}
                  onChange={(e) => setJewellerId(e.target.value)}
                  placeholder="Numeric jeweller user ID"
                />
              </div>
            ) : null}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canNextStep1}
                onClick={() => setStep(2)}
              >
                Next: write message
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="field">
              <label htmlFor="admin-msg-title">Title (short)</label>
              <input
                id="admin-msg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Cridora"
              />
            </div>
            <div className="field">
              <label htmlFor="admin-msg-body">Message</label>
              <textarea
                id="admin-msg-body"
                className="dash-textarea"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="e.g. Warm Vishu wishes — gold rates refresh live on Cridora."
                maxLength={2000}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-msg-img">Image URL (optional)</label>
              <input
                id="admin-msg-img"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <input type="checkbox" checked={storeInbox} onChange={(e) => setStoreInbox(e.target.checked)} />
              Also save in customer bell (in-app inbox)
            </label>

            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginBottom: '0.5rem' }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide' : 'Show'} personalization options
            </button>
            {showAdvanced ? (
              <div style={{ marginBottom: '1rem' }}>
                <div className="field">
                  <label htmlFor="admin-msg-fest">Festival name (optional)</label>
                  <input
                    id="admin-msg-fest"
                    value={festName}
                    onChange={(e) => setFestName(e.target.value)}
                    placeholder="Vishu, Onam…"
                  />
                </div>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} />
                  Personalize per customer (requires template)
                </label>
                {personalize ? (
                  <div className="field" style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="admin-msg-moment">Template moment key</label>
                    <input
                      id="admin-msg-moment"
                      value={engagementMoment}
                      onChange={(e) => setEngagementMoment(e.target.value)}
                      placeholder="holding_appreciation"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="admin-msg-preview-inline">
              <div className="ad-preview-tabs" style={{ marginBottom: '0.75rem' }}>
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

            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canNextStep2}
                onClick={() => setStep(3)}
              >
                Next: schedule
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="field">
              <label htmlFor="admin-msg-when">Send at (your local time)</label>
              <input
                id="admin-msg-when"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                disabled={busy}
              />
            </div>
            {saveErr ? <p className="form-error">{saveErr}</p> : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'Scheduling…' : 'Schedule message'}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <div className="card">
        <h3 className="dash-table-title" style={{ fontSize: '1.05rem' }}>
          Scheduled &amp; recent messages
        </h3>
        <div className="dash-table-scroll">
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-muted)', padding: '1rem' }}>
                    No messages scheduled yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular">{fmtWhen(r.scheduled_at)}</td>
                    <td>{r.title}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.body}
                    </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
