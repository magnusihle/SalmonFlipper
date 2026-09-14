import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CUTS, type CutId } from '../data/cuts'
import { productName } from '../data/products'
import { usePlan } from '../planner/usePlan'
import { cumYield, pattern } from '../planner/graph'
import { useStore } from '../store'
import { seriesFor } from '../prices/prices'
import { CROSS_CHECK, SERIES_LABELS } from '../prices/book'
import { kr, n0, n2, pct, shortWeek } from '../format'
import { Flag, Sparkline, Stat } from './ui'

/**
 * What the plan says about the piece the user clicked: which product codes it becomes, this week's
 * mass balance for that product, how a by-product shortfall is covered (jointly, issue #3), what a kilo is
 * worth and how that price was made (issue #7), and the reference series behind it (issue #6).
 */
export function CutDossier({ cutId }: { cutId: CutId }) {
  const cut = CUTS[cutId]
  const { g, current, pricer } = usePlan()
  const book = useStore((s) => s.priceBook)
  const [product, setProduct] = useState(cut.products[0])
  useEffect(() => setProduct(cut.products[0]), [cut])

  const { plan, balance, finance } = current
  const week = plan.week
  const bal = balance.products.find((p) => p.product === product)
  const cover = plan.byproducts.find((b) => b.product === product)
  const lines = plan.lines.filter((l) => l.order.product === product)
  const value = pricer.valuePerKg(product, week)
  const residual = finance.residual.find((r) => r.product === product)
  const isCut = g.cutParent.has(product) || product === 'ROUND'
  const y = cumYield(g, product)
  const path = pattern(g, product)
  const refSeries = value.rule !== 'manual' ? seriesFor(book.prices, 'HOG') : []
  const crossChecks = (CROSS_CHECK[product] ?? []).map((code) => seriesFor(book.prices, code)).filter((s) => s.length > 0)

  return (
    <div className="dossier">
      <p className="plant">{cut.plant}</p>
      <div className="row">
        <span className="label">Product</span>
        <ul className="pills">
          {cut.products.map((p) => (
            <li key={p} className={p === product ? 'on' : ''} onClick={() => setProduct(p)} title={productName(p)}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <motion.div key={product + week} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <p className="eyebrow">
          {productName(product)} · {shortWeek(week)}
        </p>
        {isCut && y !== undefined && (
          <p className="path small">
            CUT product · {pct(y)} of round · {path && path.length ? path.map((s) => (s.option === '-' ? s.parent : `${s.parent}·${s.option}`)).join(' › ') : 'the fish itself'}
          </p>
        )}
        {!isCut && product !== 'LOSS' && <p className="path small">By-product · comes off the fish cut for something else</p>}

        <dl className="summary tight">
          <Stat label="Output" value={`${bal ? n0(bal.outputKg) : 0} kg`} />
          <Stat label="Ordered" value={`${bal ? n0(bal.orderedKg) : 0} kg`} />
          <Stat label="Residual" value={`${bal ? n0(Math.max(0, bal.residualKg)) : 0} kg`} tone={bal && bal.residualKg > 0.5 ? 'warn' : ''} sub={residual ? `${kr(residual.valueNok)} NOK` : undefined} />
        </dl>

        {cover && (
          <div className="coverage">
            <p className="eyebrow">By-product coverage · joint</p>
            <dl className="summary tight">
              <Stat label="Demand" value={`${n0(cover.demandKg)} kg`} />
              <Stat label="Co-product" value={`${n0(cover.outputKg)} kg`} />
              <Stat label="Short" value={`${n0(cover.shortfallKg)} kg`} tone={cover.shortfallKg > 0.5 ? 'bad' : 'ok'} />
              {cover.coveredByExtraFishKg > 0.5 && <Stat label="From extra fish" value={`${n0(cover.coveredByExtraFishKg)} kg`} tone="warn" />}
              {cover.extraRawKg > 0.5 && <Stat label="Extra raw bought" value={`${n0(cover.extraRawKg)} kg`} tone="warn" sub={cover.fallsTo ? `${cover.fallsTo} falls to residual` : undefined} />}
            </dl>
            {cover.shortfallKg > 0.5 && cover.extraRawKg < 0.5 && (
              <p className="path small">Covered by the extra fish bought for another by-product — no fish of its own.</p>
            )}
          </div>
        )}

        {lines.length > 0 && (
          <div className="row">
            <span className="label">Orders</span>
            <ul className="pills">
              {lines.map((l) => (
                <li key={l.order.orderNo}>
                  {l.order.orderNo} · {n0(l.order.kg)} kg{l.flags.map((f) => <Flag key={f} flag={f} />)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="price">
          <p className="eyebrow">Price · {value.rule}</p>
          <strong>{n2(value.nokPerKg)} NOK/kg</strong>
          <p className="path small formula">{value.formula}</p>
          {value.rule === 'derived' && value.credits && (
            <p className="path small">
              {value.parent} {n2(value.parentNokPerKg ?? 0)} + {value.costSource} {n2(value.costPerKgIn ?? 0)}
              {value.credits.map((c) => ` − ${c.product} ${c.yield}×${n2(c.nokPerKg)}`)} over {value.cutYield} yield
            </p>
          )}
          {value.rule === 'manual' && <p className="path small">{value.note}</p>}
        </div>

        {refSeries.length > 1 && (
          <div className="ref">
            <div>
              <p className="eyebrow">{SERIES_LABELS.HOG}</p>
              <em className="kind">
                {value.priceWeek ? `using ${shortWeek(value.priceWeek)}` : ''} · {refSeries.length} weeks
              </em>
            </div>
            <Sparkline points={refSeries.map((p) => ({ week: p.week, value: p.nokPerKg }))} mark={value.priceWeek} />
          </div>
        )}
        {crossChecks.map((s) => {
          const last = s[s.length - 1]
          return (
            <p key={last.product} className="path small">
              {SERIES_LABELS[last.product] ?? last.product}: {n2(last.nokPerKg)} NOK/kg in {shortWeek(last.week)}
              {last.volumeTonnes ? ` · ${n0(last.volumeTonnes)} t exported` : ''}
            </p>
          )
        })}
      </motion.div>
    </div>
  )
}
