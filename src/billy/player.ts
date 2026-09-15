/**
 * Plays the singing-fish routine through WebAudio and reports, per frame, how wide the
 * mouth is and where the body should be. Two sources: the built-in groove (lip-sync read
 * straight from the score) or an audio file the viewer drops in (lip-sync follows the
 * loudness of the vocal band).
 */
import { BASS, BEAT, DRUMS, SONG_LENGTH, STABS, VOCAL, danceTarget, flap, mouthOpen, HEAD_OUT, type DancePose } from './song'

export interface SongFrame extends DancePose {
  mouth: number
}

interface Session {
  ctx: AudioContext
  master: GainNode
  t0: number
  length: number
  sources: AudioScheduledSourceNode[]
  analyser?: AnalyserNode
  samples?: Float32Array<ArrayBuffer>
  floor: number
  peak: number
  energy: number
  headOut: boolean
}

let ctx: AudioContext | null = null
let session: Session | null = null
let noise: AudioBuffer | null = null

/** read by the fish's jaw every frame */
export const act = { mouth: 0 }

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

function audio() {
  ctx ??= new AudioContext()
  void ctx.resume()
  return ctx
}

function noiseBuffer(c: AudioContext) {
  if (noise) return noise
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noise
}

function newSession(c: AudioContext, length: number): Session {
  stopSong()
  const comp = c.createDynamicsCompressor()
  comp.connect(c.destination)
  const master = c.createGain()
  master.gain.value = 0.7
  master.connect(comp)
  return { ctx: c, master, t0: c.currentTime + 0.12, length, sources: [], floor: 0.01, peak: 0.05, energy: 0, headOut: false }
}

function env(g: GainNode, at: number, peak: number, attack: number, hold: number, release: number) {
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.setValueAtTime(peak, at + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release)
}

function play(s: Session, src: AudioScheduledSourceNode, at: number, dur: number) {
  src.start(at)
  src.stop(at + dur + 0.05)
  s.sources.push(src)
}

function kick(s: Session, at: number) {
  const o = s.ctx.createOscillator()
  const g = s.ctx.createGain()
  o.frequency.setValueAtTime(150, at)
  o.frequency.exponentialRampToValueAtTime(45, at + 0.12)
  env(g, at, 0.9, 0.003, 0.02, 0.26)
  o.connect(g).connect(s.master)
  play(s, o, at, 0.3)
}

function noiseHit(s: Session, at: number, type: BiquadFilterType, freq: number, peak: number, release: number) {
  const n = s.ctx.createBufferSource()
  n.buffer = noiseBuffer(s.ctx)
  const f = s.ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = s.ctx.createGain()
  env(g, at, peak, 0.002, 0.005, release)
  n.connect(f).connect(g).connect(s.master)
  play(s, n, at, release + 0.01)
}

function bass(s: Session, at: number, midi: number, dur: number) {
  const o = s.ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(midi)
  const f = s.ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 6
  f.frequency.setValueAtTime(900, at)
  f.frequency.exponentialRampToValueAtTime(220, at + dur)
  const g = s.ctx.createGain()
  env(g, at, 0.32, 0.005, dur * 0.6, dur * 0.4)
  o.connect(f).connect(g).connect(s.master)
  play(s, o, at, dur)
}

function stab(s: Session, at: number, midis: number[]) {
  const f = s.ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 2200
  const g = s.ctx.createGain()
  env(g, at, 0.12, 0.004, 0.08, 0.12)
  f.connect(g).connect(s.master)
  for (const m of midis) {
    const o = s.ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = hz(m)
    o.connect(f)
    play(s, o, at, 0.22)
  }
}

// vowel formants (Hz) — alternating gives a "bah-doo" scat rather than a flat synth line
const VOWELS = [
  [800, 1150, 2900],
  [450, 800, 2830],
]

