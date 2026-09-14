// Statistics Norway (SSB) table 03024 in JSON-stat 2.0:
// "Export of salmon, fish-farm bred, by commodity group, contents and week".
// Zero dependencies; runs in the browser (the API allows cross-origin POSTs) and in node.
import type { Price } from './types'

export const SSB_TABLE_URL = 'https://data.ssb.no/api/v0/en/table/03024'
export const SSB_SOURCE = 'SSB 03024'

/** Commodity groups in the table, mapped to our product codes. */
export const COMMODITY_TO_PRODUCT: Record<string, string> = {
  '01': 'HOG', // fish-farm bred salmon, fresh or chilled (whole, head-on gutted basis)
  '02': 'HOG_FROZEN', // fish-farm bred salmon, frozen
}

export type SsbQuery = {
  query: { code: string; selection: { filter: string; values: string[] } }[]
  response: { format: 'json-stat2' }
}

/** Build the JSON-stat query body for the last `weeks` weeks. */
export function buildQuery({ weeks = 12, commodities = ['01'] }: { weeks?: number; commodities?: string[] } = {}): SsbQuery {
  return {
    query: [
      { code: 'VareGrupper2', selection: { filter: 'item', values: commodities } },
      { code: 'ContentsCode', selection: { filter: 'item', values: ['Kilopris', 'Vekt'] } },
      { code: 'Tid', selection: { filter: 'top', values: [String(weeks)] } },
    ],
    response: { format: 'json-stat2' },
  }
}

/** "2026U36" -> "2026-W36" (the ISO week form used by orders and supply). */
export function ssbWeekToIso(tid: string): string {
  const m = /^(\d{4})U(\d{2})$/.exec(tid)
  if (!m) throw new Error(`Unexpected SSB week code: ${tid}`)
  return `${m[1]}-W${m[2]}`
}

/** The parts of a JSON-stat 2.0 dataset this parser reads. */
export type JsonStatDataset = {
  class: string
  label?: string
  updated?: string
  id: string[]
  size: number[]
  dimension: Record<string, { category: { index: Record<string, number> } }>
  value: (number | null)[]
}

/**
 * Flatten a JSON-stat 2.0 dataset into Price rows.
 * Rows where the price is null (not yet published) are skipped.
 */
export function parseJsonStat(ds: JsonStatDataset, { fetchedAt = new Date().toISOString() }: { fetchedAt?: string } = {}): Price[] {
  if (ds.class !== 'dataset' || !Array.isArray(ds.id)) throw new Error('Not a JSON-stat 2.0 dataset')
  const dims = ds.id.map((id) => {
    const cat = ds.dimension[id].category
    const codes = Object.keys(cat.index).sort((a, b) => cat.index[a] - cat.index[b])
    return { id, codes }
  })
  const size = ds.size
  // Row-major strides over ds.id order.
  const strides = size.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1))
  const idx = (coords: number[]) => coords.reduce((acc, c, i) => acc + c * strides[i], 0)
  const pos = Object.fromEntries(dims.map((d, i) => [d.id, i])) as Record<string, number>
  const codeIndex = (dimId: string, code: string) => dims[pos[dimId]].codes.indexOf(code)

  const rows: Price[] = []
  for (const commodity of dims[pos.VareGrupper2].codes) {
    const product = COMMODITY_TO_PRODUCT[commodity]
    if (!product) continue
    for (const tid of dims[pos.Tid].codes) {
      const coords = new Array<number>(dims.length).fill(0)
      coords[pos.VareGrupper2] = codeIndex('VareGrupper2', commodity)
      coords[pos.Tid] = codeIndex('Tid', tid)
      coords[pos.ContentsCode] = codeIndex('ContentsCode', 'Kilopris')
      const price = ds.value[idx(coords)]
      coords[pos.ContentsCode] = codeIndex('ContentsCode', 'Vekt')
      const volume = ds.value[idx(coords)]
      if (price == null) continue
      rows.push({ product, week: ssbWeekToIso(tid), nokPerKg: price, volumeTonnes: volume ?? null, source: SSB_SOURCE, fetchedAt })
    }
  }
  return rows
}

export type SsbFetchResult = { prices: Price[]; updated?: string; label?: string; fetchedAt: string }

/** POST the query to SSB and return parsed Price rows plus the dataset's own `updated` stamp. */
export async function fetchSsbPrices(opts: { weeks?: number; commodities?: string[]; fetchImpl?: typeof fetch } = {}): Promise<SsbFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const res = await fetchImpl(SSB_TABLE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildQuery(opts)),
  })
  if (!res.ok) throw new Error(`SSB request failed: ${res.status} ${res.statusText}`)
  const ds = (await res.json()) as JsonStatDataset
  const fetchedAt = new Date().toISOString()
  return { prices: parseJsonStat(ds, { fetchedAt }), updated: ds.updated, label: ds.label, fetchedAt }
}
