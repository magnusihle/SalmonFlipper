import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseJsonStat, ssbWeekToIso, buildQuery } from '../src/ssb.mjs';
import { priceFor } from '../src/prices.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/ssb-03024-3weeks.json', import.meta.url), 'utf8'));

test('ssbWeekToIso maps 2026U36 to 2026-W36', () => {
  assert.equal(ssbWeekToIso('2026U36'), '2026-W36');
  assert.throws(() => ssbWeekToIso('2026-36'));
});

test('buildQuery asks for price and volume for the last N weeks', () => {
  const q = buildQuery({ weeks: 12 });
  assert.deepEqual(q.query.find((s) => s.code === 'Tid').selection, { filter: 'top', values: ['12'] });
  assert.deepEqual(q.query.find((s) => s.code === 'VareGrupper2').selection.values, ['01']);
  assert.equal(q.response.format, 'json-stat2');
});

test('parseJsonStat flattens fresh and frozen into Price rows in row-major order', () => {
  const rows = parseJsonStat(fixture, { fetchedAt: 'T' });
  assert.equal(rows.length, 6);
  const fresh = rows.filter((r) => r.product === 'HOG');
  const frozen = rows.filter((r) => r.product === 'HOG_FROZEN');
  assert.equal(fresh.length, 3);
  assert.equal(frozen.length, 3);
  assert.deepEqual(fresh.map((r) => r.week), ['2026-W34', '2026-W35', '2026-W36']);

  // Cross-check one cell against the raw value array using the dataset's own index order.
  const { size, value, dimension } = fixture;
  const iC = dimension.VareGrupper2.category.index['01'];
  const iK = dimension.ContentsCode.category.index['Kilopris'];
  const iT = dimension.Tid.category.index['2026U36'];
  const flat = iC * size[1] * size[2] + iK * size[2] + iT;
  assert.equal(fresh.find((r) => r.week === '2026-W36').nokPerKg, value[flat]);
  for (const r of rows) {
    assert.equal(typeof r.nokPerKg, 'number');
    assert.equal(r.source, 'SSB 03024');
    assert.equal(r.fetchedAt, 'T');
  }
});

test('priceFor: exact week, else latest on or before, else latest available', () => {
  const rows = parseJsonStat(fixture, { fetchedAt: 'T' });
  assert.equal(priceFor(rows, 'HOG', '2026-W35').week, '2026-W35');
  assert.equal(priceFor(rows, 'HOG', '2026-W40').week, '2026-W36'); // future week -> latest
  assert.equal(priceFor(rows, 'HOG', '2026-W10').week, '2026-W36'); // before data -> latest available
  assert.equal(priceFor(rows, 'TRIM_E', '2026-W36'), null);
});
