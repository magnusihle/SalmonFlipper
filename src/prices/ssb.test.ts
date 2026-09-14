import { describe, expect, it } from 'vitest'
import fixture from './fixtures/ssb-03024-3weeks.json'
import { buildQuery, parseJsonStat, ssbWeekToIso, type JsonStatDataset } from './ssb'
import { mergePrices, priceFor } from './prices'

const ds = fixture as unknown as JsonStatDataset

describe('SSB 03024 (issue #6)', () => {
  it('ssbWeekToIso maps 2026U36 to 2026-W36', () => {
    expect(ssbWeekToIso('2026U36')).toBe('2026-W36')
    expect(() => ssbWeekToIso('2026-36')).toThrow()
  })

  it('buildQuery asks for price and volume for the last N weeks', () => {
    const q = buildQuery({ weeks: 12 })
    expect(q.query.find((s) => s.code === 'Tid')!.selection).toEqual({ filter: 'top', values: ['12'] })
    expect(q.query.find((s) => s.code === 'VareGrupper2')!.selection.values).toEqual(['01'])
    expect(q.response.format).toBe('json-stat2')
  })

  it('parseJsonStat flattens fresh and frozen into Price rows in row-major order', () => {
    const rows = parseJsonStat(ds, { fetchedAt: 'T' })
    expect(rows.length).toBe(6)
    const fresh = rows.filter((r) => r.product === 'HOG')
    const frozen = rows.filter((r) => r.product === 'HOG_FROZEN')
    expect(fresh.length).toBe(3)
    expect(frozen.length).toBe(3)
    expect(fresh.map((r) => r.week)).toEqual(['2026-W34', '2026-W35', '2026-W36'])

    // Cross-check one cell against the raw value array using the dataset's own index order.
    const { size, value, dimension } = ds
    const iC = dimension.VareGrupper2.category.index['01']
    const iK = dimension.ContentsCode.category.index['Kilopris']
    const iT = dimension.Tid.category.index['2026U36']
    const flat = iC * size[1] * size[2] + iK * size[2] + iT
    expect(fresh.find((r) => r.week === '2026-W36')!.nokPerKg).toBe(value[flat])
    for (const r of rows) {
      expect(typeof r.nokPerKg).toBe('number')
      expect(r.source).toBe('SSB 03024')
      expect(r.fetchedAt).toBe('T')
    }
  })

  it('priceFor: exact week, else latest on or before, else latest available', () => {
    const rows = parseJsonStat(ds, { fetchedAt: 'T' })
    expect(priceFor(rows, 'HOG', '2026-W35')!.week).toBe('2026-W35')
    expect(priceFor(rows, 'HOG', '2026-W40')!.week).toBe('2026-W36') // future week -> latest
    expect(priceFor(rows, 'HOG', '2026-W10')!.week).toBe('2026-W36') // before data -> latest available
    expect(priceFor(rows, 'TRIM_E', '2026-W36')).toBeNull()
  })

  it('mergePrices replaces the same (product, week) and keeps the rest', () => {
    const rows = parseJsonStat(ds, { fetchedAt: 'T' })
    const merged = mergePrices(rows, [{ ...rows.find((r) => r.product === 'HOG' && r.week === '2026-W36')!, nokPerKg: 99, fetchedAt: 'U' }])
    expect(merged.length).toBe(rows.length)
    expect(priceFor(merged, 'HOG', '2026-W36')!.nokPerKg).toBe(99)
    expect(priceFor(merged, 'HOG', '2026-W35')!.nokPerKg).toBe(priceFor(rows, 'HOG', '2026-W35')!.nokPerKg)
  })
})
