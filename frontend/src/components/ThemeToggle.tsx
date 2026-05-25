import { useTheme } from '@/context/ThemeContext'

/** Set `true` to show the theme switch in headers again (layouts keep `<ThemeToggle />`). */
export const THEME_TOGGLE_ENABLED = false

export function ThemeToggle({ className }: { className?: string }) {
  if (!THEME_TOGGLE_ENABLED) return null
  return <ThemeToggleButton className={className} />
}

function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  const label =
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      className={['tt', className].filter(Boolean).join(' ')}
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === 'light'}
    >
      <span className="tt-k" aria-hidden />
    </button>
  )
}
