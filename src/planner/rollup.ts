import { cumYield, defaultByproductRoute, isByproduct, isCutProduct, pattern, yieldAlongPath, type Graph } from './graph'
import type { Order, PathStep, Supply } from './types'

export type LineKind = 'CUT' | 'BYPRODUCT' | 'UNRESOLVED'
export type WeekFlag = 'OK' | 'CANNOT BE MET' | 'NO SUPPLY PLANNED'

export type OrderLine = {
  order: Order
  kind: LineKind
  /** cumulative yield of ROUND for CUT lines */
  cumYield?: number
  /** raw kg this line pulls on its own — CUT lines only */
  rawKg: number
  path?: PathStep[]
  /** for BYPRODUCT lines: how the demand is met */
  coverage?: { fromCoProduct: number; shortfall: number; extraRawKg: number }
  flags: string[]
}

/** Raw pulled through the graph along one path (a CUT order, or extra fish for a by-product shortfall). */
export type RawPull = {
  rawKg: number
  path: PathStep[]
  /** the CUT product at the end of the path */
  endProduct: string
  /** what caused this pull */
  reason: { kind: 'ORDER'; orderNo: string } | { kind: 'BYPRODUCT_SHORTFALL'; product: string; shortfallKg: number }
}

export type ByproductCoverage = {
  product: string
  demandKg: number
  outputKg: number
  /** demand − outputKg (never negative): what the ordered CUT lines alone cannot cover */
  shortfallKg: number
  /** kg of this by-product met from extra fish, whether bought for it or for another by-product */
  coveredByExtraFishKg: number
  /** extra whole fish bought specifically for this by-product's shortfall */
  extraRawKg: number
  /** CUT product that the extra fish are cut to and that falls to residual */
  fallsTo?: string
}

/** Shortfalls below this many kg are float noise, not an order for more fish. */
export const SHORTFALL_TOLERANCE_KG = 1e-9

export type WeekPlan = {
  week: string
  lines: OrderLine[]
  pulls: RawPull[]
  cutRawKg: number
  extraRawKg: number
  requiredRawKg: number
  supplyRawKg?: number
  flag: WeekFlag
  /** raw kg missing when CANNOT BE MET */
  gapRawKg: number
  /** supply − required when it fits */
  unallocatedRawKg: number
  byproducts: ByproductCoverage[]
}

/** Step 2 — raw required per order line. */
export function rawPerLine(g: Graph, order: Order): OrderLine {
  if (isCutProduct(g, order.product)) {
    const y = cumYield(g, order.product)!
    return { order, kind: 'CUT', cumYield: y, rawKg: order.kg / y, path: pattern(g, order.product), flags: [] }
  }
  if (isByproduct(g, order.product)) return { order, kind: 'BYPRODUCT', rawKg: 0, flags: [] }
  return { order, kind: 'UNRESOLVED', rawKg: 0, flags: ['UNRESOLVED'] }
}

