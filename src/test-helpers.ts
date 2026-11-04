import { isPick, isTap, type PickQuestion, type Question, type TapQuestion } from './game/questions'
import type { Position, Region } from './music/notes'

/** Deterministic random numbers, so a failing test can be replayed exactly. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const inRegion = (p: Position, r: Region) => r.strings.includes(p.string) && p.fret >= r.minFret && p.fret <= r.maxFret

export function asPick(q: Question | null): PickQuestion {
  if (!q || !isPick(q)) throw new Error('expected a button question')
  return q
}

export function asTap(q: Question | null): TapQuestion {
  if (!q || !isTap(q)) throw new Error('expected a tap question')
  return q
}

/** The answer a button question counts as right: its label, or the pitch class on the note keyboard. */
export const chosen = (q: PickQuestion) => (q.options === 'notes' ? q.answer : q.options[q.answer])
