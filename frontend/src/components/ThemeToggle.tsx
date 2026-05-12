import { useTheme } from '@/context/ThemeContext'

type Props = { compact?: boolean }

export function ThemeToggle({ compact = false }: Props) {
  const { theme, preference, cycleTheme } = useTheme()
  const isLight = theme === 'light'

  const modeLabel =
    preference === 'system'
      ? `Match device (light UI only when device/browser is set to light — now ${isLight ? 'light' : 'dark'})`
      : preference === 'light'
        ? 'Light (always)'
        : 'Dark (always)'
  const nextHint =
    preference === 'system'
      ? 'Next: always light'
      : preference === 'light'
        ? 'Next: always dark'
        : 'Next: match device'

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}${
        preference === 'system' ? ' theme-toggle--auto' : ''
      }`}
      onClick={cycleTheme}
      aria-label={`${modeLabel}. ${nextHint}.`}
      title={`${modeLabel}. Click: device → always light → always dark.`}
    >
      {isLight ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 14.5A8.5 8.5 0 0 1 9.5 3a8.5 8.5 0 1 0 11.5 11.5Z"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="4" strokeLinecap="round" />
          <path
            strokeLinecap="round"
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      )}
    </button>
  )
}
