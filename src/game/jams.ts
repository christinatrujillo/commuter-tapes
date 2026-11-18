import { UNITS, type LessonSpec } from '../music/curriculum'
import { KEY_ORDER, type KeyId } from '../music/score'
import { intervalSize, parseInterval, type ChordKind } from '../music/theory'
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
  { id: 'triads', label: 'Triads', tapes: ['tr1', 'tr2', 'tr3', 'tr4', 'tr5', 'tr6'] },
  { id: 'chords', label: 'Chords in a key', tapes: ['hk1', 'hk2', 'hk3', 'hk4'] },
  { id: 'building', label: 'Building chords', tapes: ['cb1', 'cb2', 'cb3', 'cb4', 'cb8', 'cb5', 'cb6'] },
  { id: 'minor', label: 'Minor keys', tapes: ['mk1', 'mk2', 'mk3', 'mk4'] },
  { id: 'blues', label: 'Blues & pentatonics', tapes: ['bp1', 'bp2', 'bp3', 'bp4', 'bp5'] },
  { id: 'modes', label: 'Modes', tapes: ['md1', 'md2', 'md3', 'md4'] },
  { id: 'more-scales', label: 'More scales', tapes: ['sc1', 'sc2'] },
  { id: 'arpeggios', label: 'Arpeggios', tapes: ['sc3'] },
  { id: 'swaps', label: 'Chord swaps', tapes: ['cs1', 'cs2', 'cs3', 'cs4'] },
  { id: 'reading-extras', label: 'Reading extras', tapes: ['rx1'] },
  { id: 'ear', label: 'Ear · headphones', tapes: ['t9', 'tr7', 'hk5', 'cb7', 'mk5', 'bp6', 'md5', 'sc4', 'cs5'] },
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

// Interval shapes by size, for the tapes that teach them by half steps.
const SHAPE_NAMES: Record<number, string> = { 3: 'm3', 4: 'M3', 5: 'P4', 7: 'P5', 12: 'P8' }

/** The scales the Fretboard tab's Scale view can show. */
export type ScaleView = 'major' | 'majorPent' | 'minorPent' | 'blues' | 'modes'
const SCALE_TAPES: [ScaleView, string][] = [
  ['major', 't2'],
  ['majorPent', 'bp2'],
  ['minorPent', 'bp1'],
  ['blues', 'bp3'],
  ['modes', 'md1'],
]

/** The chords the Fretboard tab's Arpeggio view can show, in order: the four triads, then the 7th chords. */
const ARPEGGIO_KINDS: ChordKind[] = ['maj', 'min', 'dim', 'aug', 'maj7', '7', 'm7', 'm7b5']
/** The tapes that teach them, a track at a time (the first tape's tracks are all major). */
const ARPEGGIO_TAPES = ['tr1', 'tr2', 'tr3', 'cb2']

/**
 * What the Fretboard tab's Scale, Interval and Arpeggio views can show: only what you've learned. The
 * Scale view opens with the Major scale tape (C major, plus the keys of the tracks you've
 * recorded), and adds each pentatonic and the blues scale with its tape, the pentatonic patterns
 * as they're taught (the box first), and the modes with the Modes tape; the Interval view opens with the Intervals tape
 * (its shapes, the octave, and any names from Naming intervals); the Arpeggio view opens with the
 * Building triads tape (major), and adds each chord with the track that teaches it.
 */
export function fretboardViews(lessons: Record<string, LessonRecord>): {
  keys: KeyId[]
  intervals: string[]
  scales: ScaleView[]
  patterns: number[]
  chords: ChordKind[]
} {
  const scales = SCALE_TAPES.filter(([, tape]) => recordedOn([tape], lessons).length).map(([scale]) => scale)
  const scaleTracks = recordedOn(['t2'], lessons)
  const keys = scales.length ? KEY_ORDER.filter((k) => k === 'C' || scaleTracks.some((l) => l.keys?.includes(k))) : []
  const patternTracks = recordedOn(['bp4'], lessons)
  const patterns = patternTracks.length ? [...new Set([1, ...patternTracks.flatMap((l) => l.patterns ?? [])])].sort() : []
  const taught = new Set<ChordKind>(recordedOn(ARPEGGIO_TAPES, lessons).flatMap((l) => l.chords ?? l.triads ?? ['maj' as const]))
  const chords = ARPEGGIO_KINDS.filter((k) => taught.has(k))
  const shapeTracks = recordedOn(['u14'], lessons)
  if (!shapeTracks.length) return { keys, intervals: [], scales, patterns, chords }
  const names = new Set<string>([
    ...shapeTracks.flatMap((l) => (l.intervals ?? []).map((n) => SHAPE_NAMES[n]).filter(Boolean)),
    ...(recordedOn(['u13'], lessons).length ? ['P8'] : []),
    ...recordedOn(['t6'], lessons).flatMap((l) => l.ivNames ?? []),
  ])
  const intervals = [...names].sort((a, b) => intervalSize(parseInterval(a))! - intervalSize(parseInterval(b))!)
  return { keys, intervals, scales, patterns, chords }
}
