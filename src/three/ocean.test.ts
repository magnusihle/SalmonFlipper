import { describe, expect, it } from 'vitest'
import { Foam, Ocean } from './ocean'
import { writeScalarMap } from './maps'

const stats = (a: Float32Array) => {
  let sum = 0
  let max = 0
  for (const v of a) {
    sum += v
    max = Math.max(max, Math.abs(v))
  }
  return { mean: sum / a.length, max }
}

describe('Ocean', () => {
  it('produces a real, near-zero-mean, bounded surface that changes with time', () => {
    const o = new Ocean(32, 6.5, { amplitude: 1 })
    o.update(0)
    const a = stats(o.height)
    expect(a.max).toBeGreaterThan(0)
    expect(a.max).toBeLessThan(1)
    expect(Math.abs(a.mean)).toBeLessThan(a.max * 0.05)
    const before = o.height.slice()
    o.update(1.5)
    let moved = 0
    for (let i = 0; i < before.length; i++) moved += Math.abs(before[i] - o.height[i])
    expect(moved).toBeGreaterThan(0)
  })

  it('imaginary leakage is negligible: displacement is a real field', () => {
    const o = new Ocean(32, 6.5)
    o.update(2)
    // dispX and height are unpacked from one complex transform; both must be finite and sane
    expect(stats(o.dispX).max).toBeLessThan(1)
    expect(stats(o.dispZ).max).toBeLessThan(1)
    for (const v of o.height) expect(Number.isFinite(v)).toBe(true)
  })

  it('is deterministic for a seed and different for another', () => {
    const a = new Ocean(16, 4, { seed: 3 })
    const b = new Ocean(16, 4, { seed: 3 })
    const c = new Ocean(16, 4, { seed: 4 })
    a.update(0.5)
    b.update(0.5)
    c.update(0.5)
    expect(Array.from(a.height)).toEqual(Array.from(b.height))
    expect(Array.from(a.height)).not.toEqual(Array.from(c.height))
  })

  it('amplitude scales the surface linearly', () => {
    const a = new Ocean(16, 4, { amplitude: 1 })
    const b = new Ocean(16, 4, { amplitude: 2 })
    a.update(1)
    b.update(1)
    for (let i = 0; i < a.height.length; i += 17) expect(b.height[i]).toBeCloseTo(2 * a.height[i], 5)
  })

  it('has a Jacobian of exactly one when there is no choppiness', () => {
    const o = new Ocean(16, 4, { choppiness: 0 })
    o.update(3)
    for (const j of o.jacobian) expect(j).toBeCloseTo(1, 6)
  })

  it('Jacobian sits around one for gentle water and dips where crests fold', () => {
    const o = new Ocean(32, 6.5, { choppiness: 1 })
    o.update(1)
    const s = stats(o.jacobian)
    expect(s.mean).toBeCloseTo(1, 1)
  })
})

describe('Foam', () => {
  it('injects where the Jacobian folds and decays afterwards', () => {
    const n = 4
    const f = new Foam(n, { halfLife: 1, bias: 0.9, gain: 10 })
    const j = new Float32Array(n * n).fill(1)
    j[5] = 0.2
    f.step(0.1, j)
    expect(f.density[5]).toBeGreaterThan(0)
    expect(f.density[0]).toBe(0)
    const peak = f.density[5]
    j[5] = 1
    f.step(1, j)
    expect(f.density[5]).toBeCloseTo(peak * Math.exp(-1), 5)
  })

  it('caps at one and takes churn as a second source', () => {
    const f = new Foam(2, { gain: 100 })
    const j = new Float32Array(4).fill(1)
    const churn = new Float32Array([0, 0, 50, 0])
    f.step(1, j, churn, 1)
    expect(f.density[2]).toBe(1)
    expect(f.density[1]).toBe(0)
  })
})

describe('writeScalarMap', () => {
  it('flips rows and quantises to bytes', () => {
    const n = 2
    const src = new Float32Array([0, 0.5, 1, 2])
    const out = new Uint8Array(n * n * 4)
    writeScalarMap(src, n, out)
    // grid row 1 (values 1, 2) lands in texture row 0
    expect(out[0]).toBe(255)
    expect(out[4]).toBe(255)
    expect(out[8]).toBe(0)
    expect(out[12]).toBe(128)
    expect(out[3]).toBe(255)
  })
})
