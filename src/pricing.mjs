// Per-product NOK/kg from price rules (issue #7).
//
// PriceRule = { product, rule: 'reference' | 'derived' | 'manual', ref?, costPerKg?, nokPerKg?, note? }
//   reference: price of `ref` from prices.json (via priceFor), latest week on or before the requested one.
//   derived:   (price(ref) + costPerKgIn − Σ byproduct yield × price(byproduct)) / cutYield, where ref is the
//              product's CUT parent in the graph and the cost is the cost centre on that (parent, option)
//              in NOK per kg entering the split (rule.costPerKg overrides it).
//   manual:    hand-entered nokPerKg with a note.
//
// Every value comes back with its formula spelled out so the UI can show how the number was made.

import { readFile } from 'node:fs/promises';
import { priceFor } from './prices.mjs';

export async function loadPriceRules(path = new URL('../price_rules.json', import.meta.url)) {
  return JSON.parse(await readFile(path, 'utf8')).rules;
}

const fmt = (n) => n.toFixed(2);

/** The single CUT edge that produces `product`, or null. */
function cutEdgeTo(edges, product) {
  const hits = edges.filter((e) => e.child === product && e.kind === 'CUT');
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Check rules against the seed. Returns a list of error strings (empty = valid).
 * - every product in seed.products has exactly one rule
 * - manual rules carry a numeric nokPerKg
 * - reference rules carry a ref
 * - derived rules point at the product's CUT parent
 */
export function validatePriceRules(rules, seed) {
  const errors = [];
  const byProduct = new Map();
  for (const r of rules) {
    if (byProduct.has(r.product)) errors.push(`${r.product}: more than one rule`);
    byProduct.set(r.product, r);
  }
  for (const p of seed.products) {
    if (!byProduct.has(p.code)) errors.push(`${p.code}: no price rule`);
  }
  for (const r of rules) {
    if (r.rule === 'manual' && typeof r.nokPerKg !== 'number') errors.push(`${r.product}: manual rule without nokPerKg`);
    if (r.rule === 'reference' && !r.ref) errors.push(`${r.product}: reference rule without ref`);
    if (r.rule === 'derived') {
      const edge = cutEdgeTo(seed.edges, r.product);
      if (!edge) errors.push(`${r.product}: derived rule but no single CUT edge produces it`);
      else if (edge.parent !== r.ref) errors.push(`${r.product}: derived ref ${r.ref} is not its CUT parent ${edge.parent}`);
    }
    if (!['reference', 'derived', 'manual'].includes(r.rule)) errors.push(`${r.product}: unknown rule ${r.rule}`);
  }
  return errors;
}

/**
 * Build a pricer over rules, the cut graph, cost centres and reference prices.
 * All methods are pure; `withManualPrice` returns a new pricer.
 */
export function createPricer({ rules, edges, costCenters = [], prices }) {
  const ruleFor = new Map(rules.map((r) => [r.product, r]));

  function costPerKgIn(rule, edge) {
    if (typeof rule.costPerKg === 'number') return { cost: rule.costPerKg, costSource: 'rule.costPerKg' };
    const cc = costCenters.find((c) => c.parent === edge.parent && c.option === edge.option);
    return cc ? { cost: cc.costPerKgIn, costSource: `cost centre ${cc.code}` } : { cost: 0, costSource: 'no cost centre' };
  }

  function resolve(product, week, stack) {
    const rule = ruleFor.get(product);
    if (!rule) throw new Error(`No price rule for product ${product}`);
    if (stack.includes(product)) throw new Error(`Price rule cycle: ${[...stack, product].join(' -> ')}`);
    const next = [...stack, product];
    const base = { product, week, rule: rule.rule, note: rule.note ?? '' };

    if (rule.rule === 'manual') {
      return { ...base, nokPerKg: rule.nokPerKg, source: 'manual', referenceSource: 'manual', formula: `manual ${fmt(rule.nokPerKg)} NOK/kg` };
    }

    if (rule.rule === 'reference') {
      const p = priceFor(prices, rule.ref, week);
      if (!p) throw new Error(`No reference price for ${rule.ref} (needed by ${product})`);
      return {
        ...base,
        nokPerKg: p.nokPerKg,
        priceWeek: p.week,
        source: p.source,
        referenceSource: p.source,
        formula: `${rule.ref} ${p.source} ${p.week} = ${fmt(p.nokPerKg)}`,
      };
    }

    if (rule.rule === 'derived') {
      const edge = cutEdgeTo(edges, product);
      if (!edge || edge.parent !== rule.ref) throw new Error(`${product}: derived ref ${rule.ref} is not its CUT parent`);
      const parent = resolve(edge.parent, week, next);
      const siblings = edges.filter(
        (e) => e.parent === edge.parent && e.option === edge.option && e.kind === 'BYPRODUCT',
      );
      const credits = siblings.map((s) => {
        const v = resolve(s.child, week, next);
        return { product: s.child, yield: s.yieldOfParent, nokPerKg: v.nokPerKg, valueNok: s.yieldOfParent * v.nokPerKg };
      });
      const creditNok = credits.reduce((a, c) => a + c.valueNok, 0);
      const { cost, costSource } = costPerKgIn(rule, edge);
      const nokPerKg = (parent.nokPerKg + cost - creditNok) / edge.yieldOfParent;
      const creditText = credits.map((c) => ` − ${c.yield}×${c.product} ${fmt(c.nokPerKg)}`).join('');
      return {
        ...base,
        nokPerKg,
        priceWeek: parent.priceWeek,
        source: `derived from ${edge.parent} via ${parent.referenceSource}, ${costSource}`,
        referenceSource: parent.referenceSource,
        formula: `(${edge.parent} ${fmt(parent.nokPerKg)} + cost ${fmt(cost)}${creditText}) / ${edge.yieldOfParent} = ${fmt(nokPerKg)}`,
        parent: edge.parent,
        option: edge.option,
        cutYield: edge.yieldOfParent,
        costPerKgIn: cost,
        credits,
      };
    }

    throw new Error(`${product}: unknown rule ${rule.rule}`);
  }

  const valuePerKg = (product, week) => resolve(product, week, []);

  return {
    rules,
    valuePerKg,

    /** Residual rows { product, kg, ...rest } → rows with nokPerKg, valueNok, formula, plus totalNok. */
    valueResidual(rows, week) {
      const out = rows.map((row) => {
        const v = valuePerKg(row.product, week);
        return { ...row, nokPerKg: v.nokPerKg, valueNok: row.kg * v.nokPerKg, rule: v.rule, formula: v.formula, source: v.source };
      });
      return { week, rows: out, totalNok: out.reduce((a, r) => a + r.valueNok, 0) };
    },

    /** Spare raw (supply − required) valued through the ROUND rule, i.e. at the HOG reference price. */
    valueUnallocatedRaw(kg, week) {
      const v = valuePerKg('ROUND', week);
      return { week, kg, nokPerKg: v.nokPerKg, valueNok: kg * v.nokPerKg, priceWeek: v.priceWeek, formula: v.formula };
    },

    /** One row per product for the prices panel: rule, price, source, formula; manual rows are editable. */
    panel(week) {
      return rules.map((r) => {
        const v = valuePerKg(r.product, week);
        return {
          product: r.product,
          rule: v.rule,
          nokPerKg: v.nokPerKg,
          priceWeek: v.priceWeek ?? null,
          source: v.source,
          formula: v.formula,
          note: v.note,
          editable: v.rule === 'manual',
        };
      });
    },

    /** New pricer with a manual product repriced. Only manual rules may be edited. */
    withManualPrice(product, nokPerKg) {
      const rule = ruleFor.get(product);
      if (!rule) throw new Error(`No price rule for product ${product}`);
      if (rule.rule !== 'manual') throw new Error(`${product} is a ${rule.rule} rule; only manual rules can be edited`);
      const next = rules.map((r) => (r.product === product ? { ...r, nokPerKg } : r));
      return createPricer({ rules: next, edges, costCenters, prices });
    },
  };
}
