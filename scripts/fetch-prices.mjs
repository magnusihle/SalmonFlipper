#!/usr/bin/env node
// Fetch weekly salmon export prices from SSB table 03024 and write prices.json.
// Usage: node scripts/fetch-prices.mjs [--weeks 12] [--out prices.json] [--frozen]

import { writeFile } from 'node:fs/promises';
import { fetchSsbPrices, SSB_TABLE_URL } from '../src/ssb.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const weeks = Number(opt('weeks', '12'));
const out = opt('out', 'prices.json');
const commodities = args.includes('--frozen') ? ['01', '02'] : ['01'];

const { prices, updated, label, fetchedAt } = await fetchSsbPrices({ weeks, commodities });

const doc = {
  fetchedAt,
  series: [
    {
      source: 'SSB 03024',
      label,
      url: SSB_TABLE_URL,
      updated,
      unit: 'NOK/kg',
      products: [...new Set(prices.map((p) => p.product))],
      note: 'Weekly export price of Norwegian farmed salmon, whole fish basis. Published Wednesdays 08:00 CET.',
    },
  ],
  prices,
};

await writeFile(out, JSON.stringify(doc, null, 2) + '\n');
const weeksOut = [...new Set(prices.map((p) => p.week))];
console.log(`wrote ${out}: ${prices.length} rows, ${weeksOut[0]} .. ${weeksOut[weeksOut.length - 1]} (SSB updated ${updated})`);
