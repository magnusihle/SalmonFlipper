// Price lookup over prices.json.
// Price = { product, week, nokPerKg, source, fetchedAt, volumeTonnes? }

import { readFile } from 'node:fs/promises';

export async function loadPrices(path = new URL('../prices.json', import.meta.url)) {
  const doc = JSON.parse(await readFile(path, 'utf8'));
  return doc.prices;
}

/**
 * Price for `product` in ISO week `week` ("2026-W36").
 * Exact week if present; otherwise the latest week on or before the requested one;
 * otherwise the latest week available for the product. Returns null if the product has no prices.
 */
export function priceFor(prices, product, week) {
  const rows = prices.filter((p) => p.product === product).sort((a, b) => (a.week < b.week ? -1 : 1));
  if (rows.length === 0) return null;
  const exact = rows.find((p) => p.week === week);
  if (exact) return exact;
  const before = rows.filter((p) => p.week <= week);
  return before.length ? before[before.length - 1] : rows[rows.length - 1];
}
