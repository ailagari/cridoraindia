import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type Row = {
  id: number
  title: string
  body: string
  scheduled_at: string
  status: string
  sent_at: string | null
  push_recipient_count: number | null
  error_message: string
  created_by_email: string
  created_at: string
}

function statusTone(s: string): string {
  if (s === 'sent') return 'ok'
  if (s === 'pending') return 'wait'
  if (s === 'cancelled') return 'mute'
  if (s === 'failed') return 'bad'
  return 'mute'
}

function fmtWhen(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString()
}

export function AdminFestivalBroadcastPanel() {
  const [rows, setRows] = useState<Row[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [title, setTitle] = useState('Cridora')
  const [body, setBody] = useState('')
  const [scheduledLocal, setScheduledLocal] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoadErr('')
    const res = await authFetch('/api/v1/admin/festival-broadcasts/')
    const data = (await res.json().catch(() => ({}))) as {
      results?: Row[]
      detail?: string
    }
    if (!res.ok) {
      setRows([])
      setLoadErr(data.detail != null ? String(data.detail) : 'Could not load schedules.')
      return
    }
    setRows(Array.isArray(data.results) ? data.results : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => void load(), 60000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!scheduledLocal) {
      const d = new Date()
      d.setMinutes(d.getMinutes() + 5)
      d.setSeconds(0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      setScheduledLocal(local)
    }
  }, [scheduledLocal])

  const save = async () => {
    setSaveErr('')
    const b = body.trim()
    if (!b) {
      setSaveErr('Enter the message body.')
      return
    }
    if (!scheduledLocal.trim()) {
      setSaveErr('Choose a date and time.')
      return
    }
    const when = new Date(scheduledLocal)
    if (Number.isNaN(when.getTime())) {
      setSaveErr('Invalid date or time.')
      return
    }
    setBusy(true)
    try {
      const res = await authFetch('/api/v1/admin/festival-broadcasts/', {
        method: 'POST',
        jsonBody: {
          title: title.trim() || 'Cridora',
          body: b,
          scheduled_at: when.toISOString(),
        },
      })
      const data = (await res.json().catch(() => ({}))) as { detail?: string }
      if (!res.ok) {
        setSaveErr(
          typeof data.detail === 'string' ? data.detail : `Save failed (${res.status}).`,
        )
        return
      }
      setBody('')
      await load()
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
        setSaveErr(
          typeof data.detail === 'string' ? data.detail : `Cancel failed (${res.status}).`,
        )
        return
      }
      await load()
    } finally {
      setCancelId(null)
    }
  }

  return (
    <div className="dash-panel-max">
      <h2 className="dash-table-title">Festival & broadcast pushes</h2>
      <p className="dash-footnote" style={{ marginBottom: '1rem', maxWidth: 640 }}>
        Schedule a message for a future time. At that time the backend sends a{' '}
        <strong>Web Push to every subscribed device</strong> (customers, jewellers, and admins who enabled alerts). Users who
        never tapped &quot;Enable&quot; in the notification bell will not receive it. Production needs VAPID keys. Opening this page
        or the notification bell runs the sender for due schedules. For reliability when no admin is online, run a cron such as{' '}
        <code className="tabular">process_festival_broadcasts</code> every few minutes.
      </p>

      <div className="card" style={{ maxWidth: 560, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="field">
          <label htmlFor="fest-title">Title (optional)</label>
          <input
            id="fest-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cridora"
            disabled={busy}
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="fest-body">Message</label>
          <textarea
            id="fest-body"
            className="dash-textarea"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            placeholder="e.g. Happy Diwali — vaults stay open; rates refresh live in the marketplace."
            maxLength={2000}
          />
        </div>
        <div className="field">
          <label htmlFor="fest-when">Send at (your device local time)</label>
          <input
            id="fest-when"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            disabled={busy}
          />
        </div>
        {saveErr ? <p className="form-error">{saveErr}</p> : null}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save schedule'}
        </button>
      </div>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      <h3 className="dash-table-title" style={{ fontSize: '1.05rem' }}>
        Recent schedules
      </h3>
      <div className="dash-table-scroll card">
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>When (server display)</th>
              <th>Title</th>
              <th>Preview</th>
              <th>Status</th>
              <th>Devices</th>
              <th>By</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: 'var(--text-muted)', padding: '1.25rem' }}>
                  No broadcasts yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular">{fmtWhen(r.scheduled_at)}</td>
                  <td>{r.title}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.body}
                  </td>
                  <td>
                    <span
                      className={`kyb-pill kyb-pill--${statusTone(r.status)}`}
                      title={r.status === 'failed' && r.error_message ? r.error_message : undefined}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="tabular">
                    {r.push_recipient_count != null ? r.push_recipient_count : '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{r.created_by_email}</td>
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
  )
}
