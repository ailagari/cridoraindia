/** Display helpers for random 10-digit vault card IDs (`1234567890@cridora`). */

const CARD_ADDR_RE = /^(\d{4})(\d{4})(\d{2})@cridora$/i

/** Group digits like a card: `4872 9105 30`. */
export function formatVaultCardDisplay(address: string): string {
  const s = (address || '').trim().toLowerCase()
  const m = CARD_ADDR_RE.exec(s)
  if (m) {
    return `${m[1]} ${m[2]} ${m[3]}`
  }
  return address.trim()
}

/** Full copy/paste value with suffix. */
export function vaultCardCopyValue(address: string): string {
  return (address || '').trim().toLowerCase()
}
