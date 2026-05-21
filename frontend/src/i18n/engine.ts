import { enMessages, type MessageKey } from '@/i18n/messages/en'
import { mlMessages } from '@/i18n/messages/ml'
import type { PublicLocale } from '@/i18n/types'

type Vars = Record<string, string | number>

export function translate(locale: PublicLocale, key: MessageKey, vars?: Vars): string {
  const dict = locale === 'ml' ? mlMessages : enMessages
  let text = dict[key] ?? enMessages[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export function readStoredPublicLocale(): PublicLocale {
  if (typeof window === 'undefined') return 'en'
  try {
    const raw = localStorage.getItem('cridora_public_locale')
    return raw === 'ml' ? 'ml' : 'en'
  } catch {
    return 'en'
  }
}

export function persistPublicLocale(locale: PublicLocale): void {
  try {
    localStorage.setItem('cridora_public_locale', locale)
  } catch {
    /* private mode */
  }
}

export function applyDocumentLocale(locale: PublicLocale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale === 'ml' ? 'ml' : 'en'
}
