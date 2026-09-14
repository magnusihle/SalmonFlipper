/** One weekly reference price, as written to prices.json by scripts/fetch-prices.mjs. */
export type Price = {
  product: string
  /** ISO week, e.g. "2026-W36" */
  week: string
  nokPerKg: number
  volumeTonnes: number | null
  source: string
  fetchedAt: string
}

export type PriceSeries = {
  source: string
  label: string
  url: string
  updated?: string
  unit: string
  products: (string | { product: string; label: string })[]
  weeksFetched?: string[]
  note?: string
}

export type PriceBook = {
  fetchedAt: string
  series: PriceSeries[]
  prices: Price[]
}

export type PriceRuleKind = 'reference' | 'derived' | 'manual'

/**
 * How a product's NOK/kg is made (issue #7).
 *   reference: price of `ref` from the price book, latest week on or before the requested one.
 *   derived:   (price(parent) + costPerKgIn − Σ by-product yield × price(by-product)) / cutYield
 *   manual:    hand-entered nokPerKg with a note.
 */
export type PriceRule = {
  product: string
  rule: PriceRuleKind
  ref?: string
  costPerKg?: number
  nokPerKg?: number
  note?: string
}