/** Step 3 + 4 — roll one week up and compare to supply. */
export function rollupWeek(g: Graph, week: string, orders: Order[], supply: Supply[]): WeekPlan {
  const lines = orders.filter((o) => o.week === week).map((o) => rawPerLine(g, o))

  const pulls: RawPull[] = lines
    .filter((l) => l.kind === 'CUT')
    .map((l) => ({ rawKg: l.rawKg, path: l.path!, endProduct: l.order.product, reason: { kind: 'ORDER', orderNo: l.order.orderNo } }))
  const cutRawKg = pulls.reduce((s, p) => s + p.rawKg, 0)

  // by-product demand is covered first by the co-product output of the raw already required
  const demand = new Map<string, number>()
  for (const l of lines) if (l.kind === 'BYPRODUCT') demand.set(l.order.product, (demand.get(l.order.product) ?? 0) + l.order.kg)

  // Cover by-products jointly. Extra fish bought for one by-product also yield the others
  // (fish for a FRAME shortfall bring HEAD along), so resolve the shortfall that needs the most
  // extra raw first, re-measure every by-product against all pulls, and repeat until nothing is
  // short. The result then does not depend on the order the lines arrive in.
  const outputFor = (product: string) => pulls.reduce((s, p) => s + p.rawKg * yieldAlongPath(g, product, p.path), 0)
  const coProductOutput = new Map([...demand.keys()].map((product) => [product, outputFor(product)]))
  const boughtFor = new Map<string, { extraRawKg: number; fallsTo?: string }>()
  let extraRawKg = 0
  for (;;) {
    let worst: { product: string; shortfallKg: number; extraRawKg: number; route: NonNullable<ReturnType<typeof defaultByproductRoute>> } | undefined
    for (const [product, demandKg] of demand) {
      const shortfallKg = demandKg - outputFor(product)
      if (shortfallKg <= SHORTFALL_TOLERANCE_KG) continue
      const route = defaultByproductRoute(g, product)!
      const extra = shortfallKg / yieldAlongPath(g, product, route.path)
      if (!worst || extra > worst.extraRawKg || (extra === worst.extraRawKg && product < worst.product)) worst = { product, shortfallKg, extraRawKg: extra, route }
    }
    if (!worst) break
    pulls.push({
      rawKg: worst.extraRawKg,
      path: worst.route.path,
      endProduct: worst.route.fallsTo ?? worst.product,
      reason: { kind: 'BYPRODUCT_SHORTFALL', product: worst.product, shortfallKg: worst.shortfallKg },
    })
    extraRawKg += worst.extraRawKg
    boughtFor.set(worst.product, { extraRawKg: worst.extraRawKg, fallsTo: worst.route.fallsTo })
  }
  const byproducts: ByproductCoverage[] = [...demand].map(([product, demandKg]) => {
    const outputKg = coProductOutput.get(product)!
    const shortfallKg = Math.max(0, demandKg - outputKg)
    const bought = boughtFor.get(product)
    return {
      product,
      demandKg,
      outputKg,
      shortfallKg,
      coveredByExtraFishKg: Math.min(shortfallKg, Math.max(0, outputFor(product) - outputKg)),
      extraRawKg: bought?.extraRawKg ?? 0,
      fallsTo: bought?.fallsTo,
    }
  })

  // annotate by-product lines with their share of the coverage (pro-rata within the product)
  for (const l of lines) {
    if (l.kind !== 'BYPRODUCT') continue
    const c = byproducts.find((b) => b.product === l.order.product)!
    const share = c.demandKg > 0 ? l.order.kg / c.demandKg : 0
    l.coverage = { fromCoProduct: Math.min(l.order.kg, c.outputKg * share), shortfall: c.shortfallKg * share, extraRawKg: c.extraRawKg * share }
    if (c.shortfallKg > 0) l.flags.push('EXTRA FISH')
  }

  const requiredRawKg = cutRawKg + extraRawKg
  const supplyRow = supply.find((s) => s.week === week)
  let flag: WeekFlag = 'OK'
  let gapRawKg = 0
  let unallocatedRawKg = 0
  if (!supplyRow) flag = 'NO SUPPLY PLANNED'
  else if (requiredRawKg > supplyRow.rawKg) {
    flag = 'CANNOT BE MET'
    gapRawKg = requiredRawKg - supplyRow.rawKg
  } else unallocatedRawKg = supplyRow.rawKg - requiredRawKg

  return { week, lines, pulls, cutRawKg, extraRawKg, requiredRawKg, supplyRawKg: supplyRow?.rawKg, flag, gapRawKg, unallocatedRawKg, byproducts }
}

/** Every week that has an order or a supply row, in week order. */
export function rollupAll(g: Graph, orders: Order[], supply: Supply[]): WeekPlan[] {
  const weeks = [...new Set([...orders.map((o) => o.week), ...supply.map((s) => s.week)])].sort()
  return weeks.map((w) => rollupWeek(g, w, orders, supply))
}
