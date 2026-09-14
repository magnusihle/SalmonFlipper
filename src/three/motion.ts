/**
 * Shared, frame-driven animation state for the fish: the swimming wave that runs down
 * the body, and the trick timeline (crouch → leap → splash) that the toolbar button starts.
 *
 * Everything here is plain numbers so the timeline can be unit-tested; the React side
 * (`MotionDriver` in Salmon.tsx) advances it once per frame and the cuts, fins, water and
 * camera read from it.
 */
import { BODY_X0, BODY_X1 } from './geometry'

export type TrickKind = 'somersault' | 'barrelRoll' | 'twist'
export const TRICKS: TrickKind[] = ['somersault', 'barrelRoll', 'twist']

/** where the fish hovers at rest */
export const REST_Y = -0.04
/** the water surface */
export const WATER_Y = -0.58
/** how low the fish sinks while winding up — belly just under the surface */
export const CROUCH_Y = -0.34

// timeline, seconds since the trick began
export const T_CROUCH = 0.5
export const T_AIR = 1.4
export const T_LAND = T_CROUCH + T_AIR
export const T_END = T_LAND + 1.2

const GRAVITY = 3.6
const LAUNCH_V = (GRAVITY * T_AIR) / 2

export interface Pose {
  y: number
  rx: number
  ry: number
  rz: number
}

export interface SplashEvent {
  x: number
  z: number
  radius: number
  strength: number
  /** how many droplets to throw up */
  drops: number
}

const TAU = Math.PI * 2
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const clamp01 = (p: number) => Math.min(1, Math.max(0, p))

/** Pose of the whole fish `t` seconds into a trick. Nose is at -x, so nose-up is a negative z-roll. */
export function trickPose(kind: TrickKind, t: number): Pose {
  if (t < 0 || t >= T_END) return { y: REST_Y, rx: 0, ry: 0, rz: 0 }
  if (t < T_CROUCH) {
    const e = easeInOut(t / T_CROUCH)
    return { y: REST_Y + (CROUCH_Y - REST_Y) * e, rx: 0, ry: 0, rz: -0.35 * e }
  }
  if (t < T_LAND) {
    const a = t - T_CROUCH
    const p = a / T_AIR
    const spin = TAU * easeInOut(p)
    const tilt = -0.35 + 0.65 * p // nose-up at take-off, nose-down coming in
    const y = CROUCH_Y + LAUNCH_V * a - 0.5 * GRAVITY * a * a
    switch (kind) {
      case 'somersault':
        return { y, rx: 0, ry: 0, rz: tilt - spin }
      case 'barrelRoll':
        return { y, rx: spin, ry: 0, rz: tilt }
      case 'twist':
        return { y, rx: 0, ry: spin, rz: tilt }
    }
  }
  // landed: keep sinking on momentum, then a damped spring back up to the hover
  const a = t - T_LAND
  const d = CROUCH_Y - REST_Y
  const y = REST_Y + d * Math.exp(-3 * a) * (Math.cos(4 * a) + 1.5 * Math.sin(4 * a))
  return { y, rx: 0, ry: 0, rz: 0.3 * Math.exp(-4 * a) * Math.cos(5 * a) }
}

/** Body-wave amplitude multiplier and beat frequency (Hz) during a trick. */
export function trickSwim(t: number): { amp: number; freq: number } {
  if (t < 0 || t >= T_END) return { amp: 1, freq: 0.5 }
  if (t < T_CROUCH) {
    const p = t / T_CROUCH
    return { amp: 1 + 1.8 * p, freq: 0.5 + 2 * p }
  }
  if (t < T_LAND) {
    const p = (t - T_CROUCH) / T_AIR
    const k = 1 - clamp01((p - 0.35) / 0.5)
    return { amp: 1.2 + 1.6 * k, freq: 0.7 + 1.8 * k }
  }
  const p = (t - T_LAND) / (T_END - T_LAND)
  return { amp: 1 + 0.5 * (1 - p), freq: 0.5 + 0.4 * (1 - p) }
}

