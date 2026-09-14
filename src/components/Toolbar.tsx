import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import type { ThemePref } from '../theme'

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

const THEMES: { id: ThemePref; label: string; icon: string }[] = [
  { id: 'system', label: 'Follow system theme', icon: 'M4 5h16v11H4z M9 20h6 M12 16v4' },
  { id: 'light', label: 'Light theme', icon: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5' },
  { id: 'dark', label: 'Dark theme', icon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' },
]

function ThemeControl() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  return (
    <div className="theme-seg" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          title={t.label}
          className={theme === t.id ? 'on' : ''}
          onClick={() => setTheme(t.id)}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export function Toolbar() {
  const exploded = useStore((s) => s.exploded)
  const toggle = useStore((s) => s.toggleExploded)
  const board = useStore((s) => s.board)
  const toggleBoard = useStore((s) => s.toggleBoard)
  const tricking = useStore((s) => s.tricking)
  const doTrick = useStore((s) => s.doTrick)

  // "t" on the keyboard does the same as the button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 't' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      doTrick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doTrick])

  return (
    <motion.div className="toolbar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.6 }}>
      <span className="hint">{board ? 'click a cut for its plan' : 'drag to orbit · click a cut'}</span>
      <motion.button
        className={`trick${tricking ? ' busy' : ''}`}
        onClick={doTrick}
        disabled={tricking}
        whileTap={{ scale: 0.94 }}
        aria-label="Make the salmon do a trick"
        title="Do a trick (T)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M3 12c3.5-4.5 7.5-6 11-6 2.6 0 4.6 1 6 2.4L22 6v12l-2-2.4C18.6 17 16.6 18 14 18c-3.5 0-7.5-1.5-11-6z"
            fill="currentColor"
          />
          <circle cx="8" cy="11" r="1.1" fill="#fffaf0" />
        </svg>
        <span>{tricking ? 'Whee!' : 'Do a trick'}</span>
      </motion.button>
      <Switch on={exploded} onClick={toggle} label="Exploded view" />
      <Switch on={board} onClick={toggleBoard} label="Plan board" />
      <ThemeControl />
    </motion.div>
  )
}
