import { describe, expect, it } from 'vitest'
import { fft1d, fft2d } from './fft'

function naiveDft(re: Float32Array, im: Float32Array, inverse: boolean) {
  const n = re.length
  const outR = new Float32Array(n)
  const outI = new Float32Array(n)
  const sign = inverse ? 1 : -1
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const a = (sign * 2 * Math.PI * k * t) / n
      outR[k] += re[t] * Math.cos(a) - im[t] * Math.sin(a)
      outI[k] += re[t] * Math.sin(a) + im[t] * Math.cos(a)
    }
  }
  return [outR, outI]
}

describe('fft1d', () => {
  it('matches a naive DFT', () => {
    const n = 16
    const re = Float32Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + 0.3 * i)
    const im = Float32Array.from({ length: n }, (_, i) => Math.cos(i * 1.3))
    const [er, ei] = naiveDft(re, im, false)
    fft1d(re, im, 0, 1, n, false)
    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(er[i], 3)
      expect(im[i]).toBeCloseTo(ei[i], 3)
    }
  })

  it('round-trips through forward and inverse', () => {
    const n = 32
    const src = Float32Array.from({ length: n }, (_, i) => Math.sin(i) * i)
    const re = src.slice()
    const im = new Float32Array(n)
    fft1d(re, im, 0, 1, n, false)
    fft1d(re, im, 0, 1, n, true)
    for (let i = 0; i < n; i++) expect(re[i] / n).toBeCloseTo(src[i], 3)
  })

  it('rejects non-power-of-two sizes', () => {
    expect(() => fft1d(new Float32Array(12), new Float32Array(12), 0, 1, 12, false)).toThrow()
  })
})

describe('fft2d', () => {
  it('turns a single frequency bin into a plane wave of unit amplitude', () => {
    const n = 8
    const re = new Float32Array(n * n)
    const im = new Float32Array(n * n)
    // bins at (kx=1, kz=0) and (-1, 0) with weight n²/2 each → cos(2π x / n)
    re[0 * n + 1] = (n * n) / 2
    re[0 * n + (n - 1)] = (n * n) / 2
    fft2d(re, im, n, true)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        expect(re[r * n + c]).toBeCloseTo(Math.cos((2 * Math.PI * c) / n), 4)
        expect(im[r * n + c]).toBeCloseTo(0, 4)
      }
  })

  it('round-trips', () => {
    const n = 16
    const src = Float32Array.from({ length: n * n }, (_, i) => Math.sin(i * 0.37) * ((i % 7) - 3))
    const re = src.slice()
    const im = new Float32Array(n * n)
    fft2d(re, im, n, false)
    fft2d(re, im, n, true)
    for (let i = 0; i < n * n; i++) expect(re[i]).toBeCloseTo(src[i], 3)
  })
})
