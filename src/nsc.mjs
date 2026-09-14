// Norwegian Seafood Council (Sjømatrådet) open weekly export statistics for salmon.
// One .xlsx per week, FOB Norwegian border, NOK/kg and tonnes, with a TOTALT row per product.
// Public, no login; the en.seafood.no host serves the file (www.seafood.no sits behind a bot check).

import { readWorkbook } from './xlsx.mjs';

export const NSC_SOURCE = 'NSC weekly export statistics';

const NSC_BASE = 'https://en.seafood.no/globalassets/markedsinnsikt/apne-rapporter/ukestatistikk';

export function buildNscUrl(year, week) {
  const ww = String(week).padStart(2, '0');
  return `${NSC_BASE}/${year}/uke-${ww}/ukestat-laks-og-orret-uke-${ww}.xlsx`;
}

/** Filename variants seen on the site (week 27 2026 was published as `...-uke27.xlsx`). */
export function buildNscUrlCandidates(year, week) {
  const ww = String(week).padStart(2, '0');
  return [
    buildNscUrl(year, week),
    `${NSC_BASE}/${year}/uke-${ww}/ukestat-laks-og-orret-uke${ww}.xlsx`,
    `${NSC_BASE}/${year}/uke-${ww}/ukestat-laks-og-orret-uke-${ww}-${year}.xlsx`,
  ];
}

/**
 * What we read from the workbook. Whole fresh salmon (HOG) is deliberately not taken here:
 * SSB 03024 is the HOG series in prices.json and two sources under one code would collide.
 * `sheet` + `row` locate the line: row is either 'TOTALT' or a regex on the product label in column C.
 */
export const NSC_PRODUCTS = [
  { product: 'FILLET_FRESH', sheet: 'Fersk laksefilet', row: 'TOTALT', label: 'Fresh salmon fillet, all trims, export average' },
  { product: 'FILLET_FROZEN', sheet: 'Fryst laksefilet', row: 'TOTALT', label: 'Frozen salmon fillet, export average' },
  { product: 'HEADLESS_FRESH', sheet: 'Andre lakseprodukter', row: /fersk hel, ikke med hode/i, label: 'Fresh whole salmon, head off' },
  { product: 'HEADLESS_FROZEN', sheet: 'Andre lakseprodukter', row: /fryst hel, ikke med hode/i, label: 'Frozen whole salmon, head off / edible by-products' },
  { product: 'HOG_NSC', sheet: 'Fersk laks', row: 'TOTALT', label: 'Fresh whole salmon, export average (cross-check against SSB HOG)' },
];

/** Find the header row "uke NN YYYY" and return { week: 'YYYY-WNN', tonnesCol, priceCol }. */
function findHeader(rows) {
  for (const [, cells] of rows) {
    for (const [col, v] of cells) {
      const m = typeof v === 'string' && /uke\s+(\d{1,2})\s+(\d{4})/s.exec(v);
      if (m) {
        const priceCol = String.fromCharCode(col.charCodeAt(0) + 1);
        if (cells.get(priceCol) !== 'Kr/kg') continue;
        return { week: `${m[2]}-W${m[1].padStart(2, '0')}`, tonnesCol: col, priceCol };
      }
    }
  }
  return null;
}

function findRow(rows, matcher) {
  for (const [, cells] of rows) {
    const label = cells.get('C');
    if (typeof label !== 'string') continue;
    if (matcher === 'TOTALT' ? label.trim() === 'TOTALT' : matcher.test(label)) return cells;
  }
  return null;
}

/**
 * Parse one weekly workbook into Price rows:
 * [{ product, week, nokPerKg, volumeTonnes, source, fetchedAt }]. Rows with no price (".") are skipped.
 */
export function parseNscWorkbook(buf, { fetchedAt = new Date().toISOString() } = {}) {
  const { sheets } = readWorkbook(buf);
  const out = [];
  for (const spec of NSC_PRODUCTS) {
    const rows = sheets.get(spec.sheet);
    if (!rows) continue;
    const header = findHeader(rows);
    if (!header) continue;
    const cells = findRow(rows, spec.row);
    if (!cells) continue;
    const price = cells.get(header.priceCol);
    const tonnes = cells.get(header.tonnesCol);
    if (typeof price !== 'number') continue;
    out.push({
      product: spec.product,
      week: header.week,
      nokPerKg: price,
      volumeTonnes: typeof tonnes === 'number' ? tonnes : null,
      source: NSC_SOURCE,
      fetchedAt,
    });
  }
  return out;
}

/** ISO week of a date as { year, week }. */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
}

/** Previous ISO week. Assumes 52 weeks when crossing a year (week 53 years fetch one week less). */
export function previousWeek({ year, week }) {
  return week > 1 ? { year, week: week - 1 } : { year: year - 1, week: 52 };
}

/**
 * Fetch the last `weeks` published workbooks, walking back from the current ISO week.
 * Each week is tried under the known filename variants; a week not yet published (404) is skipped
 * and the walk stops after `maxMisses` consecutive misses.
 */
export async function fetchNscPrices({ weeks = 12, from = isoWeek(), maxMisses = 3, fetchImpl = fetch, log = () => {} } = {}) {
  const prices = [];
  const fetched = [];
  let cur = from;
  let misses = 0;
  while (fetched.length < weeks && misses < maxMisses) {
    let hit = null;
    let lastStatus = 0;
    for (const url of buildNscUrlCandidates(cur.year, cur.week)) {
      const res = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (salmon-deboning-planner)' } });
      lastStatus = res.status;
      if (res.ok && (res.headers.get('content-type') || '').includes('spreadsheetml')) { hit = { url, res }; break; }
    }
    if (hit) {
      const { url, res } = hit;
      const buf = Buffer.from(await res.arrayBuffer());
      const rows = parseNscWorkbook(buf);
      prices.push(...rows);
      fetched.push({ year: cur.year, week: cur.week, url, rows: rows.length });
      misses = 0;
      log(`nsc ${cur.year}-W${String(cur.week).padStart(2, '0')}: ${rows.length} rows`);
    } else {
      misses++;
      log(`nsc ${cur.year}-W${String(cur.week).padStart(2, '0')}: not published (${lastStatus})`);
    }
    cur = previousWeek(cur);
  }
  return { prices, fetched };
}
