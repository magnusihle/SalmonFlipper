import { create } from 'zustand'
import type { CutId } from './data/cuts'

interface State {
  hovered: CutId | null
  selected: CutId | null
  exploded: boolean
  /** planner board overlay */
  board: boolean
  /** bumps every time the viewer asks for a trick; the scene picks it up */
  trickRequest: number
  /** true while the fish is mid-trick */
  tricking: boolean
  setHovered: (id: CutId | null) => void
  select: (id: CutId) => void
  clear: () => void
  toggleExploded: () => void
  toggleBoard: () => void
  doTrick: () => void
  setTricking: (on: boolean) => void
}

export const useStore = create<State>((set) => ({
  hovered: null,
  selected: null,
  exploded: false,
  board: false,
  trickRequest: 0,
  tricking: false,
  setHovered: (hovered) => set({ hovered }),
  select: (id) => set((s) => ({ selected: s.selected === id ? null : id })),
  clear: () => set({ selected: null }),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded, selected: null })),
  toggleBoard: () => set((s) => ({ board: !s.board, selected: null })),
  // a trick needs the whole fish, so it pulls the pieces back together first
  doTrick: () => set((s) => (s.tricking ? s : { trickRequest: s.trickRequest + 1, tricking: true, selected: null, exploded: false })),
  setTricking: (tricking) => set({ tricking }),
}))
