import { usePlan } from '../planner/usePlan'
import { useStore } from '../store'
import { kr, n0, shortWeek } from '../format'
import { Card } from './ui'

const W = 520
const H = 240
const M = { l: 52, r: 12, t: 14, b: 44 }

/** Raw required (CUT raw + extra fish) against planned supply, week by week. */
export function WeeksChart() {
  const { weeks } = usePlan()
  const week = useStore((s) => s.week)
  const selectWeek = useStore((s) => s.selectWeek)
  const innerW = W - M.l - M.r
  const innerH = H - M.t - M.b
  const slot = innerW / Math.max(1, weeks.length)
  const barW = Math.min(46, slot * 0.3)
  const maxKg = Math.max(...weeks.map((w) => Math.max(w.plan.requiredRawKg, w.plan.supplyRawKg ?? 0)), 1) * 1.1
  const y = (kg: number) => M.t + innerH - (kg / maxKg) * innerH

  return (
    <Card
      eyebrow="All weeks"
      title="Raw required vs supply"
      from="bottom"
      delay={0.2}
      action={
        <span className="legend-mini">
          <i className="sw cut" /> CUT raw <i className="sw extra" /> extra fish <i className="sw supply" /> supply
        </span>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={M.l} x2={W - M.r} y1={y(maxKg * f)} y2={y(maxKg * f)} className="gridline" />
            <text x={M.l - 6} y={y(maxKg * f)} dy="0.35em" textAnchor="end" className="tick">
              {n0(maxKg * f)}
            </text>
          </g>
        ))}
        {weeks.map(({ plan, finance }, i) => {
          const cx = M.l + i * slot + slot / 2
          const active = plan.week === week
          const supply = plan.supplyRawKg ?? 0
          return (
            <g key={plan.week} onClick={() => selectWeek(plan.week)} className="week-col">
              <rect x={M.l + i * slot} y={M.t} width={slot} height={innerH} fill={active ? 'rgba(234,106,49,.08)' : 'transparent'} rx={4} />
              <rect x={cx - barW - 3} y={y(plan.cutRawKg)} width={barW} height={y(0) - y(plan.cutRawKg)} className="bar cut" />
              {plan.extraRawKg > 0 && <rect x={cx - barW - 3} y={y(plan.requiredRawKg)} width={barW} height={y(plan.cutRawKg) - y(plan.requiredRawKg)} className="bar extra" />}
              <rect x={cx + 3} y={y(supply)} width={barW} height={y(0) - y(supply)} className="bar supply" />
              <text x={cx} y={H - M.b + 18} textAnchor="middle" className={`wk-tick${active ? ' active' : ''}`}>
                {shortWeek(plan.week)}
              </text>
              <text x={cx} y={H - M.b + 33} textAnchor="middle" className={`tick${finance.marginNok < 0 ? ' bad' : ''}`}>
                {kr(finance.marginNok)} NOK
              </text>
              {plan.flag === 'CANNOT BE MET' && (
                <text x={cx} y={y(plan.requiredRawKg) - 5} textAnchor="middle" className="tick bad">
                  −{n0(plan.gapRawKg)} kg
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
