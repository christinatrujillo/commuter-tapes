import type { Card } from './rehearsal'
import type { Marker } from '../components/Fretboard'
import type { LessonSpec } from '../music/curriculum'
import {
  ALL_STRINGS,
  allPositions,
  FULL_NECK,
  isNatural,
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
  scaleScore,
  spellOn,
  toneId,
  toneName,
  tonePc,
  type Tone,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { capitalize } from '../lib/text'
import { PAPER_HIGHLIGHT as HIGHLIGHT } from '../lib/color'
import type { PickQuestion, Question } from './questions'
import { makeKeyName } from './reading'
import { INTERVAL_ORDER, intervalCard, intervalCheck, intervalItemFor, intervalReview, isIntervalItem, on } from './intervals'
import { isTriadFact, isTriadItem, TRIAD_INTRO, TRIAD_ORDER, triadCard, triadCheck, triadItemFor, triadReview } from './triads'
import { HARMONY_INTRO, HARMONY_ORDER, harmonyCard, harmonyCheck, harmonyItemFor, harmonyReview, isHarmonyFact, isHarmonyItem } from './harmony'

/**
 * Theory questions and teaching: whole and half steps, the major scale and its patterns on the
 * neck, the circle of fifths, and relative minor keys. Intervals and triads have files of their
 * own (so do chords in a key); everything theory reaches them through here.
 */

const HALF = 'Half step'
const WHOLE = 'Whole step'
const stepWord = (semitones: number) => (semitones === 1 ? 'half step' : 'whole step')
const fretsWord = (semitones: number) => (semitones === 1 ? 'one fret' : `${semitones} frets`)

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

const soundOf = (measures: ScoreMeasure[], key: KeyId = 'C') => resolveNotes(measures, key).map((n) => spelledMidi(n) - WRITTEN_OCTAVE_SHIFT)

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
    why: `Count up the ${name} scale from its root: ${tones.slice(0, d).map(toneName).join(' ')}. The ${degreeName(d)} is ${right}.${rule}`,
    ...(kind === 'scaleNote' ? { board: rootBoard(tones, d) } : {}),
    sound: [sound[0], sound[d - 1]],
    facts: [fact],
  }
}

/**
 * The scale's root on the neck, in the shape from tape 24 (root on the 6th or 5th string); once
 * answered, every note of the shape appears, spelled, with the asked-about degree lit.
 */
function rootBoard(tones: Tone[], d: number): NonNullable<PickQuestion['board']> {
  const pc = tonePc(tones[0])
  const low = pitchClass(pc - 4)
  const [string, fret] = low >= 2 && low <= 8 ? [0, low] : [1, pitchClass(pc - 9)]
  const { root, region, notes, degreeOf } = scalePattern(string, fret)
  return {
    region,
    markers: [{ pos: root, tone: 'root', label: toneName(tones[0]) }],
    after: notes.map((p): Marker => {
      const n = degreeOf(p)
      return { pos: p, tone: samePos(p, root) ? 'root' : n === d ? 'correct' : 'note', label: toneName(tones[n - 1]) }
    }),
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
    why: `Count up ${majorName(key)} from its root: ${tones.slice(0, d).map(toneName).join(' ')}. So ${toneName(tones[d - 1])} is the ${degreeName(d)}.`,
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
    why: `Count up ${majorName(key)} from its root: ${tones.slice(0, d).map(toneName).join(' ')}. The ${degreeName(d)} is ${toneName(tones[d - 1])}.`,
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
    why: `${majorName(key)}: ${KEYS[key].signature}. ${aroundTheCircle(key)}`,
    sound: [48 + tonePc(parseTone(key))],
    facts: [`key:${key}`],
  }
}

/** How a key's signature is reached: counting fifths around the circle from C. */
function aroundTheCircle(key: KeyId): string {
  const count = KEYS[key].count
  if (count === 0) return 'C major is the starting point of the circle.'
  const side = count > 0 ? SHARP_KEYS : FLAT_KEYS
  const steps = side.slice(0, Math.abs(count)).map((k, i) => `${keyLabel(k)} (${i + 1})`)
  return `Count ${count > 0 ? 'clockwise' : 'counterclockwise'} from C, one ${count > 0 ? 'sharp' : 'flat'} per step: ${steps.join(', ')}.`
}

