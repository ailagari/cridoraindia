import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

type Stats = {
  delivered_count: number
  clicked_count: number
  open_rate_percent: number
  by_category: { category: string; c: number }[]
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
        Delivered: <strong>{stats.delivered_count}</strong> · Clicked: <strong>{stats.clicked_count}</strong> · Open
        rate: <strong>{stats.open_rate_percent}%</strong>
      </p>
      {stats.by_category.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
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
