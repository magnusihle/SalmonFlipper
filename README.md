# mesh_claude_5.1

## Prices

Weekly reference prices come from Statistics Norway table 03024 (export price of farmed salmon, NOK/kg).

```bash
npm run fetch-prices -- --weeks 12   # writes prices.json (add --frozen for the frozen series too)
npm test                             # offline tests against test/fixtures
```

`src/prices.mjs` exposes `priceFor(prices, product, week)`: exact week, else the latest week on or before it, else the latest available.