/** Splashes the fish makes at the given moment, in fish-local x. Each fires once. */
export const SPLASH_CUES: { at: number; events: SplashEvent[] }[] = [
  // belly meets the water on the way down
  { at: T_CROUCH * 0.45, events: [{ x: 0.05, z: 0, radius: 0.5, strength: 0.05, drops: 6 }] },
  // tail kick at take-off
  {
    at: T_CROUCH,
    events: [
      { x: 0.7, z: 0, radius: 0.35, strength: 0.1, drops: 22 },
      { x: -0.3, z: 0, radius: 0.35, strength: 0.05, drops: 8 },
    ],
  },
  // the whole length comes back down
  {
    at: T_LAND,
    events: [-0.85, -0.4, 0.05, 0.5, 0.95].map((x) => ({ x, z: 0, radius: 0.42, strength: 0.11, drops: 12 })),
  },
]

export interface MotionState {
  t: number
  /** accumulated phase of the body wave (radians) */
  phase: number
  /** current beat frequency, Hz */
  freq: number
  /** current amplitude multiplier for the body wave and fin sway */
  swim: number
  /** 1 = free-swimming, lower while a cut is pulled out or the fish is exploded */
  calm: number
  trick: { kind: TrickKind; start: number; fired: number } | null
  pose: Pose
  /** splashes waiting for the water to consume */
  events: SplashEvent[]
}

export const motion: MotionState = {
  t: 0,
  phase: 0,
  freq: 0.5,
  swim: 1,
  calm: 1,
  trick: null,
  pose: { y: REST_Y, rx: 0, ry: 0, rz: 0 },
  events: [],
}

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt))

export function startTrick(kind: TrickKind) {
  motion.trick = { kind, start: motion.t, fired: 0 }
}

export function trickActive() {
  return motion.trick !== null
}

/**
 * Advance one frame. `calmTarget` is 1 when the fish is whole and unselected,
 * lower when the viewer has pulled it apart (a piece on its own shouldn't wriggle much).
 */
export function stepMotion(dt: number, calmTarget: number) {
  motion.t += dt
  motion.calm = damp(motion.calm, calmTarget, 5, dt)

  let ampTarget = 1
  let freqTarget = 0.5
  if (motion.trick) {
    const tt = motion.t - motion.trick.start
    const s = trickSwim(tt)
    ampTarget = s.amp
    freqTarget = s.freq
    motion.pose = trickPose(motion.trick.kind, tt)
    while (motion.trick.fired < SPLASH_CUES.length && tt >= SPLASH_CUES[motion.trick.fired].at) {
      motion.events.push(...SPLASH_CUES[motion.trick.fired].events)
      motion.trick.fired++
    }
    if (tt >= T_END) motion.trick = null
  } else {
    motion.pose = { y: REST_Y, rx: 0, ry: 0, rz: 0 }
  }
  motion.swim = damp(motion.swim, ampTarget * motion.calm, 6, dt)
  motion.freq = damp(motion.freq, freqTarget, 6, dt)
  motion.phase += TAU * motion.freq * dt
}

/** Take the pending splash events (the water calls this once per frame). */
export function drainEvents(): SplashEvent[] {
  if (motion.events.length === 0) return motion.events
  const out = motion.events
  motion.events = []
  return out
}

const WAVE_K = TAU / 1.7
const WAVE_AMP = 0.026

/**
 * The swimming wave at body position `x`: a sideways offset and the yaw that keeps a
 * rigid piece tangent to the wave. Amplitude grows toward the tail.
 */
export function bodyWave(x: number): { z: number; yaw: number } {
  const len = BODY_X1 - BODY_X0
  const s = Math.min(1, Math.max(0, (x - BODY_X0) / len))
  const a = WAVE_AMP * (0.08 + 0.92 * s * s) * motion.swim
  const da = s > 0 && s < 1 ? (WAVE_AMP * 1.84 * s * motion.swim) / len : 0
  const arg = WAVE_K * x - motion.phase
  const sin = Math.sin(arg)
  const cos = Math.cos(arg)
  return { z: a * sin, yaw: -(da * sin + a * WAVE_K * cos) }
}

/** A fin's sway: sinusoid locked to the body beat, scaled by the current swim amplitude. */
export function finSway(rate: number, offset: number) {
  return Math.sin(motion.phase * rate + offset) * (0.35 + 0.65 * motion.swim)
}
