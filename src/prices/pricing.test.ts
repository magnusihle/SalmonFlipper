import { describe, expect, it } from 'vitest'
import fixture from './fixtures/ssb-03024-3weeks.json'
import { SEED } from '../planner/seed'
import { parseJsonStat, type JsonStatDataset } from './ssb'
import { priceFor } from './prices'
import { createPricer, validatePriceRules } from './pricing'
import { PRICE_RULES } from './book'

const prices = parseJsonStat(fixture as unknown as JsonStatDataset, { fetchedAt: 'T' }) // HOG for 2026-W34..W36
const hog = (week: string) => priceFor(prices, 'HOG', week)!.nokPerKg
const pricer = createPricer({ rules: PRICE_RULES, edges: SEED.edges, costCenters: SEED.costCenters, prices })
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)

describe('derived prices (issue #7)', () => {
  it('reference rule: HOG takes the SSB price for that week', () => {
    const v = pricer.valuePerKg('HOG', '2026-W35')
    expect(v.rule).toBe('reference')
    expect(v.nokPerKg).toBe(hog('2026-W35'))
    expect(v.priceWeek).toBe('2026-W35')
    expect(v.source).toMatch(/SSB 03024/)
    expect(v.formula).toMatch(/2026-W35/)
  })

  it('reference rule falls back to the latest published week on or before the requested one', () => {
    const v = pricer.valuePerKg('HOG', '2026-W38')
    expect(v.nokPerKg).toBe(hog('2026-W36'))
    expect(v.priceWeek).toBe('2026-W36')
  })

  it('ROUND (unallocated raw) is valued at the HOG reference price', () => {
    const v = pricer.valuePerKg('ROUND', '2026-W38')
    expect(v.nokPerKg).toBe(hog('2026-W36'))
    expect(v.formula).toMatch(/HOG/)
  })

  it('manual rule: by-products use the hand-entered placeholder with its note', () => {
    const v = pricer.valuePerKg('HEAD', '2026-W38')
    expect(v.rule).toBe('manual')
    expect(v.nokPerKg).toBe(6)
    expect(v.note).toMatch(/placeholder/i)
    expect(v.formula).toBe('manual 6.00 NOK/kg')
  })

  it('derived rule: parent price plus cost per kg in, less by-product credit, over the cut yield', () => {
    // HEADLESS from HOG: option "-", HEADLESS 0.89, HEAD 0.11; HEADING costs 1 NOK per kg in.
    const v = pricer.valuePerKg('HEADLESS', '2026-W38')
    expect(v.rule).toBe('derived')
    close(v.nokPerKg, (hog('2026-W36') + 1 - 0.11 * 6) / 0.89)
    expect(v.formula).toMatch(/HOG/)
    expect(v.formula).toMatch(/0\.89/)
    expect(v.formula).toMatch(/HEAD/)
    expect(v.credits!.map((c) => c.product)).toEqual(['HEAD'])
  })

  it('derived rule resolves the whole chain down to portions', () => {
    const headless = (hog('2026-W36') + 1 - 0.11 * 6) / 0.89
    const filletA = (headless + 4 - 0.18 * 3) / 0.8
    const trimE = (filletA + 5.5 - 0.09 * 20 - 0.07 * 4 - 0.07 * 12) / 0.77
    const portion = (trimE + 6 - 0.1 * 12) / 0.9
    close(pricer.valuePerKg('FILLET_A', '2026-W38').nokPerKg, filletA)
    close(pricer.valuePerKg('TRIM_E', '2026-W38').nokPerKg, trimE)
    close(pricer.valuePerKg('PORTION_E', '2026-W38').nokPerKg, portion)
  })

  it('an explicit costPerKg on a derived rule overrides the cost centre', () => {
    const custom = PRICE_RULES.map((r) => (r.product === 'HEADLESS' ? { ...r, costPerKg: 3 } : r))
    const p = createPricer({ rules: custom, edges: SEED.edges, costCenters: SEED.costCenters, prices })
    close(p.valuePerKg('HEADLESS', '2026-W38').nokPerKg, (hog('2026-W36') + 3 - 0.11 * 6) / 0.89)
  })

  it('a product without a rule throws a clear error', () => {
    expect(() => pricer.valuePerKg('CAVIAR', '2026-W38')).toThrow(/no price rule/i)
  })

  it('valueResidual puts kg × NOK/kg on every row and totals the week', () => {
    const rows = [
      { product: 'HEAD', kg: 183 },
      { product: 'FRAME', kg: 703 },
      { product: 'BELLY_FLAP', kg: 100 },
    ]
    const r = pricer.valueResidual(rows, '2026-W38')
    expect(r.rows.length).toBe(3)
    expect(r.rows[0].nokPerKg).toBe(6)
    close(r.rows[0].valueNok, 183 * 6)
    close(r.rows[1].valueNok, 703 * 3)
    close(r.rows[2].valueNok, 100 * 20)
    close(r.totalNok, 183 * 6 + 703 * 3 + 100 * 20)
    expect(r.rows[1].formula).toBeTruthy()
  })

  it('valueUnallocatedRaw prices spare raw kg at the HOG reference for the week', () => {
    const u = pricer.valueUnallocatedRaw(1014, '2026-W38')
    expect(u.kg).toBe(1014)
    close(u.valueNok, 1014 * hog('2026-W36'))
    expect(u.priceWeek).toBe('2026-W36')
  })

  it('withManualPrice returns a new pricer whose residual total moves; the original is unchanged', () => {
    const rows = [{ product: 'FRAME', kg: 703 }]
    const before = pricer.valueResidual(rows, '2026-W38').totalNok
    const changed = pricer.withManualPrice('FRAME', 10)
    close(changed.valueResidual(rows, '2026-W38').totalNok, 7030)
    close(pricer.valueResidual(rows, '2026-W38').totalNok, before)
    // Derived prices that credit FRAME move too.
    expect(changed.valuePerKg('FILLET_A', '2026-W38').nokPerKg).toBeLessThan(pricer.valuePerKg('FILLET_A', '2026-W38').nokPerKg)
  })

  it('withManualPrice refuses to overwrite a non-manual rule', () => {
    expect(() => pricer.withManualPrice('HOG', 99)).toThrow(/manual/)
  })

  it('panel lists every product in the graph; only manual rows are editable', () => {
    const panel = pricer.panel('2026-W38')
    expect(panel.map((r) => r.product).sort()).toEqual(SEED.products.map((p) => p.code).sort())
    for (const row of panel) {
      expect(['reference', 'derived', 'manual']).toContain(row.rule)
      expect(typeof row.nokPerKg).toBe('number')
      expect(row.source).toBeTruthy()
      expect(row.formula).toBeTruthy()
      expect(row.editable).toBe(row.rule === 'manual')
    }
  })

  it('validatePriceRules: the shipped rules cover every product in the seed', () => {
    expect(validatePriceRules(PRICE_RULES, SEED)).toEqual([])
  })

  it('validatePriceRules rejects a derived rule whose ref is not the product’s CUT parent', () => {
    const bad = PRICE_RULES.map((r) => (r.product === 'TRIM_E' ? { ...r, ref: 'HOG' } : r))
    const errors = validatePriceRules(bad, SEED)
    expect(errors.length).toBe(1)
    expect(errors[0]).toMatch(/TRIM_E/)
    expect(errors[0]).toMatch(/HOG/)
  })
})