/** "Count five letters up from D: which key comes next, clockwise?" */
export function makeCircleNext(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const from = only ?? pick(keys.filter((k) => KEYS[k].count >= 0 && KEYS[k].count < 7), rng)
  const next = KEY_ORDER[KEY_ORDER.indexOf(from) + 1]
  const tones = majorScale(from)
  // Near misses: four or six letters up, or the key you started on.
  const wrong = [tones[3], tones[5]].map((t) => `${toneName(t)} major`)
  const options = shuffle([...new Set([majorName(next), ...wrong, majorName(from)])], rng)
  const what = `five letters up from ${keyLabel(from)}`
  return {
    id,
    kind: 'circleNext',
    ask: { text: `Count ${what}. Which key comes next, clockwise?`, hl: what },
    options,
    answer: options.indexOf(majorName(next)),
    why: `Count five letters up from ${keyLabel(from)}: ${tones.slice(0, 5).map(toneName).join(' ')}. So the next key is ${majorName(next)}, with one more sharp: ${KEYS[next].signature}.`,
    score: { measures: [[{ letter: tones[0].letter, octave: 4, dur: 'w', ...(tones[0].acc ? { sign: tones[0].acc } : {}) }]], keySig: from, after: [`${keyLabel(from)} → ${keyLabel(next)}`] },
    sound: [48 + tonePc(tones[0]), 48 + tonePc(tones[0]) + 7],
    facts: [`key:${next}`],
  }
}

// ---------------------------------------------------------------------------
// Relative minor
// ---------------------------------------------------------------------------

