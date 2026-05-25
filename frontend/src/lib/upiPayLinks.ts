const UPI_PAY_PREFIX = 'upi://pay?'

export type UpiAppId = 'phonepe' | 'gpay' | 'paytm'

export type UpiAppPayLink = {
  id: UpiAppId
  label: string
  href: string
}

const UPI_APPS: { id: UpiAppId; label: string }[] = [
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'gpay', label: 'GPay' },
  { id: 'paytm', label: 'Paytm' },
]

/** Map standard NPCI URI to app-specific deep link, preserving merchant query params. */
export function buildNativeAppPayHref(app: UpiAppId, upiUri: string): string {
  if (!upiUri.startsWith(UPI_PAY_PREFIX)) return upiUri
  const query = upiUri.slice(UPI_PAY_PREFIX.length)
  if (app === 'phonepe') return `phonepe://pay?${query}`
  if (app === 'paytm') return `paytmmp://pay?${query}`
  return `tez://upi/pay?${query}`
}

export function buildUpiAppPayLinks(upiUri: string): UpiAppPayLink[] {
  if (!upiUri.startsWith(UPI_PAY_PREFIX)) return []
  return UPI_APPS.map((app) => ({
    id: app.id,
    label: app.label,
    href: buildNativeAppPayHref(app.id, upiUri),
  }))
}

export function appLabel(app: UpiAppId): string {
  return UPI_APPS.find((a) => a.id === app)?.label ?? app
}
