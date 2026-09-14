import { describe, expect, it } from 'vitest'
import { SEED } from './seed'
import { buildGraph, cumYield, pattern, validateEdges, yieldAlongPath } from './graph'
import { rollupWeek } from './rollup'
import { massBalance } from './balance'
import type { Edge, Order } from './types'

const g = buildGraph(SEED.edges, SEED.products)
const kg = (n: number) => Math.round(n)
const find = (plan: ReturnType<typeof rollupWeek>, orderNo: string) => plan.lines.find((l) => l.order.orderNo === orderNo)!

describe('Dev A — graph', () => {
  it('validates the seed', () => {
    expect(validateEdges(SEED.edges)).toEqual([])
  })

  it('rejects a (parent, option) that sums to 0.98', () => {
    const edges = SEED.edges.map((e) => (e.parent === 'FILLET_A' && e.option === 'C' && e.child === 'MINCE' ? { ...e, yieldOfParent: 0.03 } : e))
    const errors = validateEdges(edges)
    expect(errors.map((e) => e.code)).toEqual(['SUM'])
    expect(errors[0].message).toContain('0.980')
    expect(() => buildGraph(edges)).toThrow(/0\.980/)
  })

  it('cumulative yields match §2', () => {
    expect(cumYield(g, 'HOG')).toBeCloseTo(0.88, 3)
    expect(cumYield(g, 'HEADLESS')).toBeCloseTo(0.783, 3)
    expect(cumYield(g, 'FILLET_A')).toBeCloseTo(0.627, 3)
    expect(cumYield(g, 'TRIM_C')).toBeCloseTo(0.551, 3)
    expect(cumYield(g, 'TRIM_D')).toBeCloseTo(0.526, 3)
    expect(cumYield(g, 'TRIM_E')).toBeCloseTo(0.482, 3)
    expect(cumYield(g, 'PORTION_E')).toBeCloseTo(0.43421, 5)
    expect(cumYield(g, 'HEAD')).toBeUndefined()
  })

  it('records the pattern per product', () => {
    expect(pattern(g, 'PORTION_E')).toEqual([
      { parent: 'ROUND', option: '-' },
      { parent: 'HOG', option: '-' },
      { parent: 'HEADLESS', option: '-' },
      { parent: 'FILLET_A', option: 'E' },
      { parent: 'TRIM_E', option: 'PORTION' },
    ])
    expect(pattern(g, 'HOG')).toEqual([{ parent: 'ROUND', option: '-' }])
  })

  it('by-product yield differs by path (the if/or yield)', () => {
    expect(yieldAlongPath(g, 'BELLY_FLAP', pattern(g, 'TRIM_C')!)).toBeCloseTo(0.627 * 0.07, 3)
    expect(yieldAlongPath(g, 'BELLY_FLAP', pattern(g, 'TRIM_E')!)).toBeCloseTo(0.627 * 0.09, 3)
    expect(yieldAlongPath(g, 'BELLY_FLAP', pattern(g, 'HOG')!)).toBe(0)
    expect(yieldAlongPath(g, 'HEAD', pattern(g, 'HOG')!)).toBe(0)
    // MINCE comes off twice on the portion path
    expect(yieldAlongPath(g, 'MINCE', pattern(g, 'PORTION_E')!)).toBeCloseTo(0.627 * 0.07 + 0.482 * 0.1, 3)
  })
})

describe('Dev B — W38 (§7)', () => {
  const plan = rollupWeek(g, '2026-W38', SEED.orders, SEED.supply)

  it('raw per line', () => {
    expect(kg(find(plan, 'ORD-001').rawKg)).toBe(2176)
    expect(kg(find(plan, 'ORD-002').rawKg)).toBe(1658)
    expect(kg(find(plan, 'ORD-003').rawKg)).toBe(1152)
    expect(kg(plan.cutRawKg)).toBe(4986)
  })

  it('HEAD is covered by co-product output, ORD-004 adds nothing', () => {
    const head = plan.byproducts.find((b) => b.product === 'HEAD')!
    expect(kg(head.outputKg)).toBe(483)
    expect(head.shortfallKg).toBe(0)
    expect(plan.extraRawKg).toBe(0)
    expect(find(plan, 'ORD-004').kind).toBe('BYPRODUCT')
  })

  it('fits with 1,014 kg unallocated', () => {
    expect(plan.flag).toBe('OK')
    expect(kg(plan.requiredRawKg)).toBe(4986)
    expect(kg(plan.unallocatedRawKg)).toBe(1014)
  })

  it('residual lists spare HEAD, FRAME and BELLY_FLAP from both routes', () => {
    const mb = massBalance(g, plan)
    const res = Object.fromEntries(mb.products.map((p) => [p.product, p.residualKg]))
    expect(kg(res.HEAD)).toBe(183)
    expect(kg(res.FRAME)).toBe(703)
    expect(kg(res.BELLY_FLAP)).toBe(kg(2176 * 0.627 * 0.07 + (1658 + 1152) * 0.627 * 0.09))
    expect(res.TRIM_C).toBeCloseTo(0, 6)
    for (const s of mb.splits) expect(Math.abs(s.residualError)).toBeLessThan(1e-6)
    expect(mb.totalOutKg).toBeCloseTo(mb.rawKg, 6)
  })
})

