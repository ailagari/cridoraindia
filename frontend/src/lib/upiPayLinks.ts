const UPI_PAY_PREFIX = 'upi://pay?'
/** NPCI initiation mode: intent handoff (not QR / gallery scan). */
const UPI_INTENT_MODE = '04'
const UPI_MERCHANT_ORG_ID = '000000'

export type UpiAppPayLink = {
  id: 'phonepe' | 'gpay' | 'paytm'
  label: string
  href: string
}

function isAndroidUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function appendParam(uri: string, key: string, value: string): string {
  if (new RegExp(`([?&])${key}=`).test(uri)) {
    return uri.replace(new RegExp(`([?&])${key}=[^&]*`), `$1${key}=${value}`)
  }
  return `${uri}&${key}=${value}`
}

/** NPCI-compliant URI for mobile browser intent handoff. */
export function upiUriForIntent(uri: string): string {
  if (!uri.startsWith(UPI_PAY_PREFIX)) return uri
  let out = appendParam(uri, 'mode', UPI_INTENT_MODE)
  out = appendParam(out, 'orgid', UPI_MERCHANT_ORG_ID)
  return out
}

function payQueryFromUri(uri: string): string | null {
  if (!uri.startsWith(UPI_PAY_PREFIX)) return null
  return uri.slice(UPI_PAY_PREFIX.length)
}

/** Generic Android intent — opens the system UPI app chooser. */
export function buildAndroidGenericUpiHref(uri: string): string | null {
  const query = payQueryFromUri(upiUriForIntent(uri))
  if (!query) return null
  return `intent://pay?${query}#Intent;scheme=upi;end`
}

/** Android intent targeting one installed UPI app (avoids gallery-QR handling in some PSPs). */
export function buildAndroidAppUpiHref(uri: string, packageName: string, storeUrl: string): string | null {
  const query = payQueryFromUri(upiUriForIntent(uri))
  if (!query) return null
  const fallback = encodeURIComponent(storeUrl)
  return `intent://pay?${query}#Intent;scheme=upi;package=${packageName};S.browser_fallback_url=${fallback};end`
}

const ANDROID_UPI_APPS = [
  {
    id: 'phonepe',
    label: 'PhonePe',
    packageName: 'com.phonepe.app',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app',
  },
  {
    id: 'gpay',
    label: 'GPay',
    packageName: 'com.google.android.apps.nbu.paisa.user',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    packageName: 'net.one97.paytm',
    storeUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm',
  },
] as const

export function buildMobileUpiPayHref(uri: string): string {
  if (isAndroidUserAgent()) {
    return buildAndroidGenericUpiHref(uri) ?? upiUriForIntent(uri)
  }
  return upiUriForIntent(uri)
}

export function buildUpiAppPayLinks(uri: string): UpiAppPayLink[] {
  const intentUri = upiUriForIntent(uri)
  return ANDROID_UPI_APPS.flatMap((app) => {
    const href = isAndroidUserAgent()
      ? buildAndroidAppUpiHref(uri, app.packageName, app.storeUrl)
      : intentUri
    if (!href) return []
    return [{ id: app.id, label: app.label, href }]
  })
}

/** @deprecated Use buildUpiAppPayLinks */
export function buildAndroidUpiAppLinks(uri: string): UpiAppPayLink[] {
  return buildUpiAppPayLinks(uri)
}

export function isAndroidMobileBrowser(): boolean {
  return isAndroidUserAgent()
}
