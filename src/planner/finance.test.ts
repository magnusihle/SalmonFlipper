import { describe, expect, it } from 'vitest'
import { SEED } from './seed'
import { buildGraph } from './graph'
import { rollupWeek } from './rollup'
import { massBalance } from './balance'
import { weekFinance, rawPriceFor } from './finance'
import { createPricer } from '../prices/pricing'
import { BUNDLED_PRICES, PRICE_RULES } from '../prices/book'

const g = buildGraph(SEED.edges, SEED.products)
const pricer = createPricer({ rules: PRICE_RULES, edges: SEED.edges, costCenters: SEED.costCenters, prices: BUNDLED_PRICES.prices })
const kg = (n: number) => Math.round(n)

describe('financial layer (§8)', () => {
  const plan = rollupWeek(g, '2026-W38', SEED.orders, SEED.supply)
  const balance = massBalance(g, plan)
  const fin = weekFinance(g, plan, balance, pricer, SEED)

  it('revenue is Σ kg × the order price', () => {
    expect(fin.revenueNok).toBe(1200 * 135 + 800 * 165 + 500 * 195 + 300 * 8)
    expect(fin.lines.every((l) => l.priced === 'ORDER')).toBe(true)
    expect(fin.revenueAtRiskNok).toBe(0)
  })

  it('raw cost uses the seed round price for the week', () => {
    expect(fin.raw.pricePerKg).toBe(60)
    expect(kg(fin.raw.costNok)).toBe(kg(plan.requiredRawKg * 60))
    expect(rawPriceFor(SEED.rawPrices, '2026-W41', pricer).pricePerKg).toBe(66) // latest before
    expect(rawPriceFor([], '2026-W41', pricer).source).toMatch(/SSB/) // falls back to the HOG reference
  })

  it('processing cost is kg entering each split × the cost centre rate', () => {
    const gut = fin.processing.find((c) => c.center.code === 'GUT')!
    expect(kg(gut.kgIn)).toBe(kg(plan.requiredRawKg))
    expect(kg(gut.costNok)).toBe(kg(plan.requiredRawKg * 2))
    const trimD = fin.processing.find((c) => c.center.code === 'TRIM_D')!
    expect(trimD.kgIn).toBe(0)
    expect(fin.processingNok).toBeGreaterThan(0)
  })

  it('the portioning line is over its weekly capacity in W38', () => {
    const portion = fin.processing.find((c) => c.center.code === 'PORTION')!
    expect(kg(portion.kgIn)).toBe(kg(500 / 0.9))
    expect(portion.capacityKg).toBe(500)
    expect(portion.over).toBe(true)
    expect(fin.overCapacity.map((c) => c.center.code)).toEqual(['PORTION'])
  })

  it('the residual is valued row by row and spare raw at the HOG reference', () => {
    const head = fin.residual.find((r) => r.product === 'HEAD')!
    expect(head.nokPerKg).toBe(6)
    expect(kg(head.valueNok)).toBe(kg(head.residualKg * 6))
    expect(fin.residual.every((r) => r.kind !== 'LOSS')).toBe(true)
    expect(kg(fin.unallocated.kg)).toBe(1014)
    expect(fin.unallocated.priceWeek).toBe('2026-W36')
    expect(fin.marginNok).toBe(fin.revenueNok + fin.residualNok - fin.raw.costNok - fin.processingNok)
  })

  it('a line without a price is valued by the price rules', () => {
    const orders = SEED.orders.map((o) => (o.orderNo === 'ORD-003' ? { ...o, pricePerKg: undefined } : o))
    const p = rollupWeek(g, '2026-W38', orders, SEED.supply)
    const f = weekFinance(g, p, massBalance(g, p), pricer, SEED)
    const line = f.lines.find((l) => l.orderNo === 'ORD-003')!
    expect(line.priced).toBe('DERIVED')
    expect(line.nokPerKg).toBe(pricer.valuePerKg('PORTION_E', '2026-W38').nokPerKg)
  })

  it('W39 cannot be met, so part of the revenue is at risk', () => {
    const p = rollupWeek(g, '2026-W39', SEED.orders, SEED.supply)
    const f = weekFinance(g, p, massBalance(g, p), pricer, SEED)
    expect(f.revenueAtRiskNok).toBeGreaterThan(0)
    expect(f.revenueAtRiskNok).toBeLessThan(f.revenueNok)
    expect(f.unallocated.kg).toBe(0)
  })
})
