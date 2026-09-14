import { useMemo } from 'react'
import { CUTS, type CutId, type CutInfo } from '../data/cuts'
import { CUTS_NB } from '../data/cuts.nb'
import { useStore } from '../store'
import { translate, type Lang, type T, type Vars } from './core'
import type { MessageKey } from './en'

export * from './core'

export function useLang(): Lang {
  return useStore((s) => s.lang)
}

export function useT(): T {
  const lang = useLang()
  return useMemo(() => (key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang])
}

export function useCuts(): Record<CutId, CutInfo> {
  const lang = useLang()
  return useMemo(() => {
    if (lang === 'en') return CUTS
    const out = {} as Record<CutId, CutInfo>
    for (const id of Object.keys(CUTS) as CutId[]) out[id] = { ...CUTS[id], ...CUTS_NB[id] }
    return out
  }, [lang])
}
