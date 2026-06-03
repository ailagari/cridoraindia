import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useOptionalPublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'
import type { AppNotification } from '@/lib/mockNotifications'
import { useAuth } from '@/context/AuthContext'
import { authFetch } from '@/lib/api'
import {
  fetchWebPushServerStatus,
  canSubscribeWebPush,
  getBrowserPushActive,
  getPushDeliveryLabel,
  isPushPermissionDenied,
  openNativeNotificationSettings,
  pushNotificationsSupported,
  pushPermissionBlockedHint,
  pushSetupHint,
  registerWebPushSubscription,
} from '@/lib/webPushApi'
import { nativePushNotificationsSupported } from '@/lib/nativeNotifications'
import { CRIDORA_PUSH_REFRESH_MESSAGE_TYPE } from '@/lib/cridoraSwMessages'
import { notifyBellFeedUpdates, seedTrayNotifiedIds } from '@/lib/nativeNotifications'

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

function formatNotifyTime(iso: string, t?: (key: MessageKey, vars?: Record<string, string | number>) => string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t ? t('notifications.justNow') : 'Just now'
  if (mins < 60) return t ? t('notifications.minutesAgo', { mins }) : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return t ? t('notifications.hoursAgo', { hrs }) : `${hrs}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type ApiInboxRow = {
  id: string
  source?: string
  kind: string
  category?: string
  title: string
  body: string
  link_path: string
  created_at: string
  priority?: string
  branding_label?: string
  logo_url?: string
  image_url?: string
  notification_type?: string
}

function mapInboxApiRow(
  r: ApiInboxRow,
  t?: (key: MessageKey, vars?: Record<string, string | number>) => string,
): AppNotification {
  const cat = (r.category || '').toLowerCase()
  const kind: AppNotification['kind'] =
    cat === 'transaction' || cat === 'loan'
      ? 'transaction'
      : cat === 'security'
        ? 'kyc'
        : cat === 'promo' || r.kind === 'festival_broadcast_sent'
          ? 'promo'
          : 'alert'
  const pri = r.priority === 'high' || r.priority === 'low' ? r.priority : 'medium'
  return {
    id: r.id,
    title: r.title,
    body: r.branding_label ? `${r.branding_label}\n${r.body}` : r.body,
    time: formatNotifyTime(r.created_at, t),
    read: false,
    kind,
    link_path: r.link_path,
    priority: pri,
    apiCategory: cat || r.category || '',
    notificationType: r.notification_type || '',
    logoUrl: (r.logo_url || '').trim() || undefined,
    imageUrl: (r.image_url || '').trim() || undefined,
  }
}

function inboxCategoryLabel(n: AppNotification): string | null {
  const nt = (n.notificationType || '').toLowerCase()
  if (nt === 'gold_rate' || nt === 'gold_hourly') return 'Gold'
  if (nt === 'holding_gain' || nt === 'portfolio_gain') return 'Portfolio'
  const cat = (n.apiCategory || '').toLowerCase()
  if (cat === 'portfolio') return 'Portfolio'
  return null
}

function NotifThumb({ n }: { n: AppNotification }) {
  const src = n.logoUrl || n.imageUrl
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className="notif-item-thumb"
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
    />
  )
}

function priorityClass(p?: AppNotification['priority']): string {
  if (p === 'high') return ' notif-item-btn--priority-high'
  if (p === 'low') return ' notif-item-btn--priority-low'
  return ''
}

type InboxCategoryFilter = '' | 'portfolio' | 'transaction' | 'security' | 'promo'

function settingsPathForRole(role: Props['role']): string | null {
  if (role === 'customer') return '/userdashboard?section=profile_notifications'
  if (role === 'jeweller') return '/jewellerdashboard?section=prof_notifications'
  if (role === 'admin') return '/admindashboard?section=plat_account'
  return null
}

function mapAdminApiRow(
  r: ApiAdminNotification,
  t?: (key: MessageKey, vars?: Record<string, string | number>) => string,
): AppNotification {
  const kind: AppNotification['kind'] =
    r.kind === 'kyb_upload' || r.kind === 'kyc_upload'
      ? 'kyc'
      : r.kind === 'festival_broadcast_sent'
        ? 'promo'
        : 'alert'
  return {
    id: `admin-${r.id}`,
    title: r.title,
    body: r.body,
    time: formatNotifyTime(r.created_at, t),
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
  /** Public site bell uses Malayalam/English UI copy only. */
  localeScope?: 'public' | 'dashboard'
}

export function NotificationBell({
  compact = false,
  role = 'customer',
  suppressPushRow = false,
  hidePushControls = false,
  localeScope = 'dashboard',
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const publicUi = localeScope === 'public'
  const { t } = useOptionalPublicLocale()
  const uiT = publicUi ? t : undefined
  const useAdminFeed = role === 'admin' && user?.user_type === 'admin'
  const usePlatformFeed = Boolean(user && !useAdminFeed)
  const useLiveFeed = useAdminFeed || usePlatformFeed
  const hidePushRowInBell = Boolean(hidePushControls) || (usePlatformFeed && suppressPushRow)

  const [open, setOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<InboxCategoryFilter>('')
  const [badgeCount, setBadgeCount] = useState(0)
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
  const [pushPermissionBlocked, setPushPermissionBlocked] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  /** Bottom sheet on narrow viewports (PWA / mobile dashboards). */
  const [useSheetLayout, setUseSheetLayout] = useState(false)

  const setupHint = pushSetupHint()
  const blockedHint = pushPermissionBlockedHint()
  const deliveryLabel = getPushDeliveryLabel()
  const settingsPath = settingsPathForRole(role)

  const items = useMemo(() => {
    if (useAdminFeed) return adminItems
    if (usePlatformFeed) return platformItems
    return []
  }, [useAdminFeed, usePlatformFeed, adminItems, platformItems])

  const unread = usePlatformFeed && !open ? badgeCount : items.length
  const displayItems = useMemo(() => {
    if (!categoryFilter) return items
    return items.filter((i) => {
      const c = (i.apiCategory || '').toLowerCase()
      if (categoryFilter === 'transaction') return c === 'transaction' || c === 'loan' || i.kind === 'transaction'
      if (categoryFilter === 'portfolio') return c === 'portfolio' || i.kind === 'transaction'
      if (categoryFilter === 'security') return c === 'security' || i.kind === 'kyc'
      if (categoryFilter === 'promo') return c === 'promo' || i.kind === 'promo'
      return true
    })
  }, [items, categoryFilter])

  const loadUnreadCount = useCallback(async () => {
    if (!usePlatformFeed) return
    const res = await authFetch('/api/v1/inbox/unread-count/', { cache: 'no-store' })
    const body = (await res.json().catch(() => ({}))) as { unread_count?: number }
    if (res.ok && typeof body.unread_count === 'number') {
      setBadgeCount(body.unread_count)
    }
  }, [usePlatformFeed])

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
    const rows = Array.isArray(body.results) ? body.results.map((r) => mapAdminApiRow(r, uiT)) : []
    setAdminItems((prev) => {
      if (prev.length === 0) {
        seedTrayNotifiedIds(rows.map((x) => x.id))
      } else {
        notifyBellFeedUpdates(prev, rows)
      }
      return rows
    })
  }, [useAdminFeed, uiT])

  const loadPlatformFeed = useCallback(async () => {
    if (!usePlatformFeed) return
    setPlatformFeedError('')
    const catQ = categoryFilter ? `&category=${encodeURIComponent(categoryFilter)}` : ''
    const res = await authFetch(`/api/v1/inbox/?limit=40${catQ}`, { cache: 'no-store' })
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      results?: ApiInboxRow[]
    }
    if (!res.ok) {
      setPlatformFeedError(body.detail ?? 'Could not load alerts.')
      return
    }
    const rows = Array.isArray(body.results) ? body.results.map((r) => mapInboxApiRow(r, uiT)) : []
    if (typeof (body as { unread_count?: number }).unread_count === 'number') {
      setBadgeCount((body as { unread_count: number }).unread_count)
    }
    setPlatformItems((prev) => {
      if (prev.length === 0) {
        seedTrayNotifiedIds(rows.map((x) => x.id))
      } else {
        notifyBellFeedUpdates(prev, rows)
      }
      return rows
    })
  }, [usePlatformFeed, uiT, categoryFilter])

  const refreshPushState = useCallback(async () => {
    if (!pushNotificationsSupported()) {
      setPushActive(false)
      setPushPermissionBlocked(false)
      return
    }
    try {
      setPushError('')
      const [on, denied] = await Promise.all([getBrowserPushActive(), isPushPermissionDenied()])
      setPushActive(on)
      setPushPermissionBlocked(denied)
    } catch {
      setPushActive(false)
      setPushPermissionBlocked(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshPushState()
  }, [open, refreshPushState])

  useEffect(() => {
    if (!open) {
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
    void loadUnreadCount()
  }, [usePlatformFeed, user, loadPlatformFeed, loadUnreadCount])

  useEffect(() => {
    if (!useLiveFeed || !user) return
    const periodMs = open ? FEED_POLL_MS_PANEL_OPEN : FEED_POLL_MS_BACKGROUND
    const id = window.setInterval(() => {
      if (open) {
        void loadAdminFeed()
        void loadPlatformFeed()
      } else {
        void loadUnreadCount()
        if (useAdminFeed) void loadAdminFeed()
      }
    }, periodMs)
    return () => window.clearInterval(id)
  }, [useLiveFeed, user, open, loadAdminFeed, loadPlatformFeed, loadUnreadCount, useAdminFeed, usePlatformFeed])

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

  const enablePush = useCallback(async () => {
    setPushBusy(true)
    setPushError('')
    try {
      await registerWebPushSubscription()
      setPushActive(true)
      setPushPermissionBlocked(false)
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Could not enable push.')
      const denied = await isPushPermissionDenied().catch(() => false)
      setPushPermissionBlocked(denied)
    } finally {
      setPushBusy(false)
    }
  }, [])

  const openPushSettings = useCallback(async () => {
    const opened = await openNativeNotificationSettings()
    if (!opened && blockedHint) {
      setPushError(blockedHint)
    }
  }, [blockedHint])

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

  const removeItemsLocal = useCallback(
    (ids?: string[]) => {
      const markAll = ids == null
      const idSet = markAll ? null : new Set(ids)
      const apply = (prev: AppNotification[]) =>
        markAll ? [] : prev.filter((x) => !idSet?.has(x.id))
      if (useAdminFeed) setAdminItems(apply)
      else if (usePlatformFeed) setPlatformItems(apply)
    },
    [useAdminFeed, usePlatformFeed],
  )

  const markAllRead = useCallback(async () => {
    if (useAdminFeed) {
      removeItemsLocal()
      const res = await authFetch('/api/v1/admin/notifications/mark-read/', {
        method: 'POST',
        jsonBody: { all: true },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string }
        setAdminFeedError(body.detail ?? `Could not clear alerts (${res.status}).`)
        await loadAdminFeed()
        return
      }
      await loadAdminFeed()
      return
    }
    if (usePlatformFeed) {
      removeItemsLocal()
      const res = await authFetch('/api/v1/inbox/ack/', {
        method: 'POST',
        jsonBody: { all: true },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string }
        setPlatformFeedError(body.detail ?? `Could not clear alerts (${res.status}).`)
        await loadPlatformFeed()
        return
      }
      await loadPlatformFeed()
    }
  }, [useAdminFeed, usePlatformFeed, loadAdminFeed, loadPlatformFeed, removeItemsLocal])

  const onFeedItemActivate = useCallback(
    async (n: AppNotification) => {
      if (!useLiveFeed) return
      removeItemsLocal([n.id])
      if (usePlatformFeed) {
        const res = await authFetch('/api/v1/inbox/ack/', {
          method: 'POST',
          jsonBody: { notification_ids: [n.id] },
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string }
          setPlatformFeedError(body.detail ?? `Could not clear alert (${res.status}).`)
          await loadPlatformFeed()
        }
      } else {
        const adminMatch = /^admin-(\d+)$/.exec(n.id)
        const nid = adminMatch ? Number.parseInt(adminMatch[1], 10) : NaN
        if (!Number.isNaN(nid)) {
          const res = await authFetch('/api/v1/admin/notifications/mark-read/', {
            method: 'POST',
            jsonBody: { notification_ids: [nid] },
          })
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { detail?: string }
            setAdminFeedError(body.detail ?? `Could not clear alert (${res.status}).`)
          }
        }
        await loadAdminFeed()
      }
      if (n.link_path) {
        navigate(n.link_path)
        setOpen(false)
      }
    },
    [navigate, useLiveFeed, useAdminFeed, usePlatformFeed, loadAdminFeed, loadPlatformFeed, removeItemsLocal],
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
  ) : !user ? (
    publicUi
      ? t('notifications.signInForAlerts')
      : 'Sign in to see your alerts, or enable push for gold rate updates on the public site.'
  ) : pushServerReady === false ? (
    <strong>{publicUi ? t('notifications.unavailable') : 'Push alerts unavailable on this deployment.'}</strong>
  ) : null

  const showTrayPushRow =
    !hidePushRowInBell && pushServerReady === true && !pushActive
  const pushSupported = canSubscribeWebPush()
  const canEnableTrayPush =
    pushSupported && !pushActive && !pushPermissionBlocked
  const showTrayInstallHint = showTrayPushRow && !pushActive && !pushSupported && Boolean(setupHint)

  const feedError = adminFeedError || platformFeedError

  const panelInner = (
    <>
      <div className="notif-panel-head">
        <h2 className="notif-panel-title" id="notif-panel-heading">
          {publicUi ? t('notifications.alerts') : 'Alerts'}
        </h2>
        <div className="notif-panel-head-actions">
          {useLiveFeed && unread > 0 ? (
            <button type="button" className="btn btn-ghost notif-panel-clear" onClick={() => void markAllRead()}>
              {publicUi ? t('notifications.markRead') : 'Clear all'}
            </button>
          ) : null}
        </div>
      </div>
      {showTrayPushRow ? (
        <div className="notif-push-row" role="region" aria-label={publicUi ? t('notifications.trayRegion') : 'Device notification tray'}>
          {pushPermissionBlocked ? (
            <>
              <span className="notif-push-label">
                {publicUi ? t('notifications.trayBlocked') : 'Tray notifications blocked'}
              </span>
              <p className="notif-push-detail notif-push-err">
                {publicUi ? t('notifications.blocked') : blockedHint}
              </p>
              {nativePushNotificationsSupported() ? (
                <button
                  type="button"
                  className="btn btn-primary notif-push-btn"
                  onClick={() => void openPushSettings()}
                >
                  {publicUi ? t('notifications.openSettings') : 'Open app settings'}
                </button>
              ) : null}
            </>
          ) : canEnableTrayPush ? (
            <>
              <span className="notif-push-label">
                {publicUi ? t('notifications.trayOff') : 'Notification tray'}
              </span>
              <p className="notif-push-detail">{deliveryLabel}</p>
              <button
                type="button"
                className="btn btn-primary notif-push-btn"
                disabled={pushBusy}
                onClick={() => void enablePush()}
              >
                {pushBusy
                  ? publicUi
                    ? t('notifications.turningOn')
                    : 'Turning on…'
                  : publicUi
                    ? t('notifications.turnOnTray')
                    : 'Turn on tray notifications'}
              </button>
            </>
          ) : showTrayInstallHint ? (
            <>
              <span className="notif-push-label">
                {publicUi ? t('notifications.trayOff') : 'Notification tray'}
              </span>
              <p className="notif-panel-hint notif-panel-hint--setup" style={{ margin: 0 }}>
                {setupHint}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
      {setupHint && !showTrayInstallHint ? (
        <p className="notif-panel-hint notif-panel-hint--setup">{setupHint}</p>
      ) : null}
      {hintPrimary ? <p className="notif-panel-hint">{hintPrimary}</p> : null}
      {usePlatformFeed ? (
        <div className="notif-category-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
          {(['', 'portfolio', 'transaction', 'security', 'promo'] as InboxCategoryFilter[]).map((c) => (
            <button
              key={c || 'all'}
              type="button"
              className={`btn btn-ghost notif-panel-clear${categoryFilter === c ? ' notif-chip--active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setCategoryFilter(c)}
            >
              {c === '' ? 'All' : c === 'promo' ? 'Offers' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
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
          {publicUi ? t('notifications.allCaughtUp') : "You're all caught up."}
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
                  <span className="notif-kind notif-kind--promo">{publicUi ? t('notifications.promo') : 'Promo'}</span>
                  <NotifThumb n={n} />
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
                className={`notif-item-btn${n.read ? '' : ' notif-item-btn--unread'}${priorityClass(n.priority)}`}
                onClick={() => void onFeedItemActivate(n)}
              >
                <span className={kindClass(n.kind)}>{n.kind}</span>
                {inboxCategoryLabel(n) ? (
                  <span className="notif-kind notif-kind--chip">{inboxCategoryLabel(n)}</span>
                ) : null}
                <NotifThumb n={n} />
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
      {settingsPath && user && localeScope === 'dashboard' ? (
        <p className="notif-panel-hint" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-ghost notif-panel-clear"
            onClick={() => {
              navigate(settingsPath)
              setOpen(false)
            }}
          >
            Notification settings
          </button>
        </p>
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
          aria-label={
            unread
              ? publicUi
                ? t('notifications.ariaLabelUnread', { count: unread > 9 ? '9+' : unread })
                : `Notifications, ${unread} unread`
              : publicUi
                ? t('notifications.ariaLabel')
                : 'Notifications'
          }
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
