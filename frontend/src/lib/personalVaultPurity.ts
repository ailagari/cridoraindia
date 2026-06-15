export const DEFAULT_PERSONAL_VAULT_PURITY = '22K'

export const PERSONAL_VAULT_PURITY_OPTIONS = [
  { value: '22K', label: '22K (916)' },
  { value: '24K', label: '24K (999)' },
  { value: '18K', label: '18K (750)' },
] as const

export function normalizePersonalVaultPurity(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t || t === 'BIS 916') return DEFAULT_PERSONAL_VAULT_PURITY
  return t
}
