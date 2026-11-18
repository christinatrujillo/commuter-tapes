import { isPick, isTap, type PickQuestion, type Question, type TapQuestion } from './game/questions'
import type { Position, Region } from './music/notes'
import type { RoadSigns } from './music/score'

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

/**
 * The route through a score's road signs, read the way a player reads them: a repeat is taken
 * once, a 1st ending skipped the second time, a D.C. or D.S. taken once, and Fine and To Coda
 * only count after it.
 */
export function roadRoute(signs: (RoadSigns | null)[]): number[] {
  const out: number[] = []
  let [i, repeated, jumped] = [0, false, false]
  while (i < signs.length && out.length < 40) {
    const s = signs[i] ?? {}
    if (s.ending === 1 && repeated) {
      i++
      continue
    }
    out.push(i + 1)
    if (s.mark === 'fine' && jumped) break
    if (s.mark === 'to-coda' && jumped) i = signs.findIndex((x) => x?.mark === 'coda')
    else if (s.repeatEnd && !repeated) {
      repeated = true
      while (i > 0 && !signs[i]?.repeatStart) i--
    } else if (s.mark?.startsWith('dc-') && !jumped) [i, jumped] = [0, true]
    else if (s.mark?.startsWith('ds-') && !jumped) [i, jumped] = [signs.findIndex((x) => x?.mark === 'segno'), true]
    else i++
  }
  return out
}
