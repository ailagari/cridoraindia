import type { DashboardNavGroup } from '@/lib/mobileNav/types'

type HubIcon = DashboardNavGroup['icon']

const common = { xmlns: 'http://www.w3.org/2000/svg', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.85, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function NavHubIcon({ icon, active }: { icon: HubIcon; active: boolean }) {
  const opacity = active ? 1 : 0.55
  const c = active ? 'currentColor' : 'currentColor'
  switch (icon) {
    case 'home':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <path d="M5 10.5 12 5l7 5.5V19a1 1 0 0 1-1 1h-4.5v-5H10.5v5H6a1 1 0 0 1-1-1z" stroke={c} />
        </svg>
      )
    case 'shop':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <path d="M5 8h14l-1.2 9.1A2 2 0 0 1 15.8 19H8.2a2 2 0 0 1-1.99-1.9z" stroke={c} />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={c} />
        </svg>
      )
    case 'portfolio':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <circle cx="12" cy="10" r="3" stroke={c} />
          <path d="M5 18c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" stroke={c} />
        </svg>
      )
    case 'profile':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <circle cx="12" cy="8.5" r="3" stroke={c} />
          <path d="M6.5 18.5c.8-2.2 2.7-3.5 5.5-3.5 2.8 0 4.7 1.3 5.5 3.5" stroke={c} />
        </svg>
      )
    case 'grid':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <rect x="5" y="5" width="6" height="6" rx="1" stroke={c} />
          <rect x="13" y="5" width="6" height="6" rx="1" stroke={c} />
          <rect x="5" y="13" width="6" height="6" rx="1" stroke={c} />
          <rect x="13" y="13" width="6" height="6" rx="1" stroke={c} />
        </svg>
      )
    case 'invest':
    case 'coins':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <circle cx="9" cy="12" r="4" stroke={c} />
          <circle cx="15" cy="12" r="4" stroke={c} />
        </svg>
      )
    case 'users':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <circle cx="9" cy="9" r="2.5" stroke={c} />
          <circle cx="15" cy="9" r="2.5" stroke={c} />
          <path d="M5 18c.5-2 2.2-3.2 4-3.2 1.2 0 2.3.5 3 1.2.7-.7 1.8-1.2 3-1.2 1.8 0 3.5 1.2 4 3.2" stroke={c} />
        </svg>
      )
    case 'building':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <path d="M8 19V6.5L12 5l4 1.5V19" stroke={c} />
          <path d="M8 10h8M8 14h8" stroke={c} />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <circle cx="12" cy="12" r="7" stroke={c} />
          <path d="M5 12h14M12 5c2.5 2.2 3.5 5.2 3.5 7s-1 4.8-3.5 7M12 5c-2.5 2.2-3.5 5.2-3.5 7s1 4.8 3.5 7" stroke={c} />
        </svg>
      )
    case 'redeem':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <path d="M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4" stroke={c} />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <path d="M12 4 6 6.5v5.2c0 3.8 2.3 7.3 6 8.3 3.7-1 6-4.5 6-8.3V6.5z" stroke={c} />
          <path d="m9 12 2 2 4-4" stroke={c} />
        </svg>
      )
    case 'bell':
    default:
      return (
        <svg {...common} width={24} height={24} style={{ opacity }}>
          <path d="M12 6a4 4 0 0 0-4 4v3l-1.5 2.5h11L16 13v-3a4 4 0 0 0-4-4" stroke={c} />
          <path d="M10 18a2 2 0 0 0 4 0" stroke={c} />
        </svg>
      )
  }
}
