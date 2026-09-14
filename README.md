# Fishbone — Salmon Deboning Planner

Interactive planner for salmon disassembly: match whole-fish supply to product-level demand across an eight-week horizon. Guiding document: [`Source_Brief.md`](Source_Brief.md); placeholder yields, prices and cost centres: [`fisk_plan_seed.json`](fisk_plan_seed.json).

## What it does

- **Supply** — fish landed per week, average weight, raw price (NOK/kg round), and how many to process.
- **Cut mix** — split each week's fish between three patterns from the brief's graph: *sell as HOG*, *Trim C fillet*, *Trim E → portions*. Cumulative yields per pattern are in `lib/data.ts`.
- **Demand** — orders per customer, product, kg and NOK/kg. Highest price fills first.
- **Matching** — surplus of freezable products carries into the next week at a haircut; the rest is residual/waste. See `lib/engine.ts`.
- **Auto-plan** — grid-searches fish count and cut mix per week to maximise margin.

All data is dummy for now. State persists in `localStorage`.

## Alignment with the brief

| Brief (`Source_Brief.md`) | This app | Status |
|---|---|---|
| Products HOG, TRIM_C, PORTION_E, HEAD, FRAME, BELLY_FLAP, SKIN, MINCE | `hog`, `fillet`, `portion`, `head`, `frame`, `belly`, `skin`, `trim` | Mapped; yields and NOK prices from the seed |
| Patterns as paths through the graph (§2) | Three fixed patterns with pre-multiplied cumulative yields | Partial — TRIM_D and the if/or graph walk (§4 step 1) not yet modelled |
| Cost centres charged per kg in (§8.1) | Folded into one processing cost per kg round per pattern | Partial — no capacity flags yet |
| Raw price per week, NOK (§8.1) | `supply.costPerKg` per week | Done |
| Order → raw back-calculation and CANNOT BE MET flags (§4) | Forward simulation: fish in → products → orders filled by price | Different direction; shortfall shown per product instead |
| Residual valued at NRV (§5) | Unsold freezable products carried at −20%; rest counted as waste | Partial — no NRV table |
| Stock/carry-over deliberately left out (§9) | Frozen carry-over is modelled | Extra — can be switched off |

Next step: load `fisk_plan_seed.json` directly, replace the fixed patterns with the edge graph and cumulative-yield walk, then add the §8 pattern-economics table and cost-centre loads.

## Run

```bash
npm install
npm run dev
```

Built with Next.js, Tailwind and framer-motion. Deploys to Vercel with no configuration.
