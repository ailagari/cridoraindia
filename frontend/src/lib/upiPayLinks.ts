const UPI_PAY_PREFIX = 'upi://pay?'

export type UpiAppId = 'phonepe' | 'gpay' | 'paytm'

export type UpiAppPayLink = {
  id: UpiAppId
  label: string
  /** Same-origin handoff — user taps again on a page with the native PSP deep link. */
  href: string
}

export type UpiPayParams = {
  pa: string
  pn: string
  am: string
  tn: string
  tr: string
  cu: string
}

const UPI_APPS: { id: UpiAppId; label: string }[] = [
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'gpay', label: 'GPay' },
  { id: 'paytm', label: 'Paytm' },
]

export function parseUpiPayParams(uri: string): UpiPayParams | null {
  if (!uri.startsWith(UPI_PAY_PREFIX)) return null
  const sp = new URLSearchParams(uri.slice(UPI_PAY_PREFIX.length))
  const pa = sp.get('pa')?.trim() ?? ''
  const am = sp.get('am')?.trim() ?? ''
  if (!pa || !am) return null
  return {
    pa,
    pn: sp.get('pn')?.trim() ?? '',
    am,
    tn: sp.get('tn')?.trim() ?? '',
    tr: sp.get('tr')?.trim() ?? '',
    cu: sp.get('cu')?.trim() || 'INR',
  }
}

function enc(value: string): string {
  return encodeURIComponent(value)
}

/**
 * Minimal P2P-style deep links per PSP docs.
 * Merchant fields (mc, tid, mode) cause PhonePe/GPay to treat browser opens as gallery/static QR.
 */
export function buildNativeAppPayHref(app: UpiAppId, params: UpiPayParams): string {
  const { pa, pn, am, tn, tr, cu } = params
  if (app === 'phonepe') {
    let q = `pa=${enc(pa)}&am=${enc(am)}&cu=${enc(cu)}`
    if (tn) q += `&tn=${enc(tn)}`
    return `phonepe://pay?${q}`
  }
  if (app === 'paytm') {
    let q = `pa=${enc(pa)}&am=${enc(am)}&cu=${enc(cu)}`
    if (tn) q += `&tn=${enc(tn)}`
    return `paytmmp://pay?${q}`
  }
  const gPn = pn || ' '
  const gTr = tr || ' '
  let q = `pa=${enc(pa)}&pn=${enc(gPn)}&am=${enc(am)}&cu=${enc(cu)}&tr=${enc(gTr)}`
  if (tn) q += `&tn=${enc(tn)}`
  return `tez://upi/pay?${q}`
}

export function buildUpiHandoffHref(app: UpiAppId, params: UpiPayParams): string {
  const sp = new URLSearchParams()
  sp.set('app', app)
  sp.set('pa', params.pa)
  sp.set('am', params.am)
  sp.set('cu', params.cu)
  if (params.pn) sp.set('pn', params.pn)
  if (params.tn) sp.set('tn', params.tn)
  if (params.tr) sp.set('tr', params.tr)
  return `/upi/open?${sp.toString()}`
}

export function buildUpiAppPayLinks(uri: string): UpiAppPayLink[] {
  const params = parseUpiPayParams(uri)
  if (!params) return []
  return UPI_APPS.map((app) => ({
    id: app.id,
    label: app.label,
    href: buildUpiHandoffHref(app.id, params),
  }))
}

export function parseHandoffSearchParams(sp: URLSearchParams): { app: UpiAppId; params: UpiPayParams } | null {
  const app = sp.get('app') as UpiAppId | null
  if (app !== 'phonepe' && app !== 'gpay' && app !== 'paytm') return null
  const pa = sp.get('pa')?.trim() ?? ''
  const am = sp.get('am')?.trim() ?? ''
  if (!pa || !am) return null
  return {
    app,
    params: {
      pa,
      pn: sp.get('pn')?.trim() ?? '',
      am,
      tn: sp.get('tn')?.trim() ?? '',
      tr: sp.get('tr')?.trim() ?? '',
      cu: sp.get('cu')?.trim() || 'INR',
    },
  }
}

export function appLabel(app: UpiAppId): string {
  return UPI_APPS.find((a) => a.id === app)?.label ?? app
}
