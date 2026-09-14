import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { AnimatePresence, motion } from 'framer-motion'
import { CUTS, type CutId } from '../data/cuts'
import { LAYOUT } from './layout'
import { useStore } from '../store'
import { makeFleshTexture, makeSkinTexture } from './textures'
import { buildSegment, type SegmentSpec } from './geometry'

let textures: { flesh: THREE.Texture; skin: THREE.Texture } | null = null
function sharedTextures() {
  if (!textures) textures = { flesh: makeFleshTexture(), skin: makeSkinTexture() }
  return textures
}

export interface CutMaterials {
  skin: THREE.MeshStandardMaterial
  flesh: THREE.MeshStandardMaterial
  fin: THREE.MeshStandardMaterial
  bone: THREE.MeshStandardMaterial
}

const MaterialsCtx = createContext<CutMaterials | null>(null)
export const useCutMaterials = () => {
  const m = useContext(MaterialsCtx)
  if (!m) throw new Error('useCutMaterials must be used inside <Cut>')
  return m
}

function makeMaterials(): CutMaterials {
  const t = sharedTextures()
  const mk = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ emissiveIntensity: 0, ...p })
    m.userData.base = m.color.clone()
    return m
  }
  return {
    skin: mk({ map: t.skin, roughness: 0.42, metalness: 0.12, envMapIntensity: 1.4, emissive: '#7fb0e0', side: THREE.DoubleSide }),
    flesh: mk({ map: t.flesh, roughness: 0.62, metalness: 0, envMapIntensity: 0.8, emissive: '#ff6a2a', side: THREE.DoubleSide }),
    fin: mk({ color: '#56636f', roughness: 0.5, metalness: 0.25, emissive: '#7fb0e0', transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    bone: mk({ color: '#efe6d2', roughness: 0.65, metalness: 0, emissive: '#ffd9a0' }),
  }
}

/**
 * One clickable, hoverable piece of the fish. Owns its materials (so it can glow and dim on its own),
 * animates around its pivot, and shows a floating label.
 */
export function Cut({ id, children }: { id: CutId; children: ReactNode }) {
  const layout = LAYOUT[id]
  const info = CUTS[id]

  const hovered = useStore((s) => s.hovered)
  const selected = useStore((s) => s.selected)
  const exploded = useStore((s) => s.exploded)
  const setHovered = useStore((s) => s.setHovered)
  const select = useStore((s) => s.select)

  const isHovered = hovered === id
  const isSelected = selected === id
  const open = exploded || selected === 'spine'
  const dimmed = selected !== null && !isSelected

  // how far along its "out" direction the cut currently sits
  const factor = isSelected ? 1 : open ? (isHovered ? 0.85 : 0.72) : isHovered ? 0.16 : 0
  const rotOn = factor >= 0.72 ? 1 : 0

  const [cx, cy, cz] = layout.center
  const d = layout.distance * factor
  const rot = layout.explodeRotation ?? [0, 0, 0]

  const spring = useSpring({
    position: [cx + layout.outDir[0] * d, cy + layout.outDir[1] * d, cz + layout.outDir[2] * d],
    rotation: [rot[0] * rotOn, rot[1] * rotOn, rot[2] * rotOn],
    scale: isHovered && !isSelected && !open ? 1.035 : 1,
    config: { mass: 1, tension: 210, friction: 17 },
  })

  useCursor(isHovered)

  const mats = useMemo(makeMaterials, [])
  const tint = useRef(1)
  useFrame((_, dt) => {
    const glow = isSelected ? 0.4 : isHovered ? 0.25 : 0
    tint.current = THREE.MathUtils.damp(tint.current, dimmed ? 0.76 : 1, 7, dt)
    for (const m of Object.values(mats)) {
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, glow, 9, dt)
      m.color.copy(m.userData.base as THREE.Color).multiplyScalar(tint.current)
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(id)
  }
  const onOut = () => {
    if (useStore.getState().hovered === id) setHovered(null)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    select(id)
  }

  const isStatic = layout.outDir.every((v) => v === 0)
  const labelPos: [number, number, number] = isStatic
    ? [0, 0.16, 0]
    : [layout.outDir[0] * 0.16, layout.outDir[1] * 0.16 + 0.04, layout.outDir[2] * 0.16 + 0.12]

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <animated.group
      position={spring.position as unknown as [number, number, number]}
      rotation={spring.rotation as unknown as [number, number, number]}
      scale={spring.scale}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={onClick}
    >
      <group position={[-cx, -cy, -cz]}>
        <MaterialsCtx.Provider value={mats}>{children}</MaterialsCtx.Provider>
      </group>
      <Html position={labelPos} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <AnimatePresence>
          {(isHovered || isSelected) && (
            <motion.div
              className={`tag ${isSelected ? 'selected' : ''}`}
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            >
              <span>{info.name}</span>
              {info.sub && <em>{info.sub}</em>}
            </motion.div>
          )}
        </AnimatePresence>
      </Html>
    </animated.group>
  )
}

/** Body segment: skin outside, flesh on every cut face. */
export function Segment({ spec }: { spec: SegmentSpec }) {
  const { skin, flesh } = useCutMaterials()
  const geo = useMemo(() => buildSegment(spec), [spec])
  return (
    <>
      <mesh geometry={geo.skin} material={skin} />
      <mesh geometry={geo.flesh} material={flesh} />
    </>
  )
}

export function Fin({ geometry, ...props }: { geometry: THREE.BufferGeometry } & ThreeElements['mesh']) {
  const { fin } = useCutMaterials()
  return <mesh geometry={geometry} material={fin} {...props} />
}

export function Bone({ geometry, ...props }: { geometry: THREE.BufferGeometry } & ThreeElements['mesh']) {
  const { bone } = useCutMaterials()
  return <mesh geometry={geometry} material={bone} {...props} />
}

export function Flesh({ geometry, ...props }: { geometry: THREE.BufferGeometry } & ThreeElements['mesh']) {
  const { flesh } = useCutMaterials()
  return <mesh geometry={geometry} material={flesh} {...props} />
}
