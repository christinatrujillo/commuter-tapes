import {
  allPositions,
  midiAt,
  pitchClass,
  positionsForMidi,
  spelledMidi,
  WRITTEN_OCTAVE_SHIFT,
  type Accidental,
  type Letter,
  type Position,
  type Region,
} from '../music/notes'
import {
  KEY_ORDER,
  HIGH_A,
  KEYS,
  MIDDLE_C,
  motionOptions,
  resolveNotes,
  staffDegree,
  stepFrom,
  type AccidentalRule,
  type KeyId,
  type MotionKind,
  type ScoreMeasure,
  type ScoreNote,
} from '../music/score'
import { pick, type Rng } from '../lib/random'
import type { Question } from './questions'

/** Reading questions: the measure rule, key signatures, steps and skips, and short phrases. */

type Spot = { letter: Letter; octave: number }

const atDegree = (degree: number): Spot => stepFrom({ letter: 'C', octave: 0 }, degree)
const note = (s: Spot, dur: ScoreNote['dur'] = 'q', sign?: Accidental): ScoreNote => ({ letter: s.letter, octave: s.octave, dur, ...(sign !== undefined ? { sign } : {}) })

// The staff and one ledger line either side: C4 (middle C) up to A5, in lines and spaces.
const BOTTOM_LINE_E = staffDegree({ letter: 'E', octave: 4 })
const TOP_LINE_F = staffDegree({ letter: 'F', octave: 5 })

/** The sounding pitch a written note stands for, once the key and accidentals are applied. */
const sounding = (measures: ScoreMeasure[], key: KeyId, index: number) => spelledMidi(resolveNotes(measures, key)[index]) - WRITTEN_OCTAVE_SHIFT

/** Sharps on F and C, flats on B and E (the ones beginners actually meet), either on the rest. */
function signFor(letter: Letter, rng: Rng): Accidental {
  if (letter === 'F' || letter === 'C') return 1
  if (letter === 'B' || letter === 'E') return -1
  return rng() < 0.5 ? 1 : -1
}

/** Notes on other letters, so they can't interfere with the one being asked about. */
function fillers(avoid: Letter, count: number, rng: Rng): Spot[] {
  const out: Spot[] = []
  while (out.length < count) {
    const s = atDegree(BOTTOM_LINE_E + Math.floor(rng() * (TOP_LINE_F - BOTTOM_LINE_E + 1)))
    if (s.letter !== avoid) out.push(s)
  }
  return out
}

/**
 * "What is the marked note?" A measure (or two) where an earlier accidental, a natural sign,
 * a bar line or an octave change decides what the marked note really is.
 */
export function makeAccidentalRule(id: number, rule: AccidentalRule, rng: Rng): Question {
  // The octave rule needs room for the same letter an octave up.
  const x = rule === 'octave' ? atDegree(MIDDLE_C + Math.floor(rng() * 6)) : atDegree(BOTTOM_LINE_E + Math.floor(rng() * (TOP_LINE_F - BOTTOM_LINE_E + 1)))
  const sign = signFor(x.letter, rng)
  const [f1, f2, f3, f4] = fillers(x.letter, 4, rng)
  let measures: ScoreMeasure[]
  let target: number
  switch (rule) {
    case 'carry':
      measures = rng() < 0.5 ? [[note(x, 'q', sign), note(f1), note(x), note(f2)]] : [[note(f1), note(x, 'q', sign), note(f2), note(x)]]
      target = measures[0].findIndex((n, i) => i > 0 && n.letter === x.letter && n.sign === undefined)
      break
    case 'natural':
      measures = [[note(x, 'q', sign), note(f1), note(x, 'q', 0), note(f2)]]
      target = 2
      break
    case 'barline':
      measures = [
        [note(f1), note(f2), note(x, 'q', sign), note(f3)],
        [note(x, 'h'), note(f4, 'h')],
      ]
      target = 4
      break
    case 'octave': {
      const up = { letter: x.letter, octave: x.octave + 1 }
      const higherFirst = rng() < 0.5
      measures = [[note(higherFirst ? up : x, 'q', sign), note(f1), note(higherFirst ? x : up), note(f2)]]
      target = 2
      break
    }
  }
  return { id, kind: 'accidentalRule', measures, target, rule, facts: [`rule:${rule}`] }
}

/**
 * "What key is this?" from a key signature on its own. `only` asks about one key in particular.
 * With more than four keys to choose from, the choices are the key and the three signatures closest to it.
 */
