import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { isMalayalamPath, stripMlPrefix } from '@/lib/goldRatesPaths'

/** Canonical SEO path + locale for gold-rate pages (supports `/ml/...` routes). */
export function useGoldRatesSeoContext() {
  const { pathname } = useLocation()

  return useMemo(() => {
    const path = stripMlPrefix(pathname.split('?')[0] ?? pathname)
    const locale: 'en' | 'ml' = isMalayalamPath(pathname) ? 'ml' : 'en'
    const seoPath = locale === 'ml' ? `/ml${path}` : path
    return { path, seoPath, locale }
  }, [pathname])
}
