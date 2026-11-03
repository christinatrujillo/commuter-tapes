import { METER_BEATS, playedIndexes, onsets, type Measure } from '../music/rhythm'
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
 * One measure of count-in, then one measure to play in. Click mode clicks every beat of both.
 * Vibrate mode buzzes the count-in, then only beat 1, so it doesn't nag.
 */
export function countIn(measure: Measure, bpm: number, mode: MetronomeMode): Clock {
  const beats = METER_BEATS[measure.meter]
  const beatMs = 60000 / bpm
  const start = Date.now() + LEAD_MS + beats * beatMs
  const timers: ReturnType<typeof setTimeout>[] = []
  const oscillators: OscillatorNode[] = []
  let latencyMs = 0

  if (mode === 'click') {
    const ac = audioContext()
    if (ac) {
      const t0 = ac.currentTime + LEAD_MS / 1000
      for (let i = 0; i < beats * 2; i++) oscillators.push(click(ac, t0 + (i * beatMs) / 1000, i % beats === 0))
      latencyMs = ((ac.outputLatency || 0) + (ac.baseLatency || 0)) * 1000
    }
  } else {
    for (let i = 0; i < beats; i++) timers.push(setTimeout(() => navigator.vibrate(i === 0 ? 60 : 30), LEAD_MS + i * beatMs))
    timers.push(setTimeout(() => navigator.vibrate(60), LEAD_MS + beats * beatMs))
  }

  return {
    start,
    latencyMs,
    stop: () => {
      timers.forEach(clearTimeout)
      oscillators.forEach((o) => {
        try {
          o.stop()
        } catch {
          // Already finished.
        }
      })
    },
  }
}

/** Plays a measure so you can hear how it goes: clicks on the beats, a guitar note on each note. */
export function playRhythm(measure: Measure, bpm: number): Clock {
  const beatMs = 60000 / bpm
  const ac = audioContext()
  const start = Date.now() + LEAD_MS
  const oscillators: OscillatorNode[] = []
  if (ac) {
    const t0 = ac.currentTime + LEAD_MS / 1000
    const beats = METER_BEATS[measure.meter]
    for (let i = 0; i < beats; i++) oscillators.push(click(ac, t0 + (i * beatMs) / 1000, i === 0))
    const starts = onsets(measure)
    for (const i of playedIndexes(measure)) pluck(59, LEAD_MS / 1000 + (starts[i] * beatMs) / 1000, 0.55)
  }
  return { start, latencyMs: 0, stop: () => oscillators.forEach((o) => o.stop()) }
}