export function makeKeyName(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question | null {
  const all = KEY_ORDER.filter((k) => keys.includes(k))
  if (all.length < 2) return null
  const key = only && all.includes(only) ? only : pick(all, rng)
  const closest = all
    .filter((k) => k !== key)
    .map((k) => ({ k, d: Math.abs(KEYS[k].count - KEYS[key].count) + rng() / 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((c) => c.k)
  const options = all.length > 4 ? KEY_ORDER.filter((k) => k === key || closest.includes(k)) : all
  return { id, kind: 'keyName', key, options, facts: [`key:${key}`] }
}

/** Natural letters across the written range a region can play. */
function writtenSpots(region: Region): Spot[] {
  const ws = allPositions(region).map((p) => midiAt(p) + WRITTEN_OCTAVE_SHIFT)
  const lo = Math.min(...ws)
  const hi = Math.max(...ws)
  const spots: Spot[] = []
  for (let d = staffDegree({ letter: 'C', octave: 3 }); d <= staffDegree({ letter: 'C', octave: 6 }); d++) {
    const s = atDegree(d)
    const w = spelledMidi({ ...s, acc: 0 })
    if (w >= lo && w <= hi) spots.push(s)
  }
  return spots
}

/**
 * A note with a key signature in front of it: name it, or find where it's played.
 * Half the time it's one of the letters the key changes, so the signature always matters.
 */
export function makeKeyNote(id: number, key: KeyId, mode: 'name' | 'find', region: Region, rng: Rng): Question | null {
  const spots = writtenSpots(region)
  const altered = spots.filter((s) => KEYS[key].altered[s.letter])
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = pick(altered.length && rng() < 0.5 ? altered : spots, rng)
    const shown = note(s, 'w')
    const targets = positionsForMidi(sounding([[shown]], key, 0), region)
    if (targets.length) return { id, kind: 'keyNote', key, note: shown, mode, region, targets, facts: [`key:${key}`] }
  }
  return null
}

const SIZES: Record<MotionKind, () => number> = { same: () => 0, step: () => 1, skip: () => 2, leap: () => 3 }

/** Two notes: is the second the same, a step, a skip or a leap away, and which way? */
export function makeMotion(id: number, kinds: MotionKind[], rng: Rng, only?: MotionKind): Question {
  const kind = only ?? pick(kinds, rng)
  // Leaps are a 4th to a 6th: wide enough to see, close enough to count.
  const size = kind === 'leap' ? 3 + Math.floor(rng() * 3) : SIZES[kind]()
  const dir = size === 0 || rng() < 0.5 ? 1 : -1
  const lo = Math.max(MIDDLE_C, MIDDLE_C - dir * size)
  const hi = Math.min(HIGH_A, HIGH_A - dir * size)
  const from = lo + Math.floor(rng() * (hi - lo + 1))
  return {
    id,
    kind: 'motion',
    from: note(atDegree(from), 'w'),
    to: note(atDegree(from + dir * size), 'w'),
    options: motionOptions(kinds),
    facts: [`motion:${kind}`],
  }
}

/**
 * A short melody (3 or 4 notes) to play in order on the fretboard. It moves mostly by step,
 * sometimes by skip, now and then a leap, the way real tunes do.
 */
export function makePhrase(id: number, key: KeyId, region: Region, length: number, rng: Rng): Question | null {
  const playable = (s: Spot) => positionsForMidi(sounding([[note(s)]], key, 0), region).length > 0
  const pool = writtenSpots(region).filter((s) => staffDegree(s) >= MIDDLE_C && playable(s))
  if (pool.length < 3) return null
  for (let attempt = 0; attempt < 30; attempt++) {
    const spots: Spot[] = [pick(pool, rng)]
    for (let guard = 0; spots.length < length && guard < 50; guard++) {
      const r = rng()
      const size = r < 0.55 ? 1 : r < 0.8 ? 2 : r < 0.9 ? 0 : 3
      const next = stepFrom(spots[spots.length - 1], size * (rng() < 0.5 ? 1 : -1))
      if (pool.some((p) => p.letter === next.letter && p.octave === next.octave)) spots.push(next)
    }
    if (spots.length < length) continue
    const durs: ScoreNote['dur'][] = length === 4 ? ['q', 'q', 'q', 'q'] : ['q', 'q', 'h']
    const measures: ScoreMeasure[] = [spots.map((s, i) => note(s, durs[i]))]
    const targets: Position[][] = spots.map((_, i) => positionsForMidi(sounding(measures, key, i), region))
    const staffKeys = [...new Set(resolveNotes(measures, key).map((n) => `staff:${spelledMidi(n)}`))]
    return { id, kind: 'phrase', measures, key, region, targets, facts: ['skill:phrase', ...staffKeys] }
  }
  return null
}

/** The pitch class a reading question's answer is, for checking button answers. */
export function readingAnswerPc(q: Question): number | null {
  if (q.kind === 'accidentalRule') return pitchClass(spelledMidi(resolveNotes(q.measures)[q.target]))
  if (q.kind === 'keyNote') return pitchClass(spelledMidi(resolveNotes([[q.note]], q.key)[0]))
  return null
}
