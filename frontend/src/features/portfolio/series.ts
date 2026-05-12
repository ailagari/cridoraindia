export type AdminPortfolioStats = {
  total_users: number
  total_customers: number
  total_jewellers: number
  pending_kyc_identity: number
  pending_kyb_identity: number
  kyc_review_queue_count: number
  kyb_review_queue_count: number
}

export function buildPlatformUserTrend(totalUsers: number): number[] {
  const n = 9
  const spread = 18 + Math.min(totalUsers, 80)
  const start = Math.max(0, totalUsers - spread)
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const wave = Math.sin(i * 0.85) * 1.65 + Math.cos(i * 0.55) * 1.1
    return Math.max(0, Math.round(start + (totalUsers - start) * t + wave))
  })
}

export function buildJewellerDemandSeries(seed: number): number[] {
  const n = 10
  return Array.from({ length: n }, (_, i) => {
    const w = Math.sin(seed * 0.13 + i * 0.9) * 4 + Math.cos(seed * 0.07 + i * 0.55) * 3
    return Math.max(2, Math.round(12 + i * 2.1 + w))
  })
}

/** Synthetic INR portfolio curve for customer dashboard previews (deterministic per user id). */
export function buildCustomerHoldingsInrTrend(seed: number): number[] {
  const n = 10
  const base = 62400 + (seed % 50) * 820
  return Array.from({ length: n }, (_, i) => {
    const w =
      Math.sin(seed * 0.11 + i * 0.72) * 4200 + Math.cos(seed * 0.05 + i * 0.51) * 2100 + i * 1800
    return Math.max(12000, Math.round(base + w))
  })
}

/** Weekly gram-equivalent intake bars (illus.). */
export function buildCustomerWeeklyGramBars(seed: number): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const w =
      Math.sin(seed * 0.07 + i * 1.1) * 0.35 + Math.cos(seed * 0.13 + i * 0.6) * 0.28
    const core = ((1.15 + (seed % 7) * 0.06 + i * 0.19) % 4.8) + w
    return Math.max(0.12, Math.round(core * 100) / 100)
  })
}

export type MockLedgerRow = {
  id: string
  when: string
  kind: 'buy' | 'sell' | 'credit' | 'fee' | 'transfer'
  holdingType: 'fractional' | 'deposit' | 'goldnest'
  detail: string
  grams: string
  inr: string
  balanceG: string
}

export function buildCustomerMockLedger(seed: number): MockLedgerRow[] {
  const kinds: MockLedgerRow['kind'][] = ['buy', 'credit', 'buy', 'fee', 'transfer', 'buy', 'sell', 'buy']
  const holdingCycle: MockLedgerRow['holdingType'][] = ['fractional', 'goldnest', 'fractional', 'deposit', 'fractional', 'goldnest', 'deposit', 'fractional']
  const labels = [
    'Fractional buy · participating jeweller',
    'GoldNest instalment',
    'Fractional SIP top-up',
    'Deposit custody fee',
    'Transferred grams in',
    'GoldNest contribution',
    'Deposit partial sellback',
    'Fractional lump-sum buy',
  ]
  let bal = 7.54 + (seed % 29) * 0.036
  const chron: MockLedgerRow[] = []
  for (let i = 0; i < 8; i++) {
    const k = kinds[i]!
    let gDelta = 0
    let inrStr = '—'
    const day = 4 + i

    if (k === 'fee') {
      const fee = 44 + (i % 4) * 11 + (seed % 9) * 2
      inrStr = `-₹${fee.toLocaleString('en-IN')}`
    } else if (k === 'sell') {
      gDelta = -(0.1 + ((i + seed) % 7) * 0.022)
      const credit = 2950 + i * 150 + (seed % 17) * 80
      inrStr = `+₹${credit.toLocaleString('en-IN')}`
      bal += gDelta
    } else if (k === 'credit') {
      gDelta = 0.04 + ((i + seed) % 10) * 0.009
      inrStr = '—'
      bal += gDelta
    } else if (k === 'transfer') {
      gDelta = 0.12 + ((seed % 6) + i * 0.03) * 0.04
      inrStr = '—'
      bal += gDelta
    } else {
      const spend = 3500 + i * 260 + (seed % 14) * 105
      inrStr = `-₹${spend.toLocaleString('en-IN')}`
      gDelta = 0.062 + ((i + seed * 0.02) % 7) * 0.029
      bal += gDelta
    }

    const gStr =
      gDelta === 0 ? '—' : gDelta < 0 ? `${gDelta.toFixed(3)} g` : `+${gDelta.toFixed(3)} g`
    chron.push({
      id: `L-${seed}-${i}`,
      when: `2026-05-${String(day).padStart(2, '0')}`,
      kind: k,
      holdingType: holdingCycle[i] ?? 'fractional',
      detail: labels[i] ?? k,
      grams: gStr,
      inr: inrStr,
      balanceG: `${bal.toFixed(3)} g`,
    })
  }
  return chron.slice().reverse()
}
