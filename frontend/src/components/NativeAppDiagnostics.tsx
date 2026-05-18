import { useCallback, useEffect, useState } from 'react'
import { apiFetch, getApiBaseUrl } from '@/lib/api'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import { getNativePushActive, registerNativePushSubscription, showTrayNotification } from '@/lib/nativeNotifications'

type HealthState = 'idle' | 'checking' | 'ok' | 'error'

export function NativeAppDiagnostics() {
  const [health, setHealth] = useState<HealthState>('idle')
  const [healthDetail, setHealthDetail] = useState('')
  const [pushActive, setPushActive] = useState<boolean | null>(null)
  const [testBusy, setTestBusy] = useState(false)

  const apiBase = getApiBaseUrl()

  const runHealthCheck = useCallback(async () => {
    setHealth('checking')
    setHealthDetail('')
    if (!apiBase) {
      setHealth('error')
      setHealthDetail('VITE_API_BASE_URL missing — rebuild APK with .env.production.local')
      return
    }
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
  }, [apiBase])

  useEffect(() => {
    if (!isNativeAndroid()) return
    void runHealthCheck()
    void getNativePushActive().then(setPushActive)
  }, [runHealthCheck])

  const sendTestNotification = useCallback(async () => {
    setTestBusy(true)
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
    } catch (e) {
      setHealthDetail(e instanceof Error ? e.message : 'Notification test failed')
    } finally {
      setTestBusy(false)
    }
  }, [])

  if (!isNativeAndroid()) return null

  const healthLabel =
    health === 'checking'
      ? 'Checking…'
      : health === 'ok'
        ? 'Connected'
        : health === 'error'
          ? 'Failed'
          : '—'

  return (
    <div className="native-diag-bar" role="status" aria-live="polite">
      <div className="native-diag-bar__row">
        <span className="native-diag-bar__label">Android app</span>
        <span className={`native-diag-bar__pill native-diag-bar__pill--${health}`}>{healthLabel}</span>
      </div>
      <p className="native-diag-bar__meta">
        API: {apiBase || '(not set — rebuild required)'}
        {healthDetail ? ` · ${healthDetail}` : ''}
        {pushActive != null ? ` · Notifications ${pushActive ? 'on' : 'off'}` : ''}
      </p>
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
