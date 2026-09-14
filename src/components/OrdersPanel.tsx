import { useState } from 'react'
import { usePlan } from '../planner/usePlan'
import { useStore } from '../store'
import { ORDERABLE } from '../data/products'
import { kindLabel, productName, useLang, useT } from '../i18n'
import { kr, n0, pathText, pct, shortWeek } from '../format'
import { Card, Flag, NumberField } from './ui'

export function OrdersPanel() {
  const { current, pricer } = usePlan()
  const { plan, finance } = current
  const setOrder = useStore((s) => s.setOrder)
  const addOrder = useStore((s) => s.addOrder)
  const removeOrder = useStore((s) => s.removeOrder)
  const [newProduct, setNewProduct] = useState('TRIM_C')
  const t = useT()
  const lang = useLang()

  return (
    <Card
      eyebrow={`${t('orders.eyebrow')} · ${shortWeek(plan.week)}`}
      title={t('orders.title')}
      from="right"
      delay={0.1}
      action={
        <span className="add-row">
          <select className="field" value={newProduct} onChange={(e) => setNewProduct(e.target.value)}>
            {ORDERABLE.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => addOrder(plan.week, newProduct)}>
            {t('orders.add')}
          </button>
        </span>
      }
    >
      <table className="grid">
        <thead>
          <tr>
            <th>{t('orders.order')}</th>
            <th>{t('orders.product')}</th>
            <th className="num">{t('orders.kg')}</th>
            <th className="num">{t('orders.nokKg')}</th>
            <th className="num">{t('orders.rawKg')}</th>
            <th>{t('orders.pattern')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {plan.lines.map((l) => {
            const value = finance.lines.find((v) => v.orderNo === l.order.orderNo)
            const derived = l.order.pricePerKg === undefined && l.kind !== 'UNRESOLVED' ? pricer.valuePerKg(l.order.product, plan.week).nokPerKg : undefined
            return (
              <tr key={l.order.orderNo} className={l.kind === 'UNRESOLVED' ? 'unresolved' : ''}>
                <td>
                  {l.order.orderNo}
                  <br />
                  <em className="kind">{kindLabel(lang, l.kind)}</em>
                </td>
                <td>
                  <select className="field" value={l.order.product} onChange={(e) => setOrder(l.order.orderNo, { product: e.target.value })} title={productName(lang, l.order.product)}>
                    {ORDERABLE.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {l.cumYield !== undefined && <em className="kind">{t('orders.yield', { pct: pct(l.cumYield) })}</em>}
                </td>
                <td className="num">
                  <NumberField value={l.order.kg} step={50} onChange={(v) => setOrder(l.order.orderNo, { kg: v })} className="w-80" />
                </td>
                <td className="num">
                  <NumberField
                    value={l.order.pricePerKg ?? derived}
                    muted={l.order.pricePerKg === undefined}
                    step={1}
                    onChange={(v) => setOrder(l.order.orderNo, { pricePerKg: v })}
                    className="w-80"
                  />
                  {value?.priced === 'DERIVED' && <em className="kind">{t('orders.derived')}</em>}
                </td>
                <td className="num">{l.kind === 'CUT' ? n0(l.rawKg) : l.coverage && l.coverage.extraRawKg > 0.5 ? `+${n0(l.coverage.extraRawKg)}` : '–'}</td>
                <td className="path">
                  {l.kind === 'CUT' && pathText(l)}
                  {l.coverage && `${t('orders.fromCoProduct', { kg: n0(l.coverage.fromCoProduct) })}${l.coverage.shortfall > 0.5 ? ` · ${t('orders.kgShort', { kg: n0(l.coverage.shortfall) })}` : ''}`}
                  {l.kind === 'UNRESOLVED' && t('orders.notInPattern')}
                  {l.flags.length > 0 && <span className="flags">{l.flags.map((f) => <Flag key={f} flag={f} />)}</span>}
                </td>
                <td>
                  <button className="x" onClick={() => removeOrder(l.order.orderNo)} aria-label={t('orders.remove')}>
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
          {plan.lines.length === 0 && (
            <tr>
              <td colSpan={7} className="path">
                {t('orders.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {plan.byproducts.length > 0 && (
        <table className="grid small">
          <caption>{t('orders.coverage.caption')}</caption>
          <thead>
            <tr>
              <th>{t('orders.product')}</th>
              <th className="num">{t('orders.coverage.demand')}</th>
              <th className="num">{t('orders.coverage.coProduct')}</th>
              <th className="num">{t('orders.coverage.short')}</th>
              <th className="num">{t('orders.coverage.fromExtra')}</th>
              <th className="num">{t('orders.coverage.extraRaw')}</th>
              <th>{t('orders.coverage.fallsTo')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.byproducts.map((b) => (
              <tr key={b.product}>
                <td>{b.product}</td>
                <td className="num">{n0(b.demandKg)}</td>
                <td className="num">{n0(b.outputKg)}</td>
                <td className="num">{b.shortfallKg > 0.5 ? n0(b.shortfallKg) : '–'}</td>
                <td className="num">{b.coveredByExtraFishKg > 0.5 ? n0(b.coveredByExtraFishKg) : '–'}</td>
                <td className="num">{b.extraRawKg > 0.5 ? n0(b.extraRawKg) : '–'}</td>
                <td>{b.fallsTo ?? (b.coveredByExtraFishKg > 0.5 ? <em className="kind">{t('orders.coverage.coveredByOther')}</em> : '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl className="summary">
        <div>
          <dt>{t('orders.revenue')}</dt>
          <dd>{kr(finance.revenueNok)} NOK</dd>
        </div>
        {finance.revenueAtRiskNok > 0 && (
          <div className="bad">
            <dt>{t('orders.atRisk')}</dt>
            <dd>{kr(finance.revenueAtRiskNok)} NOK</dd>
          </div>
        )}
        <div>
          <dt>{t('orders.residualWorth')}</dt>
          <dd>{kr(finance.residualNok)} NOK</dd>
        </div>
        <div className={finance.marginNok < 0 ? 'bad' : ''}>
          <dt>{t('orders.margin')}</dt>
          <dd>{kr(finance.marginNok)} NOK</dd>
        </div>
      </dl>
    </Card>
  )
}
