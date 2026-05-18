import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
} from '@/lib/webPushApi'
import { CRIDORA_PUSH_REFRESH_MESSAGE_TYPE } from '@/lib/cridoraSwMessages'

/** Faster poll while panel open so badges/lists stay fresh without reloading the page. */
const FEED_POLL_MS_PANEL_OPEN = 2000
const FEED_POLL_MS_BACKGROUND = 8000

/** Matches dashboard mobile breakpoint (bottom nav, wrapped top bar). */
const MOBILE_SHEET_MQ = '(max-width: 960px)'

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
    r.kind === 'kyb_upload' || r.kind === 'kyc_upload'
      ? 'kyc'
      : r.kind === 'festival_broadcast_sent'
        ? 'promo'
        : 'alert'
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
  /** Customer/jeweller dashboards: omit push controls in the bell. */
  suppressPushRow?: boolean
  /** Marketing / public chrome: never show Enable/Turn off in the bell. */
  hidePushControls?: boolean
}

export function NotificationBell({
  compact = false,
  role = 'customer',
  suppressPushRow = false,
  hidePushControls = false,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const useAdminFeed = role === 'admin' && user?.user_type === 'admin'
  const usePlatformFeed = Boolean(user && !useAdminFeed)
  const useLiveFeed = useAdminFeed || usePlatformFeed
  const hidePushRowInBell = Boolean(hidePushControls) || (usePlatformFeed && suppressPushRow)

  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [mockItems, setMockItems] = useState<AppNotification[]>(() => [...MOCK_NOTIFICATIONS])
  const [adminItems, setAdminItems] = useState<AppNotification[]>([])
  const [platformItems, setPlatformItems] = useState<AppNotification[]>([])
  const [adminFeedError, setAdminFeedError] = useState('')
  const [platformFeedError, setPlatformFeedError] = useState('')
  const [pushActive, setPushActive] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [pushServerReady, setPushServerReady] = useState<boolean | null>(null)
  const [pushTestBusy, setPushTestBusy] = useState(false)
  const [pushTestMsg, setPushTestMsg] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  /** Bottom sheet on narrow viewports (PWA / mobile dashboards). */
  const [useSheetLayout, setUseSheetLayout] = useState(false)

  const setupHint = pushSetupHint()

  const items = useMemo(() => {
    if (useAdminFeed) return adminItems
    if (usePlatformFeed) return platformItems
    return mockItems
  }, [useAdminFeed, usePlatformFeed, adminItems, platformItems, mockItems])

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items])
  const readCount = useMemo(() => items.filter((i) => i.read).length, [items])
  const displayItems = useMemo(
    () => (showHistory ? items : items.filter((i) => !i.read)),
    [showHistory, items],
  )

  const loadAdminFeed = useCallback(async () => {
    if (!useAdminFeed) return
    setAdminFeedError('')
    const res = await authFetch('/api/v1/admin/notifications/?limit=40', { cache: 'no-store' })
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

  const loadPlatformFeed = useCallback(async () => {
    if (!usePlatformFeed) return
    setPlatformFeedError('')
    const res = await authFetch('/api/v1/notifications/?limit=40', { cache: 'no-store' })
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      results?: ApiAdminNotification[]
    }
    if (!res.ok) {
      setPlatformFeedError(body.detail ?? 'Could not load alerts.')
      return
    }
    const rows = Array.isArray(body.results) ? body.results.map(mapAdminApiRow) : []
    setPlatformItems(rows)
  }, [usePlatformFeed])

  const refreshPushState = useCallback(async () => {
    if (!pushNotificationsSupported()) {
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
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshPushState()
  }, [open, refreshPushState])

  useEffect(() => {
    if (!open) {
      setShowHistory(false)
      return
    }
    let cancelled = false
    setPushServerReady(null)
    void fetchWebPushServerStatus().then((s) => {
      if (!cancelled) setPushServerReady(s.configured)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHEET_MQ)
    const sync = () => setUseSheetLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open || useSheetLayout) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, useSheetLayout])

  useEffect(() => {
    if (!open || !useSheetLayout) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open, useSheetLayout])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!useAdminFeed || !user) return
    void loadAdminFeed()
  }, [useAdminFeed, user, loadAdminFeed])

  useEffect(() => {
    if (!usePlatformFeed || !user) return
    void loadPlatformFeed()
  }, [usePlatformFeed, user, loadPlatformFeed])

  useEffect(() => {
    if (!useLiveFeed || !user) return
    const periodMs = open ? FEED_POLL_MS_PANEL_OPEN : FEED_POLL_MS_BACKGROUND
    const id = window.setInterval(() => {
      void loadAdminFeed()
      void loadPlatformFeed()
    }, periodMs)
    return () => window.clearInterval(id)
  }, [useLiveFeed, user, open, loadAdminFeed, loadPlatformFeed])

  useEffect(() => {
    if (!useLiveFeed || !user) return
    const refreshVisible = () => {
      if (document.visibilityState !== 'visible') return
      void loadAdminFeed()
      void loadPlatformFeed()
    }
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('focus', refreshVisible)
    return () => {
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('focus', refreshVisible)
    }
  }, [useLiveFeed, user, loadAdminFeed, loadPlatformFeed])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (ev: MessageEvent) => {
      const t =
        ev.data && typeof ev.data === 'object' ? (ev.data as { type?: string }).type : null
      if (t !== CRIDORA_PUSH_REFRESH_MESSAGE_TYPE) return
      void refreshPushState()
      void loadAdminFeed()
      void loadPlatformFeed()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [refreshPushState, loadAdminFeed, loadPlatformFeed])

  useEffect(() => {
    if (!open || !useAdminFeed) return
    void loadAdminFeed()
  }, [open, useAdminFeed, loadAdminFeed])

  useEffect(() => {
    if (!open || !usePlatformFeed) return
    void loadPlatformFeed()
  }, [open, usePlatformFeed, loadPlatformFeed])

  useEffect(() => {
    if (useAdminFeed || usePlatformFeed) return
    if (user?.id != null) {
      setMockItems(hydrateMockNotificationsForAccount(user.id))
    } else {
      setMockItems([...MOCK_NOTIFICATIONS])
    }
  }, [useAdminFeed, usePlatformFeed, user?.id])

  const enablePush = useCallback(async () => {
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
      setAdminItems((prev) => prev.map((x) => ({ ...x, read: true })))
      const res = await authFetch('/api/v1/admin/notifications/mark-read/', {
        method: 'POST',
        jsonBody: { all: true },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string }
        setAdminFeedError(body.detail ?? `Could not mark read (${res.status}).`)
        await loadAdminFeed()
        return
      }
      setShowHistory(false)
      await loadAdminFeed()
      return
    }
    if (usePlatformFeed) {
      setPlatformItems((prev) => prev.map((x) => ({ ...x, read: true })))
      const res = await authFetch('/api/v1/notifications/mark-read/', {
        method: 'POST',
        jsonBody: { all: true },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string }
        setPlatformFeedError(body.detail ?? `Could not mark read (${res.status}).`)
        await loadPlatformFeed()
        return
      }
      setShowHistory(false)
      await loadPlatformFeed()
      return
    }
    if (user?.id == null) return
    persistAllMockNotificationsRead(user.id)
    setMockItems(hydrateMockNotificationsForAccount(user.id))
    setShowHistory(false)
  }, [useAdminFeed, usePlatformFeed, loadAdminFeed, loadPlatformFeed, user?.id])

  const onFeedItemActivate = useCallback(
    async (n: AppNotification) => {
      if (!useLiveFeed) return
      const nid = Number.parseInt(n.id, 10)
      if (!Number.isNaN(nid)) {
        const url = useAdminFeed
          ? '/api/v1/admin/notifications/mark-read/'
          : '/api/v1/notifications/mark-read/'
        const res = await authFetch(url, {
          method: 'POST',
          jsonBody: { notification_ids: [nid] },
        })
        if (res.ok) {
          if (useAdminFeed) await loadAdminFeed()
          else await loadPlatformFeed()
        } else {
          const body = (await res.json().catch(() => ({}))) as { detail?: string }
          const msg = body.detail ?? `Could not mark read (${res.status}).`
          if (useAdminFeed) setAdminFeedError(msg)
          else setPlatformFeedError(msg)
        }
      }
      if (n.link_path) {
        navigate(n.link_path)
        setOpen(false)
      }
    },
    [navigate, useLiveFeed, useAdminFeed, loadAdminFeed, loadPlatformFeed],
  )

  const hintPrimary = useAdminFeed ? (
    pushServerReady === false ? (
      <>
        Uploads awaiting KYC or KYB review appear here. <strong>Tray alerts unavailable</strong> until Web Push is configured on
        the server.
      </>
    ) : (
      'Uploads awaiting KYC or KYB review appear here.'
    )
  ) : usePlatformFeed ? (
    pushServerReady === false ? (
      <strong>Tray alerts unavailable</strong>
    ) : null
  ) : pushServerReady === false ? (
    <>
      <strong>Unavailable on this deployment.</strong> Sample alerts below are for UI preview only.
    </>
  ) : null

  const showPushEnableToggle =
    !hidePushRowInBell &&
    pushSupported &&
    !pushActive &&
    Notification.permission !== 'denied' &&
    pushServerReady === true

  const showPushBlockedHint =
    !hidePushRowInBell && pushSupported && Notification.permission === 'denied'

  const feedError = adminFeedError || platformFeedError

  const panelInner = (
    <>
      <div className="notif-panel-head">
        <h2 className="notif-panel-title" id="notif-panel-heading">
          Alerts
        </h2>
        <div className="notif-panel-head-actions">
          {showPushEnableToggle ? (
            <button
              type="button"
              className="notif-push-toggle"
              disabled={pushBusy}
              aria-label="Turn on device notifications"
              title="Device notifications"
              onClick={() => void enablePush()}
            >
              <span className="notif-push-toggle-track" aria-hidden="true">
                <span className="notif-push-toggle-knob" />
              </span>
            </button>
          ) : null}
          {(useLiveFeed || user?.id != null) && unread > 0 ? (
            <button type="button" className="btn btn-ghost notif-panel-clear" onClick={() => void markAllRead()}>
              Mark read
            </button>
          ) : null}
        </div>
      </div>
      {setupHint ? <p className="notif-panel-hint notif-panel-hint--setup">{setupHint}</p> : null}
      {hintPrimary ? <p className="notif-panel-hint">{hintPrimary}</p> : null}
      {showPushBlockedHint ? (
        <p className="notif-panel-hint">Notifications blocked — allow them in your browser or system settings.</p>
      ) : null}
      {pushError ? <p className="form-error notif-panel-hint">{pushError}</p> : null}
      {feedError ? <p className="form-error notif-panel-hint">{feedError}</p> : null}
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
      {displayItems.length === 0 ? (
        <p className="notif-panel-hint" style={{ marginTop: '0.75rem' }}>
          {items.length === 0
            ? usePlatformFeed
              ? 'No broadcasts yet. After an admin sends one, it will show here.'
              : 'No alerts yet.'
            : showHistory
              ? 'No alerts match this view.'
              : "You're all caught up — nothing unread."}
        </p>
      ) : null}
      <ul className="notif-list">
        {displayItems.map((n) =>
          n.kind === 'promo' ? (
            useLiveFeed ? (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notif-item-btn notif-item-btn--promo-only${n.read ? '' : ' notif-item-btn--unread'}`}
                  onClick={() => void onFeedItemActivate(n)}
                >
                  <span className="notif-kind notif-kind--promo">Promo</span>
                  <p className="notif-item-title">{n.title}</p>
                  <p className="notif-item-body">{n.body}</p>
                </button>
              </li>
            ) : (
              <li key={n.id} className={`notif-item notif-item--promo-only${n.read ? '' : ' notif-item--unread'}`}>
                <span className="notif-kind notif-kind--promo">Promo</span>
                <p className="notif-item-title">{n.title}</p>
                <p className="notif-item-body">{n.body}</p>
              </li>
            )
          ) : useLiveFeed ? (
            <li key={n.id}>
              <button
                type="button"
                className={`notif-item-btn${n.read ? '' : ' notif-item-btn--unread'}`}
                onClick={() => void onFeedItemActivate(n)}
              >
                <span className={kindClass(n.kind)}>{n.kind}</span>
                <p className="notif-item-title">{n.title}</p>
                <p className="notif-item-body">{n.body}</p>
                <p className="notif-item-time">{n.time}</p>
                {n.link_path ? <span className="notif-item-open-hint">Tap to open</span> : null}
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
      {readCount > 0 ? (
        <div className="notif-panel-hint" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-ghost notif-panel-clear" onClick={() => setShowHistory((h) => !h)}>
            {showHistory ? 'Show unread only' : `Past alerts (${readCount})`}
          </button>
        </div>
      ) : null}
    </>
  )

  const sheetPortal =
    open && useSheetLayout && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="notif-sheet-backdrop"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            />
            <div
              className="notif-panel notif-panel--sheet card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notif-panel-heading"
            >
              <div className="notif-sheet-toolbar">
                <span className="notif-sheet-grab" aria-hidden="true" />
                <button type="button" className="btn btn-ghost notif-sheet-close" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              {panelInner}
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <div className="notif-bell-wrap" ref={rootRef}>
        <button
          type="button"
          className={`notif-bell-btn${compact ? ' notif-bell-btn--compact' : ''}`}
          aria-expanded={open}
          aria-haspopup="dialog"
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
        {open && !useSheetLayout ? (
          <div className="notif-panel card" role="dialog" aria-labelledby="notif-panel-heading">
            {panelInner}
          </div>
        ) : null}
      </div>
      {sheetPortal}
    </>
  )
}
