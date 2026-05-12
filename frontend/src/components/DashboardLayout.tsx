import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CridoraLogo } from '@/components/CridoraLogo'
import { NavHubIcon } from '@/components/NavHubIcon'
import { GoldTickerStrip } from '@/components/GoldTickerStrip'
import { NotificationBell } from '@/components/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import type { DashboardNavGroup } from '@/lib/mobileNav/types'

export type { DashboardNavItem, DashboardNavGroup } from '@/lib/mobileNav/types'

const ROLE_META: Record<
  'customer' | 'jeweller' | 'admin',
  { badge: string; accentVar: string }
> = {
  customer: { badge: 'Saver', accentVar: 'var(--dash-copper)' },
  jeweller: { badge: 'Jeweller', accentVar: 'var(--dash-silver-tone)' },
  admin: { badge: 'Cridora admin', accentVar: 'var(--gold-light)' },
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
                    style={{
                      ...(navActive ? { borderColor: meta.accentVar, color: meta.accentVar } : {}),
                    }}
                    onClick={() => pickSection(item.sectionKey)}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      )
    },
    [accordionOpen, activeSection, meta.accentVar, pickSection, role, toggleAccordion],
  )

  const initial = user?.first_name?.[0] ?? user?.email?.[0] ?? 'U'

  return (
    <div className={`dash-shell dash-shell--${role}`}>
      {mobileOpen ? (
        <button
          type="button"
          className="dash-overlay"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`dash-sidebar${mobileOpen ? ' dash-sidebar--open' : ''}`}>
        <div className="dash-sidebar-head">
          <Link to="/" className="dash-logo-wrap" onClick={() => setMobileOpen(false)}>
            <CridoraLogo size="sm" />
          </Link>
          {mobileOpen ? (
            <button type="button" className="btn btn-ghost dash-close" onClick={() => setMobileOpen(false)}>
              Close
            </button>
          ) : null}
        </div>

        <div className="dash-user-card">
          <div className="dash-avatar" style={{ borderColor: meta.accentVar, color: meta.accentVar }}>
            {initial}
          </div>
          <div className="dash-user-text">
            <div className="dash-user-name">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="dash-user-role" style={{ color: meta.accentVar }}>
              {meta.badge}
            </div>
          </div>
        </div>

        <nav className="dash-side-nav" aria-label="Dashboard sections">
          {navGroups.map(renderSidebarAccordion)}
        </nav>

        <div className="dash-side-foot">
          <button type="button" className="dash-logout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button
              type="button"
              className="btn btn-ghost dash-hamburger"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <h1 className="dash-topbar-title">{title}</h1>
          </div>
          <div className="dash-topbar-right" style={{ alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {(role === 'jeweller' || role === 'admin') ? <GoldTickerStrip variant="dash" /> : null}
            <NotificationBell compact />
            <Link to="/" className="dash-public-link">
              Public site
            </Link>
          </div>
        </header>

        <div className="dash-hub-tabs" aria-label="Subsections">
          {activeGroup.items.map((item) => {
            const active = item.sectionKey === activeSection
            return (
              <button
                key={item.sectionKey}
                type="button"
                className={'dash-hub-pill' + (active ? ' dash-hub-pill--active' : '')}
                style={active ? { borderColor: meta.accentVar, color: meta.accentVar } : undefined}
                onClick={() => pickSection(item.sectionKey)}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <main className="dash-content dash-content--with-bottom">{children}</main>
      </div>

      <nav className="dash-bottom-nav" aria-label="Primary sections">
        {navGroups.map((g) => {
          const inGroup = g.items.some((i) => i.sectionKey === activeSection)
          return (
            <button
              key={g.id}
              type="button"
              className={'dash-bottom-item' + (inGroup ? ' dash-bottom-item--active' : '')}
              onClick={() => pickHub(g)}
            >
              <span className="mobile-tab-ico" style={{ color: inGroup ? meta.accentVar : undefined }}>
                <NavHubIcon icon={g.icon} active={inGroup} />
              </span>
              <span className="mobile-tab-label">{g.shortLabel}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
