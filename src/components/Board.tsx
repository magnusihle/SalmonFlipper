import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SEED, buildGraph, massBalance, rollupAll, type MassBalance, type OrderLine, type WeekPlan } from '../planner'
import { useStore } from '../store'

const n0 = (v: number) => Math.round(v).toLocaleString('en-GB')
const pct = (v: number) => (v * 100).toFixed(1) + '%'
const pathText = (line: OrderLine) => (line.path ? line.path.map((s) => (s.option === '-' ? s.parent : `${s.parent}·${s.option}`)).join(' › ') : '')

function Flag({ flag }: { flag: string }) {
  const tone = flag === 'OK' ? 'ok' : flag === 'CANNOT BE MET' ? 'bad' : 'warn'
  return <span className={`flag ${tone}`}>{flag}</span>
}

function WeekCard({ plan, balance }: { plan: WeekPlan; balance: MassBalance }) {
  const residual = balance.products.filter((p) => p.kind !== 'LOSS' && p.residualKg > 0.5)
  return (
    <section className="week">
      <header className="week-head">
        <h3>{plan.week}</h3>
        <Flag flag={plan.flag} />
      </header>

      <table className="grid">
        <thead>
          <tr>
            <th>Order</th>
            <th>Product</th>
            <th className="num">kg</th>
            <th className="num">cum. yield</th>
            <th className="num">raw kg</th>
            <th>pattern / coverage</th>
            <th>flag</th>
          </tr>
        </thead>
        <tbody>
          {plan.lines.map((l) => (
            <tr key={l.order.orderNo} className={l.kind === 'UNRESOLVED' ? 'unresolved' : ''}>
              <td>{l.order.orderNo}</td>
              <td>
                {l.order.product} <em className="kind">{l.kind}</em>
              </td>
              <td className="num">{n0(l.order.kg)}</td>
              <td className="num">{l.cumYield !== undefined ? pct(l.cumYield) : '–'}</td>
              <td className="num">{l.kind === 'CUT' ? n0(l.rawKg) : l.coverage ? `+${n0(l.coverage.extraRawKg)}` : '–'}</td>
              <td className="path">
                {l.kind === 'CUT' && pathText(l)}
                {l.coverage && `${n0(l.coverage.fromCoProduct)} kg from co-product${l.coverage.shortfall > 0.5 ? ` · ${n0(l.coverage.shortfall)} kg short` : ''}`}
              </td>
              <td>{l.flags.map((f) => <Flag key={f} flag={f} />)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="summary">
        <div>
          <dt>CUT raw</dt>
          <dd>{n0(plan.cutRawKg)} kg</dd>
        </div>
        {plan.extraRawKg > 0 && (
          <div>
            <dt>Extra fish for by-products</dt>
            <dd>{n0(plan.extraRawKg)} kg</dd>
          </div>
        )}
        <div>
          <dt>Required raw</dt>
          <dd>{n0(plan.requiredRawKg)} kg</dd>
        </div>
        <div>
          <dt>Supply</dt>
          <dd>{plan.supplyRawKg !== undefined ? `${n0(plan.supplyRawKg)} kg` : 'none'}</dd>
        </div>
        {plan.flag === 'CANNOT BE MET' && (
          <div className="bad">
            <dt>Gap</dt>
            <dd>{n0(plan.gapRawKg)} kg raw</dd>
          </div>
        )}
        {plan.flag === 'OK' && (
          <div>
            <dt>Unallocated raw</dt>
            <dd>{n0(plan.unallocatedRawKg)} kg</dd>
          </div>
        )}
      </dl>

      {plan.byproducts.length > 0 && (
        <table className="grid small">
          <caption>By-product coverage</caption>
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">demand</th>
              <th className="num">output</th>
              <th className="num">shortfall</th>
              <th className="num">extra raw</th>
              <th>falls to residual</th>
            </tr>
          </thead>
          <tbody>
            {plan.byproducts.map((b) => (
              <tr key={b.product}>
                <td>{b.product}</td>
                <td className="num">{n0(b.demandKg)}</td>
                <td className="num">{n0(b.outputKg)}</td>
                <td className="num">{b.shortfallKg > 0.5 ? n0(b.shortfallKg) : '–'}</td>
                <td className="num">{b.extraRawKg > 0.5 ? n0(b.extraRawKg) : '–'}</td>
                <td>{b.fallsTo ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="two">
        <table className="grid small">
          <caption>Residual (unordered, kg)</caption>
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">output</th>
              <th className="num">ordered</th>
              <th className="num">residual</th>
            </tr>
          </thead>
          <tbody>
            {residual.map((p) => (
              <tr key={p.product}>
                <td>
                  {p.product} <em className="kind">{p.kind}</em>
                </td>
                <td className="num">{n0(p.outputKg)}</td>
                <td className="num">{n0(p.orderedKg)}</td>
                <td className="num">{n0(p.residualKg)}</td>
              </tr>
            ))}
            <tr className="foot">
              <td>LOSS</td>
              <td className="num">{n0(balance.lossKg)}</td>
              <td className="num">–</td>
              <td className="num">–</td>
            </tr>
          </tbody>
        </table>

        <table className="grid small">
          <caption>Mass balance — splits used</caption>
          <thead>
            <tr>
              <th>parent · option</th>
              <th className="num">parent kg</th>
              <th>children</th>
            </tr>
          </thead>
          <tbody>
            {balance.splits.map((s) => (
              <tr key={`${s.parent}|${s.option}`}>
                <td>
                  {s.parent}
                  {s.option !== '-' && <em className="kind">{s.option}</em>}
                </td>
                <td className="num">{n0(s.parentKg)}</td>
                <td className="path">{s.children.map((c) => `${c.product} ${n0(c.kg)}`).join(' + ')}</td>
              </tr>
            ))}
            <tr className="foot">
              <td>Raw in / out</td>
              <td className="num">{n0(balance.rawKg)}</td>
              <td className="path">{n0(balance.totalOutKg)} kg incl. {n0(balance.lossKg)} kg loss</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function Board() {
  const open = useStore((s) => s.board)
  const data = useMemo(() => {
    const g = buildGraph(SEED.edges, SEED.products)
    return rollupAll(g, SEED.orders, SEED.supply).map((plan) => ({ plan, balance: massBalance(g, plan) }))
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="board"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <p className="eyebrow">Deboning planner · raw fish required per week</p>
          {data.map(({ plan, balance }) => (
            <WeekCard key={plan.week} plan={plan} balance={balance} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
