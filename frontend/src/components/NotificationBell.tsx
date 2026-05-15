import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_NOTIFICATIONS, hydrateMockNotificationsForAccount, persistAllMockNotificationsRead, type AppNotification } from '@/lib/mockNotifications'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import {
  fetchWebPushServerStatus,
  getBrowserPushActive,
  pushNotificationsSupported,
  pushSetupHint,
  registerWebPushSubscription,
  unregisterWebPushSubscription,
} from '@/lib/webPushApi'

type ApiAdminNotification = {
  id: number
  kind: string
  title: string
  body: string
  link_path: string
  created_at: string
  unread: boolean
}

function kindClass(k: AppNotification['kind']): string {
  if (k === 'transaction') return 'notif-kind notif-kind--tx'
  if (k === 'kyc') return 'notif-kind notif-kind--kyc'
  if (k === 'promo') return 'notif-kind notif-kind--promo'
  return 'notif-kind notif-kind--alert'
}

function formatNotifyTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function mapAdminApiRow(r: ApiAdminNotification): AppNotification {
  const kind: AppNotification['kind'] =
    r.kind === 'kyb_upload' || r.kind === 'kyc_upload' ? 'kyc' : 'alert'
  return {
    id: String(r.id),
    title: r.title,
    body: r.body,
    time: formatNotifyTime(r.created_at),
    read: !r.unread,
    kind,
    link_path: r.link_path,
  }
}

type Props = {
  compact?: boolean
  role?: 'customer' | 'jeweller' | 'admin'
}

