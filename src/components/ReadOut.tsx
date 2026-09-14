import { usePlan } from '../planner/usePlan'
import { productName } from '../data/products'
import { kr, n0, n2, pct0, shortWeek } from '../format'
import { Card } from './ui'

type Item = { tone: 'ok' | 'bad' | 'warn' | 'note'; text: string }

/** Plain sentences about the selected week, in the order a planner would want to hear them. */
export function ReadOut() {
  const { current } = usePlan()
  const { plan, finance } = current
  const items: Item[] = []

  items.push({
    tone: finance.marginNok >= 0 ? 'ok' : 'bad',
    text: `Margin ${kr(finance.marginNok)} NOK on ${n0(plan.requiredRawKg)} kg raw (${n2(finance.marginPerRawKg)} NOK per raw kg): revenue ${kr(finance.revenueNok)}, residual ${kr(finance.residualNok)}, raw ${kr(finance.raw.costNok)}, processing ${kr(finance.processingNok)}.`,
  })

  if (plan.flag === 'CANNOT BE MET') {
    const biggest = [...plan.lines].filter((l) => l.kind === 'CUT').sort((a, b) => b.rawKg - a.rawKg)[0]
    const drop = biggest && biggest.cumYield ? plan.gapRawKg * biggest.cumYield : 0
    items.push({
      tone: 'bad',
      text: `Short ${n0(plan.gapRawKg)} kg raw. Buy that much more, or trim ${biggest.order.orderNo} (${biggest.order.product}) by ${n0(drop)} kg. About ${kr(finance.revenueAtRiskNok)} NOK of revenue rides on the missing fish.`,
    })
  }
  if (plan.flag === 'NO SUPPLY PLANNED') items.push({ tone: 'warn', text: 'No supply planned for this week — set raw kg in the supply card.' })

  for (const b of plan.byproducts) {
    if (b.extraRawKg > 0.5) {
      items.push({
        tone: 'warn',
        text: `${b.product} is ${n0(b.shortfallKg)} kg short of co-product output, so ${n0(b.extraRawKg)} kg of extra fish are bought for it; their ${b.fallsTo ?? 'cut product'} falls to residual.`,
      })
    } else if (b.coveredByExtraFishKg > 0.5) {
      const payer = plan.byproducts.find((o) => o.extraRawKg > 0.5)
      items.push({
        tone: 'note',
        text: `${b.product}'s ${n0(b.shortfallKg)} kg shortfall is covered by the fish bought for ${payer?.product ?? 'another by-product'} — no extra fish of its own.`,
      })
    }
  }

  for (const c of finance.overCapacity) {
    items.push({
      tone: 'bad',
      text: `${c.center.name} runs at ${pct0(c.utilisation)} of its weekly capacity (${n0(c.kgIn)} of ${n0(c.capacityKg)} kg). Add a shift or move the volume to another week.`,
    })
  }

  const top = [...finance.residual].sort((a, b) => b.valueNok - a.valueNok)[0]
  if (top) {
    items.push({
      tone: 'note',
      text: `Biggest unordered pile: ${n0(top.residualKg)} kg of ${productName(top.product)} worth ${kr(top.valueNok)} NOK at ${n2(top.nokPerKg)} NOK/kg (${top.rule}${top.rule === 'manual' ? ' placeholder' : ''}).`,
    })
  }

  if (plan.flag === 'OK' && plan.unallocatedRawKg > 0.5) {
    items.push({
      tone: 'note',
      text: `${n0(plan.unallocatedRawKg)} kg raw left unbought — ${kr(finance.unallocated.valueNok)} NOK at the HOG reference of ${n2(finance.unallocated.nokPerKg)} NOK/kg (SSB ${finance.unallocated.priceWeek ? shortWeek(finance.unallocated.priceWeek) : ''}).`,
    })
  }

  const derived = finance.lines.filter((l) => l.priced === 'DERIVED')
  if (derived.length) items.push({ tone: 'note', text: `${derived.length} order line${derived.length === 1 ? '' : 's'} carry no price and are valued by the price rules.` })

  return (
    <Card eyebrow={`Read-out · ${shortWeek(plan.week)}`} title="What the week says" from="bottom" delay={0.25} className="readout">
      <ul>
        {items.slice(0, 6).map((it, i) => (
          <li key={i} className={it.tone}>
            <i />
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
