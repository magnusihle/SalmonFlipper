# mesh_claude_5.1

## Prices

Weekly reference prices come from Statistics Norway table 03024 (export price of farmed salmon, NOK/kg).

```bash
npm run fetch-prices -- --weeks 12   # writes prices.json (add --frozen for the frozen series too)
npm test                             # offline tests against test/fixtures
```

`src/prices.mjs` exposes `priceFor(prices, product, week)`: exact week, else the latest week on or before it, else the latest available.

## Derived prices (issue #7)

`price_rules.json` holds one `PriceRule` per product in the graph:

| rule | how the NOK/kg is made |
|---|---|
| `reference` | a series in `prices.json` (HOG ← SSB 03024; ROUND uses the HOG price for unallocated raw) |
| `derived` | `(price(parent) + costPerKgIn − Σ yield × price(by-product)) / cutYield`, using the by-product edges on the same (parent, option) and the cost centre on that split from the seed. `costPerKg` on the rule overrides the cost centre. |
| `manual` | hand-entered NOK/kg with a note. HEAD, FRAME, BELLY_FLAP, SKIN, MINCE, VISCERA are placeholders from the brief's `residualPrices` — replace with the plant's buyer prices. |

`src/pricing.mjs` → `createPricer({ rules, edges, costCenters, prices })`:

- `valuePerKg(product, week)` resolves the rule chain and returns `{ nokPerKg, rule, source, formula, priceWeek, ... }` — show `formula` in the UI.
- `valueResidual(rows, week)` adds `nokPerKg` and `valueNok` to each `{ product, kg }` row and returns `totalNok`.
- `valueUnallocatedRaw(kg, week)` prices spare raw at the HOG reference.
- `panel(week)` is the data for the prices panel (issue #4); `editable` is true for manual rows.
- `withManualPrice(product, nokPerKg)` returns a new pricer with one manual price changed.

```bash
npm run prices -- --week 2026-W38                                   # panel only
npm run prices -- --week 2026-W38 --residual test/fixtures/residual-w38.json --set FRAME=10
```
