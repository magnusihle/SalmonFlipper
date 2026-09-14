import { usePlan } from '../planner/usePlan'
import { centreName, productName, useLang, useT } from '../i18n'
import { kr, n0, n2, pct0, shortWeek } from '../format'
import { Card } from './ui'

type Item = { tone: 'ok' | 'bad' | 'warn' | 'note'; text: string }

/** Plain sentences about the selected week, in the order a planner would want to hear them. */
export function ReadOut() {
  const { current } = usePlan()
  const { plan, finance } = current
  const t = useT()
  const lang = useLang()
  const items: Item[] = []

  items.push({
    tone: finance.marginNok >= 0 ? 'ok' : 'bad',
    text: t('readout.margin', {
      margin: kr(finance.marginNok),
      raw: n0(plan.requiredRawKg),
      perKg: n2(finance.marginPerRawKg),
      revenue: kr(finance.revenueNok),
      residual: kr(finance.residualNok),
      rawCost: kr(finance.raw.costNok),
      processing: kr(finance.processingNok),
    }),
  })

  if (plan.flag === 'CANNOT BE MET') {
    const biggest = [...plan.lines].filter((l) => l.kind === 'CUT').sort((a, b) => b.rawKg - a.rawKg)[0]
    const drop = biggest && biggest.cumYield ? plan.gapRawKg * biggest.cumYield : 0
    items.push({
      tone: 'bad',
      text: t('readout.short', { gap: n0(plan.gapRawKg), order: biggest.order.orderNo, product: biggest.order.product, drop: n0(drop), atRisk: kr(finance.revenueAtRiskNok) }),
    })
  }
  if (plan.flag === 'NO SUPPLY PLANNED') items.push({ tone: 'warn', text: t('readout.noSupply') })

  for (const b of plan.byproducts) {
    if (b.extraRawKg > 0.5) {
      items.push({
        tone: 'warn',
        text: t('readout.extraFish', { product: b.product, short: n0(b.shortfallKg), extra: n0(b.extraRawKg), fallsTo: b.fallsTo ?? t('readout.cutProduct') }),
      })
    } else if (b.coveredByExtraFishKg > 0.5) {
      const payer = plan.byproducts.find((o) => o.extraRawKg > 0.5)
      items.push({
        tone: 'note',
        text: t('readout.coveredBy', { product: b.product, short: n0(b.shortfallKg), payer: payer?.product ?? t('readout.anotherByproduct') }),
      })
    }
  }

  for (const c of finance.overCapacity) {
    items.push({
      tone: 'bad',
      text: t('readout.overCapacity', { centre: centreName(lang, c.center.code, c.center.name), pct: pct0(c.utilisation), kg: n0(c.kgIn), cap: n0(c.capacityKg) }),
    })
  }

  const top = [...finance.residual].sort((a, b) => b.valueNok - a.valueNok)[0]
  if (top) {
    items.push({
      tone: 'note',
      text: t('readout.biggestPile', {
        kg: n0(top.residualKg),
        product: productName(lang, top.product),
        nok: kr(top.valueNok),
        price: n2(top.nokPerKg),
        rule: `${top.rule}${top.rule === 'manual' ? ` ${t('readout.placeholder')}` : ''}`,
      }),
    })
  }

  if (plan.flag === 'OK' && plan.unallocatedRawKg > 0.5) {
    items.push({
      tone: 'note',
      text: t('readout.unallocated', { kg: n0(plan.unallocatedRawKg), nok: kr(finance.unallocated.valueNok), price: n2(finance.unallocated.nokPerKg), week: finance.unallocated.priceWeek ? shortWeek(finance.unallocated.priceWeek) : '' }),
    })
  }

  const derived = finance.lines.filter((l) => l.priced === 'DERIVED')
  if (derived.length) items.push({ tone: 'note', text: derived.length === 1 ? t('readout.derived.one') : t('readout.derived.many', { n: derived.length }) })

  return (
    <Card eyebrow={`${t('readout.eyebrow')} · ${shortWeek(plan.week)}`} title={t('readout.title')} from="bottom" delay={0.25} className="readout">
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
