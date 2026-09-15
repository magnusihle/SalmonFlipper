/**
 * The wall-plaque singing-fish routine: an original funk groove with a scat "vocal",
 * plus the choreography that goes with it. Pure numbers so the lip-sync is testable;
 * player.ts turns the note lists into sound.
 */

export const BPM = 100
export const BEAT = 60 / BPM
export const BAR = BEAT * 4

export interface Note {
  /** beats from song start */
  beat: number
  len: number
  midi: number
}

export type SectionKind = 'band' | 'vocal'
export interface Section {
  bar: number
  bars: number
  kind: SectionKind
}

export const SECTIONS: Section[] = [
  { bar: 0, bars: 2, kind: 'band' },
  { bar: 2, bars: 4, kind: 'vocal' },
  { bar: 6, bars: 2, kind: 'band' },
  { bar: 8, bars: 4, kind: 'vocal' },
  { bar: 12, bars: 2, kind: 'band' },
]
export const SONG_BARS = 14
export const SONG_LENGTH = SONG_BARS * BAR

// Em7 | Em7 | Am7 | D7
const ROOTS = [40, 40, 45, 38]
const CHORDS = [
  [64, 67, 71, 74],
  [64, 67, 71, 74],
  [57, 60, 64, 67],
  [54, 57, 60, 62],
]
// root, octave, fifth, flat seven — sits under all four chords
const BASS_STEPS: (number | null)[] = [0, null, 12, 0, null, 7, null, 10]

type Motif = [beat: number, len: number, midi: number][]
const MOTIFS: Motif[] = [
  [[0.5, 0.5, 64], [1, 0.5, 67], [1.5, 1, 69], [3, 0.5, 67]],
  [[0, 0.5, 64], [0.5, 0.5, 62], [1, 1.5, 59], [3, 0.5, 62], [3.5, 0.5, 64]],
  [[0.5, 0.5, 67], [1, 0.5, 69], [1.5, 0.5, 71], [2, 1, 69], [3.5, 0.5, 67]],
  [[0, 1, 66], [1, 0.5, 64], [1.5, 2, 62]],
]
const VERSES = [
  [0, 1, 2, 3],
  [2, 1, 0, 3],
]

const bars = <T,>(fn: (bar: number) => T[]): T[] => Array.from({ length: SONG_BARS }, (_, b) => fn(b)).flat()
const hits = (beats: number[]) => bars((bar) => beats.map((b) => bar * 4 + b))

export const BASS: Note[] = bars((bar) =>
  BASS_STEPS.flatMap((step, i) => (step === null ? [] : [{ beat: bar * 4 + i / 2, len: 0.4, midi: ROOTS[bar % 4] + step }])),
)

/** chord stabs on the offbeats of 2 and 4 */
export const STABS = bars((bar) => [1.5, 3.5].map((b) => ({ beat: bar * 4 + b, midis: CHORDS[bar % 4] })))

export const DRUMS = {
  kick: hits([0, 1.75, 2.5]),
  snare: hits([1, 3]),
  hat: hits([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]),
}

export const VOCAL: Note[] = SECTIONS.filter((s) => s.kind === 'vocal').flatMap((s, v) =>
  VERSES[v % VERSES.length].flatMap((m, i) =>
    MOTIFS[m].map(([beat, len, midi]) => ({ beat: (s.bar + i) * 4 + beat, len, midi })),
  ),
)

export function sectionAt(t: number): Section | null {
  const bar = t / BAR
  return SECTIONS.find((s) => bar >= s.bar && bar < s.bar + s.bars) ?? null
}

const TAU = Math.PI * 2
/** how long the jaw takes to close after a syllable */
const RELEASE = 0.07

/** 0 = shut, 1 = wide open, `t` seconds into the song. */
export function mouthOpen(t: number): number {
  let open = 0
  for (const n of VOCAL) {
    const a = t - n.beat * BEAT
    const dur = n.len * BEAT * 0.85
    if (a < 0 || a > dur + RELEASE) continue
    const attack = Math.min(1, a / 0.035)
    // held notes flap a little, like the toy's motor chattering
    const wobble = dur > 0.4 ? 0.78 + 0.22 * Math.cos(a * TAU * 5) : 1
    const release = a > dur ? 1 - (a - dur) / RELEASE : 1
    open = Math.max(open, attack * wobble * release)
  }
  return open
}

export interface DancePose {
  /** yaw: positive swings the head out toward the viewer, negative the tail */
  ry: number
  /** nose-down nod */
  rz: number
}

export const HEAD_OUT = 0.95
export const TAIL_OUT = -0.6

/** Tail flap on every beat of the band parts; head swung out (nodding along) for the vocals. */
export function danceTarget(t: number, mouth = mouthOpen(t)): DancePose {
  if (t < 0 || t >= SONG_LENGTH) return { ry: 0, rz: 0 }
  // the head turns out just before the first syllable, like the real motor
  const next = sectionAt(t + 0.3)
  if (next?.kind === 'vocal') return { ry: HEAD_OUT, rz: 0.12 * mouth }
  return flap(t)
}

export function flap(t: number): DancePose {
  const phase = (t / BEAT) % 1
  return { ry: TAIL_OUT * Math.max(0, Math.sin(phase * TAU)), rz: 0 }
}
