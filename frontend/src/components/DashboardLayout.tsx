import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
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

type Props = {
  navGroups: DashboardNavGroup[]
  activeSection: string
  onSectionChange: (key: string) => void
  title: string
  role: 'customer' | 'jeweller' | 'admin'
  children: ReactNode
}

function findGroupForSection(groups: DashboardNavGroup[], section: string): DashboardNavGroup | undefined {
  return groups.find((g) => g.items.some((i) => i.sectionKey === section))
}

function initialAccordionOpen(groups: DashboardNavGroup[], section: string): Record<string, boolean> {
  const ag = findGroupForSection(groups, section)
  const m: Record<string, boolean> = {}
  for (const g of groups) {
    m[g.id] = ag?.id === g.id
  }
  return m
}

export function DashboardLayout({
  navGroups,
  activeSection,
  onSectionChange,
  title,
  role,
  children,
}: Props) {
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

  const [accordionOpen, setAccordionOpen] = useState(() => initialAccordionOpen(navGroups, activeSection))

  useEffect(() => {
    const ag = findGroupForSection(navGroups, activeSection)
    if (!ag) return
    setAccordionOpen(initialAccordionOpen(navGroups, activeSection))
  }, [activeSection, navGroups])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const toggleAccordion = useCallback(
    (groupId: string) => {
      setAccordionOpen((prev) => {
        const wasOpen = prev[groupId] ?? false
        if (wasOpen) {
          return { ...prev, [groupId]: false }
        }
        const next: Record<string, boolean> = {}
        for (const g of navGroups) {
          next[g.id] = g.id === groupId
        }
        return next
      })
    },
    [navGroups],
  )

  const renderSidebarAccordion = useCallback(
    (g: DashboardNavGroup) => {
      const sole = g.items.length === 1 ? g.items[0] : null
      if (sole) {
        const navActive = sole.sectionKey === activeSection
        return (
          <button
            key={g.id}
            type="button"
            className={'dash-side-acc-trigger dash-side-acc-trigger--solo' + (navActive ? ' dash-side-acc-trigger--solo-active' : '')}
            onClick={() => pickSection(sole.sectionKey)}
          >
            <span className="dash-side-acc-trigger-label">
              <span className="dash-side-acc-ico" aria-hidden="true">
                <NavHubIcon icon={g.icon} active={navActive} />
              </span>
              {g.label}
            </span>
          </button>
        )
      }
      const open = accordionOpen[g.id] ?? false
      const panelId = `dash-acc-${role}-${g.id}`
      const hubActive = g.items.some((i) => i.sectionKey === activeSection)
      return (
        <div key={g.id} className={`dash-side-acc${open ? ' dash-side-acc--open' : ''}`}>
          <button
            type="button"
            className="dash-side-acc-trigger"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => toggleAccordion(g.id)}
          >
            <span className="dash-side-acc-trigger-label">
              <span className="dash-side-acc-ico" aria-hidden="true">
                <NavHubIcon icon={g.icon} active={hubActive} />
              </span>
              {g.label}
            </span>
            <span className={`dash-side-acc-chev${open ? ' dash-side-acc-chev--open' : ''}`} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {open ? (
            <div className="dash-side-acc-panel" id={panelId} role="region">
              {g.items.map((item) => {
                const navActive = item.sectionKey === activeSection
                return (
                  <button
                    key={item.sectionKey}
                    type="button"
                    className={'dash-side-btn' + (navActive ? ' dash-side-btn--active' : '')}
                    onClick={() => pickSection(item.sectionKey)}
                  >
                    <span className="dash-side-btn-label">{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <span className="dash-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      )
    },
    [accordionOpen, activeSection, pickSection, role, toggleAccordion],
  )

  const avatarUser = user

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
              <svg viewBox="0 0 20 20" fill="none" width={16} height={16}>
                <circle cx="10" cy="10" r="7.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.2" />
                <path
                  d="M7.5 10.5C7.5 8.84 8.84 7.5 10.5 7.5"
                  stroke="#fff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M12.5 9.5C12.5 11.16 11.16 12.5 9.5 12.5"
                  stroke="rgba(255,255,255,.65)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="sb-brand">
              <div className="sb-name">Cridora India</div>
              <div className="sb-sub">{ROLE_SUB[role]}</div>
            </div>
          </Link>
          {mobileOpen ? (
            <button type="button" className="btn btn-ghost dash-close" onClick={() => setMobileOpen(false)}>
              Close
            </button>
          ) : null}
        </div>

        <div className="sb-user">
          <UserAvatar
            className="dash-avatar"
            imageUrl={avatarUser ? userAvatarImageUrl(avatarUser) : ''}
            fallback={avatarUser ? userAvatarFallback(avatarUser) : 'U'}
            imageFit={avatarUser ? userAvatarImageFit(avatarUser) : 'cover'}
            style={{ borderColor: 'var(--gold-hi)', color: 'var(--gold-hi)' }}
          />
          <div>
            <div className="sb-user-name">
              {!user ? null : role === 'jeweller' ? jewellerSidebarDisplayName(user) : (
                <>
                  {user.first_name} {user.last_name}
                </>
              )}
            </div>
            <div className="sb-badge">{meta.badge}</div>
          </div>
        </div>

        <nav className="sb-nav" aria-label="Dashboard sections">
          {navGroups.map(renderSidebarAccordion)}
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
            <div className="sb-mark" style={{ width: 28, height: 28, borderRadius: 7 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="7.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.2" />
                <path d="M7.5 10.5C7.5 8.84 8.84 7.5 10.5 7.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
                <path
                  d="M12.5 9.5C12.5 11.16 11.16 12.5 9.5 12.5"
                  stroke="rgba(255,255,255,.65)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="tb-logo-name">Cridora</span>
          </Link>

          <div className="tb-crumb" aria-hidden={false}>
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
              <Link to="/" className="dash-public-link">
                Public site
              </Link>
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
                className={'btab' + (inGroup ? ' is-active' : '')}
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
