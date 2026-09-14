import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** The body runs from the snout (BODY_X0) to the caudal peduncle (BODY_X1). The tail fin extends past it. */
export const BODY_X0 = -1
export const BODY_X1 = 0.85

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

const tOf = (x: number) => THREE.MathUtils.clamp((x - BODY_X0) / (BODY_X1 - BODY_X0), 0, 1)

/** Half-height of the body at x. */
export function halfHeight(x: number) {
  const t = tOf(x)
  const body = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75) * 0.34
  const peduncle = 0.055 * smoothstep(0.55, 1, t)
  const snout = 0.02 * (1 - smoothstep(0, 0.08, t))
  return body + peduncle + snout
}

/** Half-width of the body at x — salmon are taller than they are wide. */
export function halfWidth(x: number) {
  return halfHeight(x) * 0.52 + 0.012
}

/** Vertical centre line — the belly sags a touch below the axis. */
export function centerY(x: number) {
  return -0.035 * Math.sin(Math.PI * tOf(x))
}

export function topY(x: number) {
  return centerY(x) + halfHeight(x)
}
export function bottomY(x: number) {
  return centerY(x) - halfHeight(x)
}

/** A point on the body surface. θ = 0 is the back, π is the belly. */
function surface(x: number, theta: number, r = 1): [number, number, number] {
  return [x, centerY(x) + r * halfHeight(x) * Math.cos(theta), r * halfWidth(x) * Math.sin(theta)]
}

type V3 = [number, number, number]
type V2 = [number, number]

/** Generic indexed grid surface with smooth normals. */
function grid(nu: number, nv: number, fn: (u: number, v: number) => V3, uv: (u: number, v: number) => V2) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    for (let j = 0; j <= nv; j++) {
      const v = j / nv
      positions.push(...fn(u, v))
      uvs.push(...uv(u, v))
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j
      const b = a + nv + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

export interface SegmentSpec {
  x0: number
  x1: number
  half?: 'top' | 'bottom'
  /** skin removed on the near (+z) side so the flesh faces the viewer, like a fillet */
  filleted?: boolean
}

/** Small gap between neighbouring cuts so the knife lines read. */
export const GAP = 0.009

const fleshUV = (y: number, z: number): V2 => [0.5 + z / 0.55, 0.5 + y / 0.8]

/**
 * Build one cut of the fish: the skin (outer surface) and the flesh (every cut face).
 * Half segments get an extra flat face along the split plane.
 */
export function buildSegment(spec: SegmentSpec) {
  const x0 = spec.x0 + GAP
  const x1 = spec.x1 - GAP
  const yOff = spec.half === 'top' ? GAP * 0.6 : spec.half === 'bottom' ? -GAP * 0.6 : 0
  const [t0, t1] =
    spec.half === 'top' ? [-Math.PI / 2, Math.PI / 2] : spec.half === 'bottom' ? [Math.PI / 2, (3 * Math.PI) / 2] : [0, Math.PI * 2]
  const nx = Math.max(6, Math.round((x1 - x0) * 40))
  const nth = spec.half ? 28 : 56

  const lift = (p: V3): V3 => [p[0], p[1] + yOff, p[2]]

  const side = (a: number, b: number, n: number, uv: (x: number, theta: number) => V2) =>
    grid(
      nx,
      n,
      (u, v) => lift(surface(x0 + u * (x1 - x0), a + v * (b - a))),
      (u, v) => uv(x0 + u * (x1 - x0), a + v * (b - a)),
    )
  const skinUV = (x: number, theta: number): V2 => [tOf(x), (Math.cos(theta) + 1) / 2]
  const filletUV = (x: number, theta: number): V2 => [(x - x0) * 1.8, (Math.cos(theta) + 1) / 2]

  const caps: THREE.BufferGeometry[] = []
  let skin: THREE.BufferGeometry
  if (spec.filleted) {
    // near side (θ in [0, π], z > 0) is bare flesh; far side keeps its skin
    const near0 = Math.max(t0, 0)
    const near1 = Math.min(t1, Math.PI)
    caps.push(side(near0, near1, Math.round(nth / 2), filletUV))
    if (spec.half === 'top') skin = side(-Math.PI / 2, 0, Math.round(nth / 2), skinUV)
    else if (spec.half === 'bottom') skin = side(Math.PI, (3 * Math.PI) / 2, Math.round(nth / 2), skinUV)
    else skin = side(Math.PI, Math.PI * 2, Math.round(nth / 2), skinUV)
  } else {
    skin = side(t0, t1, nth, skinUV)
  }
  for (const x of [x0, x1]) {
    caps.push(
      grid(
        4,
        nth,
        (u, v) => lift(surface(x, t0 + v * (t1 - t0), u)),
        (u, v) => {
          const p = surface(x, t0 + v * (t1 - t0), u)
          return fleshUV(p[1] - centerY(x), p[2])
        },
      ),
    )
  }
  if (spec.half) {
    caps.push(
      grid(
        nx,
        4,
        (u, v) => {
          const x = x0 + u * (x1 - x0)
          return [x, centerY(x) + yOff, (v * 2 - 1) * halfWidth(x)]
        },
        (u, v) => [u * (x1 - x0) * 1.8, 0.5 + (v * 2 - 1) * halfWidth(x0 + u * (x1 - x0)) / 0.55],
      ),
    )
  }

  const flesh = mergeGeometries(caps, false)!
  return { skin, flesh }
}

/** Fin outlines, in the XY plane, extruded a hair. */
function fin(points: V2[], depth = 0.012) {
  const shape = new THREE.Shape()
  shape.moveTo(...points[0])
  for (let i = 1; i < points.length; i++) shape.lineTo(...points[i])
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 12 })
  g.translate(0, 0, -depth / 2)
  return g
}

