import raw from '../../fisk_plan_seed.json'
import type { Seed } from './types'

/** The shared seed: the §3 cut pattern plus the §8 financial layer (raw prices, cost centres, residual prices). */
export const SEED: Seed = {
  edges: raw.edges.map((e) => ({
    parent: e.parent,
    child: e.child,
    option: e.option,
    yieldOfParent: e.yieldOfParent,
    kind: e.kind as Seed['edges'][number]['kind'],
  })),
  products: raw.products.map((p) => ({ code: p.code, name: p.name })),
  orders: raw.orders.map((o) => ({ orderNo: o.orderNo, week: o.week, product: o.product, kg: o.kg, pricePerKg: o.pricePerKg })),
  supply: raw.supply.map((s) => ({ week: s.week, rawKg: s.rawKg })),
  rawPrices: raw.rawPrices.map((r) => ({ week: r.week, pricePerKgRound: r.pricePerKgRound })),
  costCenters: raw.costCenters.map((c) => ({
    code: c.code,
    name: c.name,
    parent: c.parent,
    option: c.option,
    costPerKgIn: c.costPerKgIn,
    capacityKgPerDay: c.capacityKgPerDay,
    daysPerWeek: c.daysPerWeek,
  })),
  residualPrices: raw.residualPrices.map((r) => ({ product: r.product, pricePerKg: r.pricePerKg })),
  currency: raw.currency,
}
