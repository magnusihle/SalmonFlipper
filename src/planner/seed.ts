import raw from '../../fisk_plan_seed.json'
import type { Seed } from './types'

/**
 * The shared seed. Extra fields in the JSON (prices, cost centres) are outside the brief's
 * data model and are deliberately not exposed here.
 */
export const SEED: Seed = {
  edges: raw.edges.map((e) => ({
    parent: e.parent,
    child: e.child,
    option: e.option,
    yieldOfParent: e.yieldOfParent,
    kind: e.kind as Seed['edges'][number]['kind'],
  })),
  products: raw.products.map((p) => ({ code: p.code, name: p.name })),
  orders: raw.orders.map((o) => ({ orderNo: o.orderNo, week: o.week, product: o.product, kg: o.kg })),
  supply: raw.supply.map((s) => ({ week: s.week, rawKg: s.rawKg })),
}
