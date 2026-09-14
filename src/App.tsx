import { Canvas } from '@react-three/fiber'
import { Scene } from './three/Salmon'
import { Header } from './components/Header'
import { Legend } from './components/Legend'
import { InfoPanel } from './components/InfoPanel'
import { Toolbar } from './components/Toolbar'
import { Board } from './components/Board'
import { useStore } from './store'

export default function App() {
  const clear = useStore((s) => s.clear)
  return (
    <div className="app">
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
      <Header />
      <Toolbar />
      <InfoPanel />
      <Board />
      <Legend />
    </div>
  )
}
