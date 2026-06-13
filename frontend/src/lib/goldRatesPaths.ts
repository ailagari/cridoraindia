/** URL helpers for English / Malayalam gold-rate pages and hreflang alternates. */

export const ML_PATH_PREFIX = '/ml'

export function stripMlPrefix(path: string): string {
  if (path.startsWith('/ml/')) return path.slice(3)
  if (path === '/ml') return '/'
  return path
}

export function withMlPrefix(path: string): string {
  const base = stripMlPrefix(path)
  return base === '/' ? ML_PATH_PREFIX : `${ML_PATH_PREFIX}${base}`
}

export function isMalayalamPath(path: string): boolean {
  return path === ML_PATH_PREFIX || path.startsWith(`${ML_PATH_PREFIX}/`)
}

export function isGoldRatesPath(path: string): boolean {
  const base = stripMlPrefix(path.split('?')[0] ?? path)
  return base === '/gold-rates' || base.startsWith('/gold-rates/')
}

export function goldRatesHreflangPair(pathname: string): { en: string; ml: string } {
  const base = stripMlPrefix(pathname.split('?')[0] ?? pathname)
  return { en: base, ml: withMlPrefix(base) }
}
