# Salmon Deboning Planner — 2-hour build brief (v2, with financial layer)

Web app (JS/TS), 3 devs. A light-weight cousin of CARVM: one disassembly graph with if/or yields, sample orders that pull raw fish through it, week supply, flags, and a mass-balance residual. Nothing else.

## 1. What we are proving

That a product order at any level of the graph can be back-calculated to raw fish through the *chosen* cutting pattern, that alternative patterns (if/or yields) split the raw material while co-products share it, and that everything not ordered lands in a valued residual rather than an "over/under".

## 2. The graph (placeholder Atlantic salmon yields — replace with a cut test)

```
ROUND (whole fish, 100%)
 ├─ HOG 88%  ─────────────── head-on gutted (sellable as-is)
 │   ├─ HEADLESS 89%
 │   │   ├─ FILLET_A 80%  ── Trim A: skin-on, bone-in, belly on
 │   │   │   ├─[option C] TRIM_C 88% · BELLY_FLAP 7% · MINCE 5%
 │   │   │   ├─[option D] TRIM_D 84% · BELLY_FLAP 9% · MINCE 7%
 │   │   │   └─[option E] TRIM_E 77% · BELLY_FLAP 9% · SKIN 7% · MINCE 7%
 │   │   │                   └─[option PORTION] PORTION_E 90% · MINCE 10%
 │   │   ├─ FRAME 18%
 │   │   └─ LOSS 2%
 │   └─ HEAD 11%
 ├─ VISCERA 11%
 └─ LOSS 1%
```

Four levels, two if/or points. Read the FILLET_A split as: *if* the order is Trim C the fillet yields 88% product and 7% belly; *or* if it is Trim E it yields 77% product, 9% belly and 7% skin. Same product code (BELLY_FLAP) at a different yield depending on the path — that is the if/or yield.

Cumulative yield of ROUND: HOG 0.880 · HEADLESS 0.783 · FILLET_A 0.627 · TRIM_C 0.551 · TRIM_D 0.526 · TRIM_E 0.482 · PORTION_E 0.434.

## 3. Data model (mirrors CARVM tblCutPattern, nothing more)

```ts
type Edge = {
  parent: string;          // product code
  child: string;           // product code
  option: string;          // "-" = the only pattern; otherwise a pattern id within this parent
  yieldOfParent: number;   // fraction of parent kg
  kind: 'CUT' | 'BYPRODUCT' | 'LOSS';
};
type Product = { code: string; name: string };
type Order   = { orderNo: string; week: string; product: string; kg: number };
type Supply  = { week: string; rawKg: number };
```

Rules the model enforces:
- For every (parent, option) the yields sum to 1.000 (LOSS rows exist so this is always true).
- Every product is sellable at the node where it appears; child edges are *further processing*, chosen only when an order asks for a product below.
- Only `kind = CUT` edges continue the path; BYPRODUCT and LOSS edges terminate.
- A CUT product has exactly one path to ROUND once the options along it are fixed. (Keep it that way in the seed; multi-path is a later problem.)

## 4. The algorithm

**Step 1 — cumulative yield.** For each CUT product, walk parent edges to ROUND and multiply `yieldOfParent`. Record the path (the list of `(parent, option)` choices) — this is the product's *pattern*.

**Step 2 — raw required per order line.** `rawKg = order.kg / cumYield(product)`.

**Step 3 — roll up per week.**
- Lines on CUT products are *alternatives* with respect to raw material: a fish cut to Trim C cannot also be Trim E, and a fish sold as HOG never reaches the fillet table. **Sum** their rawKg. (Two lines on the same product also sum — they are simply more fish.)
- BYPRODUCT demand (HEAD, BELLY_FLAP, FRAME, SKIN, MINCE, VISCERA) is *covered first* by the by-product output of the raw already required, because those products come off the same fish. Compute output per by-product = Σ over CUT lines of `rawKg × (cumulative yield of the by-product along that line's path)`. Note a by-product only comes from raw that passes its split: HOG sold whole gives no HEAD and no BELLY_FLAP.
- Shortfall on a by-product (demand > output) requires extra whole fish: `extraRaw = shortfall / cumYield(byproduct on the default CUT path)`. Add to the week total and note that its fillets fall to residual.

**Step 4 — compare to supply.** `requiredRawKg` vs `supply.rawKg`. Flags: `CANNOT BE MET` (required > supply, show the gap in raw kg), `NO SUPPLY PLANNED` (week has no supply row), `UNRESOLVED` (order product not in the graph).

