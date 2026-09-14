// Parsing helpers for SSB (Statistics Norway) table 03024 in JSON-stat 2.0.
// Table: Export of salmon, fish-farm bred, by commodity group, contents and week.
// Zero dependencies.

export const SSB_TABLE_URL = 'https://data.ssb.no/api/v0/en/table/03024';
export const SSB_SOURCE = 'SSB 03024';

/** Commodity groups in the table, mapped to our product codes. */
export const COMMODITY_TO_PRODUCT = {
  '01': 'HOG',        // fish-farm bred salmon, fresh or chilled (whole, head-on gutted basis)
  '02': 'HOG_FROZEN', // fish-farm bred salmon, frozen
};

/** Build the JSON-stat query body for the last `weeks` weeks. */
export function buildQuery({ weeks = 12, commodities = ['01'] } = {}) {
  return {
    query: [
      { code: 'VareGrupper2', selection: { filter: 'item', values: commodities } },
      { code: 'ContentsCode', selection: { filter: 'item', values: ['Kilopris', 'Vekt'] } },
      { code: 'Tid', selection: { filter: 'top', values: [String(weeks)] } },
    ],
    response: { format: 'json-stat2' },
  };
}

/** "2026U36" -> "2026-W36" (the ISO week form used by orders and supply). */
export function ssbWeekToIso(tid) {
  const m = /^(\d{4})U(\d{2})$/.exec(tid);
  if (!m) throw new Error(`Unexpected SSB week code: ${tid}`);
  return `${m[1]}-W${m[2]}`;
}

/**
 * Flatten a JSON-stat 2.0 dataset into Price rows.
 * Returns [{ product, week, nokPerKg, volumeTonnes, source, fetchedAt }].
 * Rows where price is null (not yet published) are skipped.
 */
export function parseJsonStat(ds, { fetchedAt = new Date().toISOString() } = {}) {
  if (ds.class !== 'dataset' || !Array.isArray(ds.id)) {
    throw new Error('Not a JSON-stat 2.0 dataset');
  }
  const dims = ds.id.map((id) => {
    const cat = ds.dimension[id].category;
    const codes = Object.keys(cat.index).sort((a, b) => cat.index[a] - cat.index[b]);
    return { id, codes };
  });
  const size = ds.size;
  // Row-major strides over ds.id order.
  const strides = size.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1));

  const idx = (coords) => coords.reduce((acc, c, i) => acc + c * strides[i], 0);
  const pos = Object.fromEntries(dims.map((d, i) => [d.id, i]));
  const codeIndex = (dimId, code) => dims[pos[dimId]].codes.indexOf(code);

  const rows = [];
  for (const commodity of dims[pos.VareGrupper2].codes) {
    const product = COMMODITY_TO_PRODUCT[commodity];
    if (!product) continue;
    for (const tid of dims[pos.Tid].codes) {
      const coords = new Array(dims.length);
      coords[pos.VareGrupper2] = codeIndex('VareGrupper2', commodity);
      coords[pos.Tid] = codeIndex('Tid', tid);
      coords[pos.ContentsCode] = codeIndex('ContentsCode', 'Kilopris');
      const price = ds.value[idx(coords)];
      coords[pos.ContentsCode] = codeIndex('ContentsCode', 'Vekt');
      const volume = ds.value[idx(coords)];
      if (price == null) continue;
      rows.push({
        product,
        week: ssbWeekToIso(tid),
        nokPerKg: price,
        volumeTonnes: volume ?? null,
        source: SSB_SOURCE,
        fetchedAt,
      });
    }
  }
  return rows;
}

/** POST the query to SSB and return parsed Price rows plus the dataset's own `updated` stamp. */
export async function fetchSsbPrices(opts = {}) {
  const res = await fetch(SSB_TABLE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildQuery(opts)),
  });
  if (!res.ok) throw new Error(`SSB request failed: ${res.status} ${res.statusText}`);
  const ds = await res.json();
  const fetchedAt = new Date().toISOString();
  return { prices: parseJsonStat(ds, { fetchedAt }), updated: ds.updated, label: ds.label, fetchedAt };
}
