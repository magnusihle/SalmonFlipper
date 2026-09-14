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
  shortfallKg: number
  extraRawKg: number
  /** CUT product that the extra fish are cut to and that falls to residual */
  fallsTo?: string
}

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

  const byproducts: ByproductCoverage[] = []
  let extraRawKg = 0
  for (const [product, demandKg] of demand) {
    const outputKg = pulls.reduce((s, p) => s + p.rawKg * yieldAlongPath(g, product, p.path), 0)
    const shortfallKg = Math.max(0, demandKg - outputKg)
    let extra = 0
    let fallsTo: string | undefined
    if (shortfallKg > 0) {
      const route = defaultByproductRoute(g, product)!
      const y = yieldAlongPath(g, product, route.path)
      extra = shortfallKg / y
      fallsTo = route.fallsTo
      pulls.push({
        rawKg: extra,
        path: route.path,
        endProduct: route.fallsTo ?? product,
        reason: { kind: 'BYPRODUCT_SHORTFALL', product, shortfallKg },
      })
      extraRawKg += extra
    }
    byproducts.push({ product, demandKg, outputKg, shortfallKg, extraRawKg: extra, fallsTo })
  }

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
