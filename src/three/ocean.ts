import { fft2d } from './fft'

/**
 * A Tessendorf-style spectral ocean patch: a JONSWAP spectrum sampled onto a grid of wave
 * vectors, evolved in the frequency domain with the deep-water + capillary dispersion relation,
 * and brought back to the surface with inverse FFTs. Also produces the horizontal (choppy)
 * displacement and the Jacobian of that displacement, which goes negative where crests fold
 * over — the classic foam trigger.
 *
 * Pure TypeScript so it can run and be tested without a renderer.
 */
export interface OceanOptions {
  /** wind speed, m/s */
  wind?: number
  /** wind direction, radians (0 = +x) */
  windDir?: number
  /** fetch, metres — how far the wind has been blowing over water */
  fetch?: number
  /** how concentrated waves are around the wind direction (higher = tighter) */
  spread?: number
  /** overall height multiplier on top of the physical spectrum */
  amplitude?: number
  /** horizontal displacement scale (0 = pure heightfield, 1 = physical) */
  choppiness?: number
  /** wavelengths shorter than this (in world units) are cut to keep the grid from aliasing */
  minWavelength?: number
  /** how many real metres one world unit is */
  metresPerUnit?: number
  seed?: number
}

const G = 9.81
/** capillary wavenumber, rad/m — surface tension speeds up ripples shorter than ~1.7 cm */
const K_M = 370

