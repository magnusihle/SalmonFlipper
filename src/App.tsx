import { Canvas } from '@react-three/fiber'
import { AnimatePresence } from 'framer-motion'
import { Scene } from './three/Salmon'
import { Header } from './components/Header'
import { Legend } from './components/Legend'
import { InfoPanel } from './components/InfoPanel'
import { Toolbar } from './components/Toolbar'
import { Board } from './components/Board'
import { useStore } from './store'

export default function App() {
  const clear = useStore((s) => s.clear)
  const board = useStore((s) => s.board)
  return (
    <div className={`app${board ? ' board-on' : ''}`}>
      <div className="stage">
        <Canvas
          camera={{ position: [0.4, 1.1, 3.2], fov: 32 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 2]}
          onPointerMissed={clear}
        >
          <Scene />
        </Canvas>
      </div>
      {/* the poster text leaves when the board comes in */}
      <AnimatePresence>{!board && <Header key="header" />}</AnimatePresence>
      <Toolbar />
      <AnimatePresence>{!board && <InfoPanel key="info" />}</AnimatePresence>
      <Board />
      <AnimatePresence>{!board && <Legend key="legend" />}</AnimatePresence>
    </div>
  )
}
