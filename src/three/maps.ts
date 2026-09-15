/**
 * Write a grid as an 8-bit single-channel-in-RGBA texture. Texture row 0 is the bottom edge
 * (v = 0), which is the grid's last row, so rows are flipped — the same convention as the normal map.
 */
export function writeScalarMap(src: Float32Array, n: number, out: Uint8Array) {
  for (let r = 0; r < n; r++) {
    const tr = n - 1 - r
    for (let c = 0; c < n; c++) {
      const v = src[r * n + c]
      const b = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
      const o = (tr * n + c) * 4
      out[o] = b
      out[o + 1] = b
      out[o + 2] = b
      out[o + 3] = 255
    }
  }
}

/**
 * Tangent-space normal map (RGBA8) from any heightfield, rows flipped for texture v.
 * `strength` scales the slope so tiny ripples still read.
 */
export function writeNormalMap(h: Float32Array, n: number, cell: number, out: Uint8Array, strength: number) {
  const k = strength / (2 * cell)
  for (let r = 0; r < n; r++) {
    const up = r > 0 ? r - 1 : r
    const down = r < n - 1 ? r + 1 : r
    const tr = n - 1 - r
    for (let c = 0; c < n; c++) {
      const left = c > 0 ? c - 1 : c
      const right = c < n - 1 ? c + 1 : c
      const dx = (h[r * n + right] - h[r * n + left]) * k
      const dv = (h[up * n + c] - h[down * n + c]) * k
      const inv = 1 / Math.sqrt(dx * dx + dv * dv + 1)
      const o = (tr * n + c) * 4
      out[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      out[o + 1] = Math.round((-dv * inv * 0.5 + 0.5) * 255)
      out[o + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      out[o + 3] = 255
    }
  }
}