export function dorsalFin() {
  const xs = [-0.34, -0.3, -0.24, -0.16, -0.09, -0.06]
  return fin([
    [xs[0], topY(xs[0]) - 0.02],
    [xs[1], topY(xs[1]) + 0.13],
    [xs[2], topY(xs[2]) + 0.15],
    [xs[3], topY(xs[3]) + 0.1],
    [xs[4], topY(xs[4]) + 0.05],
    [xs[5], topY(xs[5]) - 0.02],
  ])
}

export function adiposeFin() {
  const x = 0.4
  return fin([
    [x - 0.03, topY(x - 0.03) - 0.01],
    [x - 0.01, topY(x) + 0.04],
    [x + 0.03, topY(x) + 0.035],
    [x + 0.04, topY(x + 0.04) - 0.01],
  ])
}

export function analFin() {
  const xs = [0.1, 0.14, 0.22, 0.25]
  return fin([
    [xs[0], bottomY(xs[0]) + 0.02],
    [xs[1], bottomY(xs[1]) - 0.08],
    [xs[2], bottomY(xs[2]) - 0.06],
    [xs[3], bottomY(xs[3]) + 0.02],
  ])
}

export function tailFin() {
  const x = BODY_X1 - 0.06
  return fin(
    [
      [x, 0.055],
      [x + 0.1, 0.09],
      [x + 0.26, 0.24],
      [x + 0.17, 0.02],
      [x + 0.26, -0.24],
      [x + 0.1, -0.09],
      [x, -0.055],
    ],
    0.016,
  )
}

/** Pectoral fin — built at the origin, positioned by the caller. */
export function pectoralFin() {
  return fin(
    [
      [0, 0],
      [0.12, -0.02],
      [0.2, -0.09],
      [0.15, -0.1],
      [0.04, -0.05],
    ],
    0.008,
  )
}

/** Pelvic fin — small, on the underside. */
export function pelvicFin() {
  return fin(
    [
      [0, 0],
      [0.08, -0.03],
      [0.12, -0.07],
      [0.07, -0.06],
      [0.02, -0.03],
    ],
    0.006,
  )
}

/** Cheek medallion — a flattened disc. */
export function cheekDisc() {
  const g = new THREE.CylinderGeometry(0.062, 0.058, 0.016, 40)
  g.rotateX(Math.PI / 2)
  return g
}

/** The spine, lying along x with a row of vertebrae. */
export function spine(x0: number, x1: number) {
  const parts: THREE.BufferGeometry[] = []
  const len = x1 - x0
  const core = new THREE.CylinderGeometry(0.02, 0.02, len, 16)
  core.rotateZ(Math.PI / 2)
  core.translate(x0 + len / 2, 0, 0)
  parts.push(core)
  for (let x = x0 + 0.04; x < x1 - 0.02; x += 0.055) {
    const v = new THREE.CylinderGeometry(0.03, 0.03, 0.026, 16)
    v.rotateZ(Math.PI / 2)
    v.translate(x, 0, 0)
    parts.push(v)
  }
  return mergeGeometries(parts, false)!
}
