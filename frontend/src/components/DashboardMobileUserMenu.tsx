import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

function initials(user: { first_name: string; last_name: string; email: string }): string {
  const a = user.first_name.trim().charAt(0)
  const b = user.last_name.trim().charAt(0)
  if (a || b) return `${a}${b}`.toUpperCase() || '?'
  return user.email.trim().charAt(0).toUpperCase() || '?'
}

type Props = {
  onLogout: () => void | Promise<void>
}

export function DashboardMobileUserMenu({ onLogout }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={wrapRef} className="dash-mobile-user-menu">
      <button
        type="button"
        className="dash-mobile-user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? 'Close account menu' : 'Open account menu'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dash-mobile-user-menu__avatar" aria-hidden>
          {user ? initials(user) : '?'}
        </span>
      </button>
      {open ? (
        <div className="dash-mobile-user-menu__panel" role="menu">
          <Link to="/" role="menuitem" className="dash-mobile-user-menu__item" onClick={() => setOpen(false)}>
            Public site
          </Link>
          <button
            type="button"
            role="menuitem"
            className="dash-mobile-user-menu__item dash-mobile-user-menu__item--btn"
            onClick={async () => {
              setOpen(false)
              await onLogout()
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
