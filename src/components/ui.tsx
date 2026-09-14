import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { flagLabel, useLang } from '../i18n'

type From = 'left' | 'right' | 'top' | 'bottom'
const OFFSET: Record<From, { x: number; y: number }> = { left: { x: -36, y: 0 }, right: { x: 36, y: 0 }, top: { x: 0, y: -18 }, bottom: { x: 0, y: 36 } }

/** A paper card in the poster's style: eyebrow, serif title, optional action. Slides in from `from`. */
export function Card({
  eyebrow,
  title,
  action,
  children,
  className = '',
  from = 'bottom',
  delay = 0,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  from?: From
  delay?: number
}) {
  const o = OFFSET[from]
  return (
    <motion.section
      className={`card ${className}`}
      initial={{ opacity: 0, x: o.x, y: o.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: o.x / 2, y: o.y / 2, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay }}
    >
      {(eyebrow || title || action) && (
        <header className="card-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h3>{title}</h3>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      {children}
    </motion.section>
  )
}

export function Flag({ flag }: { flag: string }) {
  const tone = flag === 'OK' ? 'ok' : flag === 'CANNOT BE MET' || flag === 'UNRESOLVED' || flag === 'OVER CAPACITY' ? 'bad' : 'warn'
  const lang = useLang()
  return <span className={`flag ${tone}`}>{flagLabel(lang, flag)}</span>
}

/** Number input that lets the user type freely and commits every finite value. */
export function NumberField({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  placeholder,
  className = '',
  muted = false,
}: {
  value: number | undefined
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
  placeholder?: string
  className?: string
  /** render the value greyed out (e.g. a derived default) */
  muted?: boolean
}) {
  const formatted = value === undefined || !Number.isFinite(value) ? '' : String(+value.toFixed(2))
  const [text, setText] = useState(formatted)
  const [focused, setFocused] = useState(false)
  return (
    <span className={`field-wrap ${className}`}>
      <input
        type="number"
        className={`field${muted ? ' muted' : ''}`}
        value={focused ? text : formatted}
        step={step}
        min={min}
        placeholder={placeholder}
        onFocus={() => {
          setText(formatted)
          setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          const v = parseFloat(e.target.value)
          if (Number.isFinite(v)) onChange(Math.max(min, v))
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  )
}

export function Stat({ label, value, sub, tone = '' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: '' | 'bad' | 'ok' | 'warn' }) {
  return (
    <div className={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {sub && <small>{sub}</small>}
    </div>
  )
}

/** Tiny line chart for a weekly price series; the `mark` week gets a dot. */
export function Sparkline({
  points,
  mark,
  width = 150,
  height = 34,
  color = 'var(--salmon-deep)',
}: {
  points: { week: string; value: number }[]
  mark?: string
  width?: number
  height?: number
  color?: string
}) {
  if (points.length < 2) return null
  const vals = points.map((p) => p.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || 1
  const x = (i: number) => 3 + (i / (points.length - 1)) * (width - 6)
  const y = (v: number) => height - 4 - ((v - lo) / span) * (height - 8)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const mi = mark ? points.findIndex((p) => p.week === mark) : -1
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {mi >= 0 && <circle cx={x(mi)} cy={y(points[mi].value)} r={3} fill={color} />}
    </svg>
  )
}
