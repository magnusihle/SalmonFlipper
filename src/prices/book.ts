// The price book and rules shipped with the app. Refresh prices.json with `npm run fetch-prices`,
// or live from the prices panel (SSB only — the Seafood Council workbooks need the node script).
import bookJson from '../../prices.json'
import rulesJson from '../../price_rules.json'
import type { PriceBook, PriceRule } from './types'

export const BUNDLED_PRICES: PriceBook = bookJson as PriceBook
export const PRICE_RULES: PriceRule[] = rulesJson.rules as PriceRule[]

/** Labels for the reference series, for the UI. */
export const SERIES_LABELS: Record<string, string> = {
  HOG: 'Fresh whole salmon · SSB 03024',
  HOG_FROZEN: 'Frozen whole salmon · SSB 03024',
  HOG_NSC: 'Fresh whole salmon · Seafood Council',
  FILLET_FRESH: 'Fresh fillet, all trims · Seafood Council',
  FILLET_FROZEN: 'Frozen fillet · Seafood Council',
  HEADLESS_FRESH: 'Fresh head-off · Seafood Council',
  HEADLESS_FROZEN: 'Frozen head-off · Seafood Council',
}

/** Which reference series is worth showing next to a graph product, as a market cross-check. */
export const CROSS_CHECK: Record<string, string[]> = {
  ROUND: ['HOG', 'HOG_NSC'],
  HOG: ['HOG', 'HOG_NSC'],
  HEADLESS: ['HEADLESS_FRESH', 'HEADLESS_FROZEN'],
  FILLET_A: ['FILLET_FRESH'],
  TRIM_C: ['FILLET_FRESH', 'FILLET_FROZEN'],
  TRIM_D: ['FILLET_FRESH', 'FILLET_FROZEN'],
  TRIM_E: ['FILLET_FRESH', 'FILLET_FROZEN'],
  PORTION_E: ['FILLET_FRESH'],
}
