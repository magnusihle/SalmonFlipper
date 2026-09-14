import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readWorkbook } from '../src/xlsx.mjs';
import { parseNscWorkbook, buildNscUrl, buildNscUrlCandidates, isoWeek, previousWeek, fetchNscPrices } from '../src/nsc.mjs';
import { priceFor } from '../src/prices.mjs';

const buf = await readFile(new URL('./fixtures/nsc-laks-og-orret-uke-36-2026.xlsx', import.meta.url));

test('xlsx reader lists the salmon sheets and reads the fillet TOTALT row', () => {
  const { sheets } = readWorkbook(buf);
  assert.ok(sheets.has('Fersk laksefilet'));
  assert.ok(sheets.has('Andre lakseprodukter'));
  const row7 = sheets.get('Fersk laksefilet').get(7);
  assert.equal(row7.get('C'), 'TOTALT');
  assert.equal(row7.get('D'), 2991);
  assert.equal(row7.get('E'), 131.87);
});

test('parseNscWorkbook yields fillet, headless and cross-check rows for week 36', () => {
  const rows = parseNscWorkbook(buf, { fetchedAt: 'T' });
  const by = Object.fromEntries(rows.map((r) => [r.product, r]));
  assert.equal(by.FILLET_FRESH.week, '2026-W36');
  assert.equal(by.FILLET_FRESH.nokPerKg, 131.87);
  assert.equal(by.FILLET_FRESH.volumeTonnes, 2991);
  assert.equal(by.FILLET_FROZEN.nokPerKg, 123.14);
  assert.equal(by.HEADLESS_FRESH.nokPerKg, 22.0);
  assert.equal(by.HEADLESS_FROZEN.nokPerKg, 26.94);
  assert.equal(by.HOG_NSC.nokPerKg, 71.98);
  assert.ok(!('HOG' in by), 'HOG is left to SSB 03024');
  for (const r of rows) {
    assert.equal(r.source, 'NSC weekly export statistics');
    assert.equal(r.fetchedAt, 'T');
  }
});

test('buildNscUrl pads the week and uses the en. host', () => {
  assert.equal(
    buildNscUrl(2026, 5),
    'https://en.seafood.no/globalassets/markedsinnsikt/apne-rapporter/ukestatistikk/2026/uke-05/ukestat-laks-og-orret-uke-05.xlsx',
  );
});

test('isoWeek and previousWeek', () => {
  assert.deepEqual(isoWeek(new Date(Date.UTC(2026, 8, 14))), { year: 2026, week: 38 }); // Mon 14 Sep 2026
  assert.deepEqual(isoWeek(new Date(Date.UTC(2026, 0, 1))), { year: 2026, week: 1 });
  assert.deepEqual(previousWeek({ year: 2026, week: 1 }), { year: 2025, week: 52 });
});

test('buildNscUrlCandidates includes the no-hyphen variant seen for week 27', () => {
  const c = buildNscUrlCandidates(2026, 27);
  assert.equal(c[0], buildNscUrl(2026, 27));
  assert.ok(c.some((u) => u.endsWith('/uke-27/ukestat-laks-og-orret-uke27.xlsx')));
});

test('fetchNscPrices tries filename variants, skips unpublished weeks and stops after the requested count', async () => {
  // W36 under the standard name, W35 only under the no-hyphen variant.
  const published = new Set(['ukestat-laks-og-orret-uke-36.xlsx', 'ukestat-laks-og-orret-uke35.xlsx']);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const hit = [...published].some((p) => url.endsWith(p));
    return {
      ok: hit,
      status: hit ? 200 : 404,
      headers: { get: () => (hit ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/html') },
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  };
  const { prices, fetched } = await fetchNscPrices({ weeks: 2, from: { year: 2026, week: 38 }, fetchImpl });
  assert.equal(calls.length, 3 + 3 + 1 + 2); // W38 and W37: all 3 variants miss; W36: first hits; W35: second hits
  assert.equal(fetched.length, 2);
  assert.ok(fetched[1].url.endsWith('uke35.xlsx'));
  assert.equal(prices.filter((p) => p.product === 'FILLET_FRESH').length, 2);
});

test('priceFor works on NSC rows next to SSB rows', () => {
  const rows = parseNscWorkbook(buf);
  assert.equal(priceFor(rows, 'FILLET_FRESH', '2026-W38').nokPerKg, 131.87);
  assert.equal(priceFor(rows, 'HOG', '2026-W38'), null);
});
