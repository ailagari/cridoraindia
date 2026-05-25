import { useTheme } from '@/context/ThemeContext'

export function ThemeToggle({ className }: { className?: string }) {
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
