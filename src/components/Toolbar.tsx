import { motion } from 'framer-motion'
import { useStore } from '../store'

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`switch${on ? ' on' : ''}`} onClick={onClick} role="switch" aria-checked={on}>
      <span className="track">
        <motion.span className="knob" layout transition={{ type: 'spring', stiffness: 520, damping: 32 }} />
      </span>
      <span className="switch-label">{label}</span>
    </button>
  )
}

export function Toolbar() {
  const exploded = useStore((s) => s.exploded)
  const toggle = useStore((s) => s.toggleExploded)
  const board = useStore((s) => s.board)
  const toggleBoard = useStore((s) => s.toggleBoard)
  return (
    <motion.div className="toolbar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.6 }}>
      <span className="hint">{board ? 'click a cut for its plan' : 'drag to orbit · click a cut'}</span>
      <Switch on={exploded} onClick={toggle} label="Exploded view" />
      <Switch on={board} onClick={toggleBoard} label="Plan board" />
    </motion.div>
  )
}
