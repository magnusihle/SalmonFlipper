import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import { Ripples } from './ripples'
import { makeFoamMaterial } from './foam'
import { BODY_X0, BODY_X1, bottomY, halfWidth } from './geometry'
import { WATER_Y, drainEvents, motion, trickActive } from './motion'
import { useStore } from '../store'
import { SCENE_PALETTE } from '../theme'

/** grid resolution of the ripple simulation (cells per side) */
const N = 128
/** world size of the pool, square */
const SIZE = 6.5
/** how much the ripple slopes are exaggerated in the normal map */
const NORMAL_STRENGTH = 2.6
/** max droplets in flight */
const MAX_DROPS = 320
const GRAVITY = 5

/** Radial alpha so the pool fades into the paper instead of ending at a hard square edge. */
function makePoolAlpha() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.save()
  ctx.translate(128, 128)
  ctx.scale(1, 0.72) // the fish is long, so the pool is an ellipse
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.7)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.3)')
  g.addColorStop(0.9, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(-128, -180, 256, 360)
  ctx.restore()
  const t = new THREE.CanvasTexture(c)
  return t
}

interface Drops {
  mesh: THREE.InstancedMesh
  pos: Float32Array
  vel: Float32Array
  size: Float32Array
  alive: Uint8Array
  count: number
}

function makeDrops(): Drops {
  const geo = new THREE.SphereGeometry(1, 8, 6)
  const mat = new THREE.MeshStandardMaterial({
    color: '#dbeaf1',
    roughness: 0.08,
    metalness: 0.1,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 0.85,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_DROPS)
  mesh.frustumCulled = false
  mesh.count = MAX_DROPS
  const m = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < MAX_DROPS; i++) mesh.setMatrixAt(i, m)
  mesh.instanceMatrix.needsUpdate = true
  return {
    mesh,
    pos: new Float32Array(MAX_DROPS * 3),
    vel: new Float32Array(MAX_DROPS * 3),
    size: new Float32Array(MAX_DROPS),
    alive: new Uint8Array(MAX_DROPS),
    count: 0,
  }
}

function spawnDrop(d: Drops, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number) {
  // find a free slot, oldest-first if we're full
  let i = d.alive.indexOf(0)
  if (i < 0) i = d.count % MAX_DROPS
  d.count++
  d.alive[i] = 1
  d.pos[i * 3] = x
  d.pos[i * 3 + 1] = y
  d.pos[i * 3 + 2] = z
  d.vel[i * 3] = vx
  d.vel[i * 3 + 1] = vy
  d.vel[i * 3 + 2] = vz
  d.size[i] = size
}

/**
 * The reflector renders the scene into its own target once per frame, clearing with the
 * renderer's clear colour. The page canvas is transparent (the paper is CSS), so this sets an
 * opaque paper clear just before that pass; `Water` puts the transparent clear back afterwards.
 * It works because frame callbacks run in mount order: this, then the reflector, then Water.
 */
function ReflectionBackdrop() {
  const gl = useThree((s) => s.gl)
  // what the water reflects where there is no fish — a pale sky by day, a dusk sky in dark mode
  const sky = SCENE_PALETTE[useStore((s) => s.resolvedTheme)].sky
  useFrame(() => gl.setClearColor(sky, 1))
  return null
}

/**
 * The pool under the fish: a heightfield ripple simulation drives both the mesh and a
 * normal map that bends the reflection, plus droplets that fly up from every splash and
 * make their own rings when they land.
 */
