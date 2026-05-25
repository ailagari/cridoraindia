import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DashboardMobileSubNav } from '@/components/DashboardMobileSubNav'
import { NavHubIcon } from '@/components/NavHubIcon'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { DashboardMobileUserMenu } from '@/components/DashboardMobileUserMenu'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth, type AuthUser } from '@/context/AuthContext'
import { userAvatarFallback, userAvatarImageFit, userAvatarImageUrl } from '@/lib/userAvatar'
import type { DashboardNavGroup } from '@/lib/mobileNav/types'

export type { DashboardNavItem, DashboardNavGroup } from '@/lib/mobileNav/types'

const ROLE_META: Record<'customer' | 'jeweller' | 'admin', { badge: string }> = {
  customer: { badge: 'Saver' },
  jeweller: { badge: 'Jeweller' },
  admin: { badge: 'Cridora admin' },
}

const ROLE_SUB: Record<'customer' | 'jeweller' | 'admin', string> = {
  customer: 'Customer Portal',
  jeweller: 'Jeweller Desk',
  admin: 'Operations',
}

const DEFAULT_DASHBOARD_HREF: Record<'customer' | 'jeweller' | 'admin', string> = {
  customer: '/userdashboard',
  jeweller: '/dashboard/jeweller',
  admin: '/dashboard/admin',
}

function jewellerSidebarDisplayName(user: AuthUser): string {
  const biz = user.business_name.trim()
  if (biz) return biz
  const personal = `${user.first_name} ${user.last_name}`.trim()
  if (personal) return personal
  return user.email
}

function findGroupForSection(groups: DashboardNavGroup[], section: string): DashboardNavGroup | undefined {
  return groups.find((g) => g.items.some((i) => i.sectionKey === section))
}

type Props = {
  navGroups: DashboardNavGroup[]
  activeSection: string
  onSectionChange: (key: string) => void
  title: string
  role: 'customer' | 'jeweller' | 'admin'
  children: ReactNode
}

