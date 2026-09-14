# mesh_claude_5.1

## Prices

Weekly reference prices come from two free sources, merged into `prices.json`:

| Source | Products in `prices.json` | Notes |
|---|---|---|
| Statistics Norway table 03024 | `HOG` (fresh whole), `HOG_FROZEN` with `--frozen` | JSON-stat API, weekly, NOK/kg |
| Norwegian Seafood Council open weekly statistics | `FILLET_FRESH`, `FILLET_FROZEN`, `HEADLESS_FRESH`, `HEADLESS_FROZEN`, `HOG_NSC` (cross-check) | One `.xlsx` per week, FOB Norwegian border, TOTALT row |

```bash
npm run fetch-prices -- --weeks 12   # both sources; --ssb-only / --nsc-only to pick one
npm test                             # offline tests against test/fixtures
```

`src/prices.mjs` exposes `priceFor(prices, product, week)`: exact week, else the latest week on or before it, else the latest available.
`src/xlsx.mjs` is a dependency-free .xlsx reader (zip + SpreadsheetML) used by `src/nsc.mjs`.
