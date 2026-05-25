const UPI_PAY_PREFIX = 'upi://pay?'
/** Juspay/NPCI merchant intent uses mode 00 (default txn), not QR scan mode 01/04. */
const UPI_INTENT_MODE = '00'
const UPI_MCC_JEWELLER = '5944'

export type UpiAppId = 'phonepe' | 'gpay' | 'paytm'

export type UpiAppPayLink = {
  id: UpiAppId
  label: string
  href: string
}

type AppIntentConfig = {
  id: UpiAppId
  label: string
  /** Native deep-link scheme (PhonePe, Tez/GPay, Paytm). */
  scheme: string
  /** Path after scheme:// — e.g. pay or upi/pay for GPay. */
  path: string
  packageName: string
  storeUrl: string
}

function isAndroidUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function payQueryFromUri(uri: string): string | null {
  if (!uri.startsWith(UPI_PAY_PREFIX)) return null
  return uri.slice(UPI_PAY_PREFIX.length)
}

function setQueryParam(query: string, key: string, value: string): string {
  const pattern = new RegExp(`(^|&)${key}=[^&]*`)
  if (pattern.test(query)) {
    return query.replace(pattern, `$1${key}=${value}`)
  }
  return `${query}&${key}=${value}`
}

/**
 * Query string for app intent buttons — merchant fields + mode=00.
 * Generic upi:// intent is treated as gallery QR by PhonePe; app-native schemes avoid that.
 */
export function payQueryForAppIntent(uri: string): string | null {
  const raw = payQueryFromUri(uri)
  if (!raw) return null
  let query = setQueryParam(raw, 'mc', UPI_MCC_JEWELLER)
  query = setQueryParam(query, 'mode', UPI_INTENT_MODE)
  query = query.replace(/(^|&)orgid=[^&]*&?/g, '$1').replace(/&&/g, '&').replace(/&$/, '')
  return query
}

/** Chrome Android intent using the PSP native scheme (not generic upi://). */
function buildAndroidAppIntentHref(config: AppIntentConfig, query: string): string {
  const fallback = encodeURIComponent(config.storeUrl)
  return `intent://${config.path}?${query}#Intent;scheme=${config.scheme};package=${config.packageName};S.browser_fallback_url=${fallback};end`
}

function buildAppPayHref(config: AppIntentConfig, query: string): string {
  const nativeHref = `${config.scheme}://${config.path}?${query}`
  if (isAndroidUserAgent()) {
    return buildAndroidAppIntentHref(config, query)
  }
  return nativeHref
}

const UPI_APPS: readonly AppIntentConfig[] = [
  {
    id: 'phonepe',
    label: 'PhonePe',
    scheme: 'phonepe',
    path: 'pay',
    packageName: 'com.phonepe.app',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app',
  },
  {
    id: 'gpay',
    label: 'GPay',
    scheme: 'tez',
    path: 'upi/pay',
    packageName: 'com.google.android.apps.nbu.paisa.user',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    scheme: 'paytmmp',
    path: 'pay',
    packageName: 'net.one97.paytm',
    storeUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm',
  },
]

export function buildUpiAppPayLinks(uri: string): UpiAppPayLink[] {
  const query = payQueryForAppIntent(uri)
  if (!query) return []
  return UPI_APPS.map((app) => ({
    id: app.id,
    label: app.label,
    href: buildAppPayHref(app, query),
  }))
}

export function isAndroidMobileBrowser(): boolean {
  return isAndroidUserAgent()
}
