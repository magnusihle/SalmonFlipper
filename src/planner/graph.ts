import { LOSS, ROOT, type Edge, type PathStep, type Product } from './types'

export const SUM_TOLERANCE = 1e-6

export type Graph = {
  edges: Edge[]
  products: Map<string, Product>
  /** parent → option → edges of that split */
  splits: Map<string, Map<string, Edge[]>>
  /** child → the single CUT edge that produces it */
  cutParent: Map<string, Edge>
}

export type ValidationError = { code: string; message: string }

/** Rules from §3. Returns an empty list when the edge set is a valid cut pattern. */
export function validateEdges(edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = []
  const groups = new Map<string, Edge[]>()
  for (const e of edges) {
    const key = `${e.parent}|${e.option}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  for (const [key, group] of groups) {
    const sum = group.reduce((s, e) => s + e.yieldOfParent, 0)
    if (Math.abs(sum - 1) > SUM_TOLERANCE) {
      errors.push({ code: 'SUM', message: `(${key.replace('|', ', ')}) yields sum to ${sum.toFixed(3)}, expected 1.000` })
    }
    const cuts = group.filter((e) => e.kind === 'CUT')
    if (cuts.length > 1) {
      errors.push({ code: 'MULTI_CUT', message: `(${key.replace('|', ', ')}) has ${cuts.length} CUT children; expected at most one` })
    }
  }
  const cutParents = new Map<string, Edge[]>()
  for (const e of edges) {
    if (e.kind !== 'CUT') continue
    cutParents.set(e.child, [...(cutParents.get(e.child) ?? []), e])
    if (e.child === LOSS) errors.push({ code: 'LOSS_CUT', message: `LOSS cannot be a CUT child (${e.parent}, ${e.option})` })
  }
  for (const [child, parents] of cutParents) {
    if (parents.length > 1) {
      errors.push({ code: 'MULTI_PATH', message: `${child} has ${parents.length} paths to ${ROOT}; the seed must keep a single path` })
    }
  }
  // every CUT chain must reach ROUND
  for (const [child] of cutParents) {
    const seen = new Set<string>()
    let cur = child
    while (cur !== ROOT) {
      if (seen.has(cur)) {
        errors.push({ code: 'CYCLE', message: `${child} never reaches ${ROOT} (cycle at ${cur})` })
        break
      }
      seen.add(cur)
      const up = cutParents.get(cur)?.[0]
      if (!up) {
        if (cur !== child) errors.push({ code: 'ORPHAN', message: `${cur} has no CUT parent, so ${child} never reaches ${ROOT}` })
        break
      }
      cur = up.parent
    }
  }
  return errors
}

/** Builds the graph. Throws with every validation message when the edge set breaks a §3 rule. */
export function buildGraph(edges: Edge[], products: Product[] = []): Graph {
  const errors = validateEdges(edges)
  if (errors.length) throw new Error(`Invalid cut pattern:\n${errors.map((e) => ` - ${e.message}`).join('\n')}`)
  const splits = new Map<string, Map<string, Edge[]>>()
  const cutParent = new Map<string, Edge>()
  for (const e of edges) {
    const byOption = splits.get(e.parent) ?? new Map<string, Edge[]>()
    byOption.set(e.option, [...(byOption.get(e.option) ?? []), e])
    splits.set(e.parent, byOption)
    if (e.kind === 'CUT') cutParent.set(e.child, e)
  }
  return { edges, products: new Map(products.map((p) => [p.code, p])), splits, cutParent }
}

export function isCutProduct(g: Graph, code: string) {
  return code === ROOT || g.cutParent.has(code)
}

export function isByproduct(g: Graph, code: string) {
  return !isCutProduct(g, code) && g.edges.some((e) => e.child === code && e.kind === 'BYPRODUCT')
}

export function isKnownProduct(g: Graph, code: string) {
  return isCutProduct(g, code) || isByproduct(g, code)
}

/**
 * Step 1 — the pattern of a CUT product: the (parent, option) choices from ROUND down to it.
 * Undefined for products that are not CUT products.
 */
export function pattern(g: Graph, code: string): PathStep[] | undefined {
  if (!isCutProduct(g, code)) return undefined
  const steps: PathStep[] = []
  let cur = code
  while (cur !== ROOT) {
    const e = g.cutParent.get(cur)!
    steps.unshift({ parent: e.parent, option: e.option })
    cur = e.parent
  }
  return steps
}

/** Step 1 — cumulative yield of ROUND for a CUT product. */
export function cumYield(g: Graph, code: string): number | undefined {
  if (!isCutProduct(g, code)) return undefined
  let y = 1
  let cur = code
  while (cur !== ROOT) {
    const e = g.cutParent.get(cur)!
    y *= e.yieldOfParent
    cur = e.parent
  }
  return y
}

/** Cumulative yield of ROUND for the CUT product a path ends in (or the parent of the last step). */
function cumYieldOfParent(g: Graph, parent: string) {
  return cumYield(g, parent) ?? 0
}

/**
 * Kg of `product` that comes off 1 kg of ROUND cut along `path`.
 * A by-product only comes from raw that passes its split, so HOG sold whole yields no HEAD.
 * A product can come off more than one split on the same path (MINCE at trimming and again at portioning).
 */
export function yieldAlongPath(g: Graph, product: string, path: PathStep[]): number {
  let y = 0
  for (const step of path) {
    const group = g.splits.get(step.parent)?.get(step.option) ?? []
    for (const e of group) {
      if (e.child === product && e.kind !== 'CUT') y += cumYieldOfParent(g, step.parent) * e.yieldOfParent
    }
  }
  return y
}

/**
 * The default CUT path used when a by-product shortfall needs extra whole fish (§4 step 3).
 * It is the path to the by-product's parent plus the first option (in seed order) that yields it.
 * Also returns the CUT product of that final split, whose output falls to residual.
 */
export function defaultByproductRoute(g: Graph, product: string): { path: PathStep[]; fallsTo: string | undefined } | undefined {
  const edge = g.edges.find((e) => e.child === product && e.kind === 'BYPRODUCT')
  if (!edge) return undefined
  const up = pattern(g, edge.parent)
  if (!up) return undefined
  const path = [...up, { parent: edge.parent, option: edge.option }]
  const cut = g.splits.get(edge.parent)?.get(edge.option)?.find((e) => e.kind === 'CUT')
  return { path, fallsTo: cut?.child }
}
