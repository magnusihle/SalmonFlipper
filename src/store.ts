import { create } from 'zustand'
import type { CutId } from './data/cuts'

interface State {
  hovered: CutId | null
  selected: CutId | null
  exploded: boolean
  /** planner board overlay */
  board: boolean
  setHovered: (id: CutId | null) => void
  select: (id: CutId) => void
  clear: () => void
  toggleExploded: () => void
  toggleBoard: () => void
}

export const useStore = create<State>((set) => ({
  hovered: null,
  selected: null,
  exploded: false,
  board: false,
  setHovered: (hovered) => set({ hovered }),
  select: (id) => set((s) => ({ selected: s.selected === id ? null : id })),
  clear: () => set({ selected: null }),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded, selected: null })),
  toggleBoard: () => set((s) => ({ board: !s.board, selected: null })),
}))
