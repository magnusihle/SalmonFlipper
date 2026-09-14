import { SEED } from '../planner/seed'

/** Paper-palette tones per product code: cut products in salmon, by-products in olive and greige. */
export const PRODUCT_TONE: Record<string, string> = {
  ROUND: '#b5461a',
  HOG: '#c9511f',
  HEADLESS: '#d9632f',
  FILLET_A: '#ea6a31',
  TRIM_C: '#ef8a57',
  TRIM_D: '#f19a6d',
  TRIM_E: '#f4ab84',
  PORTION_E: '#f7c1a3',
  HEAD: '#8f8371',
  FRAME: '#a99d84',
  BELLY_FLAP: '#c7a45f',
  SKIN: '#9a9a8c',
  MINCE: '#b9ad91',
  VISCERA: '#7d7264',
  LOSS: '#cfc6b3',
}

export const tone = (product: string) => PRODUCT_TONE[product] ?? '#8f8371'

const NAMES = new Map(SEED.products.map((p) => [p.code, p.name]))
export const productName = (code: string) => NAMES.get(code) ?? code

/** Products someone can order: everything except the root and process loss. */
export const ORDERABLE = SEED.products.map((p) => p.code).filter((c) => c !== 'ROUND' && c !== 'LOSS')
