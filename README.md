# The Ultimate Salmon Cuts

An interactive 3D take on the classic "salmon cuts" butcher poster. The fish is built procedurally,
every cut is its own piece, and each one can be hovered and clicked.

- **Hover** a cut (or its name in the legend) → it lifts, glows and shows a label.
- **Click** a cut → it pops out of the fish, the camera eases toward it and a card describes it.
- **Exploded view** toggle → every piece separates so you can see the spine.
- **Drag** to orbit — the far side of the fish still has its skin on.
- **Do a trick** (or press `T`) → the fish crouches into the pool, leaps, spins (somersault, barrel roll,
  twist — it cycles) and splashes down.
- The pool is a small shallow-water simulation (`src/three/ripples.ts`): drips, splashes and droplets all
  make real rings, and the reflection bends with them.

## Stack

- [Vite](https://vitejs.dev) + React 19 + TypeScript
- [three.js](https://threejs.org) via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) and [@react-three/drei](https://github.com/pmndrs/drei)
- [@react-spring/three](https://www.react-spring.dev) for the in-scene springs
- [framer-motion](https://www.framer.com/motion) for the 2D UI (header, legend, labels, info card)
- [zustand](https://github.com/pmndrs/zustand) for the tiny hover/select/explode store

## Run

```sh
npm install
npm run dev
```

## Layout

```
src/
  data/cuts.ts        names, blurbs, richness, cooking notes
  store.ts            hovered / selected / exploded
  three/
    geometry.ts       body profile, segment builder, fins, spine
    textures.ts       procedural flesh + skin canvases (scales, spots, bump map)
    layout.ts         where each cut sits and which way it moves
    motion.ts         body wave, fin sway and the trick timeline
    ripples.ts        heightfield water simulation
    Water.tsx         reflective pool, droplets, drips
    Cut.tsx           one interactive piece: springs, glow, label
    Salmon.tsx        assembles the fish; lights, camera
  components/         Header, Legend, InfoPanel, Toolbar
```
