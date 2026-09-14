import { motion } from 'framer-motion'
import { CUTS, CUT_ORDER } from '../data/cuts'
import { useStore } from '../store'

export function Legend() {
  const hovered = useStore((s) => s.hovered)
  const selected = useStore((s) => s.selected)
  const setHovered = useStore((s) => s.setHovered)
  const select = useStore((s) => s.select)

  return (
    <motion.nav
      className="legend"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {CUT_ORDER.map((id, i) => {
        const c = CUTS[id]
        const active = selected === id
        const hot = hovered === id
        return (
          <motion.button
            key={id}
            className={`chip${active ? ' active' : ''}${hot ? ' hot' : ''}`}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(id)}
            onBlur={() => setHovered(null)}
            onClick={() => select(id)}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.94 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.045, type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <span className="name">
              {c.name}
              {c.sub && <em> {c.sub}</em>}
            </span>
            {active && (
              <motion.span
                className="underline"
                layoutId="chip-underline"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        )
      })}
    </motion.nav>
  )
}
