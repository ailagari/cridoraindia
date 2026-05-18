import { useCallback, useEffect, useState } from 'react'
import { apiFetch, getApiBaseUrl } from '@/lib/api'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import { getNativePushActive, registerNativePushSubscription, showTrayNotification } from '@/lib/nativeNotifications'

type HealthState = 'idle' | 'checking' | 'ok' | 'error'

function apiLabel(): string {
  const base = getApiBaseUrl()
  if (base) return base
  if (typeof window !== 'undefined') return window.location.origin
  return 'same origin'
}

export function NativeAppDiagnostics() {
  const [health, setHealth] = useState<HealthState>('idle')
  const [healthDetail, setHealthDetail] = useState('')
  const [pushActive, setPushActive] = useState<boolean | null>(null)
  const [testBusy, setTestBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const runHealthCheck = useCallback(async () => {
    setHealth('checking')
    setHealthDetail('')
    try {
      const res = await apiFetch('/api/v1/health/', { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as { status?: string; detail?: string }
      if (!res.ok) {
        setHealth('error')
        setHealthDetail(body.detail ?? `HTTP ${res.status}`)
        return
      }
      setHealth('ok')
      setHealthDetail(body.status ?? 'ok')
    } catch (e) {
      setHealth('error')
      setHealthDetail(e instanceof Error ? e.message : 'Network error')
    }
  }, [])

  useEffect(() => {
    if (!isNativeAndroid()) return
    void runHealthCheck()
    void getNativePushActive().then(setPushActive)
  }, [runHealthCheck])

  const sendTestNotification = useCallback(async () => {
    setTestBusy(true)
    setHealthDetail('')
    try {
      if (!(await getNativePushActive())) {
        await registerNativePushSubscription()
      }
      await showTrayNotification({
        id: `diag-test-${Date.now()}`,
        title: 'Cridora test alert',
        body: 'If you see this in the tray, Android notifications work.',
        link_path: '/',
      })
      setPushActive(await getNativePushActive())
      setHealthDetail('Test alert sent — check the notification tray.')
    } catch (e) {
      setHealthDetail(e instanceof Error ? e.message : 'Notification test failed')
    } finally {
      setTestBusy(false)
    }
  }, [])

  if (!isNativeAndroid() || dismissed) return null

  const healthLabel =
    health === 'checking'
      ? 'Checking…'
      : health === 'ok'
        ? 'Connected'
        : health === 'error'
          ? 'Failed'
          : '—'

  const androidMatch =
    typeof navigator !== 'undefined' ? navigator.userAgent.match(/Android\s([0-9.]+)/) : null
  const webViewHint = androidMatch ? ` · Android ${androidMatch[1]}` : ''

  return (
    <div className="native-diag-bar" role="status" aria-live="polite">
      <div className="native-diag-bar__row">
        <span className="native-diag-bar__label">Android app</span>
        <span className={`native-diag-bar__pill native-diag-bar__pill--${health}`}>{healthLabel}</span>
        <button type="button" className="btn btn-ghost native-diag-bar__btn" onClick={() => setDismissed(true)}>
          Hide
        </button>
      </div>
      <p className="native-diag-bar__meta">
        API: {apiLabel()}
        {healthDetail ? ` · ${healthDetail}` : ''}
        {pushActive != null ? ` · Notifications ${pushActive ? 'on' : 'off'}` : ''}
        {webViewHint}
      </p>
      {pushActive === false ? (
        <p className="native-diag-bar__meta">Tap Test tray alert or Enable in the bell to allow notifications.</p>
      ) : null}
      <div className="native-diag-bar__actions">
        <button type="button" className="btn btn-ghost native-diag-bar__btn" onClick={() => void runHealthCheck()}>
          Retry API
        </button>
        <button
          type="button"
          className="btn btn-ghost native-diag-bar__btn"
          disabled={testBusy}
          onClick={() => void sendTestNotification()}
        >
          Test tray alert
        </button>
      </div>
    </div>
  )
}
