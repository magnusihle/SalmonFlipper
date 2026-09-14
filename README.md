# Fishbone

Interactive planner for salmon disassembly: match whole-fish supply to part-level demand across an eight-week horizon.

## What it does

- **Supply** — fish landed per week, average weight, purchase cost, and how many to process.
- **Cut mix** — split each week's fish between *sell whole*, *fillet cut* and *portion cut*. Yields per plan live in `lib/data.ts`.
- **Demand** — orders per customer, part, kg and price. Highest price fills first.
- **Matching** — surplus of freezable parts carries into the next week at a haircut; the rest is waste. See `lib/engine.ts`.
- **Auto-plan** — grid-searches fish count and cut mix per week to maximise margin.

All data is dummy for now (`lib/data.ts`). State persists in `localStorage`.

## Run

```bash
npm install
npm run dev
```

Built with Next.js, Tailwind and framer-motion. Deploys to Vercel with no configuration.
