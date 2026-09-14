import { useMemo, useState } from 'react'
import { usePlan } from '../planner/usePlan'
import { pushPull } from '../planner/balance'
import { tone } from '../data/products'
import { n0, shortWeek } from '../format'
import { Card } from './ui'

const W = 760
const H = 270
const NODE_W = 10
const PAD = 7
const TOP = 22
const COL_X = [170, 400, 630]

type Node = { id: string; label: string; sub: string; color: string; col: number; kg: number; y: number; h: number }
type Link = { source: string; target: string; kg: number; color: string; sy: number; ty: number; h: number }

/** Raw pulls → terminal products → ordered / residual / loss, as ribbons whose width is kg. */
export function FlowPanel() {
  const { g, current } = usePlan()
  const { plan, balance } = current
  const [hover, setHover] = useState<string | null>(null)

  const { nodes, links } = useMemo(() => {
    const nodes: Node[] = []
    const raw: { source: string; target: string; kg: number; color: string }[] = []
    const ordered = new Map(balance.products.map((p) => [p.product, p.orderedKg]))

    plan.pulls.forEach((pull, i) => {
      const id = `pull:${i}`
      const label = pull.reason.kind === 'ORDER' ? `${pull.reason.orderNo} · ${pull.endProduct}` : `Extra fish · ${pull.reason.product}`
      nodes.push({ id, label, sub: `${n0(pull.rawKg)} kg`, color: pull.reason.kind === 'ORDER' ? tone(pull.endProduct) : tone('ROUND'), col: 0, kg: pull.rawKg, y: 0, h: 0 })
      for (const [product, kg] of pushPull(g, pull)) raw.push({ source: id, target: `prod:${product}`, kg, color: tone(product) })
    })

    for (const p of balance.products) {
      nodes.push({ id: `prod:${p.product}`, label: p.product, sub: `${n0(p.outputKg)} kg`, color: tone(p.product), col: 1, kg: p.outputKg, y: 0, h: 0 })
      if (p.kind === 'LOSS') raw.push({ source: `prod:${p.product}`, target: 'dest:loss', kg: p.outputKg, color: tone('LOSS') })
      else {
        const sold = Math.min(p.outputKg, ordered.get(p.product) ?? 0)
        if (sold > 0.5) raw.push({ source: `prod:${p.product}`, target: 'dest:ordered', kg: sold, color: tone(p.product) })
        if (p.outputKg - sold > 0.5) raw.push({ source: `prod:${p.product}`, target: 'dest:residual', kg: p.outputKg - sold, color: tone(p.product) })
      }
    }
    const sum = (target: string) => raw.filter((l) => l.target === target).reduce((s, l) => s + l.kg, 0)
    const dest = [
      { id: 'dest:ordered', label: 'Ordered', color: 'var(--salmon-deep)' },
      { id: 'dest:residual', label: 'Residual', color: '#a99d84' },
      { id: 'dest:loss', label: 'Loss', color: '#cfc6b3' },
    ]
    for (const d of dest) {
      const kg = sum(d.id)
      if (kg > 0.5) nodes.push({ ...d, sub: `${n0(kg)} kg`, col: 2, kg, y: 0, h: 0 })
    }

    const cols = [0, 1, 2].map((c) => nodes.filter((n) => n.col === c))
    const maxKg = Math.max(...cols.map((col) => col.reduce((a, n) => a + n.kg, 0)), 1)
    const scale = (H - TOP * 2 - Math.max(...cols.map((c) => Math.max(0, c.length - 1) * PAD))) / maxKg
    for (const col of cols) {
      const total = col.reduce((a, n) => a + n.kg * scale, 0) + Math.max(0, col.length - 1) * PAD
      let y = TOP + (H - TOP * 2 - total) / 2
      for (const n of col) {
        n.y = y
        n.h = Math.max(n.kg * scale, 1.5)
        y += n.h + PAD
      }
    }

    const byId = new Map(nodes.map((n) => [n.id, n]))
    const outOff = new Map<string, number>()
    const inOff = new Map<string, number>()
    const links: Link[] = []
    const sorted = [...raw].sort((a, b) => (byId.get(a.target)?.y ?? 0) - (byId.get(b.target)?.y ?? 0) || (byId.get(a.source)?.y ?? 0) - (byId.get(b.source)?.y ?? 0))
    for (const l of sorted) {
      const s = byId.get(l.source)
      const t = byId.get(l.target)
      if (!s || !t || l.kg < 0.5) continue
      const h = l.kg * scale
      const sy = s.y + (outOff.get(s.id) ?? 0)
      const ty = t.y + (inOff.get(t.id) ?? 0)
      outOff.set(s.id, sy - s.y + h)
      inOff.set(t.id, ty - t.y + h)
      links.push({ ...l, sy, ty, h })
    }
    return { nodes, links }
  }, [g, plan, balance])

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const dim = (l: Link) => hover !== null && l.source !== hover && l.target !== hover

  return (
    <Card eyebrow={`Flow · ${shortWeek(plan.week)}`} title="Where every kilo goes" from="bottom" delay={0.15} className="flow">
      {nodes.length === 0 ? (
        <p className="path">Nothing to cut this week.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="flow-svg" onMouseLeave={() => setHover(null)}>
          {links.map((l, i) => {
            const s = byId.get(l.source)!
            const t = byId.get(l.target)!
            const x0 = COL_X[s.col] + NODE_W
            const x1 = COL_X[t.col]
            const mx = (x0 + x1) / 2
            const d = `M ${x0} ${l.sy} C ${mx} ${l.sy}, ${mx} ${l.ty}, ${x1} ${l.ty} L ${x1} ${l.ty + l.h} C ${mx} ${l.ty + l.h}, ${mx} ${l.sy + l.h}, ${x0} ${l.sy + l.h} Z`
            return (
              <path key={i} d={d} fill={l.color} opacity={dim(l) ? 0.08 : hover ? 0.8 : 0.5} onMouseEnter={() => setHover(l.source)}>
                <title>{`${s.label} → ${t.label}: ${n0(l.kg)} kg`}</title>
              </path>
            )
          })}
          {nodes.map((n) => {
            const x = COL_X[n.col]
            const faded = hover !== null && hover !== n.id && !links.some((l) => (l.source === hover && l.target === n.id) || (l.target === hover && l.source === n.id))
            return (
              <g key={n.id} opacity={faded ? 0.3 : 1} onMouseEnter={() => setHover(n.id)}>
                <rect x={x} y={n.y} width={NODE_W} height={n.h} rx={2} fill={n.color} stroke="var(--line)" />
                <text x={n.col === 0 ? x - 8 : x + NODE_W + 8} y={n.y + n.h / 2} dy="0.35em" textAnchor={n.col === 0 ? 'end' : 'start'} className="flow-label">
                  {n.label}
                  <tspan className="flow-sub"> {n.sub}</tspan>
                </text>
              </g>
            )
          })}
          <g className="flow-col">
            <text x={COL_X[0] + NODE_W / 2} y={11} textAnchor="middle">
              RAW PULLS
            </text>
            <text x={COL_X[1] + NODE_W / 2} y={11} textAnchor="middle">
              PRODUCTS
            </text>
            <text x={COL_X[2] + NODE_W / 2} y={11} textAnchor="middle">
              DESTINATION
            </text>
          </g>
        </svg>
      )}
    </Card>
  )
}