export function Water() {
  const gl = useThree((s) => s.gl)
  const sim = useMemo(() => new Ripples(N, SIZE, { damping: 0.987, sponge: 12 }), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1), [])
  const normalData = useMemo(() => new Uint8Array(N * N * 4), [])
  const normalTex = useMemo(() => {
    const t = new THREE.DataTexture(normalData, N, N, THREE.RGBAFormat)
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }, [normalData])
  const alphaTex = useMemo(makePoolAlpha, [])
  const drops = useMemo(makeDrops, [])
  const palette = SCENE_PALETTE[useStore((s) => s.resolvedTheme)]
  const foam = useMemo(() => makeFoamMaterial(normalTex, alphaTex), [normalTex, alphaTex])
  useEffect(() => {
    ;(foam.uniforms.uColor.value as THREE.Color).set(palette.foam)
  }, [foam, palette])
  const rnd = useMemo(() => {
    let s = 91
    return () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      normalTex.dispose()
      alphaTex.dispose()
      foam.dispose()
      drops.mesh.geometry.dispose()
      ;(drops.mesh.material as THREE.Material).dispose()
    },
    [geometry, normalTex, alphaTex, foam, drops],
  )

  const nextDrip = useRef(1.2)
  const nextBreeze = useRef(0.5)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), [])

  const splash = (x: number, z: number, radius: number, strength: number, count: number) => {
    sim.drop(x, z, radius, strength)
    const lift = 0.6 + strength * 14
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2
      const r = rnd() * radius * 0.8
      const speed = 0.25 + rnd() * 0.9
      spawnDrop(
        drops,
        x + Math.cos(a) * r,
        WATER_Y + 0.01,
        z + Math.sin(a) * r,
        Math.cos(a) * speed * 0.7,
        (1.1 + rnd() * 1.6) * lift,
        Math.sin(a) * speed * 0.7,
        0.006 + rnd() * 0.011,
      )
    }
  }

  useFrame((_, rawDt) => {
    // the reflection pass has run by now — back to a transparent canvas for the real frame
    gl.setClearColor('#000000', 0)

    const dt = Math.min(rawDt, 1 / 20)
    const t = motion.t

    // splashes the fish asked for this frame
    for (const e of drainEvents()) splash(e.x, e.z, e.radius, e.strength, e.drops)

    // water dripping off the fish — steady while it hovers, a shower while it's in the air
    if (t >= nextDrip.current) {
      const x = BODY_X0 + 0.1 + rnd() * (BODY_X1 - BODY_X0 - 0.2)
      const z = (rnd() * 2 - 1) * halfWidth(x) * 0.5
      const y = bottomY(x) + motion.pose.y
      if (y > WATER_Y + 0.02) spawnDrop(drops, x, y, z, 0, -0.1, 0, 0.005 + rnd() * 0.005)
      nextDrip.current = t + (trickActive() ? 0.03 + rnd() * 0.05 : 0.5 + rnd() * 1.1)
    }
    // a breath of air on the surface
    if (t >= nextBreeze.current) {
      sim.drop((rnd() - 0.5) * SIZE * 0.7, (rnd() - 0.5) * SIZE * 0.5, 0.12 + rnd() * 0.2, 0.0025 + rnd() * 0.003)
      nextBreeze.current = t + 0.25 + rnd() * 0.5
    }

    // droplets
    let any = false
    for (let i = 0; i < MAX_DROPS; i++) {
      if (!drops.alive[i]) continue
      any = true
      const o = i * 3
      drops.vel[o + 1] -= GRAVITY * dt
      drops.pos[o] += drops.vel[o] * dt
      drops.pos[o + 1] += drops.vel[o + 1] * dt
      drops.pos[o + 2] += drops.vel[o + 2] * dt
      const y = drops.pos[o + 1]
      if (y <= WATER_Y && drops.vel[o + 1] < 0) {
        drops.alive[i] = 0
        const s = drops.size[i]
        sim.drop(drops.pos[o], drops.pos[o + 2], 0.05 + s * 4, 0.006 + s * 0.8)
        tmp.m.makeScale(0, 0, 0)
      } else {
        const s = drops.size[i]
        // stretch a falling drop along its velocity
        const vy = drops.vel[o + 1]
        tmp.p.set(drops.pos[o], y, drops.pos[o + 2])
        tmp.s.set(s, s * (1 + Math.min(1.2, Math.abs(vy) * 0.25)), s)
        tmp.m.compose(tmp.p, tmp.q, tmp.s)
      }
      drops.mesh.setMatrixAt(i, tmp.m)
    }
    if (any || drops.count > 0) drops.mesh.instanceMatrix.needsUpdate = true

    // advance the surface and push it into the mesh + normal map
    sim.step(dt)
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const h = sim.height
    for (let i = 0; i < N * N; i++) arr[i * 3 + 2] = h[i]
    pos.needsUpdate = true
    sim.writeNormalMap(normalData, NORMAL_STRENGTH)
    normalTex.needsUpdate = true
    foam.uniforms.uTime.value = t
  })

  return (
    <group position={[0, WATER_Y, 0]}>
      <ReflectionBackdrop />
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <MeshReflectorMaterial
          resolution={512}
          blur={[200, 80]}
          mixBlur={0.5}
          mixStrength={0.95}
          mirror={0.7}
          color={palette.water}
          roughness={0.18}
          metalness={0.05}
          envMapIntensity={1.2}
          normalMap={normalTex}
          alphaMap={alphaTex}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh geometry={geometry} material={foam} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} />
      <primitive object={drops.mesh} position={[0, -WATER_Y, 0]} />
    </group>
  )
}
