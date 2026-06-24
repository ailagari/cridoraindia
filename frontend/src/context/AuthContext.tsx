import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  apiFetch,
  authFetch,
  clearTokens,
  getStoredAccess,
  getStoredRefresh,
  getStoredUserJson,
  SESSION_INVALIDATED_EVENT,
  setAuthPersistence,
  storeTokens,
  storeUserJson,
} from '@/lib/api'
import {
  ensureBackgroundPushDelivery,
  initWebPushResubscribeListener,
} from '@/lib/webPushApi'

export type UserType = 'customer' | 'jeweller' | 'admin'

export type AuthProvider = 'email' | 'google'

export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  user_type: UserType
  kyc_status: string
  business_name: string
  profile_photo_url: string
  logo_url: string
  auth_provider: AuthProvider
  profile_complete: boolean
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>
  loginWithGoogle: (
    idToken: string,
    extras?: Record<string, string>,
  ) => Promise<{ user: AuthUser; referralWarning?: string }>
  registerCustomer: (
    payload: Record<string, string>,
  ) => Promise<{ user: AuthUser; referralWarning?: string }>
  registerJeweller: (payload: Record<string, string>) => Promise<AuthUser>
  completeProfile: (payload: Record<string, string>) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function extractApiMessage(data: Record<string, unknown>, fallback: string): string {
  const d = data.detail
  if (typeof d === 'string' && d) return d
  const parts: string[] = []
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
    else if (typeof v === 'string' && v) parts.push(v)
  }
  return parts.join(' ') || fallback
}

function readStoredUser(): AuthUser | null {
  const raw = getStoredUserJson()
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as AuthUser
    return {
      ...u,
      phone: typeof u.phone === 'string' ? u.phone : '',
      business_name: typeof u.business_name === 'string' ? u.business_name : '',
      profile_photo_url: typeof u.profile_photo_url === 'string' ? u.profile_photo_url : '',
      logo_url: typeof u.logo_url === 'string' ? u.logo_url : '',
      auth_provider: u.auth_provider === 'google' ? 'google' : 'email',
      profile_complete: u.profile_complete === true,
    }
  } catch {
    return null
  }
}

function saveUser(u: AuthUser) {
  storeUserJson(JSON.stringify(u))
}

function parseAuthFields(data: Record<string, unknown>) {
  const authProviderRaw = String(data.auth_provider ?? 'email')
  const auth_provider: AuthProvider = authProviderRaw === 'google' ? 'google' : 'email'
  return {
    phone: typeof data.phone === 'string' ? data.phone : '',
    auth_provider,
    profile_complete: data.profile_complete === true,
  }
}

function parseMePayload(data: Record<string, unknown>): AuthUser {
  const authFields = parseAuthFields(data)
  return {
    id: Number(data.id),
    email: String(data.email),
    first_name: String(data.first_name ?? ''),
    last_name: String(data.last_name ?? ''),
    phone: authFields.phone,
    user_type: data.user_type as UserType,
    kyc_status: String(data.kyc_status ?? 'pending'),
    business_name: typeof data.business_name === 'string' ? data.business_name : '',
    profile_photo_url: typeof data.profile_photo_url === 'string' ? data.profile_photo_url : '',
    logo_url: typeof data.logo_url === 'string' ? data.logo_url : '',
    auth_provider: authFields.auth_provider,
    profile_complete: authFields.profile_complete,
  }
}

function userFromSessionPayload(data: Record<string, unknown>): AuthUser {
  const authFields = parseAuthFields(data)
  return {
    id: Number(data.user_id),
    email: String(data.email),
    first_name: String(data.first_name ?? ''),
    last_name: String(data.last_name ?? ''),
    phone: authFields.phone,
    user_type: data.user_type as UserType,
    kyc_status: String(data.kyc_status ?? 'pending'),
    business_name: typeof data.business_name === 'string' ? data.business_name : '',
    profile_photo_url: typeof data.profile_photo_url === 'string' ? data.profile_photo_url : '',
    logo_url: typeof data.logo_url === 'string' ? data.logo_url : '',
    auth_provider: authFields.auth_provider,
    profile_complete: authFields.profile_complete,
  }
}

