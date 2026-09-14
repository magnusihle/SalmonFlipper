// Per-product NOK/kg from price rules (issue #7).
//
//   reference: price of `ref` from the price book (via priceFor), latest week on or before the requested one.
//   derived:   (price(ref) + costPerKgIn − Σ byproduct yield × price(byproduct)) / cutYield, where ref is the
//              product's CUT parent in the graph and the cost is the cost centre on that (parent, option)
//              in NOK per kg entering the split (rule.costPerKg overrides it).
//   manual:    hand-entered nokPerKg with a note.
//
// Every value comes back with its formula spelled out so the UI can show how the number was made.

import type { CostCenter, Edge, Product } from '../planner/types'
import { priceFor } from './prices'
import type { Price, PriceRule, PriceRuleKind } from './types'

export type PriceCredit = { product: string; yield: number; nokPerKg: number; valueNok: number }

export type PriceValue = {
  product: string
  week: string
  rule: PriceRuleKind
  note: string
  nokPerKg: number
  /** the reference week actually used (may be earlier than `week`) */
  priceWeek?: string
  source: string
  referenceSource: string
  formula: string
  // derived only
  parent?: string
  option?: string
  cutYield?: number
  costPerKgIn?: number
  costSource?: string
  parentNokPerKg?: number
  credits?: PriceCredit[]
}

export type PanelRow = {
  product: string
  rule: PriceRuleKind
  nokPerKg: number
  priceWeek: string | null
  source: string
  formula: string
  note: string
  editable: boolean
}

export type ValuedRow<T> = T & { nokPerKg: number; valueNok: number; rule: PriceRuleKind; formula: string; source: string }

export type Pricer = {
  rules: PriceRule[]
  valuePerKg(product: string, week: string): PriceValue
  valueResidual<T extends { product: string; kg: number }>(rows: T[], week: string): { week: string; rows: ValuedRow<T>[]; totalNok: number }
  valueUnallocatedRaw(kg: number, week: string): { week: string; kg: number; nokPerKg: number; valueNok: number; priceWeek?: string; formula: string }
  panel(week: string): PanelRow[]
  withManualPrice(product: string, nokPerKg: number): Pricer
}

const fmt = (n: number) => n.toFixed(2)

/** The single CUT edge that produces `product`, or null. */
function cutEdgeTo(edges: Edge[], product: string): Edge | null {
  const hits = edges.filter((e) => e.child === product && e.kind === 'CUT')
  return hits.length === 1 ? hits[0] : null
}

/**
 * Check rules against the seed. Returns a list of error strings (empty = valid).
 * - every product in seed.products has exactly one rule
 * - manual rules carry a numeric nokPerKg
 * - reference rules carry a ref
 * - derived rules point at the product's CUT parent
 */
export function validatePriceRules(rules: PriceRule[], seed: { products: Product[]; edges: Edge[] }): string[] {
  const errors: string[] = []
  const byProduct = new Map<string, PriceRule>()
  for (const r of rules) {
    if (byProduct.has(r.product)) errors.push(`${r.product}: more than one rule`)
    byProduct.set(r.product, r)
  }
  for (const p of seed.products) if (!byProduct.has(p.code)) errors.push(`${p.code}: no price rule`)
  for (const r of rules) {
    if (r.rule === 'manual' && typeof r.nokPerKg !== 'number') errors.push(`${r.product}: manual rule without nokPerKg`)
    if (r.rule === 'reference' && !r.ref) errors.push(`${r.product}: reference rule without ref`)
    if (r.rule === 'derived') {
      const edge = cutEdgeTo(seed.edges, r.product)
      if (!edge) errors.push(`${r.product}: derived rule but no single CUT edge produces it`)
      else if (edge.parent !== r.ref) errors.push(`${r.product}: derived ref ${r.ref} is not its CUT parent ${edge.parent}`)
    }
    if (!['reference', 'derived', 'manual'].includes(r.rule)) errors.push(`${r.product}: unknown rule ${r.rule}`)
  }
  return errors
}

export type PricerInput = { rules: PriceRule[]; edges: Edge[]; costCenters?: CostCenter[]; prices: Price[] }

/**
 * Build a pricer over rules, the cut graph, cost centres and reference prices.
 * All methods are pure; `withManualPrice` returns a new pricer.
 */
