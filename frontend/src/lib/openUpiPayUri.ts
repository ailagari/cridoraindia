import { isNativeAndroid } from '@/lib/capacitorPlatform'

function isAndroidUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/** Build Android intent URL from a standard `upi://pay?...` link (opens UPI app chooser). */
export function upiUriToAndroidIntent(uri: string): string | null {
  const prefix = 'upi://pay?'
  if (!uri.startsWith(prefix)) return null
  const query = uri.slice(prefix.length)
  return `intent://pay?${query}#Intent;scheme=upi;end`
}

/** Open a UPI pay link — uses Android intent on mobile for reliable app handoff. */
export function openUpiPayUri(uri: string): void {
  if (isNativeAndroid() || isAndroidUserAgent()) {
    const intent = upiUriToAndroidIntent(uri)
    if (intent) {
      window.location.href = intent
      return
    }
  }
  window.location.href = uri
}
