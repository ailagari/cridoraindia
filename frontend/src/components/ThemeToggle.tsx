import { useTheme } from '@/context/ThemeContext'

/** Set `false` to hide the theme switch in headers. */
export const THEME_TOGGLE_ENABLED = true

export function ThemeToggle({ className }: { className?: string }) {
  if (!THEME_TOGGLE_ENABLED) return null
  return <ThemeToggleButton className={className} />
}

function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      className={['tt', className].filter(Boolean).join(' ')}
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={!isDark}
      title={label}
    >
      <span className="tt-k tt-knob" aria-hidden>
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
      />
    </svg>
  )
}
