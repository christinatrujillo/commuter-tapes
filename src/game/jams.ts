import { UNITS, type LessonSpec } from '../music/curriculum'
import type { KeyId } from '../music/score'
import type { LessonRecord } from '../store/progress'
import { pick, type Rng } from '../lib/random'
import { buildSession, type Question, type Stats } from './questions'

/**
 * One-tap theory practice in the Jam room: quick questions mixed from the tracks you've
 * recorded on a group of tapes, so it only ever covers what you've learned.
 */
export const THEORY_JAMS = [
  { id: 'scales', label: 'Steps & scales', tapes: ['t1', 't2', 't3', 't5'] },
  { id: 'keys', label: 'Keys', tapes: ['r9', 't4'] },
  { id: 'intervals', label: 'Intervals', tapes: ['u14', 't6', 't7', 't8'] },
  { id: 'ear', label: 'Ear · headphones', tapes: ['t9'] },
]

/** The tracks you've recorded on these tapes. */
export function recordedOn(tapes: string[], lessons: Record<string, LessonRecord>): LessonSpec[] {
  return UNITS.filter((u) => tapes.includes(u.id)).flatMap((u) => u.lessons.filter((l) => lessons[l.id]?.stars))
}

/** `count` questions, each from one of `tracks` at random. */
export function buildJam(tracks: LessonSpec[], stats: Stats, count: number, rng: Rng = Math.random): Question[] {
  const out: Question[] = []
  for (let i = 0; out.length < count && i < count * 3; i++) out.push(...buildSession({ ...pick(tracks, rng), count: 1 }, stats, rng))
  return out
}

/** For the Keys sprint: every key you've learned to name, from the tracks that name keys. */
export function namedKeys(lessons: Record<string, LessonRecord>): KeyId[] {
  const tracks = recordedOn(['r9', 't4'], lessons).filter((l) => l.exercises.includes('keyName') || l.exercises.includes('keySignature'))
  return [...new Set(tracks.flatMap((l) => l.keys ?? []))]
}

/** For the Intervals sprint: every interval you've learned to name. */
export function namedIntervals(lessons: Record<string, LessonRecord>): string[] {
  return [...new Set(recordedOn(['t6'], lessons).flatMap((l) => l.ivNames ?? []))]
}
