import { useProgress } from '../store/progress'

/**
 * Plucked-string sounds made on the fly (Karplus–Strong synthesis), so there
 * are no audio files to download and everything works offline.
 */
let ctx: AudioContext | null = null
const buffers = new Map<number, AudioBuffer>()

/** Everything playing or still scheduled, so moving on can cut it off. */
const voices = new Set<{ node: AudioScheduledSourceNode; gain: GainNode }>()

/** Keeps track of a sound so `stopSounds` can stop it. */
export function track(node: AudioScheduledSourceNode, gain: GainNode) {
  const voice = { node, gain }
  voices.add(voice)
  node.addEventListener('ended', () => voices.delete(voice))
}

/** Stops every note and click that's playing or waiting to play, with a quick fade so it doesn't pop. */
export function stopSounds() {
  if (!ctx) return
  const now = ctx.currentTime
  for (const { node, gain } of voices) {
    try {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setTargetAtTime(0, now, 0.01)
      node.stop(now + 0.05)
    } catch {
      // Already finished.
    }
  }
  voices.clear()
}

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
  track(source, gain)
}

const soundOn = () => useProgress.getState().settings.sound
const hapticsOn = () => useProgress.getState().settings.haptics

// Each of these replaces whatever was still playing, so sounds never pile up.

/** Plays guitar notes (sounding pitch), one after another. */
export function playNotes(...midis: number[]) {
  if (!soundOn()) return
  stopSounds()
  midis.forEach((m, i) => pluck(m, i * 0.32))
}

/**
 * Notes for ear training, one after another with room to hear each, or together, or as chords of
 * `chord` notes one after another. They play even with answer sounds off.
 */
export function playListen(midis: number[], together = false, chord = 0) {
  if (!audioContext()) return
  stopSounds()
  midis.forEach((m, i) => pluck(m, chord ? Math.floor(i / chord) * 1.6 : together ? 0 : i * 0.75))
}

/** A dead, muted thunk: the sound of a fumbled note. */
export function playWrong() {
  if (hapticsOn()) navigator.vibrate?.(200)
  if (!soundOn()) return
  stopSounds()
  ;[40, 45].forEach((m, i) => pluck(m, i * 0.01, 0.9, true))
}

/** A strummed open E major chord. */
export function playStrum() {
  if (hapticsOn()) navigator.vibrate?.([60, 60, 60])
  if (!soundOn()) return
  stopSounds()
  ;[40, 47, 52, 56, 59, 64].forEach((m, i) => pluck(m, i * 0.035, 0.45))
}