**Step 5 — mass balance / residual.** For every split actually used in the week: `parentKg = Σ children kg`. Unordered CUT and BYPRODUCT output (spare fillets, all the frames, most of the belly) is listed per product as *residual kg* — never "over", always a number with a product code someone can price later. Unallocated raw (supply − required) is also shown.

## 5. Dev split

| Dev | Owns | Done when |
|---|---|---|
| A | Graph: load edges, validate sums, cumulative yields + pattern per product | `cumYield('PORTION_E') === 0.43421`; validator rejects a (parent, option) that sums to 0.98 |
| B | Orders → raw per line, week roll-up incl. by-product coverage, supply flags | Expected numbers in §7 reproduce |
| C | Mass-balance table and the board (one row per order line + week summary) | Board shows W39 as CANNOT BE MET with the gap; residual table lists FRAME, SKIN, MINCE, spare BELLY_FLAP with kg |

Timeline: 0:00–0:15 agree the types above and load `fish_plan_seed.json` in a shared module. 0:15–1:30 build in parallel against the seed. 1:30–2:00 integrate, run §7, then the stress test.

## 6. Sample orders and supply

| Order | Week | Product | kg |
|---|---|---|---|
| ORD-001 | 2026-W38 | TRIM_C | 1,200 |
| ORD-002 | 2026-W38 | TRIM_E | 800 |
| ORD-003 | 2026-W38 | PORTION_E | 500 |
| ORD-004 | 2026-W38 | HEAD | 300 |
| ORD-005 | 2026-W39 | TRIM_D | 2,000 |
| ORD-006 | 2026-W39 | HOG | 1,500 |
| ORD-007 | 2026-W39 | BELLY_FLAP | 200 |
| ORD-008 | 2026-W39 | TRIM_E | 3,000 |

Supply: W38 6,000 kg raw · W39 8,000 kg raw.

Each order exercises one thing: 001/002 two alternative patterns in one week; 003 the second-level option (portioning); 004 a by-product covered by co-product output; 006 demand at an upper node that bypasses the fillet table; 007 a by-product whose yield differs by path; 008 an order sized to break the week.

## 7. Expected results (acceptance)

**W38** — raw per line: TRIM_C 2,176 · TRIM_E 1,658 · PORTION_E 1,152 → CUT total **4,986 kg**. Head output 4,986 × 0.88 × 0.11 = 483 kg ≥ 300 ordered, so ORD-004 adds nothing. Required 4,986 vs supply 6,000 → **fits**, 1,014 kg raw unallocated. Residual includes 183 kg spare HEAD, FRAME 703 kg, and BELLY_FLAP from both routes (C at 7%, E at 9%).

**W39** — raw per line: TRIM_D 3,800 · HOG 1,705 · TRIM_E 6,218 → CUT total **11,723 kg**. Belly output comes only from the D and E fish: (3,800 + 6,218) × 0.627 × 0.09 = 565 kg ≥ 200, covered. Head output from the same fish = 970 kg (the HOG fish keep theirs). Required 11,723 vs supply 8,000 → **CANNOT BE MET, gap 3,723 kg raw**.

Stress test after integration: change FILLET_A option E `TRIM_E` to 0.75 and `MINCE` to 0.09. W39 gap should widen (TRIM_E raw becomes 6,384) and the validator must still pass. Then add ORD-009 W38 FRAME 900 kg: output is only 703, so 197 kg shortfall forces extra fish whose fillets fall to residual — the by-product-driven case.

## 8. Financial layer — optimising the fish

Prices are NOK/kg. All financial placeholders are invented to make the demo behave; replace them with real quotes.

### 8.1 Data added

```ts
type RawPrice      = { week: string; pricePerKgRound: number };   // salmon input, moves weekly
type CostCenter    = { code: string; name: string; parent: string; option: string;  // the split it runs
                       costPerKgIn: number; capacityKgPerDay: number; daysPerWeek: number };
type Order         = { ...; pricePerKg: number };                 // every line priced
type ResidualPrice = { product: string; pricePerKg: number };     // NRV of anything unsold
```

Cost centres: GUT (on ROUND), HEADING (on HOG), FILLET (on HEADLESS), TRIM_C / TRIM_D / TRIM_E (on FILLET_A per option — skinning to E costs more), PORTION (on TRIM_E). Cost is charged per kg *entering* the centre; capacity is kg in per day × days. Volume per day = weekly kg in ÷ daysPerWeek. If several centres share one physical line, give them the same capacity and sum their loads — the seed keeps them separate.

Raw price: W38 60 · W39 66 NOK/kg round (spot indices quote HOG; divide by 0.88 to get round).

### 8.2 Calculations (steps 6–9, after the volume steps)

