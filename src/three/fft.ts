/**
 * Radix-2 complex FFT on split re/im Float32Arrays, plus an in-place 2D transform.
 * Sizes must be powers of two. Tables are cached per size.
 */
interface Tables {
  rev: Uint32Array
  cos: Float32Array
  sin: Float32Array
}

const cache = new Map<number, Tables>()

function tables(n: number): Tables {
  let t = cache.get(n)
  if (t) return t
  if (n < 2 || (n & (n - 1)) !== 0) throw new Error(`fft size must be a power of two, got ${n}`)
  const bits = Math.log2(n)
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
  const cos = new Float32Array(n / 2)
  const sin = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  t = { rev, cos, sin }
  cache.set(n, t)
  return t
}

/**
 * In-place 1D transform of `n` elements starting at `offset` with the given `stride`.
 * `inverse` uses the +i kernel and does not scale; callers divide by n themselves.
 */
export function fft1d(re: Float32Array, im: Float32Array, offset: number, stride: number, n: number, inverse: boolean) {
  const { rev, cos, sin } = tables(n)
  for (let i = 0; i < n; i++) {
    const j = rev[i]
    if (j > i) {
      const a = offset + i * stride
      const b = offset + j * stride
      let t = re[a]
      re[a] = re[b]
      re[b] = t
      t = im[a]
      im[a] = im[b]
      im[b] = t
    }
  }
  const sign = inverse ? 1 : -1
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const step = n / len
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step]
        const wi = sign * sin[k * step]
        const a = offset + (start + k) * stride
        const b = offset + (start + k + half) * stride
        const xr = re[b] * wr - im[b] * wi
        const xi = re[b] * wi + im[b] * wr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
    }
  }
}

/**
 * In-place 2D transform of an n×n row-major grid. The inverse is scaled by 1/n² unless
 * `scale` is false — wave synthesis wants the plain sum Σ h̃(k) e^{ik·x}.
 */
export function fft2d(re: Float32Array, im: Float32Array, n: number, inverse: boolean, scale = true) {
  for (let r = 0; r < n; r++) fft1d(re, im, r * n, 1, n, inverse)
  for (let c = 0; c < n; c++) fft1d(re, im, c, n, n, inverse)
  if (inverse && scale) {
    const s = 1 / (n * n)
    for (let i = 0; i < n * n; i++) {
      re[i] *= s
      im[i] *= s
    }
  }
}
