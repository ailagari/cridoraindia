const VAULT_CARD_RE = /^\d{10}@cridora$/i
const LEGACY_HANDLE_RE = /^[\w.-]+@[\w.-]+$/

/** Build a Cridora pay URI for QR encoding (optional; plain address also works). */
export function cridoraPayUri(address: string): string {
  const normalized = (address || '').trim().toLowerCase()
  if (!normalized) return ''
  return `cridora://pay/${encodeURIComponent(normalized)}`
}

/**
 * Extract a GoldUPI / vault card address from scanned QR text or deep links.
 * Accepts plain `8472910536@cridora`, legacy handles, and `cridora://pay/...` URLs.
 */
export function parseCridoraPayPayload(raw: string): string | null {
  const trimmed = (raw || '').trim()
  if (!trimmed) return null

  const cridoraScheme = /^cridora:\/\/pay\/(.+)$/i.exec(trimmed)
  if (cridoraScheme) {
    return normalizeAddress(decodeURIComponent(cridoraScheme[1]))
  }

  if (trimmed.includes('://') || trimmed.startsWith('/pay') || trimmed.includes('/pay?')) {
    try {
      const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://cridora.local')
      const toParam = url.searchParams.get('to')
      if (toParam) return normalizeAddress(toParam)
      const pathMatch = /^\/pay\/(.+)$/i.exec(url.pathname)
      if (pathMatch) return normalizeAddress(decodeURIComponent(pathMatch[1]))
    } catch {
      /* fall through */
    }
  }

  return normalizeAddress(trimmed)
}

function normalizeAddress(value: string): string | null {
  const s = (value || '').trim().toLowerCase()
  if (!s) return null
  if (VAULT_CARD_RE.test(s) || LEGACY_HANDLE_RE.test(s)) return s
  return null
}
