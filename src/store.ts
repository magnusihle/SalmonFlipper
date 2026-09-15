import { create } from 'zustand'
import type { CutId } from './data/cuts'
import { SEED } from './planner/seed'
import type { Order, RawPrice, Supply } from './planner/types'
import { BUNDLED_PRICES } from './prices/book'
import { mergePrices } from './prices/prices'
import { fetchSsbPrices } from './prices/ssb'
import type { PriceBook } from './prices/types'
import { nextWeek, setFormatLocale } from './format'
import { LOCALE, loadLang, saveLang, translate, type Lang } from './i18n/core'
import { startFile, startGroove, stopSong } from './billy/player'
import { applyTheme, loadThemePref, resolveTheme, saveThemePref, watchSystemTheme, type Theme, type ThemePref } from './theme'

/** `weeks` is set on a successful fetch so the panel can phrase it in the current language */
export type PriceStatus = { state: 'idle' | 'loading' | 'ok' | 'error'; message: string; weeks?: number }

/** The editable plan — what the planner persists between visits. */
interface PlanSlice {
  week: string
  orders: Order[]
  supply: Supply[]
  rawPrices: RawPrice[]
  /** overrides for manual price rules, NOK/kg by product */
  manualPrices: Record<string, number>
  priceBook: PriceBook
}

interface State extends PlanSlice {
  hovered: CutId | null
  selected: CutId | null
  exploded: boolean
  /** planner board overlay */
  board: boolean
  priceStatus: PriceStatus
  /** bumps every time the viewer asks for a trick; the scene picks it up */
  trickRequest: number
  /** true while the fish is mid-trick */
  tricking: boolean
  /** the singing-fish easter egg is playing */
  singing: boolean
  /** what the viewer picked; 'system' follows the OS */
  theme: ThemePref
  /** the theme actually on screen */
  resolvedTheme: Theme
  lang: Lang
  setHovered: (id: CutId | null) => void
  select: (id: CutId) => void
  clear: () => void
  toggleExploded: () => void
  toggleBoard: () => void
  doTrick: () => void
  setTricking: (on: boolean) => void
  /** no file: the built-in groove */
  sing: (file?: File) => void
  stopSinging: () => void
  setTheme: (pref: ThemePref) => void
  setLang: (lang: Lang) => void
  selectWeek: (week: string) => void
  addWeek: () => void
  setSupplyKg: (week: string, rawKg: number) => void
  setRawPrice: (week: string, pricePerKgRound: number) => void
  setOrder: (orderNo: string, patch: Partial<Pick<Order, 'kg' | 'pricePerKg' | 'product'>>) => void
  addOrder: (week: string, product?: string) => void
  removeOrder: (orderNo: string) => void
  setManualPrice: (product: string, nokPerKg: number) => void
  resetPlan: () => void
  /** Pull the latest HOG weeks from Statistics Norway into the price book (issue #6). */
  refreshSsb: () => Promise<void>
}

const STORAGE_KEY = 'salmon-flipper-planner:v1'

const seedPlan = (): PlanSlice => ({
  week: SEED.supply[0]?.week ?? SEED.orders[0]?.week ?? '2026-W38',
  orders: SEED.orders.map((o) => ({ ...o })),
  supply: SEED.supply.map((s) => ({ ...s })),
  rawPrices: SEED.rawPrices.map((r) => ({ ...r })),
  manualPrices: {},
  priceBook: BUNDLED_PRICES,
})

function load(): PlanSlice {
  const fresh = seedPlan()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as Partial<PlanSlice>
    // a newer bundled price book wins over a cached one
    const book = saved.priceBook && saved.priceBook.fetchedAt > fresh.priceBook.fetchedAt ? saved.priceBook : fresh.priceBook
    return { ...fresh, ...saved, priceBook: book }
  } catch {
    return fresh
  }
}

const nextOrderNo = (orders: Order[]) => {
  const n = orders.reduce((m, o) => Math.max(m, Number(/(\d+)$/.exec(o.orderNo)?.[1] ?? 0)), 0) + 1
  return `ORD-${String(n).padStart(3, '0')}`
}

