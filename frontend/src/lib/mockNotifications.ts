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

function readIdsStorageKey(accountId: number): string {
  return `cridora_mock_notification_read_ids_v1:${accountId}`
}

function loadReadIdSet(accountId: number): Set<string> {
  try {
    const raw = localStorage.getItem(readIdsStorageKey(accountId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

/** Merge demo rows with “mark read” choices persisted for this signed-in account (sample bell feed). */
export function hydrateMockNotificationsForAccount(accountId: number): AppNotification[] {
  const readIds = loadReadIdSet(accountId)
  return MOCK_NOTIFICATIONS.map((n) => ({
    ...n,
    read: n.read || readIds.has(n.id),
  }))
}

/** Persist that every demo notification id is read for this account. */
export function persistAllMockNotificationsRead(accountId: number): void {
  try {
    const ids = MOCK_NOTIFICATIONS.map((n) => n.id)
    localStorage.setItem(readIdsStorageKey(accountId), JSON.stringify(ids))
  } catch {
    /* quota / private mode */
  }
}
