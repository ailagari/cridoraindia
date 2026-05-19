import { createContext, useContext, useLayoutEffect, useMemo } from 'react'

export type ThemeMode = 'dark'

function applyDarkTheme(): void {
  document.documentElement.dataset.theme = 'dark'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', '#000814')
  }
}

type ThemeContextValue = {
  theme: ThemeMode
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Cridora uses dark mode only on all devices. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    applyDarkTheme()
  }, [])

  const value = useMemo(() => ({ theme: 'dark' as const }), [])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