export const useStore = create<State>((set, get) => ({
  hovered: null,
  selected: null,
  exploded: false,
  board: false,
  priceStatus: { state: 'idle', message: '' },
  trickRequest: 0,
  tricking: false,
  singing: false,
  theme: loadThemePref(),
  resolvedTheme: resolveTheme(loadThemePref()),
  lang: loadLang(),
  ...load(),

  setHovered: (hovered) => set({ hovered }),
  select: (id) => set((s) => ({ selected: s.selected === id ? null : id })),
  clear: () => set({ selected: null }),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded, selected: null })),
  toggleBoard: () => set((s) => ({ board: !s.board, selected: null })),
  // a trick needs the whole fish, so it pulls the pieces back together first
  doTrick: () => {
    if (get().tricking) return
    stopSong()
    set((s) => ({ trickRequest: s.trickRequest + 1, tricking: true, singing: false, selected: null, exploded: false }))
  },
  setTricking: (tricking) => set({ tricking }),
  sing: (file) => {
    if (get().tricking) return
    set({ singing: true, selected: null, exploded: false })
    if (!file) return startGroove()
    startFile(file).catch(() => {
      stopSong()
      set({ singing: false })
    })
  },
  stopSinging: () => {
    stopSong()
    set({ singing: false })
  },
  setTheme: (theme) => {
    saveThemePref(theme)
    set({ theme, resolvedTheme: resolveTheme(theme) })
  },
  setLang: (lang) => {
    saveLang(lang)
    set({ lang })
  },

  selectWeek: (week) => set({ week }),
  addWeek: () =>
    set((s) => {
      const weeks = [...new Set([...s.orders.map((o) => o.week), ...s.supply.map((x) => x.week)])].sort()
      const last = weeks[weeks.length - 1]
      const week = nextWeek(last)
      const lastSupply = s.supply.find((x) => x.week === last)?.rawKg ?? 6000
      const lastPrice = [...s.rawPrices].sort((a, b) => (a.week < b.week ? 1 : -1))[0]?.pricePerKgRound ?? 60
      return {
        week,
        supply: [...s.supply, { week, rawKg: lastSupply }],
        rawPrices: [...s.rawPrices, { week, pricePerKgRound: lastPrice }],
      }
    }),
  setSupplyKg: (week, rawKg) =>
    set((s) => {
      const kg = Math.max(0, Math.round(rawKg))
      const has = s.supply.some((x) => x.week === week)
      return { supply: has ? s.supply.map((x) => (x.week === week ? { ...x, rawKg: kg } : x)) : [...s.supply, { week, rawKg: kg }] }
    }),
  setRawPrice: (week, pricePerKgRound) =>
    set((s) => {
      const has = s.rawPrices.some((x) => x.week === week)
      const p = Math.max(0, pricePerKgRound)
      return { rawPrices: has ? s.rawPrices.map((x) => (x.week === week ? { ...x, pricePerKgRound: p } : x)) : [...s.rawPrices, { week, pricePerKgRound: p }] }
    }),
  setOrder: (orderNo, patch) => set((s) => ({ orders: s.orders.map((o) => (o.orderNo === orderNo ? { ...o, ...patch } : o)) })),
  addOrder: (week, product = 'TRIM_C') =>
    set((s) => ({ orders: [...s.orders, { orderNo: nextOrderNo(s.orders), week, product, kg: 500 }] })),
  removeOrder: (orderNo) => set((s) => ({ orders: s.orders.filter((o) => o.orderNo !== orderNo) })),
  setManualPrice: (product, nokPerKg) => set((s) => ({ manualPrices: { ...s.manualPrices, [product]: Math.max(0, nokPerKg) } })),
  resetPlan: () => set({ ...seedPlan(), priceStatus: { state: 'idle', message: '' } }),

  refreshSsb: async () => {
    if (get().priceStatus.state === 'loading') return
    set({ priceStatus: { state: 'loading', message: '' } })
    try {
      const r = await fetchSsbPrices({ weeks: 12 })
      set((s) => ({
        priceBook: {
          ...s.priceBook,
          fetchedAt: r.fetchedAt,
          series: s.priceBook.series.map((x) => (x.source === 'SSB 03024' ? { ...x, updated: r.updated ?? x.updated } : x)),
          prices: mergePrices(s.priceBook.prices, r.prices),
        },
        priceStatus: { state: 'ok', message: '', weeks: r.prices.length },
      }))
    } catch (e) {
      set({ priceStatus: { state: 'error', message: e instanceof Error ? e.message : '' } })
    }
  },
}))

// persist the plan slice only
useStore.subscribe((s) => {
  try {
    const slice: PlanSlice = { week: s.week, orders: s.orders, supply: s.supply, rawPrices: s.rawPrices, manualPrices: s.manualPrices, priceBook: s.priceBook }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slice))
  } catch {
    // storage unavailable; the plan lives in memory
  }
})

applyTheme(useStore.getState().resolvedTheme)
useStore.subscribe((s, prev) => {
  if (s.resolvedTheme !== prev.resolvedTheme) applyTheme(s.resolvedTheme)
})
watchSystemTheme((t) => {
  if (useStore.getState().theme === 'system') useStore.setState({ resolvedTheme: t })
})

function applyLang(lang: Lang) {
  setFormatLocale(LOCALE[lang])
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.title = translate(lang, 'app.title')
}
applyLang(useStore.getState().lang)
useStore.subscribe((s, prev) => {
  if (s.lang !== prev.lang) applyLang(s.lang)
})
