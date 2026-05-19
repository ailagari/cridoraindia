import type { AuthUser } from '@/context/AuthContext'

export function userAvatarImageUrl(user: AuthUser): string {
  if (user.user_type === 'jeweller') return user.logo_url.trim()
  return user.profile_photo_url.trim()
}

export function userAvatarFallback(user: AuthUser): string {
  if (user.user_type === 'jeweller') {
    const biz = user.business_name.trim()
    const src = biz || `${user.first_name} ${user.last_name}`.trim() || user.email
    const ch = src.trim()[0]
    return ch ? ch.toUpperCase() : '?'
  }
  const a = user.first_name.trim().charAt(0)
  const b = user.last_name.trim().charAt(0)
  if (a || b) return `${a}${b}`.toUpperCase()
  const e = user.email.trim().charAt(0)
  return e ? e.toUpperCase() : '?'
}

export function userAvatarImageFit(user: AuthUser): 'cover' | 'contain' {
  return user.user_type === 'jeweller' ? 'contain' : 'cover'
}
