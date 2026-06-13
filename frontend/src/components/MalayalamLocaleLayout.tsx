import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'

/** Forces Malayalam locale for `/ml/*` public routes (hreflang landing pages). */
export function MalayalamLocaleLayout() {
  const { setLocale } = usePublicLocale()

  useEffect(() => {
    setLocale('ml')
  }, [setLocale])

  return <Outlet />
}
