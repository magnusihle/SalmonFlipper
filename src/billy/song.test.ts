import { describe, expect, it } from 'vitest'
import { BAR, BEAT, HEAD_OUT, SECTIONS, SONG_BARS, SONG_LENGTH, VOCAL, danceTarget, mouthOpen, sectionAt } from './song'

describe('song structure', () => {
  it('sections tile the song without gaps', () => {
    let bar = 0
    for (const s of SECTIONS) {
      expect(s.bar).toBe(bar)
      bar += s.bars
    }
    expect(bar).toBe(SONG_BARS)
  })

  it('every sung note falls inside a vocal section', () => {
    expect(VOCAL.length).toBeGreaterThan(20)
    for (const n of VOCAL) expect(sectionAt(n.beat * BEAT + 1e-6)?.kind).toBe('vocal')
  })
})

describe('mouthOpen', () => {
  it('opens on each syllable and is shut in the instrumental parts', () => {
    for (const n of VOCAL) expect(mouthOpen(n.beat * BEAT + 0.05)).toBeGreaterThan(0.7)
    expect(mouthOpen(BAR)).toBe(0)
    expect(mouthOpen(SONG_LENGTH - 0.1)).toBe(0)
  })

  it('stays in range', () => {
    for (let t = -1; t < SONG_LENGTH + 1; t += 0.013) {
      const m = mouthOpen(t)
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThanOrEqual(1)
    }
  })
})

describe('danceTarget', () => {
  it('turns the head out for the vocals and flaps the tail otherwise', () => {
    expect(danceTarget(2.5 * BAR).ry).toBe(HEAD_OUT)
    expect(danceTarget(0.25 * BEAT).ry).toBeLessThan(-0.5)
    expect(danceTarget(0.75 * BEAT).ry).toBeCloseTo(0)
  })

  it('rests outside the song', () => {
    expect(danceTarget(-1)).toEqual({ ry: 0, rz: 0 })
    expect(danceTarget(SONG_LENGTH)).toEqual({ ry: 0, rz: 0 })
  })
})
