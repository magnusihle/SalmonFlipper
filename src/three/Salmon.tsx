import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Bone, Cut, Fin, Flesh, Segment } from './Cut'
import { LAYOUT, CHEEK_POS, SPINE_Y, X, type V3 } from './layout'
import {
  BODY_X1,
  adiposeFin,
  analFin,
  bottomY,
  centerY,
  cheekDisc,
  dorsalFin,
  halfWidth,
  pectoralFin,
  pelvicFin,
  spine,
  tailFin,
  topY,
} from './geometry'
import { REST_Y, TRICKS, finSway, motion, startTrick, stepMotion, trickActive } from './motion'
import { Water } from './Water'
import { useStore } from '../store'

function Eye({ side }: { side: 1 | -1 }) {
  const x = -0.85
  const y = centerY(x) + 0.03
  const z = side * (halfWidth(x) - 0.006)
  return (
    <group position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[0.03, 24, 24]} />
        <meshStandardMaterial color="#e6dfcf" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, side * 0.014]}>
        <sphereGeometry args={[0.02, 24, 24]} />
        <meshStandardMaterial color="#0f1114" roughness={0.15} metalness={0.3} />
      </mesh>
    </group>
  )
}

/** Rocks its children about `pivot` in time with the body wave. `amp` is per-axis radians. */
function Sway({ pivot, amp, rate = 1, offset = 0, children }: { pivot: V3; amp: V3; rate?: number; offset?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const s = finSway(rate, offset)
    g.rotation.set(amp[0] * s, amp[1] * s, amp[2] * s)
  })
  return (
    <group position={pivot}>
      <group ref={ref}>
        <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{children}</group>
      </group>
    </group>
  )
}

/**
 * Advances the shared motion state once per frame and turns toolbar trick requests into
 * a trick. Rendered first in the scene so everything else reads fresh numbers.
 */
function MotionDriver() {
  const request = useStore((s) => s.trickRequest)
  const setTricking = useStore((s) => s.setTricking)
  const next = useRef(0)

  useEffect(() => {
    if (request === 0) return
    startTrick(TRICKS[next.current % TRICKS.length])
    next.current++
  }, [request])

  useFrame((_, dt) => {
    const { exploded, selected } = useStore.getState()
    const wasActive = trickActive()
    stepMotion(Math.min(dt, 1 / 20), exploded || selected ? 0.25 : 1)
    if (wasActive && !trickActive()) setTricking(false)
  })
  return null
}

