import { usePlan } from '../planner/usePlan'
import { useStore } from '../store'
import { kr, n0, n2, pct0, shortWeek } from '../format'
import { Card, Flag, NumberField, Stat } from './ui'

export function SupplyPanel() {
  const { current } = usePlan()
  const { plan, finance } = current
  const setSupplyKg = useStore((s) => s.setSupplyKg)
  const setRawPrice = useStore((s) => s.setRawPrice)
  const supply = plan.supplyRawKg ?? 0
  const max = Math.max(20000, Math.ceil((Math.max(supply, plan.requiredRawKg) * 1.3) / 1000) * 1000)

  return (
    <Card eyebrow={`Supply · ${shortWeek(plan.week)}`} title="Raw fish" from="left" delay={0.05}>
      <label className="fieldrow">
        <span className="label">Raw kg</span>
        <input type="range" min={0} max={max} step={100} value={supply} onChange={(e) => setSupplyKg(plan.week, Number(e.target.value))} />
        <NumberField value={supply} step={100} onChange={(v) => setSupplyKg(plan.week, v)} suffix="kg" className="w-110" />
      </label>
      <label className="fieldrow">
        <span className="label">Round price</span>
        <span className="hint-inline">{finance.raw.source}</span>
        <NumberField value={finance.raw.pricePerKg} step={0.5} onChange={(v) => setRawPrice(plan.week, v)} suffix="NOK/kg" className="w-110" />
      </label>

      <dl className="summary">
        <Stat label="CUT raw" value={`${n0(plan.cutRawKg)} kg`} />
        {plan.extraRawKg > 0 && <Stat label="Extra fish" value={`${n0(plan.extraRawKg)} kg`} tone="warn" sub="for by-products" />}
        <Stat label="Required" value={`${n0(plan.requiredRawKg)} kg`} />
        {plan.flag === 'CANNOT BE MET' && <Stat label="Gap" value={`${n0(plan.gapRawKg)} kg`} tone="bad" sub={`${kr(finance.revenueAtRiskNok)} NOK at risk`} />}
        {plan.flag === 'OK' && (
          <Stat label="Unallocated" value={`${n0(plan.unallocatedRawKg)} kg`} sub={`${kr(finance.unallocated.valueNok)} NOK at HOG ${finance.unallocated.priceWeek ? shortWeek(finance.unallocated.priceWeek) : ''}`} />
        )}
        {plan.flag === 'NO SUPPLY PLANNED' && <Stat label="Supply" value="none" tone="warn" />}
      </dl>

      <table className="grid small">
        <caption>Cost centres · NOK per kg in · weekly capacity</caption>
        <thead>
          <tr>
            <th>centre</th>
            <th className="num">kg in</th>
            <th className="num">NOK</th>
            <th>capacity</th>
          </tr>
        </thead>
        <tbody>
          {finance.processing.map((c) => (
            <tr key={c.center.code} className={c.over ? 'unresolved' : c.kgIn < 0.5 ? 'idle' : ''}>
              <td>
                {c.center.name} <em className="kind">{n2(c.center.costPerKgIn)}/kg</em>
              </td>
              <td className="num">{c.kgIn > 0.5 ? n0(c.kgIn) : '–'}</td>
              <td className="num">{c.costNok > 0.5 ? n0(c.costNok) : '–'}</td>
              <td>
                <span className="util" title={`${n0(c.kgIn)} of ${n0(c.capacityKg)} kg`}>
                  <i className={c.over ? 'over' : ''} style={{ width: `${Math.min(100, c.utilisation * 100)}%` }} />
                </span>
                <em className="kind">{pct0(c.utilisation)}</em>
                {c.over && <Flag flag="OVER CAPACITY" />}
              </td>
            </tr>
          ))}
          <tr className="foot">
            <td>Raw {n2(finance.raw.pricePerKg)} × {n0(plan.requiredRawKg)} kg</td>
            <td className="num" />
            <td className="num">{n0(finance.raw.costNok)}</td>
            <td />
          </tr>
          <tr className="foot">
            <td>Processing</td>
            <td className="num" />
            <td className="num">{n0(finance.processingNok)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </Card>
  )
}
