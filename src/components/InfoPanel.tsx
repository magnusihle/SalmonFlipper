import { AnimatePresence, motion } from 'framer-motion'
import { CUT_ORDER } from '../data/cuts'
import { useCuts, useT } from '../i18n'
import { useStore } from '../store'
import { CutDossier } from './CutDossier'

function Richness({ n }: { n: number }) {
  const t = useT()
  return (
    <span className="dots" aria-label={t('info.richness.aria', { n })}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.i
          key={i}
          className={i < n ? 'on' : ''}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.12 + i * 0.05, type: 'spring', stiffness: 420, damping: 14 }}
        />
      ))}
    </span>
  )
}

/**
 * The card for a clicked cut. Floating on the right in poster mode; docked under the fish on the board,
 * where the culinary notes step back and the planner dossier takes the room.
 */
export function InfoPanel({ variant = 'float' }: { variant?: 'float' | 'board' }) {
  const selected = useStore((s) => s.selected)
  const clear = useStore((s) => s.clear)
  const CUTS = useCuts()
  const t = useT()
  const cut = selected ? CUTS[selected] : null
  const onBoard = variant === 'board'

  return (
    <AnimatePresence mode="wait">
      {cut && (
        <motion.aside
          key={cut.id}
          className={`panel${onBoard ? ' in-board' : ''}`}
          initial={onBoard ? { opacity: 0, y: 32 } : { opacity: 0, x: 48, rotate: 1.2 }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          exit={onBoard ? { opacity: 0, y: 24, transition: { duration: 0.18 } } : { opacity: 0, x: 32, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <button className="close" onClick={clear} aria-label={t('info.close')}>
            ×
          </button>
          <p className="eyebrow">
            {t('info.cutOf', { n: String(cut.order + 1).padStart(2, '0'), total: CUT_ORDER.length })}
          </p>
          <h2>
            {cut.name}
            {cut.sub && <em> · {cut.sub}</em>}
          </h2>
          {!onBoard && (
            <>
              <p className="blurb">{cut.blurb}</p>
              <div className="row">
                <span className="label">{t('info.richness')}</span>
                <Richness n={cut.richness} />
              </div>
              <div className="row">
                <span className="label">{t('info.bestFor')}</span>
                <ul className="pills">
                  {cut.bestFor.map((b, i) => (
                    <motion.li key={b} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.06 }}>
                      {b}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <CutDossier cutId={cut.id} />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
