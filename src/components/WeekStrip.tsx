import { motion } from 'framer-motion'
import { usePlan } from '../planner/usePlan'
import { useStore } from '../store'
import { kr, n0, shortWeek } from '../format'
import { Flag } from './ui'
import { useT } from '../i18n'

export function WeekStrip() {
  const { weeks } = usePlan()
  const week = useStore((s) => s.week)
  const selectWeek = useStore((s) => s.selectWeek)
  const addWeek = useStore((s) => s.addWeek)
  const t = useT()

  return (
    <motion.nav
      className="weeks"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <span className="weeks-label">{t('weeks.label')}</span>
      {weeks.map(({ plan, finance }, i) => {
        const active = plan.week === week
        const supply = plan.supplyRawKg ?? 0
        const share = supply > 0 ? Math.min(1, plan.requiredRawKg / supply) : 1
        return (
          <motion.button
            key={plan.week}
            className={`wk${active ? ' active' : ''}`}
            onClick={() => selectWeek(plan.week)}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
          >
            <span className="wk-head">
              <strong>{shortWeek(plan.week)}</strong>
              <Flag flag={plan.flag} />
            </span>
            <span className={`wk-bar${plan.flag === 'CANNOT BE MET' ? ' bad' : ''}`}>
              <i style={{ width: `${share * 100}%` }} />
            </span>
            <span className="wk-meta">
              {n0(plan.requiredRawKg)} <em>{t('weeks.raw', { supply: plan.supplyRawKg !== undefined ? n0(plan.supplyRawKg) : '–' })}</em>
            </span>
            <span className={`wk-margin${finance.marginNok < 0 ? ' bad' : ''}`}>{kr(finance.marginNok)} NOK</span>
            {active && <motion.span className="wk-underline" layoutId="wk-underline" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          </motion.button>
        )
      })}
      <button className="wk add" onClick={addWeek} title={t('weeks.add.title')}>
        {t('weeks.add')}
      </button>
    </motion.nav>
  )
}