export function NotificationBell({ compact = false, role = 'customer' }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const useAdminFeed = role === 'admin' && user?.user_type === 'admin'

  const [open, setOpen] = useState(false)
  const [mockItems, setMockItems] = useState<AppNotification[]>(() => [...MOCK_NOTIFICATIONS])
  const [adminItems, setAdminItems] = useState<AppNotification[]>([])
  const [adminFeedError, setAdminFeedError] = useState('')
  const [pushActive, setPushActive] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [pushServerReady, setPushServerReady] = useState<boolean | null>(null)
  const [pushTestBusy, setPushTestBusy] = useState(false)
  const [pushTestMsg, setPushTestMsg] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const setupHint = pushSetupHint()

  const items = useMemo(
    () => (useAdminFeed ? adminItems : mockItems),
    [useAdminFeed, adminItems, mockItems],
  )

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items])

  const loadAdminFeed = useCallback(async () => {
    if (!useAdminFeed) return
    setAdminFeedError('')
    const res = await authFetch('/api/v1/admin/notifications/?limit=40')
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      results?: ApiAdminNotification[]
    }
    if (!res.ok) {
      setAdminFeedError(body.detail ?? 'Could not load notifications.')
      return
    }
    const rows = Array.isArray(body.results) ? body.results.map(mapAdminApiRow) : []
    setAdminItems(rows)
  }, [useAdminFeed])

  const refreshPushState = useCallback(async () => {
    if (!user || !pushNotificationsSupported()) {
      setPushActive(false)
      return
    }
    try {
      setPushError('')
      const on = await getBrowserPushActive()
      setPushActive(on)
    } catch {
      setPushActive(false)
    }
  }, [user])

  useEffect(() => {
    if (!open || !user) return
    void refreshPushState()
  }, [open, user, refreshPushState])

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    setPushServerReady(null)
    void fetchWebPushServerStatus().then((s) => {
      if (!cancelled) setPushServerReady(s.configured)
    })
    return () => {
      cancelled = true
    }
  }, [open, user])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!useAdminFeed) return
    void loadAdminFeed()
  }, [useAdminFeed, loadAdminFeed])

  useEffect(() => {
    if (!useAdminFeed || !user) return
    const t = window.setInterval(() => void loadAdminFeed(), 120000)
    return () => window.clearInterval(t)
  }, [useAdminFeed, user, loadAdminFeed])

  useEffect(() => {
    if (!open || !useAdminFeed) return
    void loadAdminFeed()
  }, [open, useAdminFeed, loadAdminFeed])

  useEffect(() => {
    if (useAdminFeed || user?.id == null) return
    setMockItems(hydrateMockNotificationsForAccount(user.id))
  }, [useAdminFeed, user?.id])

  const enablePush = useCallback(async () => {
    if (!user) return
    setPushBusy(true)
    setPushError('')
    try {
      await registerWebPushSubscription()
      setPushActive(true)
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Could not enable push.')
    } finally {
      setPushBusy(false)
    }
  }, [user])

  const disablePush = useCallback(async () => {
    setPushBusy(true)
    setPushError('')
    try {
      await unregisterWebPushSubscription()
      setPushActive(false)
      setPushTestMsg('')
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Could not disable push.')
    } finally {
      setPushBusy(false)
    }
  }, [])

  const sendAdminTestPush = useCallback(async () => {
    setPushTestBusy(true)
    setPushTestMsg('')
    try {
      const res = await authFetch('/api/v1/admin/push/test/', {
        method: 'POST',
        jsonBody: {
          title: 'Cridora test',
          body: 'Push delivery works — you can dismiss this.',
          url: '/',
        },
      })
      const body = (await res.json().catch(() => ({}))) as { detail?: string; sent?: number }
      if (!res.ok) {
        setPushTestMsg(body.detail ?? `Test failed (${res.status}).`)
        return
      }
      const n = typeof body.sent === 'number' ? body.sent : 0
      setPushTestMsg(
        `Sent to ${n} device(s). Check the notification tray; Focus / DND can hide banners.`,
      )
    } catch (e) {
      setPushTestMsg(e instanceof Error ? e.message : 'Could not reach server.')
    } finally {
      setPushTestBusy(false)
    }
  }, [])

  const pushSupported = pushNotificationsSupported()

  const markAllRead = useCallback(async () => {
    if (useAdminFeed) {
      const res = await authFetch('/api/v1/admin/notifications/mark-read/', {
        method: 'POST',
        jsonBody: { all: true },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string }
        setAdminFeedError(body.detail ?? `Could not mark read (${res.status}).`)
        return
      }
      await loadAdminFeed()
      return
    }
    if (user?.id == null) return
    persistAllMockNotificationsRead(user.id)
    setMockItems(hydrateMockNotificationsForAccount(user.id))
  }, [useAdminFeed, loadAdminFeed, user?.id])

  const onItemActivate = useCallback(
    async (n: AppNotification) => {
      if (!useAdminFeed) return
      const nid = Number.parseInt(n.id, 10)
      if (!Number.isNaN(nid)) {
        const res = await authFetch('/api/v1/admin/notifications/mark-read/', {
          method: 'POST',
          jsonBody: { notification_ids: [nid] },
        })
        if (res.ok) {
          await loadAdminFeed()
        } else {
          const body = (await res.json().catch(() => ({}))) as { detail?: string }
          setAdminFeedError(body.detail ?? `Could not mark read (${res.status}).`)
        }
      }
      if (n.link_path) {
        navigate(n.link_path)
        setOpen(false)
      }
    },
    [navigate, useAdminFeed, loadAdminFeed],
  )

  return (
    <div className="notif-bell-wrap" ref={rootRef}>
      <button
        type="button"
        className={`notif-bell-btn${compact ? ' notif-bell-btn--compact' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="notif-bell-ico" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6a4 4 0 0 0-4 4v3l-1.5 2.5h11L16 13v-3a4 4 0 0 0-4-4" />
            <path strokeLinecap="round" d="M10 18a2 2 0 0 0 4 0" />
          </svg>
        </span>
        {unread > 0 ? <span className="notif-bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="notif-panel card" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <h2 className="notif-panel-title">Alerts</h2>
            <button type="button" className="btn btn-ghost notif-panel-clear" onClick={() => void markAllRead()}>
              Mark read
            </button>
          </div>
          {user && setupHint ? (
            <p className="notif-panel-hint" style={{ marginTop: '-0.35rem', color: 'var(--gold-light)' }}>
              {setupHint}
            </p>
          ) : null}
          <p className="notif-panel-hint">
            {useAdminFeed ? (
              <>
                Uploads awaiting KYC or KYB review appear here.
                {pushServerReady === false ? (
                  <span>
                    {' '}
                    <strong>Unavailable on this deployment:</strong> Web Push needs VAPID keys on the server (hosting env
                    vars). Enable still appears once keys are set.
                  </span>
                ) : (
                  ' Enable device notifications to get pushes on this phone or desktop.'
                )}
              </>
            ) : pushServerReady === false ? (
              <>
                <strong>Unavailable on this deployment.</strong> Web Push needs VAPID keys on the server (hosting env vars:
                WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, WEB_PUSH_VAPID_CONTACT). Sample alerts below still appear
                here for UI preview — they are not live notifications.
              </>
            ) : (
              'In-app alerts below are samples. Turn on browser notifications to get real alerts on this device (HTTPS or localhost; install the PWA on iOS 16.4+ for Web Push).'
            )}
          </p>
          {adminFeedError ? <p className="form-error notif-panel-hint">{adminFeedError}</p> : null}
          {user ? (
            <div className="notif-push-row">
              <div className="notif-push-copy">
                <span className="notif-push-label">Device notifications</span>
                {!pushSupported ? (
                  <span className="notif-push-status">Not supported in this browser or context.</span>
                ) : Notification.permission === 'denied' ? (
                  <span className="notif-push-status">Blocked in browser settings — allow notifications for this site.</span>
                ) : pushActive ? (
                  <span className="notif-push-status notif-push-status--on">On for this device</span>
                ) : pushServerReady === false ? (
                  <>
                    <span className="notif-push-status">Unavailable on this deployment</span>
                    <span className="notif-push-detail">See the note above — VAPID env vars are missing on the server.</span>
                  </>
                ) : pushServerReady === null ? (
                  <span className="notif-push-status">Checking server setup…</span>
                ) : (
                  <span className="notif-push-status">Off</span>
                )}
                {pushError ? <span className="notif-push-err">{pushError}</span> : null}
              </div>
              {pushSupported && Notification.permission !== 'denied' ? (
                pushActive ? (
                  <button
                    type="button"
                    className="btn btn-ghost notif-push-btn"
                    disabled={pushBusy}
                    onClick={() => void disablePush()}
                  >
                    Turn off
                  </button>
                ) : pushServerReady === true ? (
                  <button
                    type="button"
                    className="btn btn-primary notif-push-btn"
                    disabled={pushBusy}
                    onClick={() => void enablePush()}
                  >
                    Enable
                  </button>
                ) : null
              ) : null}
            </div>
          ) : (
            <p className="notif-panel-hint" style={{ marginTop: '-0.35rem' }}>
              Sign in to enable device notifications.
            </p>
          )}
          {useAdminFeed && user && pushActive && pushServerReady === true ? (
            <div className="notif-push-row" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost notif-push-btn"
                disabled={pushTestBusy}
                onClick={() => void sendAdminTestPush()}
              >
                Send test notification
              </button>
              {pushTestMsg ? (
                <span className="notif-push-detail" style={{ flex: '1 1 100%' }}>
                  {pushTestMsg}
                </span>
              ) : null}
            </div>
          ) : null}
          <ul className="notif-list">
            {items.map((n) =>
              useAdminFeed ? (
                <li key={n.id}>
                  <button type="button" className={`notif-item-btn${n.read ? '' : ' notif-item-btn--unread'}`} onClick={() => void onItemActivate(n)}>
                    <span className={kindClass(n.kind)}>{n.kind}</span>
                    <p className="notif-item-title">{n.title}</p>
                    <p className="notif-item-body">{n.body}</p>
                    <p className="notif-item-time">{n.time}</p>
                    {n.link_path ? <span className="notif-item-open-hint">Tap to open in dashboard</span> : null}
                  </button>
                </li>
              ) : (
                <li key={n.id} className={`notif-item${n.read ? '' : ' notif-item--unread'}`}>
                  <span className={kindClass(n.kind)}>{n.kind}</span>
                  <p className="notif-item-title">{n.title}</p>
                  <p className="notif-item-body">{n.body}</p>
                  <p className="notif-item-time">{n.time}</p>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
