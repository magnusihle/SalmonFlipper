import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseJsonStat } from '../src/ssb.mjs';
import { priceFor } from '../src/prices.mjs';
import { createPricer, validatePriceRules, loadPriceRules } from '../src/pricing.mjs';

const seed = JSON.parse(await readFile(new URL('../fisk_plan_seed.json', import.meta.url), 'utf8'));
const rules = await loadPriceRules();
const ssb = JSON.parse(await readFile(new URL('./fixtures/ssb-03024-3weeks.json', import.meta.url), 'utf8'));
const prices = parseJsonStat(ssb, { fetchedAt: 'T' }); // HOG for 2026-W34..W36
const hog = (week) => priceFor(prices, 'HOG', week).nokPerKg;

const pricer = createPricer({ rules, edges: seed.edges, costCenters: seed.costCenters, prices });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('reference rule: HOG takes the SSB price for that week', () => {
  const v = pricer.valuePerKg('HOG', '2026-W35');
  assert.equal(v.rule, 'reference');
  assert.equal(v.nokPerKg, hog('2026-W35'));
  assert.equal(v.priceWeek, '2026-W35');
  assert.match(v.source, /SSB 03024/);
  assert.match(v.formula, /2026-W35/);
});

test('reference rule falls back to the latest published week on or before the requested one', () => {
  const v = pricer.valuePerKg('HOG', '2026-W38');
  assert.equal(v.nokPerKg, hog('2026-W36'));
  assert.equal(v.priceWeek, '2026-W36');
});

test('ROUND (unallocated raw) is valued at the HOG reference price', () => {
  const v = pricer.valuePerKg('ROUND', '2026-W38');
  assert.equal(v.nokPerKg, hog('2026-W36'));
  assert.match(v.formula, /HOG/);
});

test('manual rule: by-products use the hand-entered placeholder with its note', () => {
  const v = pricer.valuePerKg('HEAD', '2026-W38');
  assert.equal(v.rule, 'manual');
  assert.equal(v.nokPerKg, 6);
  assert.match(v.note, /placeholder/i);
  assert.equal(v.formula, 'manual 6.00 NOK/kg');
});

test('derived rule: parent price plus cost per kg in, less by-product credit, over the cut yield', () => {
  // HEADLESS from HOG: option "-", HEADLESS 0.89, HEAD 0.11; HEADING costs 1 NOK per kg in.
  const v = pricer.valuePerKg('HEADLESS', '2026-W38');
  assert.equal(v.rule, 'derived');
  close(v.nokPerKg, (hog('2026-W36') + 1 - 0.11 * 6) / 0.89);
  assert.match(v.formula, /HOG/);
  assert.match(v.formula, /0\.89/);
  assert.match(v.formula, /HEAD/);
});

test('derived rule resolves the whole chain down to portions', () => {
  const headless = (hog('2026-W36') + 1 - 0.11 * 6) / 0.89;
  const filletA = (headless + 4 - 0.18 * 3) / 0.8;
  const trimE = (filletA + 5.5 - 0.09 * 20 - 0.07 * 4 - 0.07 * 12) / 0.77;
  const portion = (trimE + 6 - 0.1 * 12) / 0.9;
  close(pricer.valuePerKg('FILLET_A', '2026-W38').nokPerKg, filletA);
  close(pricer.valuePerKg('TRIM_E', '2026-W38').nokPerKg, trimE);
  close(pricer.valuePerKg('PORTION_E', '2026-W38').nokPerKg, portion);
});

test('an explicit costPerKg on a derived rule overrides the cost centre', () => {
  const custom = rules.map((r) => (r.product === 'HEADLESS' ? { ...r, costPerKg: 3 } : r));
  const p = createPricer({ rules: custom, edges: seed.edges, costCenters: seed.costCenters, prices });
  close(p.valuePerKg('HEADLESS', '2026-W38').nokPerKg, (hog('2026-W36') + 3 - 0.11 * 6) / 0.89);
});

test('a product without a rule throws a clear error', () => {
  assert.throws(() => pricer.valuePerKg('CAVIAR', '2026-W38'), /no price rule/i);
});

test('valueResidual puts kg × NOK/kg on every row and totals the week', () => {
  const rows = [
    { product: 'HEAD', kg: 183 },
    { product: 'FRAME', kg: 703 },
    { product: 'BELLY_FLAP', kg: 100 },
  ];
  const r = pricer.valueResidual(rows, '2026-W38');
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].product, 'HEAD');
  assert.equal(r.rows[0].kg, 183);
  assert.equal(r.rows[0].nokPerKg, 6);
  close(r.rows[0].valueNok, 183 * 6);
  close(r.rows[1].valueNok, 703 * 3);
  close(r.rows[2].valueNok, 100 * 20);
  close(r.totalNok, 183 * 6 + 703 * 3 + 100 * 20);
  assert.ok(r.rows[1].formula);
});

test('valueUnallocatedRaw prices spare raw kg at the HOG reference for the week', () => {
  const u = pricer.valueUnallocatedRaw(1014, '2026-W38');
  assert.equal(u.kg, 1014);
  close(u.valueNok, 1014 * hog('2026-W36'));
  assert.equal(u.priceWeek, '2026-W36');
});

test('withManualPrice returns a new pricer whose residual total moves; the original is unchanged', () => {
  const rows = [{ product: 'FRAME', kg: 703 }];
  const before = pricer.valueResidual(rows, '2026-W38').totalNok;
  const changed = pricer.withManualPrice('FRAME', 10);
  close(changed.valueResidual(rows, '2026-W38').totalNok, 7030);
  close(pricer.valueResidual(rows, '2026-W38').totalNok, before);
  // Derived prices that credit FRAME move too.
  assert.ok(changed.valuePerKg('FILLET_A', '2026-W38').nokPerKg < pricer.valuePerKg('FILLET_A', '2026-W38').nokPerKg);
});

test('withManualPrice refuses to overwrite a non-manual rule', () => {
  assert.throws(() => pricer.withManualPrice('HOG', 99), /manual/);
});

test('panel lists every product in the graph with rule, price, source and formula; only manual rows are editable', () => {
  const panel = pricer.panel('2026-W38');
  const codes = seed.products.map((p) => p.code).sort();
  assert.deepEqual(panel.map((r) => r.product).sort(), codes);
  for (const row of panel) {
    assert.ok(['reference', 'derived', 'manual'].includes(row.rule), row.product);
    assert.equal(typeof row.nokPerKg, 'number');
    assert.ok(row.source, row.product);
    assert.ok(row.formula, row.product);
    assert.equal(row.editable, row.rule === 'manual');
  }
});

test('validatePriceRules: the shipped rules cover every product in the seed', () => {
  assert.deepEqual(validatePriceRules(rules, seed), []);
});

test('validatePriceRules rejects a derived rule whose ref is not the product’s CUT parent', () => {
  const bad = rules.map((r) => (r.product === 'TRIM_E' ? { ...r, ref: 'HOG' } : r));
  const errors = validatePriceRules(bad, seed);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /TRIM_E/);
  assert.match(errors[0], /HOG/);
});

test('validatePriceRules reports products with no rule and manual rules without a price', () => {
  const missing = rules.filter((r) => r.product !== 'SKIN').map((r) => (r.product === 'MINCE' ? { ...r, nokPerKg: undefined } : r));
  const errors = validatePriceRules(missing, seed);
  assert.ok(errors.some((e) => /SKIN/.test(e)));
  assert.ok(errors.some((e) => /MINCE/.test(e)));
});
