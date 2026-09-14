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

/** Skin: blue-slate back, silver flanks, pale belly, dark spots on top. u = along the fish, v = 1 at the back. */
export function makeSkinTexture() {
  const [c, ctx] = canvas(2048, 1024)
  const g = ctx.createLinearGradient(0, 0, 0, 1024)
  g.addColorStop(0, '#3a4a5a')
  g.addColorStop(0.2, '#66788a')
  g.addColorStop(0.38, '#b3bcc3')
  g.addColorStop(0.6, '#d9dddd')
  g.addColorStop(1, '#f1f1ec')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 2048, 1024)

  // darker, greener head
  const head = ctx.createLinearGradient(0, 0, 520, 0)
  head.addColorStop(0, 'rgba(40, 60, 58, 0.55)')
  head.addColorStop(1, 'rgba(40, 60, 58, 0)')
  ctx.fillStyle = head
  ctx.fillRect(0, 0, 520, 1024)

  // speckles on the back
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 700; i++) {
    const x = 380 + rnd() * 1660
    const y = rnd() * rnd() * 360
    const r = 3 + rnd() * 5
    ctx.fillStyle = `rgba(18, 26, 34, ${0.3 + rnd() * 0.35})`
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // faint scale sheen along the lateral line
  const sheen = ctx.createLinearGradient(0, 380, 0, 620)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 380, 2048, 240)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
