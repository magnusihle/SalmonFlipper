#!/usr/bin/env node
// Print the prices panel for a week and, optionally, value a residual table.
// Usage: node scripts/prices.mjs [--week 2026-W38] [--residual file.json] [--set FRAME=10 --set SKIN=5]
// The residual file is { week?, unallocatedRawKg?, rows: [{ product, kg }] } — the shape issue #3 produces.

import { readFile } from 'node:fs/promises';
import { loadPrices } from '../src/prices.mjs';
import { loadPriceRules, createPricer, validatePriceRules } from '../src/pricing.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const sets = args.flatMap((a, i) => (a === '--set' && args[i + 1] ? [args[i + 1]] : []));

const seed = JSON.parse(await readFile(new URL('../fisk_plan_seed.json', import.meta.url), 'utf8'));
const rules = await loadPriceRules();
const errors = validatePriceRules(rules, seed);
if (errors.length) {
  console.error('price_rules.json is invalid:\n  ' + errors.join('\n  '));
  process.exit(1);
}

let pricer = createPricer({ rules, edges: seed.edges, costCenters: seed.costCenters, prices: await loadPrices() });
for (const s of sets) {
  const [product, value] = s.split('=');
  pricer = pricer.withManualPrice(product, Number(value));
}

const residual = opt('residual') ? JSON.parse(await readFile(opt('residual'), 'utf8')) : null;
const week = opt('week', residual?.week ?? '2026-W38');
const pad = (s, n) => String(s).padEnd(n);
const num = (n, w = 10) => n.toFixed(2).padStart(w);

console.log(`Prices for ${week} (NOK/kg)\n`);
console.log(pad('product', 12) + pad('rule', 11) + 'NOK/kg'.padStart(10) + '  formula / source');
for (const row of pricer.panel(week)) {
  const src = row.rule === 'manual' ? `${row.formula} (${row.note})` : `${row.formula}  [${row.source}]`;
  console.log(pad(row.product, 12) + pad(row.rule, 11) + num(row.nokPerKg) + '  ' + src);
}

if (residual) {
  const valued = pricer.valueResidual(residual.rows, week);
  console.log(`\nResidual ${week}\n`);
  console.log(pad('product', 12) + 'kg'.padStart(10) + 'NOK/kg'.padStart(10) + 'NOK'.padStart(12));
  for (const r of valued.rows) console.log(pad(r.product, 12) + num(r.kg) + num(r.nokPerKg) + num(r.valueNok, 12));
  console.log(pad('Residual total', 32) + num(valued.totalNok, 12));
  if (typeof residual.unallocatedRawKg === 'number') {
    const u = pricer.valueUnallocatedRaw(residual.unallocatedRawKg, week);
    console.log(`${pad('Unallocated raw', 12)}${num(u.kg)}${num(u.nokPerKg)}${num(u.valueNok, 12)}  (HOG ${u.priceWeek})`);
  }
}
