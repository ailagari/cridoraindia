import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'

/** What the UI looks like (applied to `data-theme` on `<html>`). */
export type ThemeMode = 'dark' | 'light'

/**
 * Stored choice.
 * - `system`: dark by default; uses light theme only when the OS / browser is set to **light** (`prefers-color-scheme: light`).
 * - `light` / `dark`: always that appearance (same palettes as system-resolved light/dark).
 */
export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'cridora_theme'

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

function persistPreference(p: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, p)
  } catch {
    /* ignore */
  }
}

/** True only when the user agent reports an explicit light color scheme. */
function getSystemPrefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): ThemeMode {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return systemPrefersLight ? 'light' : 'dark'
}

function applyDom(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#e8ecf6' : '#000814')
  }
}

type ThemeContextValue = {
  /** Effective light/dark (after resolving `system`). */
  theme: ThemeMode
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  /** Cycles: system → light → dark → system */
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [systemPrefersLight, setSystemPrefersLight] = useState(() => getSystemPrefersLight())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystemPrefersLight(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme = resolveTheme(preference, systemPrefersLight)

  useLayoutEffect(() => {
    applyDom(theme)
  }, [theme])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    persistPreference(p)
  }, [])

  const cycleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const next: ThemePreference = prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'
      persistPreference(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, preference, setPreference, cycleTheme }),
    [theme, preference, setPreference, cycleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
