import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'
import { userAvatarFallback, userAvatarImageFit, userAvatarImageUrl } from '@/lib/userAvatar'

export function PublicMobileUserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
    <div ref={wrapRef} className="public-mobile-user-menu">
      <button
        type="button"
        className="public-mobile-user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? 'Close account menu' : 'Open account menu'}
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar
          className="public-mobile-user-menu__avatar"
          imageUrl={user ? userAvatarImageUrl(user) : ''}
          fallback={user ? userAvatarFallback(user) : '?'}
          imageFit={user ? userAvatarImageFit(user) : 'cover'}
        />
      </button>
      {open ? (
        <div className="public-mobile-user-menu__panel" role="menu">
          <Link to="/" role="menuitem" className="public-mobile-user-menu__item" onClick={() => setOpen(false)}>
            Public site
          </Link>
          {user ? (
            <Link
              to={dashboardLandingPath(user)}
              role="menuitem"
              className="public-mobile-user-menu__item"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
          ) : (
            <Link to="/login" role="menuitem" className="public-mobile-user-menu__item" onClick={() => setOpen(false)}>
              Log in
            </Link>
          )}
          {user ? (
            <button
              type="button"
              role="menuitem"
              className="public-mobile-user-menu__item public-mobile-user-menu__item--btn"
              onClick={async () => {
                setOpen(false)
                await logout()
                navigate('/')
              }}
            >
              Log out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
