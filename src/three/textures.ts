import * as THREE from 'three'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** Salmon flesh: warm orange with the curved bands of connective tissue. */
export function makeFleshTexture() {
  const [c, ctx] = canvas(1024, 1024)
  const base = ctx.createLinearGradient(0, 0, 1024, 1024)
  base.addColorStop(0, '#f5834a')
  base.addColorStop(0.5, '#ef6f34')
  base.addColorStop(1, '#e45f2a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 1024, 1024)

  // marbling: nested arcs, drawn thick-and-soft then thin-and-bright
  const cx = -420
  const cy = 512
  let seed = 3
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  // the bands: slightly wobbly nested arcs
  const bands: { x: number; y: number; r: number }[] = []
  for (let r = 500; r < 1950; r += 78 + rnd() * 30) {
    bands.push({ x: cx + (rnd() - 0.5) * 12, y: cy + (rnd() - 0.5) * 30, r })
  }
  const strokeBands = (c: CanvasRenderingContext2D, width: number, alpha: number) => {
    c.strokeStyle = `rgba(255, 244, 232, ${alpha})`
    c.lineWidth = width
    c.lineCap = 'round'
    for (const b of bands) {
      c.beginPath()
      c.arc(b.x, b.y, b.r, -Math.PI / 2.4, Math.PI / 2.4)
      c.stroke()
    }
  }
  // soft halo: draw once offscreen, blur once on the way in
  const [halo, hctx] = canvas(1024, 1024)
  strokeBands(hctx, 22, 0.16)
  ctx.save()
  ctx.filter = 'blur(10px)'
  ctx.drawImage(halo, 0, 0)
  ctx.restore()
  strokeBands(ctx, 5, 0.5)

  // soft darker pockets so the surface isn't flat
  for (let i = 0; i < 24; i++) {
    const x = rnd() * 1024
    const y = rnd() * 1024
    const rad = 120 + rnd() * 160
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g2.addColorStop(0, 'rgba(190, 70, 25, 0.16)')
    g2.addColorStop(1, 'rgba(190, 70, 25, 0)')
    ctx.fillStyle = g2
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

// Skin texture layout: u (canvas x) runs snout → tail, v = 1 (canvas y = 0) is the back.
const SKIN_W = 2048
const SKIN_H = 1024
/** the head knife line, in skin u — no scales in front of it */
const HEAD_U = 0.238
/** the lateral line sits a touch above the midline */
const LATERAL_Y = 0.47 * SKIN_H

function prng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

/**
 * Scale rows: overlapping, offset every other row, tail-facing edge exposed. Calls `draw`
 * for every scale with its centre, radius, and how far along/around the body it sits.
 */
function eachScale(w: number, h: number, draw: (x: number, y: number, r: number, u: number, v: number) => void) {
  const rowH = h * 0.0125
  const pitch = w * 0.0092
  for (let row = 0, y = 0; y < h + rowH; row++, y += rowH) {
    const v = 1 - y / h
    for (let x = (row % 2) * pitch * 0.5; x < w + pitch; x += pitch) {
      const u = x / w
      // scales shrink toward the tail and along the belly/back edges
      const shrink = (1 - 0.3 * Math.max(0, (u - 0.72) / 0.28)) * (0.8 + 0.2 * Math.sin(Math.PI * v))
      draw(x, y, pitch * 0.62 * shrink, u, v)
    }
  }
}

/** X-shaped Atlantic-salmon spot. */
function spot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, rnd: () => number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rnd() - 0.5) * 0.9)
  ctx.strokeStyle = `rgba(14, 18, 24, ${alpha})`
  ctx.fillStyle = `rgba(14, 18, 24, ${alpha * 0.8})`
  ctx.lineCap = 'round'
  ctx.lineWidth = size * 0.32
  const arms = rnd() < 0.7 ? 2 : 1
  for (let i = 0; i < arms; i++) {
    const a = i === 0 ? 0.7 : -0.7 + (rnd() - 0.5) * 0.4
    const l = size * (0.5 + rnd() * 0.3)
    ctx.beginPath()
    ctx.moveTo(-Math.cos(a) * l, -Math.sin(a) * l)
    ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(0, 0, size * 0.28, size * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Fine per-pixel grain so the gradients don't read as plastic. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const rnd = prng(seed)
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Skin colour: steel-blue back, silver flank with a faint iridescent band, white belly,
 * black x-shaped spots above the lateral line, scale rows behind the head, and the
 * gill cover, jaw and eye socket painted onto the head.
 */
function paintSkinColor(ctx: CanvasRenderingContext2D) {
  const w = SKIN_W
  const h = SKIN_H
  const rnd = prng(7)

  const base = ctx.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#22313c')
  base.addColorStop(0.1, '#2f4a56')
  base.addColorStop(0.24, '#5f7a88')
  base.addColorStop(0.36, '#97aab3')
  base.addColorStop(0.46, '#c6d1d5')
  base.addColorStop(0.55, '#d8dedf')
  base.addColorStop(0.72, '#e7e6df')
  base.addColorStop(1, '#f5f2ea')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // the back is greener toward the head and bluer toward the tail
  const along = ctx.createLinearGradient(0, 0, w, 0)
  along.addColorStop(0, 'rgba(60, 92, 78, 0.35)')
  along.addColorStop(0.45, 'rgba(60, 92, 78, 0)')
  along.addColorStop(1, 'rgba(40, 60, 100, 0.18)')
  ctx.fillStyle = along
  ctx.fillRect(0, 0, w, h * 0.5)

  // iridescence: rose, then a hint of green, then violet, all soft
  const band = (y0: number, y1: number, rgb: string, a: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, `rgba(${rgb}, 0)`)
    g.addColorStop(0.5, `rgba(${rgb}, ${a})`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, y0, w, y1 - y0)
  }
  band(h * 0.34, h * 0.44, '190, 214, 176', 0.12)
  band(h * 0.43, h * 0.56, '236, 196, 206', 0.16)
  band(h * 0.56, h * 0.68, '196, 190, 220', 0.1)
  band(h * 0.4, h * 0.6, '255, 255, 255', 0.2)

  // scales
  const headPx = HEAD_U * w
  eachScale(w, h, (x, y, r, u, v) => {
    if (x < headPx) return
    const fade = Math.min(1, (x - headPx) / (w * 0.05))
    // edges read darker on the dark back and softer on the pale belly
    const dark = 0.06 + 0.2 * v
    ctx.strokeStyle = `rgba(30, 44, 56, ${dark * fade})`
    ctx.lineWidth = r * 0.16
    ctx.beginPath()
    ctx.arc(x, y, r, -1.25, 1.25)
    ctx.stroke()
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.22 - 0.1 * v) * fade})`
    ctx.lineWidth = r * 0.14
    ctx.beginPath()
    ctx.arc(x - r * 0.12, y, r * 0.86, -1.1, 1.1)
    ctx.stroke()
    if (rnd() < 0.08 * (0.5 + 0.5 * v) * fade) {
      // the odd scale catches the light
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + rnd() * 0.1})`
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y, r * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // lateral line: a thin dark seam with a light edge below it
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(70, 82, 92, 0.42)'
  ctx.beginPath()
  for (let x = w * 0.2; x <= w; x += 16) {
    const y = LATERAL_Y + Math.sin(x * 0.004) * 4 + (rnd() - 0.5) * 2
    if (x === w * 0.2) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath()
  ctx.moveTo(w * 0.2, LATERAL_Y + 5)
  ctx.lineTo(w, LATERAL_Y + 5)
  ctx.stroke()

  // spots: dense above the lateral line, a few on the gill cover, a couple straying below
  for (let i = 0; i < 230; i++) {
    const x = w * 0.19 + Math.pow(rnd(), 0.8) * w * 0.8
    const y = 24 + Math.pow(rnd(), 1.4) * (LATERAL_Y - 40)
    spot(ctx, x, y, 8 + rnd() * 10, 0.55 + rnd() * 0.35, rnd)
  }
  for (let i = 0; i < 24; i++) {
    spot(ctx, w * 0.1 + rnd() * w * 0.12, h * 0.3 + rnd() * h * 0.28, 7 + rnd() * 6, 0.5 + rnd() * 0.3, rnd)
  }
  for (let i = 0; i < 14; i++) {
    spot(ctx, w * 0.3 + rnd() * w * 0.65, LATERAL_Y + 20 + rnd() * 80, 6 + rnd() * 6, 0.2 + rnd() * 0.15, rnd)
  }

  // head: darker olive-steel crown, pale throat, fading out at the gill cover
  const [hc, hctx] = canvas(w, h)
  const crown = hctx.createLinearGradient(0, 0, 0, h)
  crown.addColorStop(0, 'rgba(34, 54, 52, 0.7)')
  crown.addColorStop(0.42, 'rgba(50, 70, 70, 0.3)')
  crown.addColorStop(0.55, 'rgba(120, 130, 130, 0.08)')
  crown.addColorStop(0.7, 'rgba(255, 250, 240, 0.25)')
  crown.addColorStop(1, 'rgba(255, 250, 240, 0.4)')
  hctx.fillStyle = crown
  hctx.fillRect(0, 0, headPx + 40, h)
  const headFade = hctx.createLinearGradient(headPx - 100, 0, headPx + 40, 0)
  headFade.addColorStop(0, 'rgba(0,0,0,1)')
  headFade.addColorStop(1, 'rgba(0,0,0,0)')
  hctx.globalCompositeOperation = 'destination-in'
  hctx.fillStyle = headFade
  hctx.fillRect(0, 0, w, h)
  ctx.drawImage(hc, 0, 0)

  // gill cover (operculum) and the pre-opercular crease behind it
  const gill = (cx: number, r: number, width: number, dark: number, light: number) => {
    ctx.lineWidth = width
    ctx.strokeStyle = `rgba(28, 38, 46, ${dark})`
    ctx.beginPath()
    ctx.arc(cx, h * 0.5, r, -0.95, 0.95)
    ctx.stroke()
    ctx.lineWidth = width * 0.6
    ctx.strokeStyle = `rgba(255, 255, 255, ${light})`
    ctx.beginPath()
    ctx.arc(cx + 6, h * 0.5, r, -0.9, 0.9)
    ctx.stroke()
  }
  gill(headPx * 0.5, headPx * 0.5, 7, 0.5, 0.3)
  gill(headPx * 0.42, headPx * 0.34, 4, 0.22, 0.18)
  // dark crescent just in front of the gill cover edge
  const gillShade = ctx.createLinearGradient(headPx * 0.86, 0, headPx, 0)
  gillShade.addColorStop(0, 'rgba(28, 38, 46, 0)')
  gillShade.addColorStop(1, 'rgba(28, 38, 46, 0.35)')
  ctx.fillStyle = gillShade
  ctx.fillRect(headPx * 0.86, h * 0.15, headPx * 0.14, h * 0.7)

  // jaw line and snout
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(40, 42, 46, 0.55)'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.53)
  ctx.quadraticCurveTo(w * 0.06, h * 0.55, w * 0.115, h * 0.6)
  ctx.stroke()
  const snout = ctx.createLinearGradient(0, 0, w * 0.05, 0)
  snout.addColorStop(0, 'rgba(30, 36, 40, 0.5)')
  snout.addColorStop(1, 'rgba(30, 36, 40, 0)')
  ctx.fillStyle = snout
  ctx.fillRect(0, 0, w * 0.05, h)

  // eye socket — the eye mesh sits on top, this is the shadow around it
  const ex = w * 0.081
  const ey = h * 0.45
  const socket = ctx.createRadialGradient(ex, ey, 10, ex, ey, 62)
  socket.addColorStop(0, 'rgba(20, 24, 28, 0.55)')
  socket.addColorStop(0.6, 'rgba(20, 24, 28, 0.25)')
  socket.addColorStop(1, 'rgba(20, 24, 28, 0)')
  ctx.fillStyle = socket
  ctx.fillRect(ex - 62, ey - 62, 124, 124)

  grain(ctx, w, h, 14, 11)
}

/**
 * Height for the bump map: each scale is a low dome with its exposed edge dropped into a
 * groove, the lateral line and gill cover are creased, the head is smooth. Mid-grey = flat.
 */
function paintSkinBump(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, w, h)
  const headPx = HEAD_U * w
  eachScale(w, h, (x, y, r) => {
    if (x < headPx) return
    const fade = Math.min(1, (x - headPx) / (w * 0.05))
    const dome = ctx.createRadialGradient(x - r * 0.25, y, 0, x - r * 0.25, y, r * 1.1)
    dome.addColorStop(0, `rgba(255, 255, 255, ${0.16 * fade})`)
    dome.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = dome
    ctx.fillRect(x - r * 1.4, y - r * 1.2, r * 2.8, r * 2.4)
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.45 * fade})`
    ctx.lineWidth = r * 0.2
    ctx.beginPath()
    ctx.arc(x, y, r, -1.25, 1.25)
    ctx.stroke()
  })
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.moveTo(w * 0.2, (LATERAL_Y / SKIN_H) * h)
  ctx.lineTo(w, (LATERAL_Y / SKIN_H) * h)
  ctx.stroke()
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(headPx * 0.5, h * 0.5, headPx * 0.5, -0.95, 0.95)
  ctx.stroke()
}

export interface SkinTextures {
  map: THREE.Texture
  bump: THREE.Texture
}

/** Skin colour + bump. u = along the fish (snout → tail), v = 1 at the back, 0 at the belly. */
export function makeSkinTexture(): SkinTextures {
  const [c, ctx] = canvas(SKIN_W, SKIN_H)
  paintSkinColor(ctx)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8

  const [bc, bctx] = canvas(SKIN_W / 2, SKIN_H / 2)
  paintSkinBump(bctx, SKIN_W / 2, SKIN_H / 2)
  const bump = new THREE.CanvasTexture(bc)
  bump.anisotropy = 8
  return { map, bump }
}
