import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { useT } from '../i18n'

const CODE = 'billy'

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

/**
 * Easter egg: type "billy" and the salmon turns into a singing wall-plaque fish.
 * Dropping an audio file on the window makes it lip-sync to that instead; Esc stops.
 */
export function SingingFish() {
  const t = useT()
  const singing = useStore((s) => s.singing)

  useEffect(() => {
    let typed = ''
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      const { singing, sing, stopSinging } = useStore.getState()
      if (e.key === 'Escape' && singing) return stopSinging()
      if (e.key.length !== 1) return
      typed = (typed + e.key.toLowerCase()).slice(-CODE.length)
      if (typed !== CODE) return
      typed = ''
      if (singing) stopSinging()
      else sing()
    }
    // without preventDefault a dropped file replaces the whole page (and, in Electron, the app)
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0]
      if (!file) return
      e.preventDefault()
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) useStore.getState().sing(file)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <AnimatePresence>
      {singing && (
        <motion.div
          className="sing-toast"
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
        >
          <span>{t('sing.hint')}</span>
          <button onClick={() => useStore.getState().stopSinging()}>{t('sing.stop')}</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