export function DashboardLayout({
  navGroups,
  activeSection,
  onSectionChange,
  title,
  role,
  children,
}: Props) {
  const dashLogoGradBase = useId().replace(/:/g, '')
  const dashLogoGradSidebar = `${dashLogoGradBase}-sb`
  const dashLogoGradTopbar = `${dashLogoGradBase}-tb`
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const meta = ROLE_META[role]

  const activeGroup = useMemo(
    () => findGroupForSection(navGroups, activeSection) ?? navGroups[0],
    [navGroups, activeSection],
  )

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/')
    setMobileOpen(false)
  }, [logout, navigate])

  const pickSection = useCallback(
    (key: string) => {
      onSectionChange(key)
      setMobileOpen(false)
    },
    [onSectionChange],
  )

  const pickHub = useCallback(
    (g: DashboardNavGroup) => {
      const first = g.items[0]?.sectionKey
      if (first) pickSection(first)
    },
    [pickSection],
  )

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const crumbPieces = title.split(' · ')
  const crumbLead = crumbPieces[0] ?? title
  const crumbRest = crumbPieces.length >= 2 ? crumbPieces.slice(1).join(' · ') : null
  const dashHomeHref = DEFAULT_DASHBOARD_HREF[role]

  return (
    <div className="ref-dash-shell shell">
      {mobileOpen ? (
        <button
          type="button"
          className="overlay is-open"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`sidebar${mobileOpen ? ' is-open' : ''}`}>
        <div className="sb-logo">
          <Link
            to="/"
            className="sb-logo-dash-link"
            onClick={() => setMobileOpen(false)}
          >
            <div className="sb-mark" aria-hidden>
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" stroke={`url(#${dashLogoGradSidebar})`} strokeWidth="2.5" />
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
                  <linearGradient id={dashLogoGradSidebar} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e0bc78" />
                    <stop offset="55%" stopColor="#a67a28" />
                    <stop offset="100%" stopColor="#5c2f0a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="sb-brand">
              <div className="sb-name">
                Cridor<span className="dash-brand-aindia">aindia</span>
              </div>
              <div className="sb-sub">{ROLE_SUB[role]}</div>
            </div>
          </Link>
          {mobileOpen ? (
            <button type="button" className="sb-close-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="sb-user">
          <UserAvatar
            className="dash-avatar av"
            imageUrl={user ? userAvatarImageUrl(user) : ''}
            fallback={user ? userAvatarFallback(user) : 'U'}
            imageFit={user ? userAvatarImageFit(user) : 'cover'}
            style={{ borderColor: 'var(--gold-hi)', color: 'var(--gold-hi)' }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="sb-user-name">
              {!user ? null : role === 'jeweller' ? jewellerSidebarDisplayName(user) : (
                <>{user.first_name} {user.last_name}</>
              )}
            </div>
            <div className="sb-badge">{meta.badge}</div>
          </div>
        </div>

        <nav className="sb-nav" aria-label="Dashboard sections">
          {navGroups.map((g) => (
            <div key={g.id}>
              <div className="sb-group">{g.label}</div>
              {g.items.map((item) => {
                const isActive = item.sectionKey === activeSection
                return (
                  <button
                    key={item.sectionKey}
                    type="button"
                    className={`sb-item${isActive ? ' is-active' : ''}`}
                    onClick={() => pickSection(item.sectionKey)}
                  >
                    <span className="sb-icon" aria-hidden="true">
                      <NavHubIcon icon={g.icon} active={isActive} />
                    </span>
                    {item.label}
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <span className="dash-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sb-foot">
          <button type="button" className="sb-foot-btn" onClick={handleLogout}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden width={13} height={13}>
              <path d="M13 3h4v14h-4M8 13l4-3-4-3M2 10h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
          <Link className="sb-foot-btn" to="/">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden width={13} height={13}>
              <path d="M10 3H3v14h14v-7M14 2h4v4M10 10l8-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Public site
          </Link>
        </div>
      </aside>

      <div className="col">
        <header className="topbar">
          <button
            type="button"
            className="tb-burger"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <Link className="tb-logo-m" to={dashHomeHref} title="Dashboard home">
            <div className="sb-mark dash-tb-logo-mark" aria-hidden>
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" stroke={`url(#${dashLogoGradTopbar})`} strokeWidth="2.5" />
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
                  <linearGradient id={dashLogoGradTopbar} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e0bc78" />
                    <stop offset="55%" stopColor="#a67a28" />
                    <stop offset="100%" stopColor="#5c2f0a" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="tb-logo-name">
              Cridor<span className="dash-brand-aindia">aindia</span>
            </span>
          </Link>

          <div className="tb-crumb">
            {crumbRest ? (
              <>
                <span>{crumbLead}</span>
                <span className="sep">›</span>
                <span className="cur">{crumbRest}</span>
              </>
            ) : (
              <span className="cur">{title}</span>
            )}
          </div>

          {role === 'customer' ? <GoldTickerStrip variant="customer" /> : null}

          <span className="dash-mobile-username" title={user?.first_name?.trim() || undefined}>
            {user?.first_name?.trim() || 'Account'}
          </span>

          <div className="tb-end">
            <div className="dash-mobile-actions">
              <NotificationBell compact role={role} />
              <DashboardMobileUserMenu onLogout={handleLogout} />
            </div>
            <div className="dash-topbar-right">
              {role === 'jeweller' ? <GoldTickerStrip variant="jeweller" /> : null}
              {role === 'admin' ? <GoldTickerStrip variant="admin" /> : null}
              <NotificationBell compact role={role} />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {role === 'jeweller' || role === 'admin' ? (
          <div className="dash-topbar-mobile-ticker">
            {role === 'jeweller' ? <GoldTickerStrip variant="jeweller" /> : null}
            {role === 'admin' ? <GoldTickerStrip variant="admin" /> : null}
          </div>
        ) : null}

        <DashboardMobileSubNav items={activeGroup.items} activeSection={activeSection} onPick={pickSection} />

        <main className="main dash-content dash-content--with-bottom">{children}</main>
      </div>

      <nav className="bnav" aria-label="Primary sections">
        <div className="bnav-inner">
          {navGroups.map((g) => {
            const inGroup = g.items.some((i) => i.sectionKey === activeSection)
            return (
              <button
                key={g.id}
                type="button"
                className={`btab${inGroup ? ' is-active' : ''}`}
                onClick={() => pickHub(g)}
              >
                <span className="mobile-tab-ico" aria-hidden="true">
                  <NavHubIcon icon={g.icon} active={inGroup} />
                </span>
                <span className="mobile-tab-label">{g.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
