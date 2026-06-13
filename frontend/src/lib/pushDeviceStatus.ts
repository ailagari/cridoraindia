import { apiFetch, authFetch, getStoredAccess } from '@/lib/api'

export type PushDeviceStatus = {
  registered: boolean
  linked_to_user: boolean
  channel: 'webpush' | 'fcm' | 'none'
}

export async function fetchPushDeviceStatus(params: {
  endpoint?: string | null
  token?: string | null
}): Promise<PushDeviceStatus> {
  const qs = new URLSearchParams()
  if (params.endpoint) qs.set('endpoint', params.endpoint)
  if (params.token) qs.set('token', params.token)
  const query = qs.toString()
  const path = query ? `/api/v1/push/device-status/?${query}` : '/api/v1/push/device-status/'
  const res = getStoredAccess()
    ? await authFetch(path, { cache: 'no-store' })
    : await apiFetch(path, { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as Partial<PushDeviceStatus>
  if (!res.ok) {
    return { registered: false, linked_to_user: false, channel: 'none' }
  }
  const channel = data.channel === 'fcm' || data.channel === 'webpush' ? data.channel : 'none'
  return {
    registered: Boolean(data.registered),
    linked_to_user: Boolean(data.linked_to_user),
    channel,
  }
}

export function isDeviceStatusDeliverable(status: PushDeviceStatus): boolean {
  if (!status.registered) return false
  if (getStoredAccess()) return status.linked_to_user
  return status.linked_to_user
}
