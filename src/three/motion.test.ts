import { beforeEach, describe, expect, it } from 'vitest'
import {
  CROUCH_Y,
  REST_Y,
  SPLASH_CUES,
  TRICKS,
  T_AIR,
  T_CROUCH,
  T_END,
  T_LAND,
  WATER_Y,
  bodyWave,
  drainEvents,
  motion,
  startTrick,
  stepMotion,
  trickActive,
  trickPose,
  trickSwim,
} from './motion'

const TAU = Math.PI * 2

function reset() {
  motion.t = 0
  motion.phase = 0
  motion.freq = 0.5
  motion.swim = 1
  motion.calm = 1
  motion.trick = null
  motion.events = []
}

describe('trickPose', () => {
  it('rests before and after the trick', () => {
    for (const kind of TRICKS) {
      expect(trickPose(kind, -1)).toEqual({ y: REST_Y, rx: 0, ry: 0, rz: 0 })
      expect(trickPose(kind, T_END + 1)).toEqual({ y: REST_Y, rx: 0, ry: 0, rz: 0 })
    }
  })

  it('crouches into the water, then leaves and re-enters at the crouch height', () => {
    const p = trickPose('somersault', T_CROUCH - 1e-6)
    expect(p.y).toBeCloseTo(CROUCH_Y, 3)
    expect(p.y).toBeLessThan(WATER_Y + 0.4) // belly (≈0.41 below centre) is under the surface
    expect(trickPose('somersault', T_LAND - 1e-6).y).toBeCloseTo(CROUCH_Y, 2)
    const peak = trickPose('somersault', T_CROUCH + T_AIR / 2).y
    expect(peak).toBeGreaterThan(0.35)
  })

  it('each trick spins a full turn about its own axis and lands level', () => {
    const end = T_LAND - 1e-6
    expect(trickPose('somersault', end).rz).toBeCloseTo(0.3 - TAU, 2)
    expect(trickPose('barrelRoll', end).rx).toBeCloseTo(TAU, 2)
    expect(trickPose('twist', end).ry).toBeCloseTo(TAU, 2)
    const mid = T_CROUCH + T_AIR / 2
    expect(trickPose('barrelRoll', mid).rx).toBeCloseTo(Math.PI, 2)
    expect(trickPose('twist', mid).ry).toBeCloseTo(Math.PI, 2)
    expect(trickPose('twist', mid).rx).toBe(0)
  })

  it('settles back to the hover after landing', () => {
    expect(trickPose('twist', T_LAND).y).toBeCloseTo(CROUCH_Y, 3)
    expect(Math.abs(trickPose('twist', T_END - 0.01).y - REST_Y)).toBeLessThan(0.02)
  })

  it('height is continuous across the phase boundaries', () => {
    for (const kind of TRICKS) {
      for (const b of [T_CROUCH, T_LAND]) {
        expect(trickPose(kind, b - 1e-4).y).toBeCloseTo(trickPose(kind, b + 1e-4).y, 2)
      }
    }
  })
})

describe('trickSwim', () => {
  it('beats hardest at take-off and returns to idle', () => {
    expect(trickSwim(-1)).toEqual({ amp: 1, freq: 0.5 })
    expect(trickSwim(T_CROUCH - 1e-6).amp).toBeGreaterThan(2.5)
    expect(trickSwim(T_CROUCH - 1e-6).freq).toBeGreaterThan(2)
    expect(trickSwim(T_END - 1e-6).amp).toBeCloseTo(1, 1)
    expect(trickSwim(T_END + 1)).toEqual({ amp: 1, freq: 0.5 })
  })
})

describe('stepMotion', () => {
  beforeEach(reset)

  it('advances phase at the idle beat while resting', () => {
    stepMotion(1, 1)
    expect(motion.phase).toBeCloseTo(TAU * 0.5, 5)
    expect(motion.pose.y).toBe(REST_Y)
    expect(trickActive()).toBe(false)
  })

  it('runs a trick to completion, firing every splash cue exactly once', () => {
    startTrick('barrelRoll')
    expect(trickActive()).toBe(true)
    let fired = 0
    let maxY = -Infinity
    for (let i = 0; i < 400; i++) {
      stepMotion(1 / 60, 1)
      fired += drainEvents().length
      maxY = Math.max(maxY, motion.pose.y)
    }
    expect(trickActive()).toBe(false)
    expect(fired).toBe(SPLASH_CUES.reduce((n, c) => n + c.events.length, 0))
    expect(maxY).toBeGreaterThan(0.35)
    expect(motion.pose.y).toBe(REST_Y)
  })

  it('calms the wave when the fish is pulled apart', () => {
    for (let i = 0; i < 300; i++) stepMotion(1 / 60, 0.2)
    expect(motion.swim).toBeLessThan(0.3)
    for (let i = 0; i < 300; i++) stepMotion(1 / 60, 1)
    expect(motion.swim).toBeGreaterThan(0.95)
  })

  it('drainEvents empties the queue', () => {
    motion.events.push({ x: 0, z: 0, radius: 1, strength: 1, drops: 0 })
    expect(drainEvents()).toHaveLength(1)
    expect(drainEvents()).toHaveLength(0)
  })
})

describe('bodyWave', () => {
  beforeEach(reset)

  it('is quiet at the snout and largest at the tail', () => {
    let head = 0
    let tail = 0
    for (let i = 0; i < 60; i++) {
      stepMotion(1 / 60, 1)
      head = Math.max(head, Math.abs(bodyWave(-1).z))
      tail = Math.max(tail, Math.abs(bodyWave(0.85).z))
    }
    expect(tail).toBeGreaterThan(head * 4)
    expect(tail).toBeLessThan(0.05)
  })

  it('yaw follows the slope of the wave', () => {
    stepMotion(0.3, 1)
    const x = 0.5
    const h = 1e-3
    const slope = (bodyWave(x + h).z - bodyWave(x - h).z) / (2 * h)
    expect(bodyWave(x).yaw).toBeCloseTo(-slope, 2)
  })
})
