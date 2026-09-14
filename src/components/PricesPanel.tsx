import { usePlan } from '../planner/usePlan'
import { useStore } from '../store'
import { seriesFor } from '../prices/prices'
import { SERIES_LABELS } from '../prices/book'
import { n2, shortWeek } from '../format'
import { Card, NumberField, Sparkline } from './ui'

/** The prices panel (issue #4): one row per product with rule, NOK/kg and formula; manual rows editable. */
export function PricesPanel() {
  const { current, pricer } = usePlan()
  const week = current.plan.week
  const rows = pricer.panel(week)
  const setManualPrice = useStore((s) => s.setManualPrice)
  const book = useStore((s) => s.priceBook)
  const status = useStore((s) => s.priceStatus)
  const refresh = useStore((s) => s.refreshSsb)
  const hog = seriesFor(book.prices, 'HOG')
  const hogWeek = rows.find((r) => r.product === 'HOG')?.priceWeek ?? undefined
  const fillet = seriesFor(book.prices, 'FILLET_FRESH')
  const latestFillet = fillet[fillet.length - 1]

  return (
    <Card
      eyebrow={`Prices · ${shortWeek(week)}`}
      title="NOK per kilo"
      from="left"
      delay={0.12}
      className="prices"
      action={
        <button className="btn" onClick={() => void refresh()} disabled={status.state === 'loading'} title="POST to data.ssb.no table 03024">
          {status.state === 'loading' ? 'Fetching…' : 'Refresh from SSB'}
        </button>
      }
    >
      <div className="ref">
        <div>
          <p className="eyebrow">{SERIES_LABELS.HOG}</p>
          <strong>{hog.length ? `${n2(hog[hog.length - 1].nokPerKg)} NOK/kg` : 'no data'}</strong>
          <em className="kind">
            {hog.length ? `latest ${shortWeek(hog[hog.length - 1].week)} · using ${hogWeek ? shortWeek(hogWeek) : '–'}` : ''}
          </em>
        </div>
        <Sparkline points={hog.map((p) => ({ week: p.week, value: p.nokPerKg }))} mark={hogWeek} />
      </div>
      {latestFillet && (
        <p className="path small">
          Cross-check: {SERIES_LABELS.FILLET_FRESH} {n2(latestFillet.nokPerKg)} NOK/kg in {shortWeek(latestFillet.week)}.
        </p>
      )}
      <p className={`status ${status.state}`}>
        {status.state === 'idle' ? `Price book fetched ${book.fetchedAt.slice(0, 10)}` : status.message}
      </p>

      <table className="grid small">
        <thead>
          <tr>
            <th>product</th>
            <th>rule</th>
            <th className="num">NOK/kg</th>
            <th>formula</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product}>
              <td>{r.product}</td>
              <td>
                <em className="kind">{r.rule}</em>
              </td>
              <td className="num">
                {r.editable ? <NumberField value={r.nokPerKg} step={0.5} onChange={(v) => setManualPrice(r.product, v)} className="w-80" /> : n2(r.nokPerKg)}
              </td>
              <td className="path formula" title={r.note}>
                {r.formula}
                {r.priceWeek && <em className="kind">{shortWeek(r.priceWeek)}</em>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
