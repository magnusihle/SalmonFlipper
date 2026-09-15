# Salmon Flipper

An interactive 3D salmon-cut planner. The procedural fish can be explored cut by cut, while the plan board turns weekly demand, yields, supply, prices, processing capacity, and residual products into a complete mass-balance and margin view.

- Hover or click a cut to lift it and open its product dossier.
- Toggle exploded view to separate the pieces and reveal the spine.
- Open the plan board to edit orders, supply, and prices by week.
- Drag to orbit, or choose **Do a trick** (keyboard shortcut `T`) for the animated pool sequence.

## Run

```sh
npm install
npm run dev
npm test
npm run build
```

## Price data

Weekly reference prices come from two free sources and are merged into `prices.json`:

| Source | Products | Notes |
|---|---|---|
| Statistics Norway table 03024 | `HOG`, optionally `HOG_FROZEN` | Weekly JSON-stat series in NOK/kg |
| Norwegian Seafood Council weekly statistics | `FILLET_FRESH`, `FILLET_FROZEN`, `HEADLESS_FRESH`, `HEADLESS_FROZEN`, `HOG_NSC` | Weekly `.xlsx`, FOB Norwegian border, `TOTALT` row |

```sh
npm run fetch-prices -- --weeks 12
npm run test:scripts
```

Use `--ssb-only`, `--nsc-only`, or `--frozen` to narrow the fetch. The UI uses the typed pricing modules under `src/prices/`; the standalone source adapters and their offline fixtures are retained for the fetch tooling.

## Stack

- Vite, React 19, and TypeScript
- three.js with React Three Fiber and Drei
- React Spring for in-scene motion and Framer Motion for UI transitions
- Zustand for planner and interaction state

## Project map

```text
src/
  components/       planner panels and poster UI
  data/             cuts and product metadata
  planner/          graph, roll-up, mass balance, and finance logic
  prices/           typed price book, derivation rules, and SSB parser
  three/            procedural fish, animation, water, and ripples
scripts/            price-fetch CLI and source adapters
```
