// The financial layer on top of the mass balance (brief §8): what the week earns, what the raw and
// the cost centres cost, what the residual is worth at derived / reference prices, and whether any
// cost centre runs past its weekly capacity.
import type { Graph } from './graph'
import type { MassBalance, ProductBalance } from './balance'
import type { WeekPlan } from './rollup'
import type { CostCenter, RawPrice } from './types'
import type { Pricer } from '../prices/pricing'
import type { PriceRuleKind } from '../prices/types'

export type LineValue = {
  orderNo: string
  product: string
  kg: number
  nokPerKg: number
  /** ORDER = the order's own price; DERIVED = no price on the order, valued by the price rules */
  priced: 'ORDER' | 'DERIVED'
  revenueNok: number
}

export type CostLine = {
  center: CostCenter
  kgIn: number
  costNok: number
  capacityKg: number
  /** kgIn / capacityKg */
  utilisation: number
  over: boolean
}

export type ValuedResidual = ProductBalance & { nokPerKg: number; valueNok: number; rule: PriceRuleKind; formula: string; source: string }

export type WeekFinance = {
  week: string
  lines: LineValue[]
  revenueNok: number
  /** when CANNOT BE MET: the share of revenue the missing raw would have carried (pro-rata to the gap) */
  revenueAtRiskNok: number
  raw: { pricePerKg: number; source: string; costNok: number }
  processing: CostLine[]
  processingNok: number
  residual: ValuedResidual[]
  residualNok: number
  unallocated: { kg: number; nokPerKg: number; valueNok: number; priceWeek?: string; formula: string }
  /** revenue + residual value − raw − processing */
  marginNok: number
  marginPerRawKg: number
  overCapacity: CostLine[]
}

/** Round price for a week: exact, else latest on or before, else the HOG reference through the ROUND rule. */
export function rawPriceFor(rawPrices: RawPrice[], week: string, pricer: Pricer): { pricePerKg: number; source: string } {
  const rows = [...rawPrices].sort((a, b) => (a.week < b.week ? -1 : 1))
  const exact = rows.find((r) => r.week === week)
  if (exact) return { pricePerKg: exact.pricePerKgRound, source: `seed raw price ${week}` }
  const before = rows.filter((r) => r.week <= week)
  if (before.length) {
    const r = before[before.length - 1]
    return { pricePerKg: r.pricePerKgRound, source: `seed raw price ${r.week} (latest before ${week})` }
  }
  const v = pricer.valuePerKg('ROUND', week)
  return { pricePerKg: v.nokPerKg, source: `${v.referenceSource} ${v.priceWeek ?? ''} (no seed raw price)`.trim() }
}

export function weekFinance(
  _g: Graph,
  plan: WeekPlan,
  balance: MassBalance,
  pricer: Pricer,
  seed: { rawPrices: RawPrice[]; costCenters: CostCenter[] },
): WeekFinance {
  const week = plan.week

  const lines: LineValue[] = plan.lines
    .filter((l) => l.kind !== 'UNRESOLVED')
    .map((l) => {
      const own = l.order.pricePerKg
      const nokPerKg = typeof own === 'number' ? own : pricer.valuePerKg(l.order.product, week).nokPerKg
      return { orderNo: l.order.orderNo, product: l.order.product, kg: l.order.kg, nokPerKg, priced: typeof own === 'number' ? 'ORDER' : 'DERIVED', revenueNok: l.order.kg * nokPerKg }
    })
  const revenueNok = lines.reduce((s, l) => s + l.revenueNok, 0)
  const revenueAtRiskNok = plan.flag === 'CANNOT BE MET' && plan.requiredRawKg > 0 ? revenueNok * (plan.gapRawKg / plan.requiredRawKg) : 0

  const rawPrice = rawPriceFor(seed.rawPrices, week, pricer)
  const raw = { ...rawPrice, costNok: plan.requiredRawKg * rawPrice.pricePerKg }

  const processing: CostLine[] = seed.costCenters.map((center) => {
    const split = balance.splits.find((s) => s.parent === center.parent && s.option === center.option)
    const kgIn = split?.parentKg ?? 0
    const capacityKg = center.capacityKgPerDay * center.daysPerWeek
    const utilisation = capacityKg > 0 ? kgIn / capacityKg : 0
    return { center, kgIn, costNok: kgIn * center.costPerKgIn, capacityKg, utilisation, over: utilisation > 1 + 1e-9 }
  })
  const processingNok = processing.reduce((s, c) => s + c.costNok, 0)

  const residualRows = balance.products.filter((p) => p.kind !== 'LOSS' && p.residualKg > 0.5).map((p) => ({ ...p, kg: p.residualKg }))
  const valued = pricer.valueResidual(residualRows, week)
  const residual: ValuedResidual[] = valued.rows.map(({ kg: _kg, ...r }) => r)
  const residualNok = valued.totalNok

  const u = plan.flag === 'OK' ? pricer.valueUnallocatedRaw(plan.unallocatedRawKg, week) : pricer.valueUnallocatedRaw(0, week)
  const unallocated = { kg: u.kg, nokPerKg: u.nokPerKg, valueNok: u.valueNok, priceWeek: u.priceWeek, formula: u.formula }

  const marginNok = revenueNok + residualNok - raw.costNok - processingNok
  return {
    week,
    lines,
    revenueNok,
    revenueAtRiskNok,
    raw,
    processing,
    processingNok,
    residual,
    residualNok,
    unallocated,
    marginNok,
    marginPerRawKg: plan.requiredRawKg > 0 ? marginNok / plan.requiredRawKg : 0,
    overCapacity: processing.filter((c) => c.over),
  }
}
