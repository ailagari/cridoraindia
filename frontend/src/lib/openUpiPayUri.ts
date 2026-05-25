import { isNativeAndroid } from '@/lib/capacitorPlatform'

const UPI_PAY_PREFIX = 'upi://pay?'
/** NPCI initiation mode: intent handoff (not QR / gallery scan). */
const UPI_INTENT_MODE = '04'

function isAndroidUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/** Ensure `mode=04` so PSP apps treat this as an intent payment, not gallery QR. */
export function upiUriForIntent(uri: string): string {
  if (!uri.startsWith(UPI_PAY_PREFIX)) return uri
  if (/([?&])mode=/.test(uri)) {
    return uri.replace(/([?&])mode=[^&]*/, `$1mode=${UPI_INTENT_MODE}`)
  }
  return `${uri}&mode=${UPI_INTENT_MODE}`
}

/** Build Android intent URL from a standard `upi://pay?...` link (opens UPI app chooser). */
export function upiUriToAndroidIntent(uri: string): string | null {
  if (!uri.startsWith(UPI_PAY_PREFIX)) return null
  const query = uri.slice(UPI_PAY_PREFIX.length)
  return `intent://pay?${query}#Intent;scheme=upi;end`
}

function openCustomScheme(url: string): void {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener noreferrer'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** Open a UPI pay link with intent mode for reliable PSP handoff on mobile. */
export function openUpiPayUri(uri: string): void {
  const intentUri = upiUriForIntent(uri)

  if (isNativeAndroid() || isAndroidUserAgent()) {
    openCustomScheme(intentUri)
    return
  }

  window.location.href = intentUri
}
