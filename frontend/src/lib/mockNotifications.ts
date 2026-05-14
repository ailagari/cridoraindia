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
