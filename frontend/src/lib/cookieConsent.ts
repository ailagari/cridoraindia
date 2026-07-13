const STORAGE_KEY = 'cridora-cookie-consent'

export type CookieConsentChoice = 'accepted' | 'essential'

export function readCookieConsent(): CookieConsentChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'accepted' || value === 'essential') return value
  } catch {
    /* private mode */
  }
  return null
}

export function writeCookieConsent(choice: CookieConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    /* private mode */
  }
}

export function hasCookieConsent(): boolean {
  return readCookieConsent() !== null
}
