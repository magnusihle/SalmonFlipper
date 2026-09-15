import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import type { ThemePref } from '../theme'
import { useT, type T } from '../i18n'
import type { MessageKey } from '../i18n/en'

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

const THEMES: { id: ThemePref; label: MessageKey; icon: string }[] = [
  { id: 'system', label: 'toolbar.theme.system', icon: 'M4 5h16v11H4z M9 20h6 M12 16v4' },
  { id: 'light', label: 'toolbar.theme.light', icon: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5' },
  { id: 'dark', label: 'toolbar.theme.dark', icon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' },
]

function ThemeControl({ t }: { t: T }) {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  return (
    <div className="theme-seg" role="radiogroup" aria-label={t('toolbar.theme')}>
      {THEMES.map((th) => (
        <button
          key={th.id}
          role="radio"
          aria-checked={theme === th.id}
          aria-label={t(th.label)}
          title={t(th.label)}
          className={theme === th.id ? 'on' : ''}
          onClick={() => setTheme(th.id)}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d={th.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function LangToggle({ t }: { t: T }) {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  return (
    <button className="lang" onClick={() => setLang(lang === 'en' ? 'nb' : 'en')} title={t('toolbar.lang')} aria-label={t('toolbar.lang')}>
      <span className={lang === 'en' ? 'on' : ''}>EN</span>
      <span className={lang === 'nb' ? 'on' : ''}>NO</span>
    </button>
  )
}

export function Toolbar() {
  const t = useT()
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
      <span className="hint">{board ? t('toolbar.hint.board') : t('toolbar.hint.poster')}</span>
      <motion.button
        className={`trick${tricking ? ' busy' : ''}`}
        onClick={doTrick}
        disabled={tricking}
        whileTap={{ scale: 0.94 }}
        aria-label={t('toolbar.trick.aria')}
        title={t('toolbar.trick.title')}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M3 12c3.5-4.5 7.5-6 11-6 2.6 0 4.6 1 6 2.4L22 6v12l-2-2.4C18.6 17 16.6 18 14 18c-3.5 0-7.5-1.5-11-6z"
            fill="currentColor"
          />
          <circle cx="8" cy="11" r="1.1" fill="#fffaf0" />
        </svg>
        <span>{tricking ? t('toolbar.trick.busy') : t('toolbar.trick')}</span>
      </motion.button>
      <Switch on={exploded} onClick={toggle} label={t('toolbar.exploded')} />
      <Switch on={board} onClick={toggleBoard} label={t('toolbar.board')} />
    </motion.div>
  )
}

/** Theme and language are set-and-forget, so they wait behind a menu in the corner opposite the toolbar. */
export function Prefs() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <motion.div
      ref={root}
      className="prefs"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.6 }}
    >
      <button
        className={`menu-btn${open ? ' on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('menu.label')}
        title={t('menu.label')}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 7h16 M4 12h16 M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            <div className="menu-row">
              <span>{t('toolbar.theme')}</span>
              <ThemeControl t={t} />
            </div>
            <div className="menu-row">
              <span>{t('menu.language')}</span>
              <LangToggle t={t} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
