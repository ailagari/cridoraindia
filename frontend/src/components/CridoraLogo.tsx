import { useId } from 'react'

type Props = {
  size?: 'sm' | 'md' | 'lg' | 'splash'
  showWordmark?: boolean
  className?: string
  /** Pulsating golden drop-shadow (e.g. native Android splash). */
  pulseGlow?: boolean
}

const box = { sm: 36, md: 44, lg: 80, splash: 160 } as const

export function CridoraLogo({
  size = 'sm',
  showWordmark = true,
  className = '',
  pulseGlow = false,
}: Props) {
  const gid = `cg-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const s = box[size]

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}>
      <span
        className={pulseGlow ? 'cridora-logo__mark cridora-logo__mark--pulse' : undefined}
        style={{
          flexShrink: 0,
          width: s,
          height: s,
          display: 'grid',
          placeItems: 'center',
          ...(pulseGlow
            ? {}
            : { filter: 'drop-shadow(0 2px 10px rgba(212, 168, 92, 0.35))' }),
        }}
      >
        <svg width={s} height={s} viewBox="0 0 40 40" fill="none" aria-hidden>
          <circle cx="20" cy="20" r="18" stroke={`url(#${gid})`} strokeWidth="2.5" />
          <path
            d="M14 20C14 16.6863 16.6863 14 20 14"
            stroke="#d4a85c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M26 20C26 23.3137 23.3137 26 20 26"
            stroke="#a67a28"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id={gid} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e0bc78" />
              <stop offset="55%" stopColor="#a67a28" />
              <stop offset="100%" stopColor="#5c2f0a" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {showWordmark ? (
        <span
          style={{
            fontFamily: 'var(--font)',
            fontWeight: 700,
            fontSize: size === 'md' ? '1.2rem' : '1.05rem',
            color: 'var(--text)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          Cridora<span className="cridora-logo__aindia">India</span>
        </span>
      ) : null}
    </span>
  )
}