function voice(s: Session, at: number, midi: number, dur: number, vowel: number[]) {
  const o = s.ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(midi)
  o.detune.setValueAtTime(-90, at)
  o.detune.linearRampToValueAtTime(0, at + 0.06)
  const lfo = s.ctx.createOscillator()
  lfo.frequency.value = 5.5
  const depth = s.ctx.createGain()
  depth.gain.value = 12
  lfo.connect(depth).connect(o.detune)
  const g = s.ctx.createGain()
  env(g, at, 0.55, 0.03, Math.max(0, dur - 0.08), 0.07)
  g.connect(s.master)
  vowel.forEach((freq, i) => {
    const f = s.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = 9
    const fg = s.ctx.createGain()
    fg.gain.value = [1.6, 0.9, 0.35][i]
    o.connect(f).connect(fg).connect(g)
  })
  play(s, o, at, dur + 0.1)
  play(s, lfo, at, dur + 0.1)
}

export function startGroove() {
  const s = newSession(audio(), SONG_LENGTH)
  const at = (beat: number) => s.t0 + beat * BEAT
  DRUMS.kick.forEach((b) => kick(s, at(b)))
  DRUMS.snare.forEach((b) => noiseHit(s, at(b), 'bandpass', 1800, 0.5, 0.16))
  DRUMS.hat.forEach((b, i) => noiseHit(s, at(b), 'highpass', 7000, i % 2 ? 0.08 : 0.14, 0.04))
  BASS.forEach((n) => bass(s, at(n.beat), n.midi, n.len * BEAT))
  STABS.forEach((n) => stab(s, at(n.beat), n.midis))
  VOCAL.forEach((n, i) => voice(s, at(n.beat), n.midi, n.len * BEAT * 0.85, VOWELS[i % 2]))
  session = s
}

export async function startFile(file: File) {
  const c = audio()
  const buffer = await c.decodeAudioData(await file.arrayBuffer())
  const s = newSession(c, buffer.duration)
  const src = c.createBufferSource()
  src.buffer = buffer
  src.connect(s.master)
  // listen only where voices live so the kick drum doesn't flap the jaw
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1000
  band.Q.value = 0.8
  const analyser = c.createAnalyser()
  analyser.fftSize = 1024
  src.connect(band).connect(analyser)
  s.analyser = analyser
  s.samples = new Float32Array(analyser.fftSize)
  play(s, src, s.t0, buffer.duration)
  session = s
}

export function stopSong() {
  if (!session) return
  const s = session
  session = null
  act.mouth = 0
  s.master.gain.setTargetAtTime(0, s.ctx.currentTime, 0.03)
  for (const src of s.sources) {
    try {
      src.stop(s.ctx.currentTime + 0.15)
    } catch {
      // already stopped
    }
  }
}

export const singing = () => session !== null

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt))

function listen(s: Session, t: number, dt: number): SongFrame {
  s.analyser!.getFloatTimeDomainData(s.samples!)
  let sum = 0
  for (const v of s.samples!) sum += v * v
  const rms = Math.sqrt(sum / s.samples!.length)
  // floor and peak adapt so quiet and loud recordings both get a full gape
  s.floor = rms < s.floor ? damp(s.floor, rms, 8, dt) : damp(s.floor, rms, 0.3, dt)
  s.peak = rms > s.peak ? rms : damp(s.peak, Math.max(rms, s.floor * 2), 0.2, dt)
  const mouth = Math.min(1, Math.max(0, ((rms - s.floor) / Math.max(1e-4, s.peak - s.floor)) * 1.5 - 0.25))
  s.energy = damp(s.energy, mouth, 1.2, dt)
  if (s.headOut !== s.energy > (s.headOut ? 0.18 : 0.32)) s.headOut = !s.headOut
  return s.headOut ? { ry: HEAD_OUT, rz: 0.12 * mouth, mouth } : { ...flap(t), mouth: 0 }
}

/** Advance one frame; null when nothing is playing. */
export function songFrame(dt: number): SongFrame | null {
  const s = session
  if (!s) return null
  const t = s.ctx.currentTime - s.t0
  if (t > s.length + 0.3) {
    stopSong()
    return null
  }
  const frame = s.analyser ? listen(s, t, dt) : { ...danceTarget(t), mouth: mouthOpen(t) }
  act.mouth = frame.mouth
  return frame
}