/** "What's the relative minor of G major?", or the other way round. */
export function makeRelativeKey(id: number, keys: KeyId[], rng: Rng, only?: KeyId, showScale = false): Question {
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
  const majorNames = [...major, major[0]].map(toneName)
  const minorNames = [...minor, minor[0]].map(toneName)
  // Starting out, the scale is on the staff to count along; later, only the key signature.
  const score = !showScale
    ? { measures: [[]], keySig: key }
    : toMinor
      ? { measures: scaleScore(major), labels: majorNames, after: ['1', '2', '3', '4', '5', '6', '7', '8'] }
      : { measures: scaleScore(minor), labels: minorNames }
  return {
    id,
    kind: 'relativeKey',
    ask: toMinor
      ? { text: `What’s the relative minor of ${majorName(key)}?`, hl: 'relative minor' }
      : { text: `What’s the relative major of ${minorName(key)}?`, hl: 'relative major' },
    options,
    answer: options.indexOf(right),
    why: toMinor
      ? `Count up the ${majorName(key)} scale to its 6th note: ${majorNames.slice(0, 6).join(' ')}. So the relative minor is ${minorName(key)}, and both share ${KEYS[key].signature}.`
      : `${capitalize(minorName(key))}’s notes, ${minorNames.slice(0, 7).join(' ')}, are the ${majorName(key)} scale’s notes, starting from its 6th. So the relative major is ${majorName(key)}.`,
    score,
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
    why: `Count 3 frets back from ${keyLabel(key)} on the same string: ${[1, 2, 3].map((d) => pcName(pitchClass(midiAt(from) - d), 'sharp')).join(', ')}. That’s ${minor}, so the relative minor is ${minor} minor.`,
    facts: [`rel:${key}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching: one card per idea, and quick checks on it
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const THEORY_ORDER = [
  'basics:written',
  'basics:beat',
  'basics:measure',
  'basics:staff',
  'basics:clef',
  'intro:low-strings',
  'intro:fifth-fret',
  'step:why',
  'step:half',
  'step:whole',
  'step:letters',
  'step:accidentals',
  'scale:what',
  'scale:formula',
  'scale:c-major',
  'scale:build',
  'scale:degrees',
  'scale:letters',
  'pattern:why',
  'pattern:root',
  'pattern:6',
  'pattern:move',
  'pattern:5',
  'scale:key',
  'circle:why',
  'circle:fifth',
  'circle:addsharp',
  'circle:sharps',
  'circle:name-sharp',
  'circle:flats',
  'circle:name-flat',
  'circle:map',
  'rel:why',
  'rel:moods',
  'rel:home',
  'rel:sixth',
  'rel:signature',
  'rel:neck',
  'minor:scale',
  ...INTERVAL_ORDER,
  ...TRIAD_ORDER,
  ...HARMONY_ORDER,
]

/** Ideas that are explained on a card but not tested on their own (the why, the sound of major and minor, what an octave is). */
const INTRO = new Set([
  'step:why',
  'scale:what',
  'scale:key',
  'pattern:why',
  'pattern:root',
  'circle:why',
  'circle:map',
  'rel:why',
  'rel:moods',
  'ivname:parts',
  'ivstaff:why',
  'invert:what',
  'ear:why',
  ...TRIAD_INTRO,
  ...HARMONY_INTRO,
])
export const isIntroItem = (item: string) => INTRO.has(item) || /^(oct|basics|intro|ivshape):/.test(item)

export const isTheoryItem = (item: string) => /^(basics|intro|step|scale|pattern|circle|rel|minor):/.test(item) || isIntervalItem(item) || isTriadItem(item) || isHarmonyItem(item)

const SHARP_KEYS = KEY_ORDER.filter((k) => KEYS[k].count > 0)
const FLAT_KEYS = KEY_ORDER.filter((k) => KEYS[k].count < 0)
/** Keys with their own reading card on the Key signatures tape. */
const READ_KEYS: KeyId[] = ['C', 'G', 'D', 'F']

/** The idea a practiced fact belongs to, for the theory facts that don't share its name. */
export function theoryItemFor(fact: string): string | null {
  const own = intervalItemFor(fact) ?? triadItemFor(fact) ?? harmonyItemFor(fact)
  if (own) return own
  const [kind, value] = fact.split(':')
  if (kind === 'scale' && value !== 'formula') return 'scale:degrees'
  if (kind === 'minor') return 'minor:scale'
  if (kind === 'degree') return 'pattern:6'
  if (kind === 'rel') return 'rel:sixth'
  if (kind === 'key' && !READ_KEYS.includes(value as KeyId)) return KEYS[value as KeyId]?.count > 0 ? 'circle:sharps' : 'circle:flats'
  return null
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function theoryCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  if (isIntervalItem(item)) return intervalCheck(item, l, turn, rng, id)
  if (isTriadItem(item)) return triadCheck(item, l, turn, rng, id)
  if (isHarmonyItem(item)) return harmonyCheck(item, l, turn, rng, id)
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
    case 'scale:c-major':
      return makeScaleStep(id, rng)
    case 'scale:build':
    case 'scale:degrees':
    case 'scale:letters':
      return makeScaleNote(id, keys, rng)
    case 'pattern:6':
    case 'pattern:move':
    case 'pattern:5': {
      const strings = [item === 'pattern:5' ? 1 : 0]
      return even ? makeDegreeName(id, strings, rng) : makeDegreeFind(id, strings, rng)
    }
    case 'circle:fifth':
      return makeCircleNext(id, keys, rng)
    case 'circle:addsharp':
    case 'circle:sharps':
    case 'circle:name-sharp':
    case 'circle:flats':
    case 'circle:name-flat': {
      const sharps = item.includes('sharp')
      const side = keys.filter((k) => (sharps ? KEYS[k].count >= 0 : KEYS[k].count <= 0))
      const pool = side.length > 1 ? side : sharps ? ['C' as KeyId, ...SHARP_KEYS] : ['C' as KeyId, ...FLAT_KEYS]
      return item.startsWith('circle:name') || !even ? makeKeyName(id, pool, rng) : makeKeySignature(id, pool, rng)
    }
    case 'rel:home':
    case 'rel:sixth':
    case 'rel:signature':
      return makeRelativeKey(id, keys, rng, undefined, l.showScale)
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
  if (isTriadFact(fact)) return triadReview(fact, id, rng)
  if (isHarmonyFact(fact)) return harmonyReview(fact, id, rng)
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'step': {
      if (value !== 'half' && value !== 'whole') return null
      const size = value === 'half' ? 1 : 2
      return rng() < 0.5 ? makeStepNote(id, rng, size) : makeStepSize(id, FULL_NECK, rng, size)
    }
    case 'scale':
      if (value === 'formula') return makeScaleStep(id, rng)
      return isOneOf(value, KEY_ORDER) ? makeScaleNote(id, [value], rng) : null
    case 'minor': {
      const key = majorKeyOfMinor(value)
      return key ? makeMinorNote(id, [key], rng) : null
    }
    case 'degree': {
      const d = Number(value)
      if (!Number.isInteger(d) || d < 2 || d > 7) return null
      return rng() < 0.5 ? makeDegreeName(id, [0, 1], rng, d) : makeDegreeFind(id, [0, 1], rng, d)
    }
    case 'key':
      return isOneOf(value, KEY_ORDER) && !READ_KEYS.includes(value) ? makeKeySignature(id, [value], rng) : null
    case 'rel':
      return isOneOf(value, KEY_ORDER) ? makeRelativeKey(id, [value], rng) : null
    default:
      return null
  }
}

// Worked examples for the cards.
const A_STRING = 1

function patternBoard(rootString: number, fret: number): Card['board'] {
  const { root, region, notes, degreeOf } = scalePattern(rootString, fret)
  return {
    region,
    markers: notes.map((p): Marker => (samePos(p, root) ? { pos: p, tone: 'root', label: '1' } : { pos: p, tone: 'note', label: String(degreeOf(p)) })),
  }
}

/** A scale climbing one string from the open note to the 12th fret, labeled with names or degree numbers. */
function oneString(string: number, tones: Tone[], labels: 'names' | 'degrees'): Card['board'] {
  const pcs = tones.map(tonePc)
  const region = { strings: [string], minFret: 0, maxFret: 12 }
  return {
    region,
    markers: allPositions(region)
      .filter((p) => pcs.includes(pitchClass(midiAt(p))))
      .map((p): Marker => {
        const d = pcs.indexOf(pitchClass(midiAt(p)))
        return { pos: p, tone: d === 0 ? 'root' : 'note', label: labels === 'names' ? toneName(tones[d]) : String(d + 1) }
      }),
  }
}

/** The same card, with some of its notes colored. */
const withColors = (c: Pick<Card, 'score' | 'sound'>, colors: (string | undefined)[]): Pick<Card, 'score' | 'sound'> => ({ ...c, score: { ...c.score!, colors } })

/** A scale's notes on the neck, every one labeled: the home note glows, and so do any to point out. */
function scaleNeck(tones: Tone[], home: string, point: string[] = [], minFret = 0, maxFret = 5): Card['board'] {
  const pcs = tones.map(tonePc)
  const region = { strings: ALL_STRINGS, minFret, maxFret }
  const pcOf = (name: string) => tonePc(parseTone(name.replace('♯', '#').replace('♭', 'b')))
  return {
    region,
    markers: allPositions(region)
      .filter((p) => pcs.includes(pitchClass(midiAt(p))))
      .map((p): Marker => {
        const pc = pitchClass(midiAt(p))
        return { pos: p, tone: pc === pcOf(home) ? 'root' : point.some((n) => pcOf(n) === pc) ? 'target' : 'note', label: noteAt(p) }
      }),
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

const quarters = (letters: ScoreNote['letter'][], octave = 4): ScoreNote[] => letters.map((letter) => ({ letter, octave, dur: 'q' }))
const beats = { meter: '4/4' as const, events: [0, 1, 2, 3].map(() => ({ dur: 'q' as const, dots: 0 as const, rest: false })) }

const THEORY_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'basics:written': () => ({
    title: 'How music is written',
    subtitle: 'Two things about every note',
    hook: 'Written music tells you two things about every note: how high or low it sounds, and how long it lasts. Where the note sits tells you the first; the note’s shape tells you the second. This tape starts with how long.',
    onGuitar: 'Tab shows where to put your fingers. Standard notation, what you’ll learn here, also shows the rhythm, and every instrument can read it.',
    score: { measures: [[{ letter: 'C', octave: 5, dur: 'q' }, { letter: 'D', octave: 5, dur: 'q' }, { letter: 'E', octave: 5, dur: 'h' }], [{ letter: 'G', octave: 4, dur: 'w' }]], meter: '4/4' },
    sound: [60, 62, 64, 55],
  }),
  'basics:beat': () => ({
    title: 'The beat',
    subtitle: 'The steady pulse',
    hook: 'The beat is the steady pulse you’d tap your foot to, like a ticking clock. Musicians count along with it, 1 2 3 4, to keep time. Press ▶ Hear to hear four beats.',
    notation: { measure: beats, labels: ['1', '2', '3', '4'] },
    rhythm: { measure: beats, bpm: 72 },
    sound: [],
  }),
  'basics:measure': () => ({
    title: 'Measures and bar lines',
    subtitle: 'Beats in groups',
    hook: 'Beats are grouped into measures (also called bars). A bar line, the straight line down the staff, marks where one measure ends and the next begins. Here each measure holds four beats.',
    score: { measures: [quarters(['B', 'B', 'B', 'B']), quarters(['B', 'B', 'B', 'B'])], meter: '4/4', labels: ['1', '2', '3', '4', '1', '2', '3', '4'] },
    sound: [59, 59, 59, 59, 59, 59, 59, 59],
  }),
  'basics:staff': () => ({
    title: 'The staff',
    subtitle: 'Five lines, four spaces',
    hook: 'Music is written on a staff: five lines with four spaces between them. Each note sits on a line or in a space, and the higher it sits, the higher it sounds. Climbing here: line, space, line, space…',
    score: { measures: [quarters(['E', 'F', 'G', 'A', 'B']).concat(quarters(['C', 'D', 'E', 'F'], 5))], labels: ['line', 'space', 'line', 'space', 'line', 'space', 'line', 'space', 'line'] },
    sound: [52, 53, 55, 57, 59, 60, 62, 64, 65],
  }),
  'basics:clef': () => ({
    title: 'The treble clef',
    subtitle: 'The sign that starts every staff',
    hook: 'The curly sign at the start of the staff is the treble clef. It’s also called the G clef: it curls around the second line from the bottom, and a note on that line is G. Guitar music always uses it.',
    onGuitar: 'The guitar actually sounds an octave (the same notes, one level) lower than written, which keeps its low notes from needing lots of extra lines. Sometimes a small 8 under the clef says so.',
    score: { measures: [[{ letter: 'G', octave: 4, dur: 'w' }]], labels: ['G'] },
    sound: [55],
  }),
  'intro:low-strings': () => ({
    title: 'Why these two strings',
    subtitle: 'Where chords start',
    hook: 'Most chords are named after and built up from one note, called the root: a C chord is built on C. On the guitar, that root is usually on the 6th or 5th string. Know every note on these two strings and you can find almost any chord’s starting point.',
    onGuitar: 'Barre chords (one finger pressed across all the strings) and power chords, the movable shapes behind most rock and pop, start on one of these two strings.',
    board: {
      region: { strings: [0, 1], minFret: 0, maxFret: 12 },
      markers: [0, 1].flatMap((s) => [0, 1, 2, 3, 5, 7, 8, 10, 12].filter((f) => isNatural(midiAt({ string: s, fret: f }))).map((f) => on(s, f, 'note'))),
    },
    sound: [],
  }),
  'intro:fifth-fret': () => ({
    title: 'The 5th-fret link',
    subtitle: 'Hopping between the strings',
    hook: 'The 5th fret of the 6th string is A, the same note as the open 5th string. And on the same fret, the 5th string’s note is always four letters higher: G at the 3rd fret of the 6th string, C right next to it on the 5th.',
    board: { region: { strings: [0, 1], minFret: 0, maxFret: 6 }, markers: [{ ...on(0, 5), tone: 'root' }, on(1, 0), on(0, 3, 'note'), on(1, 3, 'note')] },
    sound: [45, 45],
  }),
  'step:why': () => ({
    title: 'Why steps matter',
    subtitle: 'The measuring stick of music',
    hook: 'Everything in theory, from scales to chords, is built from two sizes of step: the half step and the whole step. Once you can see them on the neck, the rest is counting frets.',
    onGuitar: 'In tape 18 a “step” meant moving to the next letter on the staff. Here we measure exactly how big that move is: half or whole.',
    board: { region: { strings: [A_STRING], minFret: 0, maxFret: 5 }, markers: [on(A_STRING, 2), on(A_STRING, 3), on(A_STRING, 5)] },
    sound: [47, 48, 50],
  }),
  'step:half': () => ({
    title: 'Half step',
    subtitle: 'One fret',
    hook: 'The smallest step in music: from one fret to the very next fret on the same string. B to C is a half step, and so is C to C♯ (C sharp).',
    score: { measures: [[{ letter: 'B', octave: 4, dur: 'w' }, { letter: 'C', octave: 5, dur: 'w' }]], labels: ['B', 'C'] },
    board: { region: { strings: [A_STRING], minFret: 0, maxFret: 5 }, markers: [on(A_STRING, 2), on(A_STRING, 3)] },
    sound: [47, 48],
  }),
  'step:whole': () => ({
    title: 'Whole step',
    subtitle: 'Two frets',
    hook: 'Two half steps make a whole step: two frets along the same string, skipping the fret in between. C to D is a whole step, with C♯ in between.',
    score: { measures: [[{ letter: 'C', octave: 5, dur: 'w' }, { letter: 'D', octave: 5, dur: 'w' }]], labels: ['C', 'D'] },
    board: { region: { strings: [A_STRING], minFret: 1, maxFret: 6 }, markers: [on(A_STRING, 3), on(A_STRING, 4, 'accidental'), on(A_STRING, 5)] },
    sound: [48, 50],
  }),
  'step:letters': () => ({
    title: 'E–F and B–C',
    subtitle: 'The two natural half steps',
    hook: 'The natural notes are the plain letters, A to G, with no sharp or flat. Most neighbors are a whole step apart, with a sharp or flat in between. E–F and B–C have nothing in between: they’re half steps.',
    ...withColors(scaleCard(majorScale('C'), 'names'), [undefined, undefined, HIGHLIGHT, HIGHLIGHT, undefined, undefined, HIGHLIGHT, HIGHLIGHT]),
    board: {
      region: { strings: [A_STRING], minFret: 0, maxFret: 12 },
      markers: [0, 2, 3, 5, 7, 8, 10, 12].map((f) => on(A_STRING, f, [2, 3, 7, 8].includes(f) ? 'target' : 'note')),
    },
    sound: [45, 47, 48, 50, 52, 53, 55, 57],
  }),
  'step:accidentals': () => ({
    title: 'Steps from any note',
    subtitle: 'Sharps and flats fill the gaps',
    hook: 'A sharp (♯) is a half step up and a flat (♭) is a half step down. So a whole step above E skips over F and lands on F♯, and a half step below C is B.',
    score: { measures: [[{ letter: 'E', octave: 4, dur: 'w' }, { letter: 'F', octave: 4, dur: 'w', sign: 1 }]], labels: ['E', 'F♯'] },
    board: { region: { strings: [2], minFret: 0, maxFret: 6 }, markers: [on(2, 2), on(2, 3, 'note'), on(2, 4)] },
    sound: [52, 54],
  }),
  'scale:what': () => ({
    title: 'What a scale is',
    subtitle: 'Notes in order, from home to home',
    hook: 'A scale is a set of notes played one after another, going up from a starting note to the same note an octave higher (the same name, one level up). The starting note is called the root. It’s the scale’s home, and it gives the scale its name: the C major scale starts and ends on C.',
    onGuitar: 'Scales are what melodies and solos are made of.',
    ...scaleCard(majorScale('C'), 'names', 0),
    board: scaleNeck(majorScale('C'), 'C'),
  }),
  'scale:formula': () => ({
    title: 'The major scale’s steps',
    subtitle: 'Whole, whole, half, whole, whole, whole, half',
    hook: 'Every major scale climbs from its root with the same pattern of steps: whole, whole, half, whole, whole, whole, half. On one string that’s 2 frets, 2, 1, 2, 2, 2, 1. Here it is on the 5th string, starting on the open A: the A major scale.',
    ...scaleCard(majorScale('A'), 'names'),
    board: oneString(A_STRING, majorScale('A'), 'names'),
  }),
  'scale:c-major': () => ({
    title: 'Why C major is all naturals',
    subtitle: 'Its half steps land on E–F and B–C',
    hook: 'Start the pattern on C and the two half steps fall from the 3rd note to the 4th and the 7th to the 8th: E to F, and B to C. Those are exactly the two natural half steps from tape 22, so the C major scale needs no sharps or flats.',
    ...withColors(scaleCard(majorScale('C'), 'names'), [undefined, undefined, HIGHLIGHT, HIGHLIGHT, undefined, undefined, HIGHLIGHT, HIGHLIGHT]),
    board: scaleNeck(majorScale('C'), 'C', ['E', 'F', 'B']),
  }),
  'scale:build': () => ({
    title: 'Building G major',
    subtitle: 'Step by step',
    hook: 'Start on G and follow the steps. Whole: A. Whole: B. Half: C. Whole: D. Whole: E. Whole: F♯ (plain F would only be a half step above E). Half: back to G. That’s where G major’s F♯ comes from.',
    onGuitar: 'You can build any major scale on a single string this way: count 2, 2, 1, 2, 2, 2, 1 frets up from its root.',
    ...withColors(scaleCard(majorScale('G'), 'names'), [undefined, undefined, undefined, undefined, undefined, undefined, HIGHLIGHT]),
    board: oneString(3, majorScale('G'), 'names'),
    sound: [55, 57, 59, 60, 62, 64, 66, 67],
  }),
  'scale:degrees': () => ({
    title: 'Scale degrees',
    subtitle: 'Numbering the notes',
    hook: 'Each note of a scale gets a number, counting up from the root: the root is 1, the next note is 2, and so on to 7. These numbers are called degrees. In G major, G is 1, A is 2, B is 3, C is 4, D is 5, E is 6 and F♯ is 7. The 8th is G again.',
    onGuitar: 'Degrees describe every scale at once: “the 5th” is D in G major and G in C major. Chords are built from degrees, so you’ll use them a lot.',
    ...scaleCard(majorScale('G'), 'degrees'),
    board: oneString(3, majorScale('G'), 'degrees'),
    sound: [55, 57, 59, 60, 62, 64, 66, 67],
  }),
  'scale:letters': () => ({
    title: 'One of each letter',
    subtitle: 'How scales are spelled',
    hook: 'A major scale uses every letter from A to G exactly once, in order. So the F major scale’s 4th note is B♭ (B flat), not A♯: A is already used as its 3rd. That’s also why a scale has only sharps or only flats, never both.',
    ...scaleCard(majorScale('F'), 'names', 3),
    board: scaleNeck(majorScale('F'), 'F', ['B♭']),
  }),
  'pattern:why': () => ({
    title: 'Why scale shapes',
    subtitle: 'The scale under one hand',
    hook: 'Playing a scale up one string means sliding your hand all the way along the neck. Spread across the strings instead, the whole scale fits in about five frets, so your hand can stay in one place. That spread-out version is called a shape, or pattern.',
    onGuitar: 'Most melodies and solos are played from shapes like this one.',
    board: scaleNeck(majorScale('G'), 'G', [], 2, 6),
    sound: [43, 45, 47, 48, 50, 52, 54, 55],
  }),
  'pattern:root': () => ({
    title: 'Find the root first',
    subtitle: 'The shape is built around home',
    hook: 'Every shape is built around its root, the scale’s home note. For this first shape the root sits on the 6th string, the thickest. Find it, and the rest of the shape sits around it: from one fret below the root to three frets above.',
    board: { region: { strings: ALL_STRINGS, minFret: 2, maxFret: 6 }, markers: [{ ...on(0, 3), tone: 'root' }, { ...on(2, 5), tone: 'root' }, { ...on(5, 3), tone: 'root' }] },
    sound: [43],
  }),
  'pattern:6': () => ({
    title: 'Root on the 6th string',
    subtitle: 'G major at the 3rd fret',
    hook: 'Here’s the whole shape, each note numbered by its degree (its place in the scale, from tape 23). Learn where 1, 3 and 5 sit first; they’re the notes chords are built from later.',
    board: patternBoard(0, 3),
    sound: [43, 45, 47, 48, 50, 52, 54, 55],
  }),
  'pattern:move': () => ({
    title: 'Move it, change the scale',
    subtitle: 'Same shape, new root',
    hook: 'Slide the whole shape up two frets and every note moves up a whole step: G major at the 3rd fret becomes A major at the 5th fret. The shape stays the same; the root decides which major scale it is.',
    board: patternBoard(0, 5),
    sound: [45, 47, 49, 50, 52, 54, 56, 57],
  }),
  'pattern:5': () => ({
    title: 'Root on the 5th string',
    subtitle: 'C major at the 3rd fret',
    hook: 'Put the root on the 5th string and the scale makes a second shape, still within about five frets. Between the two shapes you can play any major scale almost anywhere on the neck.',
    board: patternBoard(1, 3),
    sound: [48, 50, 52, 53, 55, 57, 59, 60],
  }),
  'scale:key': () => ({
    title: 'What a key is',
    subtitle: 'A piece of music’s home base',
    hook: 'A key is a piece of music’s home base: a home note, plus the scale that supplies its notes. A song in G major feels at home on G and mostly uses the G major scale’s notes: G A B C D E F♯.',
    onGuitar: 'Knowing a song’s key tells you which scale shape fits a solo, and which chords are likely to show up.',
    ...scaleCard(majorScale('G'), 'names', 0),
    board: scaleNeck(majorScale('G'), 'G'),
  }),
  'circle:why': () => ({
    title: 'Why the circle of fifths',
    subtitle: 'A map of every key',
    hook: 'There are 15 major keys. The circle of fifths puts them in order so each key sits next to its closest relatives: two keys side by side share all their notes but one.',
    onGuitar: 'Chords from neighboring keys mix well, so songs often borrow from, or move to, the next key around the circle.',
    circle: { majors: ['C', 'G', 'F'] },
    sound: [],
  }),
  'circle:fifth': () => ({
    title: 'Counting up a fifth',
    subtitle: 'Five letters up',
    hook: 'A fifth here simply means five letters up, counting the one you start on: C D E F G. So the key a fifth above C is G. Keep going: a fifth above G is D (G A B C D).',
    onGuitar: 'On the neck, a fifth up is one string over and two frets up, like here.',
    score: { measures: [[{ letter: 'C', octave: 4, dur: 'w' }, { letter: 'G', octave: 4, dur: 'w' }]], labels: ['C', 'G'] },
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 6 }, markers: [{ ...on(A_STRING, 3), tone: 'root' }, on(2, 5)] },
    sound: [48, 55],
  }),
  'circle:addsharp': () => ({
    title: 'Each step adds a sharp',
    subtitle: 'C, then G, then D…',
    hook: 'C major has no sharps. G major, a fifth up, has one: F♯. D major, a fifth above G, has two: F♯ and C♯. Every step a fifth up adds one more sharp and keeps the ones before.',
    circle: { majors: ['C', 'G', 'D'] },
    score: { measures: [[]], keySig: 'D' },
    sound: [],
  }),
  'circle:sharps': () => ({
    title: 'The order of sharps',
    subtitle: 'F C G D A E B',
    hook: 'Sharps always join the key signature in the same order: F, C, G, D, A, E, B. A sentence to remember it: Father Charles Goes Down And Ends Battle.',
    score: { measures: [[]], keySig: 'C#' },
    sound: [],
  }),
  'circle:name-sharp': () => ({
    title: 'Naming a sharp key',
    subtitle: 'One fret above the last sharp',
    hook: 'To name a key from its sharps, look at the last sharp and go a half step (one fret) up. Last sharp F♯ → G major. Last sharp C♯ → D major. Last sharp G♯, as here → A major.',
    score: { measures: [[]], keySig: 'A' },
    sound: [],
  }),
  'circle:flats': () => ({
    title: 'Going the other way: flats',
    subtitle: 'Five letters down',
    hook: 'Count five letters down from C instead (C B A G F) and you reach F major, with one flat: B♭. Each step a fifth down adds a flat, in the reverse order of the sharps: B, E, A, D, G, C, F.',
    circle: { majors: FLAT_KEYS },
    score: { measures: [[]], keySig: 'Eb' },
    sound: [],
  }),
  'circle:name-flat': () => ({
    title: 'Naming a flat key',
    subtitle: 'The second-to-last flat',
    hook: 'With two or more flats, the key is named after the second-to-last flat: B♭ E♭ means B♭ major, and B♭ E♭ A♭, as here, means E♭ major. One flat on its own is F major: that one you just remember.',
    score: { measures: [[]], keySig: 'Eb' },
    sound: [],
  }),
  'circle:map': () => ({
    title: 'The whole circle',
    subtitle: 'Sharps one way, flats the other',
    hook: 'Put it together and the keys form a circle: sharp keys going clockwise from C, flat keys counterclockwise. At the bottom they meet, where three pairs of keys sound the same but are written differently: B and C♭, F♯ and G♭, C♯ and D♭.',
    circle: { majors: [] },
    sound: [],
  }),
  'rel:why': () => ({
    title: 'Why relative keys matter',
    subtitle: 'Two keys for the price of one',
    hook: 'Every major key has a minor partner that uses exactly the same notes: its relative minor. Learn one and you get both. Songs often move between a key and its relative minor, and knowing the pair helps you work out what key a song is in.',
    onGuitar: 'This G major scale shape also plays E minor, the E’s lit up here. Same frets; only the home note changes.',
    board: scaleNeck(majorScale('G'), 'G', ['E'], 2, 6),
    sound: [43, 45, 47, 48, 50, 52, 54, 55],
  }),
  'rel:moods': () => ({
    title: 'Major and minor',
    subtitle: 'Two moods',
    hook: 'Most songs are in a major key or a minor key. Major tends to sound bright and settled; minor sounds darker or sadder. Press ▶ Hear: first the C major scale, then the A minor scale.',
    ...scaleCard(majorScale('C'), 'names'),
    board: scaleNeck(majorScale('C'), 'C'),
    sound: [48, 50, 52, 53, 55, 57, 59, 60, 45, 47, 48, 50, 52, 53, 55, 57],
  }),
  'rel:home': () => ({
    title: 'Same notes, new home',
    subtitle: 'The C major scale, starting on A',
    hook: 'Take the C major scale’s notes, C D E F G A B, and start and end on A instead: A B C D E F G A. That’s the A minor scale. The same seven notes, the same dots on the neck, but now A is home, so it sounds minor. A major key and a minor key that share their notes are called relatives.',
    onGuitar: 'This isn’t moving a shape. Sliding a chord or scale shape changes the key; here nothing moves, only which note feels like home.',
    ...scaleCard(naturalMinorScale('C'), 'names', 0),
    board: scaleNeck(naturalMinorScale('C'), 'A'),
  }),
  'rel:sixth': () => ({
    title: 'Finding the relative minor',
    subtitle: 'Count to the 6th note',
    hook: 'A relative minor is a key, named after its home note. To find it, count up the major scale to its 6th note: that’s the minor key’s home. G major goes G A B C D E, so its relative minor is E minor. C major goes C D E F G A, so A minor.',
    onGuitar: 'Know the G major scale on the neck? Then you already know E minor: same frets, different home note.',
    ...withColors(scaleCard(majorScale('G'), 'degrees', 5), [undefined, undefined, undefined, undefined, undefined, HIGHLIGHT]),
    board: scaleNeck(majorScale('G'), 'G', ['E']),
    sound: [43, 45, 47, 48, 50, 52],
  }),
  'rel:signature': () => ({
    title: 'Same key signature',
    subtitle: 'One sharp: G major or E minor',
    hook: 'Relatives use the same notes, so they share a key signature. One sharp (F♯) means the key of G major or E minor. Which one? Listen for home: a piece usually starts and ends on its home note.',
    score: { measures: [[{ letter: 'G', octave: 4, dur: 'h' }, { letter: 'E', octave: 4, dur: 'h' }]], keySig: 'G', labels: ['G major', 'E minor'] },
    sound: [55, 52],
  }),
  'rel:neck': () => ({
    title: '3 frets back',
    subtitle: 'The shortcut on the neck',
    hook: 'From a major key’s home note, move 3 frets back toward the tuning pegs on the same string. You land on the home note of its relative minor. C at the 3rd fret of the 5th string → the open A. G at the 3rd fret of the 6th string → the open E.',
    board: {
      region: { strings: [0, A_STRING], minFret: 0, maxFret: 5 },
      markers: [{ ...on(A_STRING, 3), tone: 'root' }, on(A_STRING, 0), { ...on(0, 3), tone: 'root' }, on(0, 0)],
    },
    sound: [48, 45, 43, 40],
  }),
  'minor:scale': () => ({
    title: 'The natural minor scale',
    subtitle: 'Its own pattern of steps',
    hook: 'From its home note, the minor scale steps whole, half, whole, whole, half, whole, whole. Major goes whole, whole, half, whole, whole, whole, half, so the half steps land in different places. That’s what makes minor sound different. In A minor the half steps (in amber) are B–C and E–F.',
    ...withColors(scaleCard(naturalMinorScale('C'), 'names'), [undefined, HIGHLIGHT, HIGHLIGHT, undefined, HIGHLIGHT, HIGHLIGHT]),
    board: scaleNeck(naturalMinorScale('C'), 'A', ['B', 'C', 'E', 'F']),
  }),
}

/** The card that teaches a theory idea. */
export function theoryCard(item: string, counter: string): Card {
  if (isIntervalItem(item)) return intervalCard(item, counter)
  if (isTriadItem(item)) return triadCard(item, counter)
  if (isHarmonyItem(item)) return harmonyCard(item, counter)
  return { ...THEORY_CARDS[item](), counter }
}
