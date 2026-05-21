import type { MessageKey } from '@/i18n/messages/en'
import { translate, readStoredPublicLocale } from '@/i18n/engine'

export type AppNotification = {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  kind: 'transaction' | 'kyc' | 'alert' | 'promo'
  link_path?: string
}

function baseMockRows(locale = readStoredPublicLocale()): AppNotification[] {
  const t = (key: MessageKey) => translate(locale, key)
  return [
    {
      id: 'n1',
      title: t('notifications.mock.ledgerTitle'),
      body: t('notifications.mock.ledgerBody'),
      time: t('notifications.justNow'),
      read: false,
      kind: 'transaction',
    },
    {
      id: 'n2',
      title: t('notifications.mock.kycTitle'),
      body: t('notifications.mock.kycBody'),
      time: t('notifications.mock.yesterday'),
      read: false,
      kind: 'kyc',
    },
    {
      id: 'n3',
      title: t('notifications.mock.spotTitle'),
      body: t('notifications.mock.spotBody'),
      time: 'May 10',
      read: true,
      kind: 'alert',
    },
    {
      id: 'n4',
      title: t('notifications.mock.promoTitle'),
      body: t('notifications.mock.promoBody'),
      time: 'May 8',
      read: true,
      kind: 'promo',
    },
  ]
}

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

function mergeMockWithReadIds(readIds: Set<string>, locale = readStoredPublicLocale()): AppNotification[] {
  return baseMockRows(locale).map((n) => ({
    ...n,
    read: n.read || readIds.has(n.id),
  }))
}

export function hydrateMockNotificationsForGuest(locale?: ReturnType<typeof readStoredPublicLocale>): AppNotification[] {
  return mergeMockWithReadIds(loadReadIdSet(GUEST_READ_KEY), locale)
}

export function hydrateMockNotificationsForAccount(
  accountId: number,
  locale?: ReturnType<typeof readStoredPublicLocale>,
): AppNotification[] {
  return mergeMockWithReadIds(loadReadIdSet(readIdsStorageKey(accountId)), locale)
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

export function persistMockNotificationReadIds(accountId: number | null, ids: string[]): void {
  const key = accountId == null ? GUEST_READ_KEY : readIdsStorageKey(accountId)
  persistReadIds(key, ids)
}

export function persistAllMockNotificationsRead(accountId: number | null): void {
  try {
    const ids = baseMockRows().map((n) => n.id)
    const key = accountId == null ? GUEST_READ_KEY : readIdsStorageKey(accountId)
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    /* quota / private mode */
  }
}

export const MOCK_NOTIFICATION_IDS = ['n1', 'n2', 'n3', 'n4']
