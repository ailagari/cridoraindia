/** Warm, Kerala-rooted copy helpers — logic only, no UI. */

export type GoldRateDirection = 'up' | 'down' | 'steady' | 'unknown'

export type GoldRateContextInput = {
  deltaInr?: number | null
  deltaPct?: number | null
  direction?: GoldRateDirection
}

const IST = 'Asia/Kolkata'

/** Time-of-day greeting in IST. */
export function timeOfDayGreeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: IST }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function resolveDirection(input: GoldRateContextInput): GoldRateDirection {
  if (input.direction && input.direction !== 'unknown') return input.direction
  const pct = input.deltaPct
  if (pct != null && Number.isFinite(pct)) {
    if (Math.abs(pct) < 0.05) return 'steady'
    return pct > 0 ? 'up' : 'down'
  }
  const inr = input.deltaInr
  if (inr != null && Number.isFinite(inr)) {
    if (Math.abs(inr) < 1) return 'steady'
    return inr > 0 ? 'up' : 'down'
  }
  return 'unknown'
}

function fmtInrDelta(n: number): string {
  return Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/** Human context line under a gold rate — warm, not trading-alert tone. */
export function goldRateContextLine(input: GoldRateContextInput): string {
  const dir = resolveDirection(input)
  const swing = input.deltaInr != null && Number.isFinite(input.deltaInr) ? Math.abs(input.deltaInr) : null

  if (dir === 'up' && swing != null && swing >= 1) {
    return `Up ₹${fmtInrDelta(swing)} from yesterday — one of the better days this month.`
  }
  if (dir === 'down' && swing != null && swing >= 1) {
    return `Down ₹${fmtInrDelta(swing)} — some families see this as a buying moment.`
  }
  if (dir === 'steady') {
    return 'Steady today — a good day to think about adding a little.'
  }
  return "We checked the rate for you — here's today's number."
}

/** Celebration when the user logs their first personal holding. */
export function firstHoldingCelebration(grams?: number | null): string {
  const g = grams != null && Number.isFinite(grams) && grams > 0 ? grams : null
  if (g != null && g < 1) {
    return 'Your first piece is logged. That is how every great gold record begins.'
  }
  return 'Your first gram is logged. That is how every great gold record begins.'
}

/** Warm tail after saving a holding (not the first). */
export function holdingSavedWarmTail(label: string): string {
  return `"${label}" is now part of your gold record — safe and counted.`
}

/** Warm tail after updating a holding. */
export function holdingUpdatedWarmTail(label: string): string {
  return `"${label}" is updated — your record stays current.`
}

export function fmtGoldRateInr(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/** Full daily greeting line for portfolio home. */
export function dailyGoldGreetingLine(opts: {
  rate22k: number | null
  hasHoldings: boolean
  now?: Date
}): string {
  const greet = timeOfDayGreeting(opts.now)
  const ratePart =
    opts.rate22k != null && Number.isFinite(opts.rate22k)
      ? `Gold is ₹${fmtGoldRateInr(opts.rate22k)} today`
      : "Today's gold rate is loading"
  const tail = opts.hasHoldings
    ? 'your record is up to date.'
    : "when you're ready, we'll keep track."
  return `${greet}. ${ratePart} — ${tail}`
}
