import type { OrderLine } from './planner'

let locale = 'en-GB'
/** Number formatting follows the UI language; the store sets this when it changes. */
export const setFormatLocale = (l: string) => {
  locale = l
}

export const n0 = (v: number) => Math.round(v).toLocaleString(locale)
export const n1 = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 })
export const n2 = (v: number) => v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const pct = (v: number) => (v * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
export const pct0 = (v: number) => Math.round(v * 100) + '%'

/** Compact NOK: 393,900 → "394 k", 1,530,000 → "1.53 M". */
export function kr(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (abs >= 1e6) return `${sign}${n2(abs / 1e6)} M`
  if (abs >= 1e4) return `${sign}${n0(abs / 1e3)} k`
  return `${sign}${n0(abs)}`
}

export const pathText = (line: OrderLine) =>
  line.path ? line.path.map((s) => (s.option === '-' ? s.parent : `${s.parent}·${s.option}`)).join(' › ') : ''

/** "2026-W38" → "W38" */
export const shortWeek = (week: string) => week.replace(/^\d{4}-/, '')

/** The ISO week after "2026-W52" is "2027-W01" (53-week years are folded into 52). */
export function nextWeek(week: string) {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return week
  const y = Number(m[1])
  const w = Number(m[2])
  return w >= 52 ? `${y + 1}-W01` : `${y}-W${String(w + 1).padStart(2, '0')}`
}
