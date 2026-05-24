const UTR_MIN_LEN = 8
const UTR_MAX_LEN = 20

/** Mirror backend normalize_utr — strip non-alphanumeric, uppercase. */
export function normalizeUtr(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

export function isValidUtr(raw: string): boolean {
  const s = normalizeUtr(raw)
  return s.length >= UTR_MIN_LEN && s.length <= UTR_MAX_LEN
}

export function utrValidationHint(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isValidUtr(trimmed)) return null
  return 'Enter a valid UTR number (8–20 letters or digits).'
}
