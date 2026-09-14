import { useMemo } from 'react'
import { useStore } from '../store'
import { SEED } from './seed'
import { buildGraph, type Graph } from './graph'
import { rollupAll, type WeekPlan } from './rollup'
import { massBalance, type MassBalance } from './balance'
import { weekFinance, type WeekFinance } from './finance'
import { createPricer, type Pricer } from '../prices/pricing'
import { PRICE_RULES } from '../prices/book'
import type { Order, RawPrice, Supply } from './types'
import type { Price } from '../prices/types'

export type WeekBundle = { plan: WeekPlan; balance: MassBalance; finance: WeekFinance }

export type Plan = {
  g: Graph
  pricer: Pricer
  weeks: WeekBundle[]
  byWeek: Map<string, WeekBundle>
  /** the selected week (falls back to the first) */
  current: WeekBundle
}

type Inputs = { orders: Order[]; supply: Supply[]; rawPrices: RawPrice[]; manualPrices: Record<string, number>; prices: Price[] }

let cache: { inputs: Inputs; value: Omit<Plan, 'current'> } | null = null

/** Recomputes only when one of the inputs changes identity — every panel shares the result. */
export function computePlan(inputs: Inputs): Omit<Plan, 'current'> {
  if (cache && (Object.keys(inputs) as (keyof Inputs)[]).every((k) => cache!.inputs[k] === inputs[k])) return cache.value
  const g = buildGraph(SEED.edges, SEED.products)
  const rules = PRICE_RULES.map((r) => (r.rule === 'manual' && inputs.manualPrices[r.product] !== undefined ? { ...r, nokPerKg: inputs.manualPrices[r.product] } : r))
  const pricer = createPricer({ rules, edges: SEED.edges, costCenters: SEED.costCenters, prices: inputs.prices })
  const weeks = rollupAll(g, inputs.orders, inputs.supply).map((plan) => {
    const balance = massBalance(g, plan)
    return { plan, balance, finance: weekFinance(g, plan, balance, pricer, { rawPrices: inputs.rawPrices, costCenters: SEED.costCenters }) }
  })
  const value = { g, pricer, weeks, byWeek: new Map(weeks.map((w) => [w.plan.week, w])) }
  cache = { inputs, value }
  return value
}

export function usePlan(): Plan {
  const orders = useStore((s) => s.orders)
  const supply = useStore((s) => s.supply)
  const rawPrices = useStore((s) => s.rawPrices)
  const manualPrices = useStore((s) => s.manualPrices)
  const prices = useStore((s) => s.priceBook.prices)
  const week = useStore((s) => s.week)
  return useMemo(() => {
    const base = computePlan({ orders, supply, rawPrices, manualPrices, prices })
    return { ...base, current: base.byWeek.get(week) ?? base.weeks[0] }
  }, [orders, supply, rawPrices, manualPrices, prices, week])
}
