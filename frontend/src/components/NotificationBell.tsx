import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MOCK_NOTIFICATIONS, type AppNotification } from '@/lib/mockNotifications'
import { useAuth } from '@/context/AuthContext'
import {
  getBrowserPushActive,
  pushNotificationsSupported,
  registerWebPushSubscription,
  unregisterWebPushSubscription,
} from '@/lib/webPushApi'

function kindClass(k: AppNotification['kind']): string {
  if (k === 'transaction') return 'notif-kind notif-kind--tx'
  if (k === 'kyc') return 'notif-kind notif-kind--kyc'
  if (k === 'promo') return 'notif-kind notif-kind--promo'
  return 'notif-kind notif-kind--alert'
}

type Props = {
  /** When true, use compact icon-only button for dense headers. */
  compact?: boolean
}

export function NotificationBell({ compact = false }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>(() => [...MOCK_NOTIFICATIONS])
  const [pushActive, setPushActive] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items])

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
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

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
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Could not disable push.')
    } finally {
      setPushBusy(false)
    }
  }, [])

  const pushSupported = pushNotificationsSupported()

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
  }, [])

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
            <button type="button" className="btn btn-ghost notif-panel-clear" onClick={markAllRead}>
              Mark read
            </button>
          </div>
          <p className="notif-panel-hint">
            In-app alerts below are samples. Turn on browser notifications to get real alerts on this device (HTTPS or
            localhost; install the PWA on iOS 16.4+ for Web Push).
          </p>
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
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary notif-push-btn"
                    disabled={pushBusy}
                    onClick={() => void enablePush()}
                  >
                    Enable
                  </button>
                )
              ) : null}
            </div>
          ) : (
            <p className="notif-panel-hint" style={{ marginTop: '-0.35rem' }}>
              Sign in to enable device notifications.
            </p>
          )}
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={`notif-item${n.read ? '' : ' notif-item--unread'}`}>
                <span className={kindClass(n.kind)}>{n.kind}</span>
                <p className="notif-item-title">{n.title}</p>
                <p className="notif-item-body">{n.body}</p>
                <p className="notif-item-time">{n.time}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
