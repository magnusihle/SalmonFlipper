import { en, type MessageKey } from './en'
import { CENTRE_NAMES_NB, PRODUCT_NAMES_NB, nb } from './nb'
import { productName as seedProductName } from '../data/products'

export type Lang = 'en' | 'nb'
export const LANG_KEY = 'salmon-flipper:lang'
export const LOCALE: Record<Lang, string> = { en: 'en-GB', nb: 'nb-NO' }

const DICT: Record<Lang, Record<MessageKey, string>> = { en, nb }
const hasWindow = typeof window !== 'undefined'

export function loadLang(): Lang {
  if (!hasWindow) return 'en'
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'en' || saved === 'nb') return saved
  return /^(nb|nn|no)\b/i.test(navigator.language) ? 'nb' : 'en'
}

export function saveLang(lang: Lang) {
  if (hasWindow) localStorage.setItem(LANG_KEY, lang)
}

export type Vars = Record<string, string | number>
export type T = (key: MessageKey, vars?: Vars) => string

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const s = DICT[lang][key] ?? en[key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** Flags and line kinds are stable codes in the planner; only their display changes. */
export const flagLabel = (lang: Lang, flag: string) => DICT[lang][`flag.${flag}` as MessageKey] ?? flag
export const kindLabel = (lang: Lang, kind: string) => DICT[lang][`kind.${kind}` as MessageKey] ?? kind

export const productName = (lang: Lang, code: string) => (lang === 'nb' ? PRODUCT_NAMES_NB[code] : undefined) ?? seedProductName(code)
export const centreName = (lang: Lang, code: string, fallback: string) => (lang === 'nb' ? CENTRE_NAMES_NB[code] : undefined) ?? fallback
