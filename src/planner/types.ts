/** Data model from the brief §3 — mirrors CARVM tblCutPattern — plus the financial layer (§8). */

export type EdgeKind = 'CUT' | 'BYPRODUCT' | 'LOSS'

export type Edge = {
  parent: string // product code
  child: string // product code
  option: string // "-" = the only pattern; otherwise a pattern id within this parent
  yieldOfParent: number // fraction of parent kg
  kind: EdgeKind
}

export type Product = { code: string; name: string }
export type Order = { orderNo: string; week: string; product: string; kg: number; pricePerKg?: number }
export type Supply = { week: string; rawKg: number }
export type RawPrice = { week: string; pricePerKgRound: number }
export type CostCenter = {
  code: string
  name: string
  parent: string
  option: string
  /** NOK per kg entering the (parent, option) split */
  costPerKgIn: number
  capacityKgPerDay: number
  daysPerWeek: number
}
export type ResidualPrice = { product: string; pricePerKg: number }

export type Seed = {
  edges: Edge[]
  products: Product[]
  orders: Order[]
  supply: Supply[]
  rawPrices: RawPrice[]
  costCenters: CostCenter[]
  residualPrices: ResidualPrice[]
  currency: string
}

/** One (parent, option) choice on the way from ROUND to a product. */
export type PathStep = { parent: string; option: string }

export const ROOT = 'ROUND'
export const LOSS = 'LOSS'