function lcg(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export class Ocean {
  readonly n: number
  /** patch length in world units; the surface tiles at this period */
  readonly size: number
  readonly height: Float32Array
  readonly dispX: Float32Array
  readonly dispZ: Float32Array
  readonly jacobian: Float32Array
  readonly choppiness: number
  private readonly omega: Float32Array
  /** h0(k) and conj(h0(-k)), split re/im */
  private readonly h0r: Float32Array
  private readonly h0i: Float32Array
  private readonly hcr: Float32Array
  private readonly hci: Float32Array
  /** unit wave vector components, zero at k = 0 */
  private readonly ux: Float32Array
  private readonly uz: Float32Array
  private readonly re1: Float32Array
  private readonly im1: Float32Array
  private readonly re2: Float32Array
  private readonly im2: Float32Array

  constructor(n: number, size: number, opts: OceanOptions = {}) {
    this.n = n
    this.size = size
    const N = n * n
    this.height = new Float32Array(N)
    this.dispX = new Float32Array(N)
    this.dispZ = new Float32Array(N)
    this.jacobian = new Float32Array(N).fill(1)
    this.omega = new Float32Array(N)
    this.h0r = new Float32Array(N)
    this.h0i = new Float32Array(N)
    this.hcr = new Float32Array(N)
    this.hci = new Float32Array(N)
    this.ux = new Float32Array(N)
    this.uz = new Float32Array(N)
    this.re1 = new Float32Array(N)
    this.im1 = new Float32Array(N)
    this.re2 = new Float32Array(N)
    this.im2 = new Float32Array(N)
    this.choppiness = opts.choppiness ?? 1

    const mpu = opts.metresPerUnit ?? 0.5
    const wind = Math.max(0.1, opts.wind ?? 3)
    const fetch = Math.max(1, opts.fetch ?? 60)
    const windDir = opts.windDir ?? 0.6
    const spread = opts.spread ?? 4
    const amp = opts.amplitude ?? 1
    const minLambda = (opts.minWavelength ?? (2.5 * size) / n) * mpu
    const rnd = lcg(opts.seed ?? 7)
    const gauss = () => {
      const u = Math.max(rnd(), 1e-9)
      const v = rnd()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }

    // JONSWAP parameters for this wind and fetch
    const alpha = 0.076 * Math.pow((wind * wind) / (fetch * G), 0.22)
    const omegaP = 22 * Math.pow((G * G) / (wind * fetch), 1 / 3)
    const gamma = 3.3
    const L = size * mpu // patch length in metres
    const dk = (2 * Math.PI) / L

    const dispersion = (k: number) => Math.sqrt(G * k * (1 + (k / K_M) * (k / K_M)))
    const spectrum = (kx: number, kz: number) => {
      const k = Math.hypot(kx, kz)
      if (k < 1e-6) return 0
      const w = dispersion(k)
      const sigma = w <= omegaP ? 0.07 : 0.09
      const r = Math.exp(-((w - omegaP) * (w - omegaP)) / (2 * sigma * sigma * omegaP * omegaP))
      const s = ((alpha * G * G) / Math.pow(w, 5)) * Math.exp(-1.25 * Math.pow(omegaP / w, 4)) * Math.pow(gamma, r)
      // polar → Cartesian: S(ω) dω/dk / k
      const dwdk = (G * (1 + (3 * k * k) / (K_M * K_M))) / (2 * w)
      const theta = Math.atan2(kz, kx) - windDir
      const c = Math.cos(theta)
      const dir = c > 0 ? Math.pow(c, 2 * spread) : 0
      // a little energy in every direction so the surface never looks combed
      const D = (0.85 * dir) / dirInt + 0.15 / (2 * Math.PI)
      // gaussian roll-off for wavelengths shorter than minLambda (k > 2π / minLambda)
      const kc = (k * minLambda) / (2 * Math.PI)
      const cutoff = Math.exp(-kc * kc)
      return (s * dwdk * D * cutoff) / k
    }

    // normalise the directional part so it integrates to one over the circle
    let dirInt = 0
    for (let i = 0; i < 720; i++) {
      const c = Math.cos((i / 720) * 2 * Math.PI)
      dirInt += c > 0 ? Math.pow(c, 2 * spread) : 0
    }
    dirInt *= (2 * Math.PI) / 720

    const h0 = (kx: number, kz: number) => {
      const e = spectrum(kx, kz)
      // spectrum is in metres; the surface lives in world units
      const a = (Math.sqrt(2 * e * dk * dk) * amp) / mpu
      return [(gauss() * a) / Math.SQRT2, (gauss() * a) / Math.SQRT2]
    }

    for (let r = 0; r < n; r++) {
      const mz = r < n / 2 ? r : r - n
      const kz = mz * dk
      for (let c = 0; c < n; c++) {
        const mx = c < n / 2 ? c : c - n
        const kx = mx * dk
        const i = r * n + c
        const k = Math.hypot(kx, kz)
        this.omega[i] = k > 0 ? dispersion(k) : 0
        this.ux[i] = k > 0 ? kx / k : 0
        this.uz[i] = k > 0 ? kz / k : 0
        const [ar, ai] = h0(kx, kz)
        this.h0r[i] = ar
        this.h0i[i] = ai
        const [br, bi] = h0(-kx, -kz)
        this.hcr[i] = br
        this.hci[i] = -bi
      }
    }
  }

  /** cell spacing in world units */
  get cell() {
    return this.size / this.n
  }

  /** Evaluate the surface at time `t` seconds into height, dispX, dispZ and jacobian. */
  update(t: number) {
    const { n, omega, h0r, h0i, hcr, hci, ux, uz, re1, im1, re2, im2 } = this
    const N = n * n
    for (let i = 0; i < N; i++) {
      const w = omega[i] * t
      const c = Math.cos(w)
      const s = Math.sin(w)
      // h(k,t) = h0 e^{iωt} + conj(h0(-k)) e^{-iωt}
      const hr = h0r[i] * c - h0i[i] * s + hcr[i] * c + hci[i] * s
      const hi = h0r[i] * s + h0i[i] * c - hcr[i] * s + hci[i] * c
      // Dx = -i (kx/k) h,  Dz = -i (kz/k) h
      const dxr = ux[i] * hi
      const dxi = -ux[i] * hr
      const dzr = uz[i] * hi
      const dzi = -uz[i] * hr
      // pack two real fields per transform: ifft(A + iB) = a + ib for Hermitian A, B
      re1[i] = hr - dxi
      im1[i] = hi + dxr
      re2[i] = dzr
      im2[i] = dzi
    }
    fft2d(re1, im1, n, true, false)
    fft2d(re2, im2, n, true, false)
    const { height, dispX, dispZ } = this
    for (let i = 0; i < N; i++) {
      height[i] = re1[i]
      dispX[i] = im1[i]
      dispZ[i] = re2[i]
    }
    this.computeJacobian()
  }

  private computeJacobian() {
    const { n, dispX, dispZ, jacobian, choppiness: lam } = this
    const k = lam / (2 * this.cell)
    for (let r = 0; r < n; r++) {
      const up = (r + n - 1) % n
      const down = (r + 1) % n
      for (let c = 0; c < n; c++) {
        const left = (c + n - 1) % n
        const right = (c + 1) % n
        const dxdx = (dispX[r * n + right] - dispX[r * n + left]) * k
        const dxdz = (dispX[down * n + c] - dispX[up * n + c]) * k
        const dzdx = (dispZ[r * n + right] - dispZ[r * n + left]) * k
        const dzdz = (dispZ[down * n + c] - dispZ[up * n + c]) * k
        jacobian[r * n + c] = (1 + dxdx) * (1 + dzdz) - dxdz * dzdx
      }
    }
  }
}

export interface FoamOptions {
  /** seconds for foam to fall to 1/e */
  halfLife?: number
  /** Jacobian below which foam is injected (1 = flat water; raise for more foam) */
  bias?: number
  /** foam added per second per unit of Jacobian deficit */
  gain?: number
}

/** Foam density on the surface: injected where the Jacobian folds or splashes churn, decaying over time. */
export class Foam {
  readonly density: Float32Array
  private readonly decayRate: number
  private readonly bias: number
  private readonly gain: number

  constructor(n: number, opts: FoamOptions = {}) {
    this.density = new Float32Array(n * n)
    this.decayRate = 1 / (opts.halfLife ?? 2.5)
    this.bias = opts.bias ?? 0.9
    this.gain = opts.gain ?? 6
  }

  /**
   * Advance by `dt`. `jacobian` folds inject foam; `churn` (any non-negative per-cell
   * agitation measure, e.g. ripple speed) injects scaled by `churnGain`.
   */
  step(dt: number, jacobian: Float32Array, churn?: Float32Array, churnGain = 0) {
    const d = this.density
    const keep = Math.exp(-dt * this.decayRate)
    for (let i = 0; i < d.length; i++) {
      let f = d[i] * keep
      const fold = this.bias - jacobian[i]
      if (fold > 0) f += fold * this.gain * dt
      if (churn) f += Math.abs(churn[i]) * churnGain * dt
      d[i] = f > 1 ? 1 : f
    }
  }
}
