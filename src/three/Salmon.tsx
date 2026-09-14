import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Bone, Cut, Fin, Flesh, Segment } from './Cut'
import { LAYOUT, CHEEK_POS, SPINE_Y, X } from './layout'
import {
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
} from './geometry'
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

  // idle sway — a fish at rest is never quite still
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    const amp = selected ? 0.4 : 1
    g.rotation.y = Math.sin(t * 0.45) * 0.06 * amp
    g.rotation.z = Math.sin(t * 0.7) * 0.012 * amp
    g.position.y = -0.04 + Math.sin(t * 1.1) * 0.014 * amp
  })

  const pecX = -0.5
  const pelX = -0.22

  return (
    <group ref={group}>
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
        <Fin geometry={geo.pectoral} position={[pecX, centerY(pecX) - 0.08, halfWidth(pecX) - 0.012]} rotation={[0.15, -0.55, -0.3]} />
        <Fin geometry={geo.pectoral} position={[pecX, centerY(pecX) - 0.08, -halfWidth(pecX) + 0.012]} rotation={[-0.15, 0.55, -0.3]} />
      </Cut>

      <Cut id="upperFillet">
        <Segment spec={LAYOUT.upperFillet.seg!} />
        <Fin geometry={geo.dorsal} />
      </Cut>

      <Cut id="belly">
        <Segment spec={LAYOUT.belly.seg!} />
        <Fin geometry={geo.pelvic} position={[pelX, bottomY(pelX) + 0.012, halfWidth(pelX) * 0.45]} rotation={[0.3, -0.5, -0.2]} />
        <Fin geometry={geo.pelvic} position={[pelX, bottomY(pelX) + 0.012, -halfWidth(pelX) * 0.45]} rotation={[-0.3, 0.5, -0.2]} />
      </Cut>

      <Cut id="loin">
        <Segment spec={LAYOUT.loin.seg!} />
      </Cut>

      <Cut id="toro">
        <Segment spec={LAYOUT.toro.seg!} />
        <Fin geometry={geo.anal} />
      </Cut>

      <Cut id="fillet">
        <Segment spec={LAYOUT.fillet.seg!} />
        <Fin geometry={geo.adipose} />
      </Cut>

      <Cut id="steak">
        <Segment spec={LAYOUT.steak.seg!} />
        <Bone geometry={geo.steakBone} position={[(X.steak0 + X.steak1) / 2, SPINE_Y, 0]} />
      </Cut>

      <Cut id="tail">
        <Segment spec={LAYOUT.tail.seg!} />
        <Fin geometry={geo.tail} />
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
    c.target.x = THREE.MathUtils.damp(c.target.x, target[0] * 0.45, 3, dt)
    c.target.y = THREE.MathUtils.damp(c.target.y, target[1] * 0.45, 3, dt)
    c.update()
  })
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={1.8}
      maxDistance={5}
      minPolarAngle={0.55}
      maxPolarAngle={2.0}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
    />
  )
}

export function Scene() {
  return (
    <>
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
      <ContactShadows position={[0, -0.6, 0]} opacity={0.4} scale={4.5} blur={2.6} far={1.4} color="#4d3b25" />
      <CameraRig />
    </>
  )
}
