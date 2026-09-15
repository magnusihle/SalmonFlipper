export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

/** also read by the inline script in index.html, so the first paint already has the right theme */
export const THEME_KEY = 'salmon-flipper:theme'

const hasWindow = typeof window !== 'undefined'
const query = () => (hasWindow && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

export function loadThemePref(): ThemePref {
  if (!hasWindow) return 'system'
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function saveThemePref(pref: ThemePref) {
  if (!hasWindow) return
  if (pref === 'system') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, pref)
}

export const systemTheme = (): Theme => (query()?.matches ? 'dark' : 'light')

export const resolveTheme = (pref: ThemePref): Theme => (pref === 'system' ? systemTheme() : pref)

export function applyTheme(theme: Theme) {
  if (!hasWindow) return
  document.documentElement.dataset.theme = theme
}

/** Calls `onChange` whenever the OS theme flips. Returns an unsubscribe. */
export function watchSystemTheme(onChange: (t: Theme) => void) {
  const mq = query()
  if (!mq) return () => {}
  const handler = (e: MediaQueryListEvent) => onChange(e.matches ? 'dark' : 'light')
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

/** Scene colours that have to follow the page, since the canvas is transparent over the paper. */
export const SCENE_PALETTE: Record<Theme, { sky: string; water: string; foam: string }> = {
  light: { sky: '#cfe3ef', water: '#8fbcd8', foam: '#f4fbfd' },
  dark: { sky: '#232c34', water: '#3a5568', foam: '#b7ccd6' },
}
