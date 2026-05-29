import { authFetch } from '@/lib/api'

export type NotificationPreferencesDTO = {
  allow_promotional: boolean
  allow_gold_alerts: boolean
  allow_portfolio_alerts: boolean
  allow_jeweller_campaigns: boolean
  allow_festival_alerts: boolean
  allow_push_notifications: boolean
  allow_sound: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

export async function fetchInboxPreferences(): Promise<
  { ok: true; data: NotificationPreferencesDTO } | { ok: false; detail: string }
> {
  const res = await authFetch('/api/v1/inbox/preferences/')
  const data = (await res.json().catch(() => ({}))) as NotificationPreferencesDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not load notification settings.' }
  }
  return { ok: true, data }
}

export async function patchInboxPreferences(
  patch: Partial<NotificationPreferencesDTO>,
): Promise<{ ok: true; data: NotificationPreferencesDTO } | { ok: false; detail: string }> {
  const res = await authFetch('/api/v1/inbox/preferences/', {
    method: 'PATCH',
    jsonBody: patch,
  })
  const data = (await res.json().catch(() => ({}))) as NotificationPreferencesDTO & { detail?: string }
  if (!res.ok) {
    return { ok: false, detail: data.detail != null ? String(data.detail) : 'Could not save notification settings.' }
  }
  return { ok: true, data }
}
