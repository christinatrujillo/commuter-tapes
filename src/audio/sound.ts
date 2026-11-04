import { useProgress } from '../store/progress'

/**
 * Plucked-string sounds made on the fly (Karplus–Strong synthesis), so there
 * are no audio files to download and everything works offline.
 */
let ctx: AudioContext | null = null
const buffers = new Map<number, AudioBuffer>()

function audio(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** The shared audio context, or null where Web Audio isn't available. */
export function audioContext(): AudioContext | null {
  return typeof AudioContext === 'undefined' ? null : audio()
}

function pluckBuffer(ac: AudioContext, midi: number, muted = false): AudioBuffer {
  const cacheKey = muted ? -midi : midi
  const cached = buffers.get(cacheKey)
  if (cached) return cached
  const rate = ac.sampleRate
  const freq = 440 * 2 ** ((midi - 69) / 12)
  const length = Math.floor(rate * (muted ? 0.25 : 1.8))
  const buffer = ac.createBuffer(1, length, rate)
  const out = buffer.getChannelData(0)
  const period = Math.max(2, Math.round(rate / freq))
  const ring = new Float32Array(period)
  // Slightly smoothed noise gives a warmer, less "scratchy" attack.
  let prev = 0
  for (let i = 0; i < period; i++) {
    prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5
    ring[i] = prev
  }
  // A palm-muted string loses its energy almost at once.
  const decay = muted ? 0.94 : 0.996
  let idx = 0
  for (let i = 0; i < length; i++) {
    const next = (idx + 1) % period
    out[i] = ring[idx]
    ring[idx] = decay * 0.5 * (ring[idx] + ring[next])
    idx = next
  }
  const fade = Math.floor(rate * 0.05)
  for (let i = 0; i < fade; i++) out[length - 1 - i] *= i / fade
  buffers.set(cacheKey, buffer)
  return buffer
}

/** Plays a plucked note `when` seconds from now. */
export function pluck(midi: number, when = 0, volume = 0.7, muted = false) {
  const ac = audio()
  const source = ac.createBufferSource()
  source.buffer = pluckBuffer(ac, midi, muted)
  const gain = ac.createGain()
  gain.gain.value = volume
  source.connect(gain).connect(ac.destination)
  source.start(ac.currentTime + when)
}

const soundOn = () => useProgress.getState().settings.sound
const hapticsOn = () => useProgress.getState().settings.haptics

/** Plays guitar notes (sounding pitch), one after another. */
export function playNotes(...midis: number[]) {
  if (soundOn()) midis.forEach((m, i) => pluck(m, i * 0.32))
}

/** A dead, muted thunk: the sound of a fumbled note. */
/** Notes for ear training, one after another with room to hear each, or together. They play even with answer sounds off. */
export function playListen(midis: number[], together = false) {
  if (audioContext()) midis.forEach((m, i) => pluck(m, together ? 0 : i * 0.75))
}

export function playWrong() {
  if (hapticsOn()) navigator.vibrate?.(120)
  if (soundOn()) [40, 45].forEach((m, i) => pluck(m, i * 0.01, 0.9, true))
}

/** A strummed open E major chord. */
export function playStrum() {
  if (hapticsOn()) navigator.vibrate?.([40, 60, 40])
  if (soundOn()) [40, 47, 52, 56, 59, 64].forEach((m, i) => pluck(m, i * 0.035, 0.45))
}
