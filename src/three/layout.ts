import type { CutId } from '../data/cuts'
import { centerY, halfHeight, type SegmentSpec } from './geometry'

export type V3 = [number, number, number]

export interface CutLayout {
  seg?: SegmentSpec
  /** pivot point — the cut lifts, rotates and is labelled around this */
  center: V3
  /** direction the cut moves when hovered / selected / exploded */
  outDir: V3
  /** how far it travels at full explode */
  distance: number
  /** extra rotation (euler) applied at full explode */
  explodeRotation?: V3
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const segCenter = (seg: SegmentSpec): V3 => {
  const x = (seg.x0 + seg.x1) / 2
  const y = centerY(x) + (seg.half === 'top' ? halfHeight(x) * 0.45 : seg.half === 'bottom' ? -halfHeight(x) * 0.45 : 0)
  return [x, y, 0]
}

const seg = (x0: number, x1: number, half?: 'top' | 'bottom', filleted = false): SegmentSpec => ({ x0, x1, half, filleted })

// x-boundaries of the knife lines, snout → tail
export const X = {
  head: -0.56,
  collar: -0.43,
  shoulder: -0.06,
  midback: 0.26,
  steak0: 0.49,
  steak1: 0.58,
}

function make(segment: SegmentSpec, outDir: V3, distance = 0.3, explodeRotation?: V3): CutLayout {
  return { seg: segment, center: segCenter(segment), outDir: norm(outDir), distance, explodeRotation }
}

export const CHEEK_POS: V3 = [-0.75, centerY(-0.75) - 0.005, 0]
export const SPINE_Y = 0.03

export const LAYOUT: Record<CutId, CutLayout> = {
  head: make(seg(-1, X.head), [-1, 0.05, 0], 0.32),
  cheek: { center: CHEEK_POS, outDir: [0, 0, 1], distance: 0.22 },
  collar: make(seg(X.head, X.collar, undefined, true), [-0.35, -1, 0], 0.3),
  upperFillet: make(seg(X.collar, X.shoulder, 'top', true), [0, 1, 0], 0.3),
  belly: make(seg(X.collar, X.shoulder, 'bottom', true), [0, -1, 0], 0.3),
  loin: make(seg(X.shoulder, X.midback, 'top', true), [0, 1, 0], 0.3),
  toro: make(seg(X.shoulder, X.midback, 'bottom', true), [0, -1, 0], 0.3),
  fillet: make(seg(X.midback, X.steak0, undefined, true), [0.2, 1, 0], 0.3),
  steak: make(seg(X.steak0, X.steak1), [0.1, 0.05, 1], 0.5, [0, Math.PI / 2, 0]),
  tail: make(seg(X.steak1, 0.85), [1, 0, 0], 0.32),
  spine: { center: [(X.head + X.steak1) / 2, SPINE_Y, 0], outDir: [0, 0, 0], distance: 0 },
}
