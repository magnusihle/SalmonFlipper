import { usePlan } from '../planner/usePlan'
import { useStore } from '../store'
import { kr, n0, n2, pct0, shortWeek } from '../format'
import { Card, Flag, NumberField, Stat } from './ui'
import { centreName, useLang, useT } from '../i18n'

export function SupplyPanel() {
  const { current } = usePlan()
  const { plan, finance } = current
  const setSupplyKg = useStore((s) => s.setSupplyKg)
  const setRawPrice = useStore((s) => s.setRawPrice)
  const t = useT()
  const lang = useLang()
  const supply = plan.supplyRawKg ?? 0
  const max = Math.max(20000, Math.ceil((Math.max(supply, plan.requiredRawKg) * 1.3) / 1000) * 1000)

  return (
    <Card eyebrow={`${t('supply.eyebrow')} · ${shortWeek(plan.week)}`} title={t('supply.title')} from="left" delay={0.05}>
      <label className="fieldrow">
        <span className="label">{t('supply.rawKg')}</span>
        <input type="range" min={0} max={max} step={100} value={supply} onChange={(e) => setSupplyKg(plan.week, Number(e.target.value))} />
        <NumberField value={supply} step={100} onChange={(v) => setSupplyKg(plan.week, v)} suffix="kg" className="w-110" />
      </label>
      <label className="fieldrow">
        <span className="label">{t('supply.roundPrice')}</span>
        <span className="hint-inline">{finance.raw.source}</span>
        <NumberField value={finance.raw.pricePerKg} step={0.5} onChange={(v) => setRawPrice(plan.week, v)} suffix="NOK/kg" className="w-110" />
      </label>

      <dl className="summary">
        <Stat label={t('supply.cutRaw')} value={`${n0(plan.cutRawKg)} kg`} />
        {plan.extraRawKg > 0 && <Stat label={t('supply.extraFish')} value={`${n0(plan.extraRawKg)} kg`} tone="warn" sub={t('supply.forByproducts')} />}
        <Stat label={t('supply.required')} value={`${n0(plan.requiredRawKg)} kg`} />
        {plan.flag === 'CANNOT BE MET' && <Stat label={t('supply.gap')} value={`${n0(plan.gapRawKg)} kg`} tone="bad" sub={t('supply.atRisk', { nok: kr(finance.revenueAtRiskNok) })} />}
        {plan.flag === 'OK' && (
          <Stat label={t('supply.unallocated')} value={`${n0(plan.unallocatedRawKg)} kg`} sub={t('supply.unallocated.sub', { nok: kr(finance.unallocated.valueNok), week: finance.unallocated.priceWeek ? shortWeek(finance.unallocated.priceWeek) : '' })} />
        )}
        {plan.flag === 'NO SUPPLY PLANNED' && <Stat label={t('supply.supply')} value={t('supply.none')} tone="warn" />}
      </dl>

      <table className="grid small">
        <caption>{t('supply.centres.caption')}</caption>
        <thead>
          <tr>
            <th>{t('supply.centres.centre')}</th>
            <th className="num">{t('supply.centres.kgIn')}</th>
            <th className="num">{t('supply.centres.nok')}</th>
            <th>{t('supply.centres.capacity')}</th>
          </tr>
        </thead>
        <tbody>
          {finance.processing.map((c) => (
            <tr key={c.center.code} className={c.over ? 'unresolved' : c.kgIn < 0.5 ? 'idle' : ''}>
              <td>
                {centreName(lang, c.center.code, c.center.name)} <em className="kind">{n2(c.center.costPerKgIn)}/kg</em>
              </td>
              <td className="num">{c.kgIn > 0.5 ? n0(c.kgIn) : '–'}</td>
              <td className="num">{c.costNok > 0.5 ? n0(c.costNok) : '–'}</td>
              <td>
                <span className="util" title={t('supply.centres.util', { kg: n0(c.kgIn), cap: n0(c.capacityKg) })}>
                  <i className={c.over ? 'over' : ''} style={{ width: `${Math.min(100, c.utilisation * 100)}%` }} />
                </span>
                <em className="kind">{pct0(c.utilisation)}</em>
                {c.over && <Flag flag="OVER CAPACITY" />}
              </td>
            </tr>
          ))}
          <tr className="foot">
            <td>{t('supply.raw')} {n2(finance.raw.pricePerKg)} × {n0(plan.requiredRawKg)} kg</td>
            <td className="num" />
            <td className="num">{n0(finance.raw.costNok)}</td>
            <td />
          </tr>
          <tr className="foot">
            <td>{t('supply.processing')}</td>
            <td className="num" />
            <td className="num">{n0(finance.processingNok)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </Card>
  )
}
