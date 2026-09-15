/**
 * A small 2D shallow-water heightfield: every cell carries a height and a velocity,
 * and each step pulls a cell toward the mean of its four neighbours. Disturbances
 * spread as rings, reflect softly off a damped border and die out over a few seconds.
 *
 * Pure TypeScript so it can run (and be tested) without a renderer.
 */
export interface RipplesOptions {
  /** velocity retained per substep — lower dies faster */
  damping?: number
  /** wave stiffness; keep ≤ 0.5 for stability */
  speed?: number
  /** cells near the border that soak up energy so waves don't bounce back */
  sponge?: number
  /** substep length in seconds */
  substep?: number
}

import { writeNormalMap } from './maps'

export class Ripples {
  readonly n: number
  readonly size: number
  readonly height: Float32Array
  readonly velocity: Float32Array
  private readonly damping: number
  private readonly speed: number
  private readonly sponge: number
  private readonly substep: number
  private readonly edgeDamp: Float32Array
  private carry = 0

  constructor(n: number, size: number, opts: RipplesOptions = {}) {
    this.n = n
    this.size = size
    this.height = new Float32Array(n * n)
    this.velocity = new Float32Array(n * n)
    this.damping = opts.damping ?? 0.986
    this.speed = opts.speed ?? 0.5
    this.sponge = opts.sponge ?? 10
    this.substep = opts.substep ?? 1 / 60

    // per-cell damping that ramps down inside the sponge band
    this.edgeDamp = new Float32Array(n * n)
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const d = Math.min(r, c, n - 1 - r, n - 1 - c)
        const s = d >= this.sponge ? 1 : d / this.sponge
        this.edgeDamp[r * n + c] = 0.9 + 0.1 * s * s
      }
    }
  }

  /** cell spacing in world units */
  get cell() {
    return this.size / (this.n - 1)
  }

  /** world (x, z) → fractional grid (col, row) */
  toGrid(x: number, z: number): [number, number] {
    const h = this.size / 2
    return [((x + h) / this.size) * (this.n - 1), ((z + h) / this.size) * (this.n - 1)]
  }

  /**
   * Push the surface down (or up, with a negative strength) in a smooth bump of the given
   * world radius. Something landing on the water is a positive strength.
   */
  drop(x: number, z: number, radius: number, strength: number) {
    const [gc, gr] = this.toGrid(x, z)
    const rc = radius / this.cell
    const r0 = Math.max(0, Math.floor(gr - rc))
    const r1 = Math.min(this.n - 1, Math.ceil(gr + rc))
    const c0 = Math.max(0, Math.floor(gc - rc))
    const c1 = Math.min(this.n - 1, Math.ceil(gc + rc))
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(r - gr, c - gc) / rc
        if (d >= 1) continue
        const w = 0.5 + 0.5 * Math.cos(Math.PI * d)
        this.height[r * this.n + c] -= strength * w
      }
    }
  }

  /** Advance the simulation by `dt` seconds (internally fixed substeps, at most `maxSteps`). */
  step(dt: number, maxSteps = 4) {
    this.carry += dt
    let steps = 0
    while (this.carry >= this.substep && steps < maxSteps) {
      this.substep1()
      this.carry -= this.substep
      steps++
    }
    if (steps === maxSteps) this.carry = 0
    return steps
  }

  private substep1() {
    const { n, height: h, velocity: v, speed, damping, edgeDamp } = this
    for (let r = 0; r < n; r++) {
      const up = r > 0 ? r - 1 : r
      const down = r < n - 1 ? r + 1 : r
      for (let c = 0; c < n; c++) {
        const left = c > 0 ? c - 1 : c
        const right = c < n - 1 ? c + 1 : c
        const i = r * n + c
        const mean = (h[up * n + c] + h[down * n + c] + h[r * n + left] + h[r * n + right]) * 0.25
        v[i] = (v[i] + (mean - h[i]) * speed) * damping * edgeDamp[i]
      }
    }
    for (let i = 0; i < n * n; i++) h[i] += v[i]
  }

  /** Bilinear height at a world position. */
  sample(x: number, z: number) {
    const [gc, gr] = this.toGrid(x, z)
    const c = Math.min(Math.max(gc, 0), this.n - 1.0001)
    const r = Math.min(Math.max(gr, 0), this.n - 1.0001)
    const c0 = Math.floor(c)
    const r0 = Math.floor(r)
    const fc = c - c0
    const fr = r - r0
    const h = this.height
    const n = this.n
    return (
      h[r0 * n + c0] * (1 - fc) * (1 - fr) +
      h[r0 * n + c0 + 1] * fc * (1 - fr) +
      h[(r0 + 1) * n + c0] * (1 - fc) * fr +
      h[(r0 + 1) * n + c0 + 1] * fc * fr
    )
  }

  /** Sum of squared heights — a cheap "how much is going on" measure. */
  energy() {
    let e = 0
    for (let i = 0; i < this.height.length; i++) e += this.height[i] * this.height[i]
    return e
  }

  /** Tangent-space normal map of this surface alone; see `writeNormalMap` in maps.ts. */
  writeNormalMap(out: Uint8Array, strength: number) {
    writeNormalMap(this.height, this.n, this.cell, out, strength)
  }
}
