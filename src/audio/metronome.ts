import { METER_PULSE, playedIndexes, onsets, type Measure } from '../music/rhythm'
import { audioContext, pluck } from './sound'

export type MetronomeMode = 'click' | 'vibrate'

/** Phones and tablets that can buzz. Laptops report a vibrate function but can't, so require a touch screen too. */
export function canVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

export const effectiveMode = (setting: MetronomeMode): MetronomeMode => (setting === 'vibrate' && canVibrate() ? 'vibrate' : 'click')

export interface Clock {
  /** Wall-clock time (Date.now) of beat 1 of the measure. */
  start: number
  /** How late clicks reach your ears (speaker latency), to forgive taps that follow the sound. */
  latencyMs: number
  stop: () => void
}

/** A short wooden click; the first beat of a measure is higher. */
function click(ac: AudioContext, when: number, accent: boolean): OscillatorNode {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.value = accent ? 1760 : 1320
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(0.35, when + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
  osc.connect(gain).connect(ac.destination)
  osc.start(when)
  osc.stop(when + 0.07)
  return osc
}

const LEAD_MS = 150

/**
 * Runs `go` once the audio clock is actually ticking. Android starts it asleep and takes a moment
 * to wake; sounds scheduled before then come out late and then bunch up, so the count speeds up.
 */
function whenRunning(ac: AudioContext, go: () => void) {
  if (ac.state === 'running') return go()
  let done = false
  const fire = () => {
    if (done) return
    done = true
    go()
  }
  void ac.resume().then(fire, fire)
  setTimeout(fire, 1000) // Don't hang if it never says it's running.
}

/**
 * When a sound scheduled at audio time `when` leaves the speaker, on the Date.now clock.
 * The audio engine knows its own output delay best; the latency fields are a fallback.
 */
function heardAt(ac: AudioContext, when: number): number {
  const scheduled = Date.now() + (when - ac.currentTime) * 1000
  const ts = typeof ac.getOutputTimestamp === 'function' ? ac.getOutputTimestamp() : null
  if (ts?.contextTime && ts.performanceTime && typeof performance !== 'undefined') {
    const heard = Date.now() + ts.performanceTime + (when - ts.contextTime) * 1000 - performance.now()
    if (heard >= scheduled - 50 && heard < scheduled + 1000) return Math.max(heard, scheduled)
  }
  return scheduled + ((ac.outputLatency || 0) + (ac.baseLatency || 0)) * 1000
}

/**
 * One measure of count-in, then one measure to play in. Click mode clicks every beat of both.
 * Vibrate mode buzzes the count-in, then only beat 1, so it doesn't nag.
 * Calls `ready` with the clock once it's scheduled (straight away, unless the audio has to wake up first).
 */
export function countIn(measure: Measure, bpm: number, mode: MetronomeMode, ready: (clock: Clock) => void): void {
  // `bpm` counts the beat you tap: quarter notes, or half notes in cut time.
  const beats = METER_PULSE[measure.meter].beats
  const beatMs = 60000 / bpm
  const timers: ReturnType<typeof setTimeout>[] = []
  const oscillators: OscillatorNode[] = []
  const stop = () => {
    timers.forEach(clearTimeout)
    oscillators.forEach((o) => {
      try {
        o.stop()
      } catch {
        // Already finished.
      }
    })
  }
  const ac = mode === 'click' ? audioContext() : null

  if (!ac) {
    if (mode === 'vibrate') {
      for (let i = 0; i < beats; i++) timers.push(setTimeout(() => navigator.vibrate(i === 0 ? 60 : 30), LEAD_MS + i * beatMs))
      timers.push(setTimeout(() => navigator.vibrate(60), LEAD_MS + beats * beatMs))
    }
    ready({ start: Date.now() + LEAD_MS + beats * beatMs, latencyMs: 0, stop })
    return
  }

  whenRunning(ac, () => {
    const t0 = ac.currentTime + LEAD_MS / 1000
    for (let i = 0; i < beats * 2; i++) oscillators.push(click(ac, t0 + (i * beatMs) / 1000, i % beats === 0))
    const beat1 = t0 + (beats * beatMs) / 1000
    const start = Date.now() + (beat1 - ac.currentTime) * 1000
    ready({ start, latencyMs: heardAt(ac, beat1) - start, stop })
  })
}

/** Plays a measure so you can hear how it goes: clicks on the beats, a guitar note on each note. */
export function playRhythm(measure: Measure, bpm: number): Clock {
  const beatMs = 60000 / bpm
  const ac = audioContext()
  const start = Date.now() + LEAD_MS
  const oscillators: OscillatorNode[] = []
  if (ac) {
    const t0 = ac.currentTime + LEAD_MS / 1000
    const pulse = METER_PULSE[measure.meter]
    for (let i = 0; i < pulse.beats; i++) oscillators.push(click(ac, t0 + (i * beatMs) / 1000, i === 0))
    const starts = onsets(measure)
    for (const i of playedIndexes(measure)) pluck(59, LEAD_MS / 1000 + ((starts[i] / pulse.quarters) * beatMs) / 1000, 0.55)
  }
  return { start, latencyMs: 0, stop: () => oscillators.forEach((o) => o.stop()) }
}

