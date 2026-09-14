import type { Graph } from './graph'
import { LOSS, ROOT } from './types'
import type { RawPull, WeekPlan } from './rollup'

export type SplitBalance = {
  parent: string
  option: string
  parentKg: number
  children: { product: string; kind: string; kg: number }[]
  /** parentKg − Σ children kg; should be ~0 */
  residualError: number
}

export type ProductBalance = {
  product: string
  kind: 'CUT' | 'BYPRODUCT' | 'LOSS'
  /** kg landing on this product as a terminal (not cut further) */
  outputKg: number
  orderedKg: number
  /** output − ordered: unordered kg with a product code someone can price later */
  residualKg: number
}

export type MassBalance = {
  week: string
  rawKg: number
  splits: SplitBalance[]
  products: ProductBalance[]
  /** Σ terminal output incl. LOSS — equals rawKg when the balance closes */
  totalOutKg: number
  lossKg: number
  unallocatedRawKg: number
}

export function productKind(g: Graph, product: string): ProductBalance['kind'] {
  return product === LOSS ? 'LOSS' : product === ROOT || g.cutParent.has(product) ? 'CUT' : 'BYPRODUCT'
}

/**
 * Push one raw pull down its path on its own. Returns the kg landing on every terminal product
 * (by-products and loss along the way, the CUT product at the end). Used to draw the flow.
 */
export function pushPull(g: Graph, pull: RawPull): Map<string, number> {
  const outputs = new Map<string, number>()
  const add = (k: string, v: number) => outputs.set(k, (outputs.get(k) ?? 0) + v)
  let kg = pull.rawKg
  for (const step of pull.path) {
    const group = g.splits.get(step.parent)?.get(step.option) ?? []
    let next = 0
    for (const e of group) {
      const childKg = kg * e.yieldOfParent
      if (e.kind === 'CUT') next = childKg
      else add(e.child, childKg)
    }
    kg = next
  }
  add(pull.endProduct, kg)
  return outputs
}

/** Step 5 — push every raw pull down its path and account for every kg. */
export function massBalance(g: Graph, plan: WeekPlan): MassBalance {
  const splits = new Map<string, SplitBalance>()
  const output = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)

  for (const pull of plan.pulls) {
    let kg = pull.rawKg
    for (const step of pull.path) {
      const key = `${step.parent}|${step.option}`
      const group = g.splits.get(step.parent)?.get(step.option) ?? []
      const sb = splits.get(key) ?? { parent: step.parent, option: step.option, parentKg: 0, children: group.map((e) => ({ product: e.child, kind: e.kind, kg: 0 })), residualError: 0 }
      sb.parentKg += kg
      let next = 0
      for (const e of group) {
        const childKg = kg * e.yieldOfParent
        sb.children.find((c) => c.product === e.child && c.kind === e.kind)!.kg += childKg
        if (e.kind === 'CUT') next = childKg
        else add(output, e.child, childKg)
      }
      splits.set(key, sb)
      kg = next
    }
    // the CUT product at the end of the path is sold (or falls to residual) as-is
    add(output, pull.endProduct, kg)
  }
  for (const sb of splits.values()) sb.residualError = sb.parentKg - sb.children.reduce((s, c) => s + c.kg, 0)

  const ordered = new Map<string, number>()
  for (const l of plan.lines) if (l.kind !== 'UNRESOLVED') add(ordered, l.order.product, l.order.kg)

  const products: ProductBalance[] = [...output.entries()]
    .map(([product, outputKg]) => {
      const kind = productKind(g, product)
      const orderedKg = ordered.get(product) ?? 0
      return { product, kind, outputKg, orderedKg, residualKg: kind === 'LOSS' ? 0 : outputKg - orderedKg }
    })
    .sort((a, b) => b.residualKg - a.residualKg)

  const totalOutKg = [...output.values()].reduce((s, v) => s + v, 0)
  return { week: plan.week, rawKg: plan.requiredRawKg, splits: [...splits.values()], products, totalOutKg, lossKg: output.get(LOSS) ?? 0, unallocatedRawKg: plan.unallocatedRawKg }
}