export function createPricer({ rules, edges, costCenters = [], prices }: PricerInput): Pricer {
  const ruleFor = new Map(rules.map((r) => [r.product, r]))

  function costPerKgIn(rule: PriceRule, edge: Edge) {
    if (typeof rule.costPerKg === 'number') return { cost: rule.costPerKg, costSource: 'rule.costPerKg' }
    const cc = costCenters.find((c) => c.parent === edge.parent && c.option === edge.option)
    return cc ? { cost: cc.costPerKgIn, costSource: `cost centre ${cc.code}` } : { cost: 0, costSource: 'no cost centre' }
  }

  function resolve(product: string, week: string, stack: string[]): PriceValue {
    const rule = ruleFor.get(product)
    if (!rule) throw new Error(`No price rule for product ${product}`)
    if (stack.includes(product)) throw new Error(`Price rule cycle: ${[...stack, product].join(' -> ')}`)
    const next = [...stack, product]
    const base = { product, week, rule: rule.rule, note: rule.note ?? '' }

    if (rule.rule === 'manual') {
      const nokPerKg = rule.nokPerKg ?? 0
      return { ...base, nokPerKg, source: 'manual', referenceSource: 'manual', formula: `manual ${fmt(nokPerKg)} NOK/kg` }
    }

    if (rule.rule === 'reference') {
      const p = priceFor(prices, rule.ref!, week)
      if (!p) throw new Error(`No reference price for ${rule.ref} (needed by ${product})`)
      return {
        ...base,
        nokPerKg: p.nokPerKg,
        priceWeek: p.week,
        source: p.source,
        referenceSource: p.source,
        formula: `${rule.ref} ${p.source} ${p.week} = ${fmt(p.nokPerKg)}`,
      }
    }

    if (rule.rule === 'derived') {
      const edge = cutEdgeTo(edges, product)
      if (!edge || edge.parent !== rule.ref) throw new Error(`${product}: derived ref ${rule.ref} is not its CUT parent`)
      const parent = resolve(edge.parent, week, next)
      const siblings = edges.filter((e) => e.parent === edge.parent && e.option === edge.option && e.kind === 'BYPRODUCT')
      const credits: PriceCredit[] = siblings.map((s) => {
        const v = resolve(s.child, week, next)
        return { product: s.child, yield: s.yieldOfParent, nokPerKg: v.nokPerKg, valueNok: s.yieldOfParent * v.nokPerKg }
      })
      const creditNok = credits.reduce((a, c) => a + c.valueNok, 0)
      const { cost, costSource } = costPerKgIn(rule, edge)
      const nokPerKg = (parent.nokPerKg + cost - creditNok) / edge.yieldOfParent
      const creditText = credits.map((c) => ` − ${c.yield}×${c.product} ${fmt(c.nokPerKg)}`).join('')
      return {
        ...base,
        nokPerKg,
        priceWeek: parent.priceWeek,
        source: `derived from ${edge.parent} via ${parent.referenceSource}, ${costSource}`,
        referenceSource: parent.referenceSource,
        formula: `(${edge.parent} ${fmt(parent.nokPerKg)} + cost ${fmt(cost)}${creditText}) / ${edge.yieldOfParent} = ${fmt(nokPerKg)}`,
        parent: edge.parent,
        option: edge.option,
        cutYield: edge.yieldOfParent,
        costPerKgIn: cost,
        costSource,
        parentNokPerKg: parent.nokPerKg,
        credits,
      }
    }

    throw new Error(`${product}: unknown rule ${rule.rule}`)
  }

  const valuePerKg = (product: string, week: string) => resolve(product, week, [])

  return {
    rules,
    valuePerKg,

    valueResidual(rows, week) {
      const out = rows.map((row) => {
        const v = valuePerKg(row.product, week)
        return { ...row, nokPerKg: v.nokPerKg, valueNok: row.kg * v.nokPerKg, rule: v.rule, formula: v.formula, source: v.source }
      })
      return { week, rows: out, totalNok: out.reduce((a, r) => a + r.valueNok, 0) }
    },

    /** Spare raw (supply − required) valued through the ROUND rule, i.e. at the HOG reference price. */
    valueUnallocatedRaw(kg, week) {
      const v = valuePerKg('ROUND', week)
      return { week, kg, nokPerKg: v.nokPerKg, valueNok: kg * v.nokPerKg, priceWeek: v.priceWeek, formula: v.formula }
    },

    /** One row per product for the prices panel: rule, price, source, formula; manual rows are editable. */
    panel(week) {
      return rules.map((r) => {
        const v = valuePerKg(r.product, week)
        return { product: r.product, rule: v.rule, nokPerKg: v.nokPerKg, priceWeek: v.priceWeek ?? null, source: v.source, formula: v.formula, note: v.note, editable: v.rule === 'manual' }
      })
    },

    /** New pricer with a manual product repriced. Only manual rules may be edited. */
    withManualPrice(product, nokPerKg) {
      const rule = ruleFor.get(product)
      if (!rule) throw new Error(`No price rule for product ${product}`)
      if (rule.rule !== 'manual') throw new Error(`${product} is a ${rule.rule} rule; only manual rules can be edited`)
      const next = rules.map((r) => (r.product === product ? { ...r, nokPerKg } : r))
      return createPricer({ rules: next, edges, costCenters, prices })
    },
  }
}