**Step 6 — pattern economics, per kg of ROUND.** For each terminal CUT product, `nrv = Σ outputs (cumYield × residualPrice)`, `proc = Σ cost centres on the path (costPerKgIn × cumYield of that centre's parent)`, `margin = nrv − proc − rawPrice(week)`. This table is the optimised cutout: it says what one kg of fish is worth under each pattern this week, before any order is considered.

**Step 7 — order line margin (by-product credit method).** `costPerKgProduct = (rawPrice + proc − byProductCredit) / cumYield(product)`, where `byProductCredit = Σ non-primary outputs × residualPrice`. `lineMargin = (pricePerKg − costPerKgProduct) × kg`. Also report `marginPerKgRaw = lineMargin / rawKg` — that is the number to rank orders by when fish is short.

**Step 8 — cost-centre load and flag.** For each centre, weekly kg in = Σ over lines whose path passes it of `rawKg × cumYield(parent)`. Flag `CAPACITY EXCEEDED` when load > capacityKgPerDay × daysPerWeek; show kg/day alongside.

**Step 9 — week P&L, breakeven, and where the spare fish goes.**
- `revenue` (order lines at price) + `residualValue` (all unordered output at NRV) − `processing` − `rawCost` = `weekMargin`.
- `breakevenRawPrice = (revenue + residualValue − processing) / requiredRawKg` — the input price at which the week's orders exactly wash. Compare to the actual weekly price on the board.
- Spare raw (supply − required): assign it greedily to the pattern with the highest step-6 margin **whose cost centres still have capacity**; step down the ranking as centres fill. If no pattern is positive, the honest answer is "sell as HOG / don't buy the fish".
- When the week is CANNOT BE MET, rank lines by `marginPerKgRaw` ascending and show which lines to short first to close the gap.

That last pair is the whole optimisation for today: a ranked pattern table plus a greedy fill. A proper LP (patterns as variables, orders and capacities as constraints, maximise margin) is the next session — `javascript-lp-solver` or `glpk.js` drop in once the tables exist.

### 8.3 Expected results (placeholder prices)

Pattern margins per kg round (NRV prices): at 60 NOK — PORTION_E 9.27 · TRIM_E 5.80 · TRIM_D 5.56 · HOG 4.94 · TRIM_C 3.34; at 66 NOK — only PORTION_E stays positive (3.27), TRIM_E −0.20, HOG −1.06. A six-krone move in the fish price flips every fillet pattern except portions: that is the "adjusting each week" effect on screen.

Line margins: ORD-001 TRIM_C cost 118.94 → +16.06/kg, 19,271 · ORD-002 TRIM_E 137.98 → +27.02, 21,613 · ORD-003 PORTION_E 158.65 → +36.35, 18,175 · ORD-005 TRIM_D 135.84 → +9.16, 18,324 · ORD-006 HOG 77.21 → +2.79, 4,185 · ORD-008 TRIM_E 150.42 → +9.58, 28,738.

W38: revenue 393,900 · residual 12,013 · processing 47,087 · raw cost 299,167 → **margin 59,659**, breakeven raw price **71.97** vs actual 60. PORTION load 556 kg in vs 500 capacity → **CAPACITY EXCEEDED** (ORD-003 needs a sixth day or a shorter line). Spare 1,014 kg: best pattern is PORTION_E but portioning is full, so it goes to TRIM_E at 5.80 → +5,881.

W39: revenue 895,000 · residual 24,363 · processing 93,409 · raw cost 773,707 → margin 52,247, breakeven 70.46 vs actual 66. Gap 3,723 kg raw. Ranked by margin per kg raw: HOG 2.45 · TRIM_E 4.62 · TRIM_D 4.82 — short ORD-006 first (frees 1,705), then 2,018 kg raw of ORD-008 (≈ 974 kg of Trim E).

### 8.4 Dev split, revised

Phase 1 (to ~1:15) is §5 unchanged. Phase 2, if phase 1 integrates: Dev A adds step 6 (pattern table — it is pure graph maths, A already has the paths); Dev B adds steps 7–8 (line margin, cost-centre load); Dev C adds step 9 to the board (P&L strip, breakeven vs actual, spare-fish and short-first lists). If phase 1 is not integrated by 1:15, phase 2 is the next session — the tables are already in the seed.

## 9. Deliberately left out

Stock on hand and roll-forward · carry/short/unsold routing and the adjustment ledger · realised yields from production history · relative-NRV joint-cost allocation (by-product credit is used instead; same answer for single-main-product patterns) · LP optimisation · quality grades · multi-site · fish count vs kg (add `avgFishKg` later; everything above is in kg).
