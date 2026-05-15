type Tab = 'home' | 'discover' | 'shop' | 'join' | 'dashboard' | 'account'

const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg' as const,
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function PublicTabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const style = { opacity: active ? 1 : 0.55 }
  switch (tab) {
    case 'home':
      return (
        <svg {...svgBase} style={style}>
          <path d="M5 10.5 12 5l7 5.5V19a1 1 0 0 1-1 1h-4.5v-5H10.5v5H6a1 1 0 0 1-1-1z" />
        </svg>
      )
    case 'discover':
      return (
        <svg {...svgBase} style={style}>
          <path d="M12 2.5 14.4 9.1 21.2 9.9 15.6 14.7 17.5 21.5 12 17.6 6.5 21.5 8.4 14.7 2.8 9.9 9.6 9.1z" />
        </svg>
      )
    case 'shop':
      return (
        <svg {...svgBase} style={style}>
          <path d="M5 8h14l-1.2 9.1A2 2 0 0 1 15.8 19H8.2a2 2 0 0 1-1.99-1.9z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      )
    case 'join':
      return (
        <svg {...svgBase} style={style}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      )
    case 'dashboard':
      return (
        <svg {...svgBase} style={style}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="11" width="7" height="10" rx="1.5" />
          <rect x="3" y="15" width="7" height="6" rx="1.5" />
        </svg>
      )
    case 'account':
      return (
        <svg {...svgBase} style={style}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      )
  }
}