function hasStoredSession(): boolean {
  return Boolean(getStoredAccess() || getStoredRefresh())
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!hasStoredSession()) {
      setUser(null)
      return
    }
    try {
      const res = await authFetch('/api/v1/auth/me/')
      if (!res.ok) {
        if (!hasStoredSession()) {
          setUser(null)
        }
        return
      }
      const data = (await res.json()) as Record<string, unknown>
      const u = parseMePayload(data)
      saveUser(u)
      setUser(u)
    } catch {
      // Transient network errors — keep cached session (remember-me stays signed in).
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = readStoredUser()
      if (cached && hasStoredSession()) {
        setUser(cached)
        await refreshProfile()
      } else if (cached && !hasStoredSession()) {
        clearTokens()
        setUser(null)
      }
      if (!cancelled) {
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshProfile])

  useEffect(() => {
    const onInvalidated = () => setUser(null)
    window.addEventListener(SESSION_INVALIDATED_EVENT, onInvalidated)
    return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, onInvalidated)
  }, [])

  useEffect(() => initWebPushResubscribeListener(), [])

  useEffect(() => {
    if (loading) return
    if (!user || !hasStoredSession()) return
    void ensureBackgroundPushDelivery({ promptIfNeeded: true })
  }, [loading, user])

  useEffect(() => {
    if (loading) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (user && hasStoredSession()) {
        void ensureBackgroundPushDelivery({ promptIfNeeded: true })
      }
      if (hasStoredSession()) {
        void refreshProfile()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [loading, user, refreshProfile])

  const persistSession = useCallback((data: Record<string, unknown>) => {
    const access = String(data.access ?? '')
    const refresh = String(data.refresh ?? '')
    storeTokens(access, refresh)
    const u = userFromSessionPayload(data)
    saveUser(u)
    setUser(u)
    void ensureBackgroundPushDelivery({ promptIfNeeded: true })
    return u
  }, [])

  const login = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      setAuthPersistence(rememberMe ? 'local' : 'session')
      const res = await apiFetch('/api/v1/auth/login/', {
        method: 'POST',
        jsonBody: { email, password },
      })
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!res.ok) {
        const msg = extractApiMessage(data, 'Sign in failed')
        throw new Error(msg)
      }
      return persistSession(data)
    },
    [persistSession],
  )

  const loginWithGoogle = useCallback(
    async (idToken: string, extras?: Record<string, string>) => {
      setAuthPersistence('local')
      const res = await apiFetch('/api/v1/auth/google/', {
        method: 'POST',
        jsonBody: { id_token: idToken, ...(extras ?? {}) },
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Google sign-in failed'))
      }
      const u = persistSession(data)
      const warn = data.referral_warning
      return {
        user: u,
        referralWarning: typeof warn === 'string' && warn ? warn : undefined,
      }
    },
    [persistSession],
  )

  const completeProfile = useCallback(
    async (payload: Record<string, string>) => {
      const res = await authFetch('/api/v1/auth/complete-profile/', {
        method: 'PATCH',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Could not update profile.'))
      }
      return persistSession(data)
    },
    [persistSession],
  )

  const registerCustomer = useCallback(
    async (payload: Record<string, string>) => {
      setAuthPersistence('local')
      const res = await apiFetch('/api/v1/auth/register/', {
        method: 'POST',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Registration failed'))
      }
      const u = persistSession(data)
      const warn = data.referral_warning
      return {
        user: u,
        referralWarning: typeof warn === 'string' && warn ? warn : undefined,
      }
    },
    [persistSession],
  )

  const registerJeweller = useCallback(
    async (payload: Record<string, string>) => {
      setAuthPersistence('local')
      const res = await apiFetch('/api/v1/auth/jeweller/apply/', {
        method: 'POST',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Application failed'))
      }
      return persistSession(data)
    },
    [persistSession],
  )

  const logout = useCallback(async () => {
    const refresh = getStoredRefresh()
    const access = getStoredAccess()
    if (refresh && access) {
      await apiFetch('/api/v1/auth/logout/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
        jsonBody: { refresh },
      }).catch(() => undefined)
    }
    clearTokens()
    setUser(null)
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const refresh = getStoredRefresh()
      const res = await authFetch('/api/v1/auth/password/change/', {
        method: 'POST',
        jsonBody: {
          current_password: currentPassword,
          new_password: newPassword,
          ...(refresh ? { refresh } : {}),
        },
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Could not change password.'))
      }
      persistSession(data)
    },
    [persistSession],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginWithGoogle,
      registerCustomer,
      registerJeweller,
      completeProfile,
      logout,
      refreshProfile,
      changePassword,
    }),
    [
      user,
      loading,
      login,
      loginWithGoogle,
      registerCustomer,
      registerJeweller,
      completeProfile,
      logout,
      refreshProfile,
      changePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
