import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type UserTypeRow = {
  user_type: string
  eligible: number
  inbox_delivered: number
  push_sent: number
  push_failed: number
  read: number
}

type Stats = {
  delivered_count: number
  clicked_count: number
  open_rate_percent: number
  by_category: { category: string; c: number }[]
  funnel?: {
    inbox_delivered: number
    push_sent: number
    push_failed: number
    tray_delivered: number
    tray_clicked: number
  }
  by_user_type?: UserTypeRow[]
  subscriptions?: {
    web_push: number
    web_push_anonymous: number
    native_fcm: number
  }
}

function labelUserType(key: string): string {
  if (key === 'jewellers') return 'Jewellers'
  if (key === 'admins') return 'Admins'
  return 'Customers'
}

export function AdminNotificationStatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const res = await authFetch('/api/v1/admin/notification-stats/')
    const data = (await res.json().catch(() => ({}))) as Stats & { detail?: string }
    if (!res.ok) {
      setStats(null)
      setErr(data.detail != null ? String(data.detail) : 'Could not load stats.')
      return
    }
    setStats(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (err) return <p className="form-error">{err}</p>
  if (!stats) return <p style={{ color: 'var(--text-muted)' }}>Loading delivery stats…</p>

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Delivery analytics</h3>
      <p className="dash-footnote">
        Inbox events: <strong>{stats.delivered_count}</strong> · Read/clicked:{' '}
        <strong>{stats.clicked_count}</strong> · Open rate: <strong>{stats.open_rate_percent}%</strong>
      </p>
      {stats.funnel ? (
        <p className="dash-footnote">
          Funnel — Inbox rows: <strong>{stats.funnel.inbox_delivered}</strong> · Push sent:{' '}
          <strong>{stats.funnel.push_sent}</strong> · Push failed:{' '}
          <strong>{stats.funnel.push_failed}</strong> · Tray shown:{' '}
          <strong>{stats.funnel.tray_delivered}</strong> · Tray clicked:{' '}
          <strong>{stats.funnel.tray_clicked}</strong>
        </p>
      ) : null}
      {stats.subscriptions ? (
        <p className="dash-footnote">
          Subscriptions — Web Push (signed-in): <strong>{stats.subscriptions.web_push}</strong> ·
          Web Push (guest): <strong>{stats.subscriptions.web_push_anonymous}</strong> · FCM:{' '}
          <strong>{stats.subscriptions.native_fcm}</strong>
        </p>
      ) : null}
      {stats.by_user_type && stats.by_user_type.length > 0 ? (
        <div className="dash-table-scroll" style={{ marginTop: 'var(--sp-4)' }}>
          <table className="admin-user-table">
            <thead>
              <tr>
                <th>Audience</th>
                <th>Eligible</th>
                <th>Inbox</th>
                <th>Push sent</th>
                <th>Push failed</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_user_type.map((row) => (
                <tr key={row.user_type}>
                  <td>{labelUserType(row.user_type)}</td>
                  <td>{row.eligible}</td>
                  <td>{row.inbox_delivered}</td>
                  <td>{row.push_sent}</td>
                  <td>{row.push_failed}</td>
                  <td>{row.read}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {stats.by_category.length > 0 ? (
        <ul style={{ margin: 'var(--sp-4) 0 0', paddingLeft: '1.25rem' }}>
          {stats.by_category.map((row) => (
            <li key={row.category || 'other'}>
              {row.category || 'other'}: {row.c}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
