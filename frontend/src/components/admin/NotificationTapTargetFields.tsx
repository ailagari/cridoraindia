import { useCallback, useState } from 'react'
import { NOTIFICATION_TAP_PRESETS, pathForPresetId, presetIdForPath } from '@/lib/notificationTapTargets'

type Props = {
  idPrefix: string
  guestLabel?: string
  authLabel?: string
  guestPreset: string
  guestCustom: string
  authPreset: string
  authCustom: string
  onGuestPresetChange: (id: string) => void
  onGuestCustomChange: (path: string) => void
  onAuthPresetChange: (id: string) => void
  onAuthCustomChange: (path: string) => void
  disabled?: boolean
}

export function NotificationTapTargetFields({
  idPrefix,
  guestLabel = 'Guests tap opens',
  authLabel = 'Signed-in users tap opens',
  guestPreset,
  guestCustom,
  authPreset,
  authCustom,
  onGuestPresetChange,
  onGuestCustomChange,
  onAuthPresetChange,
  onAuthCustomChange,
  disabled = false,
}: Props) {
  return (
    <div className="admin-msg-tap-targets">
      <div className="field">
        <label htmlFor={`${idPrefix}-guest-preset`}>{guestLabel}</label>
        <select
          id={`${idPrefix}-guest-preset`}
          value={guestPreset}
          onChange={(e) => onGuestPresetChange(e.target.value)}
          disabled={disabled}
        >
          {NOTIFICATION_TAP_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom path…</option>
        </select>
        {guestPreset === 'custom' ? (
          <input
            id={`${idPrefix}-guest-custom`}
            type="text"
            value={guestCustom}
            onChange={(e) => onGuestCustomChange(e.target.value)}
            placeholder="/gold-rates/kerala"
            disabled={disabled}
            aria-label={`${guestLabel} custom path`}
          />
        ) : (
          <p className="admin-msg-field-hint">{pathForPresetId(guestPreset, guestCustom)}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-auth-preset`}>{authLabel}</label>
        <select
          id={`${idPrefix}-auth-preset`}
          value={authPreset}
          onChange={(e) => onAuthPresetChange(e.target.value)}
          disabled={disabled}
        >
          {NOTIFICATION_TAP_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom path…</option>
        </select>
        {authPreset === 'custom' ? (
          <input
            id={`${idPrefix}-auth-custom`}
            type="text"
            value={authCustom}
            onChange={(e) => onAuthCustomChange(e.target.value)}
            placeholder="/userdashboard?section=portfolio_overview"
            disabled={disabled}
            aria-label={`${authLabel} custom path`}
          />
        ) : (
          <p className="admin-msg-field-hint">{pathForPresetId(authPreset, authCustom)}</p>
        )}
      </div>
    </div>
  )
}

export function useTapTargetState(initialGuest = '/', initialAuth = '/userdashboard?section=portfolio_overview') {
  const [guestPreset, setGuestPreset] = useState(presetIdForPath(initialGuest))
  const [guestCustom, setGuestCustom] = useState(initialGuest)
  const [authPreset, setAuthPreset] = useState(presetIdForPath(initialAuth))
  const [authCustom, setAuthCustom] = useState(initialAuth)

  const guestPath = pathForPresetId(guestPreset, guestCustom)
  const authPath = pathForPresetId(authPreset, authCustom)

  const loadFromPaths = useCallback((guest: string, auth: string) => {
    setGuestPreset(presetIdForPath(guest))
    setGuestCustom(guest)
    setAuthPreset(presetIdForPath(auth))
    setAuthCustom(auth)
  }, [])

  return {
    guestPreset,
    setGuestPreset,
    guestCustom,
    setGuestCustom,
    authPreset,
    setAuthPreset,
    authCustom,
    setAuthCustom,
    guestPath,
    authPath,
    loadFromPaths,
  }
}
