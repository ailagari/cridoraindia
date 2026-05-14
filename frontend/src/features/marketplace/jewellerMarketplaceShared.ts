export type SellbackMode = 'percent' | 'fixed'

export function formatInr(n: number, fractionDigits = 2): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

export function parseN(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function numOrZero(s: string): string {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? String(n) : '0'
}

export function inferSellbackMode(pctStr: string, fixStr: string): SellbackMode {
  const pct = parseN(pctStr)
  const fix = parseN(fixStr)
  if (pct > 0) return 'percent'
  if (fix > 0) return 'fixed'
  return 'percent'
}

export function previewIndicativeBuyback(
  jewellerStore22k: number,
  defaultMarkupPct: number,
  mode: SellbackMode,
  pctStr: string,
  fixStr: string,
): number {
  const refMetal = jewellerStore22k * (1 + defaultMarkupPct / 100)
  if (mode === 'percent') {
    const p = parseN(pctStr)
    return Math.max(0, refMetal * (1 - p / 100))
  }
  const f = parseN(fixStr)
  return Math.max(0, refMetal - f)
}
