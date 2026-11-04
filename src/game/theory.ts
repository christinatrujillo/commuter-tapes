import type { Card } from './rehearsal'
import type { Marker } from '../components/Fretboard'
import type { LessonSpec } from '../music/curriculum'
import {
  ALL_STRINGS,
  allPositions,
  FULL_NECK,
  LETTERS,
  midiAt,
  noteAt,
  pcName,
  pitchClass,
  positionsForPc,
  samePos,
  spelledMidi,
  WRITTEN_OCTAVE_SHIFT,
  type Position,
  type Region,
} from '../music/notes'
import { KEY_ORDER, KEYS, keyLabel, resolveNotes, type KeyId, type ScoreMeasure, type ScoreNote } from '../music/score'
import {
  degreeName,
  KEY_ON_PC,
  MAJOR_STEPS,
  majorKeyOfMinor,
  majorName,
  majorScale,
  minorName,
  naturalMinorScale,
  parseTone,
  relativeMinor,
  spellOn,
  toneId,
  toneName,
  tonePc,
  type Tone,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { capitalize } from '../lib/text'
import type { Question } from './questions'
import { INTERVAL_ORDER, intervalCard, intervalCheck, intervalItemFor, intervalReview, isIntervalItem } from './intervals'

/**
 * Theory questions and teaching: whole and half steps, the major scale and its patterns on the
 * neck, the circle of fifths, and relative minor keys.
 */

const HALF = 'Half step'
const WHOLE = 'Whole step'
const stepWord = (semitones: number) => (semitones === 1 ? 'half step' : 'whole step')
const fretsWord = (semitones: number) => (semitones === 1 ? 'one fret' : `${semitones} frets`)
const HIGHLIGHT = '#b8862e'

/** A few frets of one string around the notes in play, so the board stays readable. */
function stringWindow(string: number, frets: number[]): Region {
  const lo = Math.max(0, Math.min(...frets) - 2)
  const hi = Math.min(12, Math.max(lo + 5, Math.max(...frets) + 2))
  return { strings: [string], minFret: Math.max(0, Math.min(lo, hi - 5)), maxFret: hi }
}

// ---------------------------------------------------------------------------
// Whole and half steps
// ---------------------------------------------------------------------------

/** Two notes on one string: a half step or a whole step apart? */
export function makeStepSize(id: number, region: Region, rng: Rng, only?: 1 | 2): Question {
  const semitones = only ?? (rng() < 0.5 ? 1 : 2)
  const string = pick(region.strings, rng)
  const low = between(region.minFret, region.maxFret - semitones, rng)
  const [a, b] = rng() < 0.5 ? [low, low + semitones] : [low + semitones, low]
  const from = { string, fret: a }
  const to = { string, fret: b }
  return {
    id,
    kind: 'stepSize',
    ask: { text: 'Half step or whole step?' },
    options: [HALF, WHOLE],
    answer: semitones - 1,
    why: `${noteAt(from)} to ${noteAt(to)}: ${fretsWord(semitones)} apart, so it’s a ${stepWord(semitones)}.`,
    board: {
      region: stringWindow(string, [a, b]),
      markers: [
        { pos: from, tone: 'root' },
        { pos: to, tone: 'target' },
      ],
      after: [
        { pos: from, tone: 'root', label: noteAt(from) },
        { pos: to, tone: 'correct', label: noteAt(to) },
      ],
    },
    sound: [midiAt(from), midiAt(to)],
    facts: [semitones === 1 ? 'step:half' : 'step:whole'],
  }
}

/** A note on one string: tap the note a half or whole step above or below it. */
export function makeStepFind(id: number, region: Region, rng: Rng, only?: 1 | 2): Question {
  const semitones = only ?? (rng() < 0.5 ? 1 : 2)
  const up = rng() < 0.5
  const string = pick(region.strings, rng)
  const fret = up ? between(region.minFret, region.maxFret - semitones, rng) : between(region.minFret + semitones, region.maxFret, rng)
  const from = { string, fret }
  const target = { string, fret: fret + (up ? semitones : -semitones) }
  const where = `${stepWord(semitones)} ${up ? 'above' : 'below'}`
  return {
    id,
    kind: 'stepFind',
    ask: { text: `Tap a ${where} this ${noteAt(from)}`, hl: where },
    region: stringWindow(string, [fret, target.fret]),
    markers: [{ pos: from, tone: 'root', label: noteAt(from) }],
    from,
    targets: [target],
    label: noteAt(target),
    why: `${noteAt(target)} is ${fretsWord(semitones)} ${up ? 'above' : 'below'} ${noteAt(from)}.`,
    facts: [semitones === 1 ? 'step:half' : 'step:whole'],
  }
}

// The staff from the bottom line up, so neighboring letters fit on it.
const STAFF_SPOTS: { letter: ScoreNote['letter']; octave: number }[] = [
  ...(['E', 'F', 'G', 'A', 'B'] as const).map((letter) => ({ letter, octave: 4 })),
  ...(['C', 'D', 'E', 'F'] as const).map((letter) => ({ letter, octave: 5 })),
]

/** Two neighboring letters on the staff: half step or whole step? Only E–F and B–C are half steps. */
export function makeStepRead(id: number, rng: Rng, only?: 1 | 2): Question {
  const pairs = STAFF_SPOTS.slice(0, -1)
    .map((lo, i) => ({ lo, hi: STAFF_SPOTS[i + 1] }))
    .map((p) => ({ ...p, semitones: (p.lo.letter === 'E' || p.lo.letter === 'B' ? 1 : 2) as 1 | 2 }))
    .filter((p) => !only || p.semitones === only)
  const { lo, hi, semitones } = pick(pairs, rng)
  const [a, b] = rng() < 0.5 ? [lo, hi] : [hi, lo]
  const measures: ScoreMeasure[] = [[{ ...a, dur: 'w' }, { ...b, dur: 'w' }]]
  const gap = pcName(pitchClass(spelledMidi({ ...lo, acc: 0 }) + 1))
  return {
    id,
    kind: 'stepRead',
    ask: { text: 'Half step or whole step?' },
    options: [HALF, WHOLE],
    answer: semitones - 1,
    why:
      semitones === 1
        ? `${a.letter} to ${b.letter}: there’s no note between them, so it’s a half step.`
        : `${a.letter} to ${b.letter}: ${gap} sits between them, so it’s a whole step.`,
    score: { measures, after: [a.letter, b.letter] },
    sound: soundOf(measures),
    facts: [semitones === 1 ? 'step:half' : 'step:whole'],
  }
}

const STEP_STARTS: Tone[] = [...LETTERS.map((letter): Tone => ({ letter, acc: 0 })), parseTone('F#'), parseTone('Bb'), parseTone('Eb'), parseTone('C#')]

/** "What's a whole step above E?" Answered on the note keyboard. */
export function makeStepNote(id: number, rng: Rng, only?: 1 | 2): Question {
  const semitones = only ?? (rng() < 0.5 ? 1 : 2)
  const up = rng() < 0.5
  const from = pick(STEP_STARTS, rng)
  const pc = pitchClass(tonePc(from) + (up ? semitones : -semitones))
  const name = pcName(pc, up ? 'sharp' : 'flat')
  const where = `${stepWord(semitones)} ${up ? 'above' : 'below'} ${toneName(from)}`
  const start = 52 + pitchClass(tonePc(from) - 4)
  return {
    id,
    kind: 'stepNote',
    ask: { text: `What’s a ${where}?`, hl: where },
    options: 'notes',
    answer: pc,
    why: `${capitalize(where)} is ${name}: ${fretsWord(semitones)} ${up ? 'up' : 'down'}.`,
    sound: [start, start + (up ? semitones : -semitones)],
    facts: [semitones === 1 ? 'step:half' : 'step:whole'],
  }
}

// ---------------------------------------------------------------------------
// Major and minor scales
// ---------------------------------------------------------------------------

/** A scale written out on the staff, one octave up from the tonic, in two measures of four. */
function scaleScore(tones: Tone[]): ScoreMeasure[] {
  const start = LETTERS.indexOf(tones[0].letter)
  const notes = [...tones, tones[0]].map(
    (t, i): ScoreNote => ({
      letter: t.letter,
      octave: 4 + (i === 7 || LETTERS.indexOf(t.letter) < start ? 1 : 0),
      dur: 'q',
      ...(t.acc ? { sign: t.acc } : {}),
    }),
  )
  return [notes.slice(0, 4), notes.slice(4)]
}

const soundOf = (measures: ScoreMeasure[], key: KeyId = 'C') => resolveNotes(measures, key).map((n) => spelledMidi(n) - WRITTEN_OCTAVE_SHIFT)
const scaleNames = (tones: Tone[]) => [...tones, tones[0]].map(toneName).join(' ')

/** In a major scale, is it a half or a whole step from one note to the next? */
export function makeScaleStep(id: number, rng: Rng, only?: number): Question {
  const key = pick<KeyId>(['C', 'G', 'D', 'F'], rng)
  const tones = majorScale(key)
  const d = only ?? between(1, 7, rng)
  const semitones = MAJOR_STEPS[d - 1]
  const measures = scaleScore(tones)
  const names = [...tones, tones[0]].map(toneName)
  const span = `${degreeName(d)} note to the ${degreeName(d + 1)}`
  return {
    id,
    kind: 'scaleStep',
    ask: { text: `In a major scale, from the ${span}: half or whole step?`, hl: span },
    options: [HALF, WHOLE],
    answer: semitones - 1,
    why: `Whole, whole, half, whole, whole, whole, half: ${d} to ${d + 1} is a ${stepWord(semitones)} (${names[d - 1]} to ${names[d]} in ${majorName(key)}).`,
    score: {
      measures,
      labels: names.map((_, i) => String(i + 1)),
      colors: names.map((_, i) => (i === d - 1 || i === d ? HIGHLIGHT : undefined)),
      marker: d - 1,
    },
    sound: soundOf(measures).slice(d - 1, d + 1),
    facts: ['scale:formula'],
  }
}

/** Wrong answers worth considering: the other spelling of the same note, the same letter changed, and its neighbors in the scale. */
function noteChoices(tones: Tone[], d: number, rng: Rng): { options: string[]; answer: number; respelled?: string } {
  const right = tones[d - 1]
  const next = LETTERS[(LETTERS.indexOf(right.letter) + 1) % 7]
  const prev = LETTERS[(LETTERS.indexOf(right.letter) + 6) % 7]
  const pc = tonePc(right)
  const respelled = right.acc === 1 ? spellOn(next, pc) : right.acc === -1 ? spellOn(prev, pc) : null
  // A natural note gets the key's kind of sign, unless that makes a rare name like E♯ or C♭.
  let sign: Tone['acc'] = tones.some((t) => t.acc === -1) ? -1 : 1
  if (sign === 1 && (right.letter === 'E' || right.letter === 'B')) sign = -1
  if (sign === -1 && (right.letter === 'C' || right.letter === 'F')) sign = 1
  const changed: Tone = { letter: right.letter, acc: right.acc !== 0 ? 0 : sign }
  const candidates = [respelled, changed, tones[d - 2], tones[d % 7]].filter((t): t is Tone => !!t)
  const names = [...new Set([toneName(right), ...candidates.map(toneName)])].slice(0, 4)
  const options = shuffle(names, rng)
  return { options, answer: options.indexOf(toneName(right)), respelled: respelled ? toneName(respelled) : undefined }
}

function scaleNoteQuestion(id: number, kind: 'scaleNote' | 'minorNote', tones: Tone[], name: string, fact: string, rng: Rng, only?: number): Question {
  // Mostly the notes that need a sharp or flat, when there are any: that's where scales go wrong.
  const altered = [2, 3, 4, 5, 6, 7].filter((d) => tones[d - 1].acc !== 0)
  const d = only ?? (altered.length && rng() < 0.6 ? pick(altered, rng) : between(2, 7, rng))
  const { options, answer, respelled } = noteChoices(tones, d, rng)
  const right = toneName(tones[d - 1])
  const what = `${degreeName(d)} note of ${name}`
  const rule = respelled && options.includes(respelled) ? ` Each letter appears once, so it’s ${right}, not ${respelled}.` : ''
  const measures = scaleScore(tones)
  const sound = soundOf(measures)
  return {
    id,
    kind,
    ask: { text: `What’s the ${what}?`, hl: what },
    options,
    answer,
    why: `${capitalize(name)}: ${scaleNames(tones)}. The ${degreeName(d)} is ${right}.${rule}`,
    sound: [sound[0], sound[d - 1]],
    facts: [fact],
  }
}

/** "What's the 5th note of G major?" */
export function makeScaleNote(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(keys, rng)
  return scaleNoteQuestion(id, 'scaleNote', majorScale(key), majorName(key), `scale:${key}`, rng)
}

/** "What's the 3rd note of E minor?", for the relative minors of `keys`. */
export function makeMinorNote(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(keys, rng)
  return scaleNoteQuestion(id, 'minorNote', naturalMinorScale(key), minorName(key), `minor:${toneId(relativeMinor(key))}`, rng)
}

// ---------------------------------------------------------------------------
// The major scale on the neck
// ---------------------------------------------------------------------------

/**
 * A major scale in one position: the root on the 6th or 5th string, and every scale note from
 * one fret below the root to three above, on all six strings.
 */
function scalePattern(rootString: number, fret: number) {
  const root = { string: rootString, fret }
  const key = KEY_ON_PC[pitchClass(midiAt(root))]
  const tones = majorScale(key)
  const pcs = tones.map(tonePc)
  const region: Region = { strings: ALL_STRINGS, minFret: fret - 1, maxFret: fret + 3 }
  const notes = allPositions(region).filter((p) => pcs.includes(pitchClass(midiAt(p))))
  const degreeOf = (p: Position) => pcs.indexOf(pitchClass(midiAt(p))) + 1
  return { root, key, tones, region, notes, degreeOf }
}

const patternRoots = (rootStrings: number[]) => {
  const roots = rootStrings.filter((s) => s <= 1)
  return roots.length ? roots : [0, 1]
}

/** A scale pattern with one note marked: which degree is it? */
export function makeDegreeName(id: number, rootStrings: number[], rng: Rng, only?: number): Question | null {
  const { root, key, tones, region, notes, degreeOf } = scalePattern(pick(patternRoots(rootStrings), rng), between(2, 8, rng))
  const choices = notes.filter((p) => !samePos(p, root) && (!only || degreeOf(p) === only))
  if (!choices.length) return null
  const target = pick(choices, rng)
  const d = degreeOf(target)
  const others = notes.filter((p) => !samePos(p, root) && !samePos(p, target))
  return {
    id,
    kind: 'degreeName',
    ask: { text: `Which degree of ${keyLabel(key)} major is the marked note?`, hl: `${keyLabel(key)} major` },
    options: ['1', '2', '3', '4', '5', '6', '7'],
    answer: d - 1,
    why: `${toneName(tones[d - 1])} is the ${degreeName(d)} of ${majorName(key)}.`,
    board: {
      region,
      markers: [...others.map((p): Marker => ({ pos: p, tone: 'note' })), { pos: root, tone: 'root', label: keyLabel(key) }, { pos: target, tone: 'target', label: '?' }],
      after: [
        ...others.map((p): Marker => ({ pos: p, tone: 'note', label: String(degreeOf(p)) })),
        { pos: root, tone: 'root', label: '1' },
        { pos: target, tone: 'correct', label: String(d) },
      ],
    },
    sound: [midiAt(root), midiAt(target)],
    facts: [`degree:${d}`],
  }
}

/** A scale pattern around a root: tap a given degree. */
export function makeDegreeFind(id: number, rootStrings: number[], rng: Rng, only?: number): Question {
  const { root, key, tones, region, notes, degreeOf } = scalePattern(pick(patternRoots(rootStrings), rng), between(2, 8, rng))
  const d = only ?? between(2, 7, rng)
  const what = degreeName(d)
  return {
    id,
    kind: 'degreeFind',
    ask: { text: `Tap the ${what} of ${keyLabel(key)} major`, hl: what },
    region,
    markers: [...notes.filter((p) => !samePos(p, root)).map((p): Marker => ({ pos: p, tone: 'note' })), { pos: root, tone: 'root', label: keyLabel(key) }],
    from: root,
    targets: notes.filter((p) => degreeOf(p) === d),
    label: String(d),
    why: `${toneName(tones[d - 1])} is the ${degreeName(d)} of ${majorName(key)}.`,
    facts: [`degree:${d}`],
  }
}

// ---------------------------------------------------------------------------
// Key signatures and the circle of fifths
// ---------------------------------------------------------------------------

const countLabel = (count: number) => {
  const n = Math.abs(count)
  return n === 0 ? 'No sharps or flats' : `${n} ${count > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`
}

/** "How many sharps or flats does A major have?" */
export function makeKeySignature(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(keys, rng)
  const count = KEYS[key].count
  // One more and one fewer of the same kind, and the same number of the other kind.
  const near = count === 0 ? [1, -1, 2] : [count + Math.sign(count), count - Math.sign(count), -count]
  const counts = [...new Set([count, ...near.filter((c) => Math.abs(c) <= 7)])].sort((a, b) => b - a)
  return {
    id,
    kind: 'keySignature',
    ask: { text: `How many sharps or flats does ${majorName(key)} have?`, hl: majorName(key) },
    options: counts.map(countLabel),
    answer: counts.indexOf(count),
    why: `${majorName(key)}: ${KEYS[key].signature}.`,
    sound: [48 + tonePc(parseTone(key))],
    facts: [`key:${key}`],
  }
}

// ---------------------------------------------------------------------------
// Relative minor
// ---------------------------------------------------------------------------

/** "What's the relative minor of G major?", or the other way round. */
export function makeRelativeKey(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(keys, rng)
  const major = majorScale(key)
  const minor = naturalMinorScale(key)
  const toMinor = rng() < 0.5
  const right = toMinor ? minorName(key) : majorName(key)
  // The usual mix-ups: the minor key on the same note, or the wrong scale degree.
  const wrong = toMinor
    ? [`${keyLabel(key)} minor`, `${toneName(major[1])} minor`, `${toneName(major[2])} minor`]
    : [`${toneName(minor[0])} major`, `${toneName(minor[5])} major`, `${toneName(minor[6])} major`]
  const options = shuffle([right, ...wrong], rng)
  const tonic = 48 + tonePc(major[0])
  return {
    id,
    kind: 'relativeKey',
    ask: toMinor
      ? { text: `What’s the relative minor of ${majorName(key)}?`, hl: 'relative minor' }
      : { text: `What’s the relative major of ${minorName(key)}?`, hl: 'relative major' },
    options,
    answer: options.indexOf(right),
    why: toMinor
      ? `${minorName(key)} shares ${majorName(key)}’s key signature (${KEYS[key].signature}). It starts on the 6th note of ${majorName(key)}.`
      : `${majorName(key)} shares ${minorName(key)}’s key signature (${KEYS[key].signature}). It starts 3 frets (a minor 3rd) above ${toneName(minor[0])}.`,
    score: { measures: [[]], keySig: key },
    sound: [tonic, tonic - 3],
    facts: [`rel:${key}`],
  }
}

/** A major key's root on one string: tap its relative minor, 3 frets down the same string. */
export function makeRelativeFind(id: number, region: Region, rng: Rng, only?: KeyId): Question {
  const spots = allPositions({ strings: region.strings, minFret: 3, maxFret: 12 }).filter(
    (p) => !only || pitchClass(midiAt(p)) === tonePc(parseTone(only)),
  )
  const from = pick(spots, rng)
  const key = only ?? KEY_ON_PC[pitchClass(midiAt(from))]
  const minor = toneName(relativeMinor(key))
  const view = { strings: [from.string], minFret: Math.max(0, from.fret - 5), maxFret: Math.min(12, from.fret + 2) }
  return {
    id,
    kind: 'relativeFind',
    ask: { text: `Tap the relative minor of this ${keyLabel(key)}`, hl: 'relative minor' },
    region: view,
    markers: [{ pos: from, tone: 'root', label: keyLabel(key) }],
    from,
    targets: positionsForPc(midiAt(from) - 3, view),
    label: minor,
    why: `${minor} minor is ${majorName(key)}’s relative minor: 3 frets down from ${keyLabel(key)}.`,
    facts: [`rel:${key}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching: one card per idea, and quick checks on it
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const THEORY_ORDER = [
  'step:half',
  'step:whole',
  'step:letters',
  'step:accidentals',
  'scale:formula',
  'scale:degrees',
  'scale:letters',
  'pattern:6',
  'pattern:5',
  'circle:sharps',
  'circle:flats',
  'rel:keys',
  'rel:neck',
  'minor:scale',
  ...INTERVAL_ORDER,
]

export const isTheoryItem = (item: string) => /^(step|scale|pattern|circle|rel|minor):/.test(item) || isIntervalItem(item)

const SHARP_KEYS = KEY_ORDER.filter((k) => KEYS[k].count > 0)
const FLAT_KEYS = KEY_ORDER.filter((k) => KEYS[k].count < 0)
/** Keys with their own reading card on the Key signatures tape. */
const READ_KEYS: KeyId[] = ['C', 'G', 'D', 'F']

/** The idea a practiced fact belongs to, for the theory facts that don't share its name. */
export function theoryItemFor(fact: string): string | null {
  const interval = intervalItemFor(fact)
  if (interval) return interval
  const [kind, value] = fact.split(':')
  if (kind === 'scale' && value !== 'formula') return 'scale:degrees'
  if (kind === 'minor') return 'minor:scale'
  if (kind === 'degree') return 'pattern:6'
  if (kind === 'rel') return 'rel:keys'
  if (kind === 'key' && !READ_KEYS.includes(value as KeyId)) return KEYS[value as KeyId]?.count > 0 ? 'circle:sharps' : 'circle:flats'
  return null
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function theoryCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  if (isIntervalItem(item)) return intervalCheck(item, l, turn, rng, id)
  const keys = l.keys ?? ['C']
  const even = turn % 2 === 0
  switch (item) {
    case 'step:half':
    case 'step:whole': {
      const size = item === 'step:half' ? 1 : 2
      return even ? makeStepSize(id, l.region, rng, size) : makeStepFind(id, l.region, rng, size)
    }
    case 'step:letters':
      return makeStepRead(id, rng)
    case 'step:accidentals':
      return makeStepNote(id, rng)
    case 'scale:formula':
      return makeScaleStep(id, rng)
    case 'scale:degrees':
    case 'scale:letters':
      return makeScaleNote(id, keys, rng)
    case 'pattern:6':
    case 'pattern:5': {
      const strings = [item === 'pattern:6' ? 0 : 1]
      return even ? makeDegreeName(id, strings, rng) : makeDegreeFind(id, strings, rng)
    }
    case 'circle:sharps':
    case 'circle:flats': {
      const side = keys.filter((k) => (item === 'circle:sharps' ? KEYS[k].count > 0 : KEYS[k].count < 0))
      return makeKeySignature(id, side.length ? side : item === 'circle:sharps' ? SHARP_KEYS : FLAT_KEYS, rng)
    }
    case 'rel:keys':
      return makeRelativeKey(id, keys, rng)
    case 'rel:neck':
      return makeRelativeFind(id, l.region, rng)
    case 'minor:scale':
      return makeMinorNote(id, keys, rng)
    default:
      return null
  }
}

/** A review question on one theory fact, or null if it isn't one. */
export function theoryReview(fact: string, id: number, rng: Rng): Question | null {
  if (intervalItemFor(fact)) return intervalReview(fact, id, rng)
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'step': {
      const size = value === 'half' ? 1 : 2
      return rng() < 0.5 ? makeStepNote(id, rng, size) : makeStepSize(id, FULL_NECK, rng, size)
    }
    case 'scale':
      return value === 'formula' ? makeScaleStep(id, rng) : makeScaleNote(id, [value as KeyId], rng)
    case 'minor': {
      const key = majorKeyOfMinor(value)
      return key ? makeMinorNote(id, [key], rng) : null
    }
    case 'degree': {
      const d = Number(value)
      return rng() < 0.5 ? makeDegreeName(id, [0, 1], rng, d) : makeDegreeFind(id, [0, 1], rng, d)
    }
    case 'key':
      return READ_KEYS.includes(value as KeyId) || !KEYS[value as KeyId] ? null : makeKeySignature(id, [value as KeyId], rng)
    case 'rel':
      return KEYS[value as KeyId] ? makeRelativeKey(id, [value as KeyId], rng) : null
    default:
      return null
  }
}

// Worked examples for the cards.
const A_STRING = 1
const on = (string: number, fret: number, tone: Marker['tone'] = 'target'): Marker => ({ pos: { string, fret }, tone, label: noteAt({ string, fret }) })

function patternBoard(rootString: number, fret: number): Card['board'] {
  const { root, region, notes, degreeOf } = scalePattern(rootString, fret)
  return {
    region,
    markers: notes.map((p): Marker => (samePos(p, root) ? { pos: p, tone: 'root', label: '1' } : { pos: p, tone: 'note', label: String(degreeOf(p)) })),
  }
}

function scaleCard(tones: Tone[], labels: 'degrees' | 'names', marker?: number): Pick<Card, 'score' | 'sound'> {
  const measures = scaleScore(tones)
  const names = [...tones, tones[0]].map(toneName)
  return {
    score: { measures, labels: labels === 'degrees' ? names.map((_, i) => String(i + 1)) : names, marker: marker ?? null },
    sound: soundOf(measures),
  }
}

const THEORY_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'step:half': () => ({
    title: 'Half step',
    subtitle: 'One fret',
    hook: 'The smallest step in music: one fret along the same string. B to C is a half step, and so is C to C♯.',
    board: { region: { strings: [A_STRING], minFret: 0, maxFret: 5 }, markers: [on(A_STRING, 2), on(A_STRING, 3)] },
    sound: [47, 48],
  }),
  'step:whole': () => ({
    title: 'Whole step',
    subtitle: 'Two frets',
    hook: 'Two half steps make a whole step: two frets along the same string. C to D is a whole step, with C♯ in between.',
    board: { region: { strings: [A_STRING], minFret: 1, maxFret: 6 }, markers: [on(A_STRING, 3), on(A_STRING, 4, 'accidental'), on(A_STRING, 5)] },
    sound: [48, 50],
  }),
  'step:letters': () => ({
    title: 'E–F and B–C',
    subtitle: 'The two natural half steps',
    hook: 'Most neighboring letters are a whole step apart, with a sharp or flat in between. E–F and B–C have nothing in between: they’re half steps.',
    board: {
      region: { strings: [A_STRING], minFret: 0, maxFret: 12 },
      markers: [0, 2, 3, 5, 7, 8, 10, 12].map((f) => on(A_STRING, f, [2, 3, 7, 8].includes(f) ? 'target' : 'note')),
    },
    sound: [45, 47, 48, 50, 52, 53, 55, 57],
  }),
  'step:accidentals': () => ({
    title: 'Steps from any note',
    subtitle: 'Sharps and flats fill the gaps',
    hook: 'A sharp is a half step up and a flat is a half step down. A whole step above E skips over F and lands on F♯. A half step below C is B.',
    board: { region: { strings: [2], minFret: 0, maxFret: 6 }, markers: [on(2, 2), on(2, 3, 'note'), on(2, 4)] },
    sound: [52, 54],
  }),
  'scale:formula': () => ({
    title: 'The major scale',
    subtitle: 'W W H W W W H',
    hook: 'Every major scale takes the same steps: whole, whole, half, whole, whole, whole, half. The half steps are between notes 3–4 and 7–8. In C major those are E–F and B–C, so C major needs no sharps or flats.',
    ...scaleCard(majorScale('C'), 'degrees'),
  }),
  'scale:degrees': () => ({
    title: 'Scale degrees',
    subtitle: 'Numbering the notes',
    hook: 'Number the notes up from the root: in G major, G is 1, A is 2, B is 3, and so on. The 7th is F♯, a half step below G, and the 8th is G again.',
    ...scaleCard(majorScale('G'), 'names', 6),
  }),
  'scale:letters': () => ({
    title: 'One of each letter',
    subtitle: 'How scales are spelled',
    hook: 'A major scale uses every letter once, in order. F major’s 4th note is B♭, not A♯, because A is already its 3rd. That’s why a key has only sharps or only flats.',
    ...scaleCard(majorScale('F'), 'names', 3),
  }),
  'pattern:6': () => ({
    title: 'Root on the 6th string',
    subtitle: 'G major at the 3rd fret',
    hook: 'With the root on the 6th string, the whole scale fits in five frets. Learn where each number sits around the root, and the same shape plays any major scale: slide it up two frets and it’s A major.',
    board: patternBoard(0, 3),
    sound: [43, 45, 47, 48, 50, 52, 54, 55],
  }),
  'pattern:5': () => ({
    title: 'Root on the 5th string',
    subtitle: 'C major at the 3rd fret',
    hook: 'Put the root on the 5th string and the scale makes a second shape, still within five frets. Between the two shapes, you can find any major scale almost anywhere on the neck.',
    board: patternBoard(1, 3),
    sound: [48, 50, 52, 53, 55, 57, 59, 60],
  }),
  'circle:sharps': () => ({
    title: 'Sharp keys',
    subtitle: 'Clockwise: G D A E B F♯ C♯',
    hook: 'Each step clockwise around the circle is a fifth up and adds one sharp, always in the order F C G D A E B. To name a sharp key, go a half step up from the last sharp: E major’s last sharp is D♯.',
    circle: { majors: SHARP_KEYS },
    score: { measures: [[]], keySig: 'E' },
    sound: [],
  }),
  'circle:flats': () => ({
    title: 'Flat keys',
    subtitle: 'Counterclockwise: F B♭ E♭ A♭ D♭ G♭ C♭',
    hook: 'Each step counterclockwise is a fifth down and adds one flat, in the order B E A D G C F. A flat key is named after its second-to-last flat: B♭ E♭ A♭ is E♭ major. One flat is F major.',
    circle: { majors: FLAT_KEYS },
    score: { measures: [[]], keySig: 'Eb' },
    sound: [],
  }),
  'rel:keys': () => ({
    title: 'Relative minor',
    subtitle: 'Same key signature, different home',
    hook: 'Every major key shares its key signature with a minor key, its relative minor. The relative minor starts on the 6th note of the major scale: C major and A minor, G major and E minor.',
    circle: { majors: ['C', 'G'], minors: ['C', 'G'] },
    sound: [48, 45],
  }),
  'rel:neck': () => ({
    title: '3 frets down',
    subtitle: 'Finding it on the neck',
    hook: 'The relative minor sits a minor 3rd below the major key’s root: 3 frets down the same string. From C at the 3rd fret of the 5th string, go down to the open A.',
    board: { region: { strings: [A_STRING], minFret: 0, maxFret: 5 }, markers: [{ ...on(A_STRING, 3), tone: 'root' }, on(A_STRING, 0)] },
    sound: [48, 45],
  }),
  'minor:scale': () => ({
    title: 'The natural minor scale',
    subtitle: 'W H W W H W W',
    hook: 'A natural minor scale uses its relative major’s notes, starting from the 6th. A minor has the same notes as C major: A B C D E F G. Its steps are whole, half, whole, whole, half, whole, whole.',
    ...scaleCard(naturalMinorScale('C'), 'names'),
  }),
}

/** The card that teaches a theory idea. */
export function theoryCard(item: string, counter: string): Card {
  return isIntervalItem(item) ? intervalCard(item, counter) : { ...THEORY_CARDS[item](), counter }
}
