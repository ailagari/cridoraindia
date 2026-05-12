import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'

/** Applied to `data-theme` on `<html>` — follows OS / browser color scheme only. */
export type ThemeMode = 'dark' | 'light'

function getSystemPrefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function applyDom(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#e8ecf6' : '#000814')
  }
}

type ThemeContextValue = {
  theme: ThemeMode
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemPrefersLight, setSystemPrefersLight] = useState(() => getSystemPrefersLight())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystemPrefersLight(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: ThemeMode = systemPrefersLight ? 'light' : 'dark'

  useLayoutEffect(() => {
    applyDom(theme)
  }, [theme])

  const value = useMemo(() => ({ theme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
