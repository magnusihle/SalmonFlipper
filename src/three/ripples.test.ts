import { describe, expect, it } from 'vitest'
import { Ripples } from './ripples'

describe('Ripples', () => {
  it('starts flat and stays flat without disturbances', () => {
    const r = new Ripples(32, 4)
    r.step(1)
    expect(r.energy()).toBe(0)
  })

  it('a drop makes a depression that spreads outward as a ring', () => {
    const r = new Ripples(64, 4)
    r.drop(0, 0, 0.3, 1)
    expect(r.sample(0, 0)).toBeLessThan(0)
    expect(r.sample(1.2, 0)).toBe(0)
    // after a while the centre has rebounded and the disturbance has reached further out
    let reached = false
    for (let i = 0; i < 90; i++) {
      r.step(1 / 60)
      if (Math.abs(r.sample(1.2, 0)) > 1e-4) reached = true
    }
    expect(reached).toBe(true)
  })

  it('energy decays over time', () => {
    const r = new Ripples(64, 4)
    r.drop(0.5, -0.5, 0.4, 1)
    const e0 = r.energy()
    for (let i = 0; i < 240; i++) r.step(1 / 60)
    const e1 = r.energy()
    for (let i = 0; i < 240; i++) r.step(1 / 60)
    const e2 = r.energy()
    expect(e1).toBeLessThan(e0)
    expect(e2).toBeLessThan(e1)
    expect(e2 / e0).toBeLessThan(0.05)
  })

  it('stays bounded (no blow-up) under repeated hits', () => {
    const r = new Ripples(48, 4)
    for (let i = 0; i < 600; i++) {
      if (i % 10 === 0) r.drop((i % 7) * 0.3 - 1, (i % 5) * 0.3 - 0.6, 0.25, 0.5)
      r.step(1 / 60)
    }
    let max = 0
    for (const h of r.height) max = Math.max(max, Math.abs(h))
    expect(Number.isFinite(max)).toBe(true)
    expect(max).toBeLessThan(2)
  })

  it('caps the number of substeps for a huge frame time', () => {
    const r = new Ripples(16, 4)
    expect(r.step(5, 4)).toBe(4)
    expect(r.step(0)).toBe(0)
  })

  it('writes a flat normal map for a flat surface and tilts it near a slope', () => {
    const r = new Ripples(16, 4)
    const out = new Uint8Array(16 * 16 * 4)
    r.writeNormalMap(out, 1)
    expect([out[0], out[1], out[2], out[3]]).toEqual([128, 128, 255, 255])
    r.drop(0, 0, 0.8, 1)
    r.writeNormalMap(out, 4)
    let tilted = 0
    for (let i = 0; i < out.length; i += 4) if (out[i] !== 128 || out[i + 1] !== 128) tilted++
    expect(tilted).toBeGreaterThan(0)
  })
})
