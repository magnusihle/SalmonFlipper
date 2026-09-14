// Price lookup over a list of weekly Price rows. Pure functions only — this file is also
// imported by the node fetch script, so it must not pull in JSON or browser code.
import type { Price } from './types'

/**
 * Price for `product` in ISO week `week` ("2026-W36").
 * Exact week if present; otherwise the latest week on or before the requested one;
 * otherwise the latest week available for the product. Null if the product has no prices.
 */
export function priceFor(prices: Price[], product: string, week: string): Price | null {
  const rows = seriesFor(prices, product)
  if (rows.length === 0) return null
  const exact = rows.find((p) => p.week === week)
  if (exact) return exact
  const before = rows.filter((p) => p.week <= week)
  return before.length ? before[before.length - 1] : rows[rows.length - 1]
}

/** Every price of one product, oldest week first. */
export function seriesFor(prices: Price[], product: string): Price[] {
  return prices.filter((p) => p.product === product).sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0))
}

/** Merge freshly fetched rows into a book: same (product, week) is replaced, everything else kept. */
export function mergePrices(base: Price[], incoming: Price[]): Price[] {
  const key = (p: Price) => `${p.product}|${p.week}`
  const map = new Map(base.map((p) => [key(p), p]))
  for (const p of incoming) map.set(key(p), p)
  return [...map.values()].sort((a, b) => (a.product === b.product ? (a.week < b.week ? -1 : 1) : a.product < b.product ? -1 : 1))
}