describe('Dev B — W39 (§7)', () => {
  const plan = rollupWeek(g, '2026-W39', SEED.orders, SEED.supply)

  it('raw per line, HOG bypasses the fillet table', () => {
    expect(kg(find(plan, 'ORD-005').rawKg)).toBe(3800)
    expect(kg(find(plan, 'ORD-006').rawKg)).toBe(1705)
    expect(kg(find(plan, 'ORD-008').rawKg)).toBe(6218)
    expect(kg(plan.cutRawKg)).toBe(11723)
  })

  it('belly comes only from the D and E fish, head from the same fish', () => {
    const belly = plan.byproducts.find((b) => b.product === 'BELLY_FLAP')!
    expect(kg(belly.outputKg)).toBe(565)
    expect(belly.shortfallKg).toBe(0)
    const mb = massBalance(g, plan)
    expect(kg(mb.products.find((p) => p.product === 'HEAD')!.outputKg)).toBe(970)
  })

  it('CANNOT BE MET with a 3,723 kg gap', () => {
    expect(plan.flag).toBe('CANNOT BE MET')
    expect(kg(plan.gapRawKg)).toBe(3723)
  })
})

describe('flags', () => {
  it('NO SUPPLY PLANNED and UNRESOLVED', () => {
    const orders: Order[] = [
      { orderNo: 'X-1', week: '2026-W40', product: 'TRIM_C', kg: 100 },
      { orderNo: 'X-2', week: '2026-W40', product: 'CAVIAR', kg: 5 },
    ]
    const plan = rollupWeek(g, '2026-W40', orders, SEED.supply)
    expect(plan.flag).toBe('NO SUPPLY PLANNED')
    expect(find(plan, 'X-2').kind).toBe('UNRESOLVED')
    expect(find(plan, 'X-2').flags).toContain('UNRESOLVED')
  })
})

describe('stress test (§7)', () => {
  it('option E TRIM_E 0.75 / MINCE 0.09 widens the W39 gap and still validates', () => {
    const edges: Edge[] = SEED.edges.map((e) => {
      if (e.parent !== 'FILLET_A' || e.option !== 'E') return e
      if (e.child === 'TRIM_E') return { ...e, yieldOfParent: 0.75 }
      if (e.child === 'MINCE') return { ...e, yieldOfParent: 0.09 }
      return e
    })
    expect(validateEdges(edges)).toEqual([])
    const g2 = buildGraph(edges)
    const plan = rollupWeek(g2, '2026-W39', SEED.orders, SEED.supply)
    expect(kg(find(plan, 'ORD-008').rawKg)).toBe(6384)
    expect(plan.gapRawKg).toBeGreaterThan(3723)
  })

  it('ORD-009 W38 FRAME 900 kg forces extra fish whose fillets fall to residual', () => {
    const orders = [...SEED.orders, { orderNo: 'ORD-009', week: '2026-W38', product: 'FRAME', kg: 900 }]
    const plan = rollupWeek(g, '2026-W38', orders, SEED.supply)
    const frame = plan.byproducts.find((b) => b.product === 'FRAME')!
    expect(kg(frame.outputKg)).toBe(703)
    expect(kg(frame.shortfallKg)).toBe(197)
    expect(frame.extraRawKg).toBeGreaterThan(0)
    expect(frame.fallsTo).toBe('FILLET_A')
    expect(kg(plan.requiredRawKg)).toBe(kg(4986 + frame.extraRawKg))
    const mb = massBalance(g, plan)
    const fillet = mb.products.find((p) => p.product === 'FILLET_A')!
    expect(fillet.residualKg).toBeGreaterThan(0)
    expect(kg(mb.products.find((p) => p.product === 'FRAME')!.residualKg)).toBe(0)
    expect(mb.totalOutKg).toBeCloseTo(mb.rawKg, 6)
  })
})

describe('by-product coverage is joint and order-independent', () => {
  const base = SEED.orders.filter((o) => o.week === '2026-W38' && o.product !== 'HEAD')
  const frame: Order = { orderNo: 'ORD-009', week: '2026-W38', product: 'FRAME', kg: 900 }
  const head: Order = { orderNo: 'ORD-010', week: '2026-W38', product: 'HEAD', kg: 600 }

  it('extra fish bought for FRAME also cover the HEAD shortfall', () => {
    const plan = rollupWeek(g, '2026-W38', [...base, frame, head], SEED.supply)
    const f = plan.byproducts.find((b) => b.product === 'FRAME')!
    const h = plan.byproducts.find((b) => b.product === 'HEAD')!
    // FRAME: 197 kg short → 1,398 kg extra fish, which bring 1,398 × 0.88 × 0.11 = 135 kg of HEAD
    expect(kg(f.shortfallKg)).toBe(197)
    expect(kg(f.extraRawKg)).toBe(1398)
    expect(kg(h.outputKg)).toBe(483)
    expect(kg(h.shortfallKg)).toBe(117)
    expect(kg(h.coveredByExtraFishKg)).toBe(117)
    expect(h.extraRawKg).toBe(0)
    expect(kg(plan.extraRawKg)).toBe(1398)
    expect(kg(plan.requiredRawKg)).toBe(6384)
    const mb = massBalance(g, plan)
    expect(mb.products.find((p) => p.product === 'HEAD')!.residualKg).toBeGreaterThanOrEqual(0)
    expect(mb.totalOutKg).toBeCloseTo(mb.rawKg, 6)
  })

  it('the same lines in a different order give the same week', () => {
    const a = rollupWeek(g, '2026-W38', [...base, frame, head], SEED.supply)
    const b = rollupWeek(g, '2026-W38', [...base, head, frame], SEED.supply)
    expect(b.requiredRawKg).toBeCloseTo(a.requiredRawKg, 6)
    expect(b.extraRawKg).toBeCloseTo(a.extraRawKg, 6)
    expect(b.pulls.length).toBe(a.pulls.length)
    const res = (plan: typeof a) => Object.fromEntries(massBalance(g, plan).products.map((p) => [p.product, kg(p.residualKg)]))
    expect(res(b)).toEqual(res(a))
  })
})
