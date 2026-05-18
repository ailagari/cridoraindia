export type AppNotification = {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  kind: 'transaction' | 'kyc' | 'alert' | 'promo'
  /** In-app navigation when supported (admin feed). */
  link_path?: string
}

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Ledger credit',
    body: 'Fractional gold credited after UPI settlement · ref #CRD-9F2A',
    time: 'Just now',
    read: false,
    kind: 'transaction',
  },
  {
    id: 'n2',
    title: 'KYC checkpoint',
    body: 'Proof of address may be required if admin requests a re-upload.',
    time: 'Yesterday',
    read: false,
    kind: 'kyc',
  },
  {
    id: 'n3',
    title: 'Spot price band',
    body: 'Gold ₹/g moved within your alert range (illustrative demo data).',
    time: 'May 10',
    read: true,
    kind: 'alert',
  },
  {
    id: 'n4',
    title: 'GoldNest window',
    body: 'Early bird waivers on selected schemes — review before month end.',
    time: 'May 8',
    read: true,
    kind: 'promo',
  },
]

const GUEST_READ_KEY = 'cridora_mock_notification_read_ids_v1:guest'

function readIdsStorageKey(accountId: number): string {
  return `cridora_mock_notification_read_ids_v1:${accountId}`
}

function loadReadIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function mergeMockWithReadIds(readIds: Set<string>): AppNotification[] {
  return MOCK_NOTIFICATIONS.map((n) => ({
    ...n,
    read: n.read || readIds.has(n.id),
  }))
}

/** Public / guest bell — restore read state from localStorage. */
export function hydrateMockNotificationsForGuest(): AppNotification[] {
  return mergeMockWithReadIds(loadReadIdSet(GUEST_READ_KEY))
}

/** Merge demo rows with “mark read” choices persisted for this signed-in account (sample bell feed). */
export function hydrateMockNotificationsForAccount(accountId: number): AppNotification[] {
  return mergeMockWithReadIds(loadReadIdSet(readIdsStorageKey(accountId)))
}

function persistReadIds(key: string, ids: string[]): void {
  try {
    const prev = loadReadIdSet(key)
    for (const id of ids) prev.add(id)
    localStorage.setItem(key, JSON.stringify([...prev]))
  } catch {
    /* quota / private mode */
  }
}

/** Persist read ids for guest or signed-in preview feed. */
export function persistMockNotificationReadIds(accountId: number | null, ids: string[]): void {
  const key = accountId == null ? GUEST_READ_KEY : readIdsStorageKey(accountId)
  persistReadIds(key, ids)
}

/** Persist that every demo notification id is read for this account or guest. */
export function persistAllMockNotificationsRead(accountId: number | null): void {
  try {
    const ids = MOCK_NOTIFICATIONS.map((n) => n.id)
    const key = accountId == null ? GUEST_READ_KEY : readIdsStorageKey(accountId)
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    /* quota / private mode */
  }
}