export function Salmon() {
  const group = useRef<THREE.Group>(null)
  const selected = useStore((s) => s.selected)

  const geo = useMemo(
    () => ({
      dorsal: dorsalFin(),
      adipose: adiposeFin(),
      anal: analFin(),
      tail: tailFin(),
      pectoral: pectoralFin(),
      pelvic: pelvicFin(),
      cheek: cheekDisc(),
      spine: spine(X.head + 0.03, X.steak1 - 0.02),
      steakBone: (() => {
        const g = new THREE.CylinderGeometry(0.031, 0.031, X.steak1 - X.steak0 - 0.012, 16)
        g.rotateZ(Math.PI / 2)
        return g
      })(),
    }),
    [],
  )

  // idle drift on top of whatever the trick timeline says — a fish at rest is never quite still
  const lift = useRef(0)
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const t = motion.t
    const amp = (selected ? 0.4 : 1) * (trickActive() ? 0.3 : 1)
    const p = motion.pose
    // the exploded belly pieces would otherwise sit in the water
    lift.current = THREE.MathUtils.damp(lift.current, useStore.getState().exploded ? 0.2 : 0, 4, dt)
    g.rotation.x = p.rx + Math.sin(t * 0.5) * 0.02 * amp
    g.rotation.y = p.ry + Math.sin(t * 0.45) * 0.06 * amp
    g.rotation.z = p.rz + Math.sin(t * 0.7) * 0.012 * amp
    g.position.y = p.y + lift.current + Math.sin(t * 1.1) * 0.014 * amp + Math.sin(t * 0.23) * 0.01 * amp
  })

  const pecX = -0.5
  const pelX = -0.22
  const pecPos = (side: 1 | -1): V3 => [pecX, centerY(pecX) - 0.08, side * (halfWidth(pecX) - 0.012)]
  const pelPos = (side: 1 | -1): V3 => [pelX, bottomY(pelX) + 0.012, side * halfWidth(pelX) * 0.45]

  return (
    <group ref={group} position={[0, REST_Y, 0]}>
      <Cut id="head">
        <Segment spec={LAYOUT.head.seg!} />
        <Eye side={1} />
        <Eye side={-1} />
      </Cut>

      <Cut id="cheek">
        <Flesh geometry={geo.cheek} position={[CHEEK_POS[0], CHEEK_POS[1], halfWidth(CHEEK_POS[0]) - 0.004]} />
      </Cut>

      <Cut id="collar">
        <Segment spec={LAYOUT.collar.seg!} />
        <Sway pivot={pecPos(1)} amp={[0.06, 0.16, 0.05]} rate={0.5} offset={0}>
          <Fin geometry={geo.pectoral} position={pecPos(1)} rotation={[0.15, -0.55, -0.3]} />
        </Sway>
        <Sway pivot={pecPos(-1)} amp={[-0.06, -0.16, 0.05]} rate={0.5} offset={0.9}>
          <Fin geometry={geo.pectoral} position={pecPos(-1)} rotation={[-0.15, 0.55, -0.3]} />
        </Sway>
      </Cut>

      <Cut id="upperFillet">
        <Segment spec={LAYOUT.upperFillet.seg!} />
        <Sway pivot={[-0.2, topY(-0.2), 0]} amp={[0.1, 0, 0]} offset={0.4}>
          <Fin geometry={geo.dorsal} />
        </Sway>
      </Cut>

      <Cut id="belly">
        <Segment spec={LAYOUT.belly.seg!} />
        <Sway pivot={pelPos(1)} amp={[0.05, 0.14, 0.04]} rate={0.5} offset={1.6}>
          <Fin geometry={geo.pelvic} position={pelPos(1)} rotation={[0.3, -0.5, -0.2]} />
        </Sway>
        <Sway pivot={pelPos(-1)} amp={[-0.05, -0.14, 0.04]} rate={0.5} offset={2.5}>
          <Fin geometry={geo.pelvic} position={pelPos(-1)} rotation={[-0.3, 0.5, -0.2]} />
        </Sway>
      </Cut>

      <Cut id="loin">
        <Segment spec={LAYOUT.loin.seg!} />
      </Cut>

      <Cut id="toro">
        <Segment spec={LAYOUT.toro.seg!} />
        <Sway pivot={[0.17, bottomY(0.17), 0]} amp={[0.14, 0, 0]} offset={0.8}>
          <Fin geometry={geo.anal} />
        </Sway>
      </Cut>

      <Cut id="fillet">
        <Segment spec={LAYOUT.fillet.seg!} />
        <Sway pivot={[0.4, topY(0.4), 0]} amp={[0.18, 0, 0]} offset={1.1}>
          <Fin geometry={geo.adipose} />
        </Sway>
      </Cut>

      <Cut id="steak">
        <Segment spec={LAYOUT.steak.seg!} />
        <Bone geometry={geo.steakBone} position={[(X.steak0 + X.steak1) / 2, SPINE_Y, 0]} />
      </Cut>

      <Cut id="tail">
        <Segment spec={LAYOUT.tail.seg!} />
        <Sway pivot={[BODY_X1 - 0.06, 0, 0]} amp={[0, 0.24, 0.03]} offset={-1}>
          <Fin geometry={geo.tail} />
        </Sway>
      </Cut>

      <Cut id="spine">
        <Bone geometry={geo.spine} position={[0, SPINE_Y, 0]} />
      </Cut>
    </group>
  )
}

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const selected = useStore((s) => s.selected)
  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const target = selected ? LAYOUT[selected].center : [0, 0, 0]
    // frame the fish and its reflection; follow the fish part of the way up when it leaps
    const lift = (motion.pose.y - REST_Y) * 0.55 - 0.14
    c.target.x = THREE.MathUtils.damp(c.target.x, target[0] * 0.45, 3, dt)
    c.target.y = THREE.MathUtils.damp(c.target.y, target[1] * 0.45 + lift, 3, dt)
    c.update()
  })
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={1.8}
      maxDistance={5}
      minPolarAngle={0.55}
      maxPolarAngle={1.75}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
    />
  )
}

export function Scene() {
  return (
    <>
      <MotionDriver />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#fff6ea" />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#dbe7f7" />
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} color="#fff4e6" />
        <Lightformer intensity={1.2} position={[-5, 1, 3]} scale={[2, 5, 1]} color="#ffe9d0" />
        <Lightformer intensity={1.2} position={[5, 1, -3]} scale={[2, 5, 1]} color="#dce8fa" />
        <Lightformer intensity={0.6} position={[0, -4, 2]} rotation-x={-Math.PI / 2} scale={[8, 2, 1]} color="#e9dcc4" />
      </Environment>
      <Salmon />
      <Water />
      <CameraRig />
    </>
  )
}
