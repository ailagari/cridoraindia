import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  applyDocumentLocale,
  persistPublicLocale,
  readStoredPublicLocale,
  translate,
} from '@/i18n/engine'
import type { MessageKey } from '@/i18n/messages/en'
import type { PublicLocale } from '@/i18n/types'
import { isGoldRatesPath, stripMlPrefix, withMlPrefix } from '@/lib/goldRatesPaths'

type PublicLocaleContextValue = {
  locale: PublicLocale
  setLocale: (locale: PublicLocale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const PublicLocaleContext = createContext<PublicLocaleContextValue | null>(null)

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>(() => {
    const initial = readStoredPublicLocale()
    applyDocumentLocale(initial)
    return initial
  })

  const setLocale = useCallback((next: PublicLocale) => {
    setLocaleState(next)
    persistPublicLocale(next)
    applyDocumentLocale(next)
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>
}

export function usePublicLocale(): PublicLocaleContextValue {
  const ctx = useContext(PublicLocaleContext)
  if (!ctx) {
    throw new Error('usePublicLocale must be used within PublicLocaleProvider')
  }
  return ctx
}

/** Safe outside public layout — returns English no-op setter. */
export function useOptionalPublicLocale(): PublicLocaleContextValue {
  const ctx = useContext(PublicLocaleContext)
  return useMemo(
    () =>
      ctx ?? {
        locale: 'en' as const,
        setLocale: () => {},
        t: (key, vars) => translate('en', key, vars),
      },
    [ctx],
  )
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = usePublicLocale()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const switchTo = (next: PublicLocale) => {
    setLocale(next)
    if (isGoldRatesPath(pathname)) {
      const target = next === 'ml' ? withMlPrefix(pathname) : stripMlPrefix(pathname)
      if (target !== pathname) navigate(target)
    }
  }

  return (
    <div className={className ?? 'public-lang-switch'} role="group" aria-label="Language">
      <button
        type="button"
        className={`public-lang-switch__btn${locale === 'en' ? ' public-lang-switch__btn--active' : ''}`}
        aria-pressed={locale === 'en'}
        onClick={() => switchTo('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={`public-lang-switch__btn${locale === 'ml' ? ' public-lang-switch__btn--active' : ''}`}
        aria-pressed={locale === 'ml'}
        onClick={() => switchTo('ml')}
      >
        ML
      </button>
    </div>
  )
}
