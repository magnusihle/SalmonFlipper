#!/usr/bin/env node
// Fetch weekly salmon reference prices and write prices.json (issue #6).
//   SSB table 03024                       -> HOG (fresh whole), optionally HOG_FROZEN
//   Norwegian Seafood Council weekly xlsx -> FILLET_FRESH, FILLET_FROZEN, HEADLESS_FRESH, HEADLESS_FROZEN, HOG_NSC
// Usage: node scripts/fetch-prices.mjs [--weeks 12] [--out prices.json] [--frozen] [--ssb-only | --nsc-only]
// Needs node >= 23.6 (imports the app's TypeScript SSB parser directly).

import { writeFile } from 'node:fs/promises'
import { fetchSsbPrices, SSB_TABLE_URL, SSB_SOURCE } from '../src/prices/ssb.ts'
import { fetchNscPrices, NSC_PRODUCTS, NSC_SOURCE, buildNscUrl } from './lib/nsc.mjs'

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const weeks = Number(opt('weeks', '12'))
const out = opt('out', 'prices.json')
const runSsb = !args.includes('--nsc-only')
const runNsc = !args.includes('--ssb-only')
const fetchedAt = new Date().toISOString()

const series = []
const prices = []

if (runSsb) {
  const commodities = args.includes('--frozen') ? ['01', '02'] : ['01']
  const ssb = await fetchSsbPrices({ weeks, commodities })
  prices.push(...ssb.prices)
  series.push({
    source: SSB_SOURCE,
    label: ssb.label,
    url: SSB_TABLE_URL,
    updated: ssb.updated,
    unit: 'NOK/kg',
    products: [...new Set(ssb.prices.map((p) => p.product))],
    note: 'Weekly export price of Norwegian farmed salmon, whole fish basis. Published Wednesdays 08:00 CET.',
  })
  console.log(`ssb: ${ssb.prices.length} rows`)
}

if (runNsc) {
  const nsc = await fetchNscPrices({ weeks, log: (m) => console.log(m) })
  prices.push(...nsc.prices)
  series.push({
    source: NSC_SOURCE,
    label: 'Norwegian Seafood Council, open weekly export statistics, salmon and trout (ukestat-laks-og-orret)',
    url: buildNscUrl('<year>', '<week>'),
    unit: 'NOK/kg',
    products: NSC_PRODUCTS.map((p) => ({ product: p.product, label: p.label })),
    weeksFetched: nsc.fetched.map((f) => `${f.year}-W${String(f.week).padStart(2, '0')}`),
    note: 'FOB Norwegian border, all destinations (TOTALT row). Fillet is the export average across trims. Week N is published on the Wednesday of week N+1.',
  })
}

prices.sort((a, b) => (a.product === b.product ? (a.week < b.week ? -1 : 1) : a.product < b.product ? -1 : 1))
await writeFile(out, JSON.stringify({ fetchedAt, series, prices }, null, 2) + '\n')

const summary = {}
for (const p of prices) (summary[p.product] ??= []).push(p.week)
console.log(`wrote ${out}: ${prices.length} rows`)
for (const [product, ws] of Object.entries(summary)) console.log(`  ${product.padEnd(16)} ${ws.length} weeks  ${ws[0]} .. ${ws[ws.length - 1]}`)
