import type { Card } from './rehearsal'
import type { Marker } from '../components/Fretboard'
import type { LessonSpec } from '../music/curriculum'
import { LETTERS, midiAt, pcName, pitchClass, stringName, type Region } from '../music/notes'
import type { KeyId, ScoreMeasure } from '../music/score'
import {
  degreeName,
  harmonicMinorScale,
  majorScale,
  melodicMinorScale,
  minorKeyName as keyName,
  minorScaleOn,
  parseTone,
  scaleLabels,
  scaleScore,
  scaleSound,
  spelled,
  toneId,
  toneName,
  tonePc,
  type Tone,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { marked, PAPER_HIGHLIGHT } from '../lib/color'
import { andList, capitalize } from '../lib/text'
import type { Question } from './questions'

/**
 * More scales: melodic minor, the minor scale with a major top, and telling the three minor
 * scales apart (questions always use its rising form; one card explains the classical way back
 * down); then the symmetric scales, whole-tone and diminished, which repeat one step pattern all
 * the way up. They have no settled spelling, so their questions ask about steps, shapes and the
 * chords inside rather than letters. Last, hearing them: the minor scales by their tops, and
 * whole-tone from diminished.
 */

/** The minor keys these tapes use, by their home notes: each spells melodic minor with plain sharps and flats. */
const MINOR_KEYS = ['A', 'E', 'D', 'B', 'G', 'C', 'F']
const known = (tonics: string[]) => {
  const own = tonics.filter((t) => isOneOf(t, MINOR_KEYS))
  return own.length ? own : MINOR_KEYS.slice(0, 3)
}
/** "E melodic minor" */
const melodicName = (tonic: string) => `${toneName(parseTone(tonic))} melodic minor`

// ---------------------------------------------------------------------------
// Melodic minor
// ---------------------------------------------------------------------------

/** A sharp note's other name: G♯ is also A♭. */
const otherName = (t: Tone) => (t.acc === 1 ? toneName({ letter: LETTERS[(LETTERS.indexOf(t.letter) + 1) % 7], acc: -1 }) : null)

/** "What's the 6th note of E melodic minor?" (or the 7th) */
export function makeMelodicNote(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(known(tonics), rng)
  const natural = minorScaleOn(tonic)
  const scale = melodicMinorScale(tonic)
  const d = pick([5, 6], rng)
  const right = toneName(scale[d])
  // Near misses: the note before it's raised, its other name, then the other raised note and where it started.
  const near = [toneName(natural[d]), otherName(scale[d]), toneName(scale[11 - d]), toneName(natural[11 - d])].filter((n): n is string => !!n)
  const options = shuffle([...new Set([right, ...near])].slice(0, 4), rng)
  return {
    id,
    kind: 'melodicNote',
    ask: { text: `What’s the ${degreeName(d + 1)} note of ${melodicName(tonic)}?`, hl: 'melodic minor' },
    options,
    answer: options.indexOf(right),
    why: `${keyName(tonic)}’s ${degreeName(d + 1)} note is ${toneName(natural[d])}. Melodic minor raises its 6th and 7th a half step, to ${toneName(scale[5])} and ${toneName(scale[6])}: ${spelled(scale)}.`,
    score: { measures: scaleScore(natural), labels: scaleLabels(natural), marker: d, afterMeasures: scaleScore(scale), after: scaleLabels(scale) },
    // From the 5th up to home: the smooth climb the raised notes make.
    sound: scaleSound(scale).slice(4),
    facts: [`mmin:${toneId(parseTone(tonic))}`],
  }
}

/** "Which notes make D melodic minor?" */
export function makeMelodicSpell(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(known(tonics), rng)
  const scale = melodicMinorScale(tonic)
  const major = majorScale(tonic as KeyId)
  const right = spelled(scale)
  // Near misses: the other two minor scales on the same root, and the major scale (one note off).
  const options = shuffle([right, spelled(minorScaleOn(tonic)), spelled(harmonicMinorScale(tonic)), spelled(major)], rng)
  const name = melodicName(tonic)
  return {
    id,
    kind: 'melodicSpell',
    ask: { text: `Which notes make ${name}?`, hl: name },
    options,
    answer: options.indexOf(right),
    why: `Start from ${toneName(major[0])} major: ${spelled(major)}. Lower its 3rd, ${toneName(major[2])} to ${toneName(scale[2])}, and you have ${name}: ${right}.`,
    score: { measures: [[]], afterMeasures: scaleScore(scale), after: scaleLabels(scale) },
    sound: scaleSound(scale),
    facts: [`mmsp:${toneId(parseTone(tonic))}`],
  }
}

// ---------------------------------------------------------------------------
// Three minor scales
// ---------------------------------------------------------------------------

type MinorKind = 'natural' | 'harmonic' | 'melodic'
const MINOR_KINDS: MinorKind[] = ['natural', 'harmonic', 'melodic']
const KIND_LABELS: Record<MinorKind, string> = { natural: 'Natural minor', harmonic: 'Harmonic minor', melodic: 'Melodic minor' }
const minorOf = (tonic: string, kind: MinorKind) => (kind === 'melodic' ? melodicMinorScale(tonic) : kind === 'harmonic' ? harmonicMinorScale(tonic) : minorScaleOn(tonic))

/** "A B C D E F G♯: which minor scale?" */
export function makeMinorKind(id: number, tonics: string[], rng: Rng, only?: MinorKind): Question {
  const tonic = pick(known(tonics), rng)
  const which = only ?? pick(MINOR_KINDS, rng)
  const scale = minorOf(tonic, which)
  const [sixth, seventh] = [scale[5], scale[6]].map(toneName)
  const why = {
    natural: `Its 6th and 7th, ${sixth} and ${seventh}, aren’t raised: that’s natural minor.`,
    harmonic: `Only its 7th is raised, to ${seventh}, and the 6th stays ${sixth}: that’s harmonic minor.`,
    melodic: `Its 6th and 7th are both raised, to ${sixth} and ${seventh}: that’s melodic minor.`,
  }[which]
  return {
    id,
    kind: 'minorKind',
    ask: { text: `${spelled(scale)}: which minor scale?` },
    // Always in the same order, natural to melodic: the order they're built in.
    options: MINOR_KINDS.map((k) => KIND_LABELS[k]),
    answer: MINOR_KINDS.indexOf(which),
    why,
    score: { measures: [[]], afterMeasures: scaleScore(scale), after: scaleLabels(scale) },
    sound: scaleSound(scale),
    facts: [`mkind:${which}`],
  }
}

// ---------------------------------------------------------------------------
// Symmetric scales
// ---------------------------------------------------------------------------

type SymmetricId = 'whole-tone' | 'whole-half' | 'half-whole'
const SYMMETRIC: SymmetricId[] = ['whole-tone', 'whole-half', 'half-whole']
const SYMMETRIC_NAMES: Record<SymmetricId, string> = { 'whole-tone': 'whole-tone', 'whole-half': 'whole-half diminished', 'half-whole': 'half-whole diminished' }
/** Half steps from the root to each note. */
const OFFSETS: Record<SymmetricId, number[]> = {
  'whole-tone': [0, 2, 4, 6, 8, 10],
  'whole-half': [0, 2, 3, 5, 6, 8, 9, 11],
  'half-whole': [0, 1, 3, 4, 6, 7, 9, 10],
}
/** How far up each one starts over with the same notes: every whole step, or every minor 3rd. */
const repeatOf = (s: SymmetricId) => (s === 'whole-tone' ? 2 : 3)
const knownSymmetric = (ids: string[]) => {
  const own = ids.filter((id): id is SymmetricId => isOneOf(id, SYMMETRIC))
  return own.length ? own : SYMMETRIC
}
const PCS = Array.from({ length: 12 }, (_, pc) => pc)
/** The roots questions name scales from: the natural notes. */
const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
/** Whole-tone scales are named with sharps, diminished ones with flats (like the diminished 7ths inside them). */
const rootName = (pc: number, s: SymmetricId) => pcName(pc, s === 'whole-tone' ? 'sharp' : 'flat')
/** The scale up an octave from its root (sounding MIDI). */
const evenSound = (pc: number, s: SymmetricId) => [...OFFSETS[s], 12].map((o) => 45 + pitchClass(pc - 9) + o)

/** "C whole-tone has the same notes as which whole-tone scale?" */
export function makeSymmetricSame(id: number, kinds: string[], rng: Rng, only?: SymmetricId): Question {
  const s = only ?? pick(knownSymmetric(kinds), rng)
  const root = pick(ROOTS, rng)
  const pc = tonePc(parseTone(root))
  const step = repeatOf(s)
  const same = (p: number) => (p - pc + 12) % step === 0
  const right = pick(PCS.filter((p) => p !== pc && same(p)), rng)
  // Near misses: a half step up for whole-tone, a whole step up for diminished (where whole-tone would repeat), then the rest.
  const near = pitchClass(pc + (step === 2 ? 1 : 2))
  const wrong = [near, ...shuffle(PCS.filter((p) => !same(p) && p !== near), rng)].slice(0, 3)
  const label = (p: number) => `${rootName(p, s)} ${SYMMETRIC_NAMES[s]}`
  const options = shuffle([right, ...wrong].map(label), rng)
  const name = `${root} ${SYMMETRIC_NAMES[s]}`
  // Its notes from the root up: every one is a place it starts over.
  const starts = PCS.filter(same).sort((a, b) => ((a - pc + 12) % 12) - ((b - pc + 12) % 12))
  return {
    id,
    kind: 'symmetricSame',
    ask: { text: `${name} has the same notes as which ${SYMMETRIC_NAMES[s]} scale?`, hl: name },
    options,
    answer: options.indexOf(label(right)),
    why: `${capitalize(SYMMETRIC_NAMES[s])} starts over every ${step === 2 ? 'whole step' : 'minor 3rd'}, so it has the same notes from ${andList(starts.map((p) => rootName(p, s)))}: ${label(right)} is one of them.`,
    sound: evenSound(pc, s),
    facts: [`symsame:${s}`],
  }
}

/** Frets up one string from the open string: whole-tone, or which diminished scale? */
export function makeSymmetricShape(id: number, kinds: string[], rng: Rng, only?: SymmetricId): Question {
  const s = only ?? pick(knownSymmetric(kinds), rng)
  const string = between(0, 5, rng)
  const frets = [...OFFSETS[s], 12]
  const open = pcName(pitchClass(midiAt({ string, fret: 0 })), 'sharp')
  const climb = { 'whole-tone': '2 at a time', 'whole-half': '2, then 1, over and over', 'half-whole': '1, then 2, over and over' }[s]
  const steps = { 'whole-tone': 'All whole steps', 'whole-half': 'Whole, half', 'half-whole': 'Half, whole' }[s]
  return {
    id,
    kind: 'symmetricShape',
    ask: { text: `These frets on the ${stringName(string)} string: which scale?` },
    // Always in the same order: whole-tone, then the two diminished scales.
    options: SYMMETRIC.map((k) => capitalize(SYMMETRIC_NAMES[k])),
    answer: SYMMETRIC.indexOf(s),
    why: `The frets climb ${climb}: ${frets.join(', ')}. ${steps}: that’s ${SYMMETRIC_NAMES[s]}.`,
    board: {
      region: { strings: [string], minFret: 0, maxFret: 12 },
      markers: frets.map((fret): Marker => (fret % 12 === 0 ? { pos: { string, fret }, tone: 'root', label: open } : { pos: { string, fret }, tone: 'note' })),
    },
    sound: frets.map((fret) => midiAt({ string, fret })),
    facts: [`symneck:${s}`],
  }
}

/** "Which two chords make C whole-tone?" */
export function makeSymmetricChords(id: number, kinds: string[], rng: Rng, only?: SymmetricId): Question {
  const s = only ?? pick(knownSymmetric(kinds), rng)
  const root = pick(ROOTS, rng)
  const up = (n: number) => pcName(tonePc(parseTone(root)) + n, 'sharp')
  const pairs = { aug: `${root}+ and ${up(2)}+`, nearAug: `${root}+ and ${up(1)}+`, wholeDim: `${root}°7 and ${up(2)}°7`, halfDim: `${root}°7 and ${up(1)}°7` }
  const right = { 'whole-tone': pairs.aug, 'whole-half': pairs.wholeDim, 'half-whole': pairs.halfDim }[s]
  const options = shuffle(Object.values(pairs), rng)
  const name = `${root} ${SYMMETRIC_NAMES[s]}`
  const apart = s === 'half-whole' ? 'a half step' : 'a whole step'
  const [first, second] = right.split(' and ')
  return {
    id,
    kind: 'symmetricChords',
    ask: { text: `Which two chords make ${name}?`, hl: name },
    options,
    answer: options.indexOf(right),
    why: `Every other note of ${name} makes ${s === 'whole-tone' ? 'an augmented triad, all major 3rds' : 'a diminished 7th, all minor 3rds'}: ${first} from the 1st note and ${second} from the 2nd, ${apart} apart.`,
    sound: evenSound(tonePc(parseTone(root)), s),
    facts: [`symchord:${s}`],
  }
}

// ---------------------------------------------------------------------------
// Hearing them
// ---------------------------------------------------------------------------

/** Half steps from home to each note of a minor scale (counted on A, home's pitch class 9). */
const stepsOf = (kind: MinorKind) => minorOf('A', kind).map((t) => pitchClass(tonePc(t) - 9))
/** A scale climbing from `low` to the octave (sounding MIDI). */
const climbFrom = (steps: number[], low: number) => [...steps, 12].map((s) => low + s)
const minorChord = (low: number) => [low, low + 3, low + 7]
/** What to listen for, by the scale that played. */
const MINOR_EAR_WHY: Record<MinorKind, string> = {
  natural: 'Natural minor: its 6th and 7th aren’t raised, so the top of the climb stays dark, a whole step below home.',
  harmonic: 'Harmonic minor: only its 7th is raised, so it jumps a step and a half from the 6th, then a half step home.',
  melodic: 'Melodic minor: its 6th and 7th are both raised, so the top climbs smoothly in whole steps and brightens like major.',
}

/** Hear the home chord, then a minor scale climbing to the octave: which of `kinds` is it? */
function minorHear(id: number, kind: 'melodicHear' | 'harmonicHear' | 'minorScaleHear', kinds: MinorKind[], fact: string, rng: Rng, only?: MinorKind): Question {
  const played = only && kinds.includes(only) ? only : pick(kinds, rng)
  const low = between(45, 55, rng)
  const names = kinds.map((k) => KIND_LABELS[k])
  return {
    id,
    kind,
    ask: { text: kinds.length === 2 ? `${names[0]} or ${names[1].toLowerCase()}?` : 'Which minor scale?' },
    options: names,
    answer: kinds.indexOf(played),
    why: MINOR_EAR_WHY[played],
    listen: { home: minorChord(low), notes: climbFrom(stepsOf(played), low) },
    sound: [],
    facts: [`ear:${fact}`],
  }
}

/** "Melodic minor or natural minor?" */
export const makeMelodicHear = (id: number, rng: Rng, only?: MinorKind) => minorHear(id, 'melodicHear', ['melodic', 'natural'], 'melodic-minor', rng, only)
/** "Harmonic minor or melodic minor?" */
export const makeHarmonicHear = (id: number, rng: Rng, only?: MinorKind) => minorHear(id, 'harmonicHear', ['harmonic', 'melodic'], 'harmonic-minor', rng, only)
/** All three: "Which minor scale?" */
export const makeMinorScaleHear = (id: number, rng: Rng, only?: MinorKind) => minorHear(id, 'minorScaleHear', MINOR_KINDS, 'minor-scales', rng, only)

/** Hear a scale climb, with no home chord since it has no home: whole-tone or diminished? */
export function makeSymmetricHear(id: number, rng: Rng, only?: 'whole-tone' | 'diminished'): Question {
  const whole = only ? only === 'whole-tone' : rng() < 0.5
  const s: SymmetricId = whole ? 'whole-tone' : pick<SymmetricId>(['whole-half', 'half-whole'], rng)
  return {
    id,
    kind: 'symmetricHear',
    ask: { text: 'Whole-tone or diminished?' },
    options: ['Whole-tone', 'Diminished'],
    answer: whole ? 0 : 1,
    why: whole
      ? 'Whole-tone: six even whole steps to the octave, so it floats, with no pull anywhere.'
      : 'Diminished: eight notes, whole and half steps in turn, so it twists and sounds tense.',
    listen: { notes: climbFrom(OFFSETS[s], between(45, 55, rng)) },
    sound: [],
    facts: ['ear:symmetric'],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const SCALES_ORDER = [
  'scales:melodic-why',
  'scales:melodic',
  'scales:melodic-spell',
  'scales:down',
  'scales:three-minors',
  'scales:symmetric-why',
  'scales:whole-tone',
  'scales:diminished',
  'scales:half-whole',
  'scales:symmetric-neck',
  'scales:symmetric-chords',
  'scales:ear-why',
  'scales:ear-melodic',
  'scales:ear-harmonic',
  'scales:ear-minors',
  'scales:ear-symmetric',
]
/** Explained on a card, not quizzed on their own. */
export const SCALES_INTRO = ['scales:melodic-why', 'scales:down', 'scales:symmetric-why', 'scales:ear-why']

export const isScalesItem = (item: string) => item.startsWith('scales:')
/**
 * Facts practiced on these tapes: melodic minor's raised notes ("mmin:A") and spelling ("mmsp:A"),
 * telling the minor scales apart ("mkind:melodic"), and for each symmetric scale, how it repeats
 * ("symsame:whole-tone"), its frets on one string ("symneck:whole-half") and its chords ("symchord:half-whole"),
 * and hearing them ("ear:melodic-minor", "ear:harmonic-minor", "ear:minor-scales", "ear:symmetric").
 */
export const isScalesFact = (fact: string) => /^(mmin|mmsp|mkind|symsame|symneck|symchord):/.test(fact) || /^ear:(melodic-minor|harmonic-minor|minor-scales|symmetric)$/.test(fact)
/** Each hearing fact's idea, and its short name. */
const EAR_ITEMS: Record<string, { item: string; name: string }> = {
  'melodic-minor': { item: 'scales:ear-melodic', name: 'Hearing melodic or natural minor' },
  'harmonic-minor': { item: 'scales:ear-harmonic', name: 'Hearing harmonic or melodic minor' },
  'minor-scales': { item: 'scales:ear-minors', name: 'Hearing the three minor scales' },
  symmetric: { item: 'scales:ear-symmetric', name: 'Hearing whole-tone or diminished' },
}
const SAME_ITEMS: Record<SymmetricId, string> = { 'whole-tone': 'scales:whole-tone', 'whole-half': 'scales:diminished', 'half-whole': 'scales:half-whole' }

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function scalesItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'mmin':
      return isOneOf(value, MINOR_KEYS) ? 'scales:melodic' : null
    case 'mmsp':
      return isOneOf(value, MINOR_KEYS) ? 'scales:melodic-spell' : null
    case 'mkind':
      return isOneOf(value, MINOR_KINDS) ? 'scales:three-minors' : null
    case 'symsame':
      return isOneOf(value, SYMMETRIC) ? SAME_ITEMS[value] : null
    case 'symneck':
      return isOneOf(value, SYMMETRIC) ? 'scales:symmetric-neck' : null
    case 'symchord':
      return isOneOf(value, SYMMETRIC) ? 'scales:symmetric-chords' : null
    case 'ear':
      return Object.hasOwn(EAR_ITEMS, value) ? EAR_ITEMS[value].item : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` goes through the three minor scales, or the three symmetric ones, in order. */
export function scalesCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const tonics = l.minorKeys ?? []
  const symmetric = l.symmetric ?? []
  switch (item) {
    case 'scales:melodic':
      return makeMelodicNote(id, tonics, rng)
    case 'scales:melodic-spell':
      return makeMelodicSpell(id, tonics, rng)
    case 'scales:three-minors':
      return makeMinorKind(id, tonics, rng, MINOR_KINDS[turn % MINOR_KINDS.length])
    case 'scales:whole-tone':
      return makeSymmetricSame(id, symmetric, rng, 'whole-tone')
    case 'scales:diminished':
      return makeSymmetricSame(id, symmetric, rng, 'whole-half')
    case 'scales:half-whole':
      return makeSymmetricSame(id, symmetric, rng, 'half-whole')
    case 'scales:symmetric-neck':
      return makeSymmetricShape(id, symmetric, rng, SYMMETRIC[turn % SYMMETRIC.length])
    case 'scales:symmetric-chords':
      return makeSymmetricChords(id, symmetric, rng, SYMMETRIC[turn % SYMMETRIC.length])
    case 'scales:ear-melodic':
      return makeMelodicHear(id, rng)
    case 'scales:ear-harmonic':
      return makeHarmonicHear(id, rng)
    case 'scales:ear-minors':
      return makeMinorScaleHear(id, rng, MINOR_KINDS[turn % MINOR_KINDS.length])
    case 'scales:ear-symmetric':
      return makeSymmetricHear(id, rng, turn % 2 === 0 ? 'whole-tone' : 'diminished')
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function scalesReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'mmin':
      return isOneOf(value, MINOR_KEYS) ? makeMelodicNote(id, MINOR_KEYS, rng, value) : null
    case 'mmsp':
      return isOneOf(value, MINOR_KEYS) ? makeMelodicSpell(id, MINOR_KEYS, rng, value) : null
    case 'mkind':
      return isOneOf(value, MINOR_KINDS) ? makeMinorKind(id, MINOR_KEYS, rng, value) : null
    case 'symsame':
      return isOneOf(value, SYMMETRIC) ? makeSymmetricSame(id, [], rng, value) : null
    case 'symneck':
      return isOneOf(value, SYMMETRIC) ? makeSymmetricShape(id, [], rng, value) : null
    case 'symchord':
      return isOneOf(value, SYMMETRIC) ? makeSymmetricChords(id, [], rng, value) : null
    case 'ear':
      return value === 'melodic-minor'
        ? makeMelodicHear(id, rng)
        : value === 'harmonic-minor'
          ? makeHarmonicHear(id, rng)
          : value === 'minor-scales'
            ? makeMinorScaleHear(id, rng)
            : value === 'symmetric'
              ? makeSymmetricHear(id, rng)
              : null
    default:
      return null
  }
}

/** "E melodic minor", "Spotting harmonic minor", "How whole-tone repeats"; null if it isn't one of these facts. */
export function describeScalesFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'mmin':
      return isOneOf(value, MINOR_KEYS) ? melodicName(value) : null
    case 'mmsp':
      return isOneOf(value, MINOR_KEYS) ? `Spelling ${melodicName(value)}` : null
    case 'mkind':
      return isOneOf(value, MINOR_KINDS) ? `Spotting ${KIND_LABELS[value].toLowerCase()}` : null
    case 'symsame':
      return isOneOf(value, SYMMETRIC) ? `How ${SYMMETRIC_NAMES[value]} repeats` : null
    case 'symneck':
      return isOneOf(value, SYMMETRIC) ? `${capitalize(SYMMETRIC_NAMES[value])} on one string` : null
    case 'symchord':
      return isOneOf(value, SYMMETRIC) ? `${capitalize(SYMMETRIC_NAMES[value])}’s two chords` : null
    case 'ear':
      return Object.hasOwn(EAR_ITEMS, value) ? EAR_ITEMS[value].name : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const A_NATURAL = minorScaleOn('A')
const A_HARMONIC = harmonicMinorScale('A')
const A_MELODIC = melodicMinorScale('A')
const A_MAJOR = majorScale('A')

/** The top of A melodic minor going up, then back down the classical way, as natural minor (with natural signs). */
const UP_AND_DOWN: ScoreMeasure[] = [
  scaleScore(A_MELODIC)[1],
  [
    { letter: 'G', octave: 5, dur: 'q', sign: 0 },
    { letter: 'F', octave: 5, dur: 'q', sign: 0 },
    { letter: 'E', octave: 5, dur: 'h' },
  ],
]

const C_WHOLE_TONE = ['C', 'D', 'E', 'F#', 'G#', 'A#'].map(parseTone)
const C_WHOLE_HALF = ['C', 'D', 'Eb', 'F', 'Gb', 'Ab', 'A', 'B'].map(parseTone)
const C_HALF_WHOLE = ['C', 'Db', 'Eb', 'E', 'F#', 'G', 'A', 'Bb'].map(parseTone)

/**
 * A six- or eight-note scale on the staff, four notes to a measure, with a natural sign where a
 * letter comes back without its flat (A♭, then A). The octave holds to the end of the last
 * measure: a half note after whole-tone's other two, a whole note after diminished's full measures.
 */
function evenScore(tones: Tone[]): ScoreMeasure[] {
  const notes = scaleScore(tones).flat()
  const measures: ScoreMeasure[] = []
  for (let i = 0; i < notes.length; i += 4) {
    const earlier = new Map<string, number>()
    measures.push(
      notes.slice(i, i + 4).map((n) => {
        const spot = `${n.letter}${n.octave}`
        const before = earlier.get(spot)
        earlier.set(spot, n.sign ?? 0)
        return before && n.sign === undefined ? { ...n, sign: 0 as const } : n
      }),
    )
  }
  const last = measures[measures.length - 1]
  last[last.length - 1] = { ...last[last.length - 1], dur: last.length === 1 ? 'w' : 'h' }
  return measures
}

/** Whole-tone up the low E string, and whole-half diminished up the A string with the notes it starts over from lit. */
function symmetricNeck(): Card['board'] {
  return {
    region: { strings: [0, 1], minFret: 0, maxFret: 12 },
    markers: [
      ...[...OFFSETS['whole-tone'], 12].map((fret): Marker => ({ pos: { string: 0, fret }, tone: 'note' })),
      ...[...OFFSETS['whole-half'], 12].map((fret): Marker => ({ pos: { string: 1, fret }, tone: fret % 3 === 0 ? 'root' : 'note' })),
    ],
  }
}

/** The melodic minor scale up the A string, its raised 6th and 7th lit. */
function melodicNeck(): Card['board'] {
  const pcs = A_MELODIC.map(tonePc)
  const region: Region = { strings: [1], minFret: 0, maxFret: 12 }
  const markers = Array.from({ length: 13 }, (_, fret) => ({ string: 1, fret }))
    .filter((p) => pcs.includes(pitchClass(midiAt(p))))
    .map((p) => {
      const i = pcs.indexOf(pitchClass(midiAt(p)))
      return { pos: p, tone: i === 0 ? ('root' as const) : i >= 5 ? ('target' as const) : ('note' as const), label: toneName(A_MELODIC[i]) }
    })
  return { region, markers }
}

const SCALES_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'scales:melodic-why': () => ({
    title: 'Smoothing the climb',
    subtitle: 'Harmonic minor’s awkward gap',
    hook: 'Harmonic minor (tape 55) raises the 7th so it leans into home, but that leaves a step and a half between its 6th and 7th: F to G♯ in A minor (in amber). In a melody climbing up to home, that jump sticks out. Raise the 6th too, F to F♯, and the climb is smooth again. Press ▶\uFE0E Hear: harmonic minor’s top, then the smooth one.',
    score: { measures: scaleScore(A_HARMONIC), labels: scaleLabels(A_HARMONIC), colors: marked(7, PAPER_HIGHLIGHT, 5, 6) },
    sound: [...scaleSound(A_HARMONIC).slice(4), ...scaleSound(A_MELODIC).slice(4)],
  }),
  'scales:melodic': () => ({
    title: 'Melodic minor',
    subtitle: 'Raise the 6th and 7th',
    hook: 'Raise both the 6th and 7th notes of the natural minor scale a half step and you get the melodic minor scale: A B C D E F♯ G♯ A (the raised notes in amber). Its bottom half is still minor, but its top half matches A major, so it sounds minor with a bright finish.',
    score: { measures: scaleScore(A_MELODIC), labels: scaleLabels(A_MELODIC), colors: marked(7, PAPER_HIGHLIGHT, 5, 6) },
    board: melodicNeck(),
    sound: scaleSound(A_MELODIC),
  }),
  'scales:melodic-spell': () => ({
    title: 'Major with a lowered 3rd',
    subtitle: 'A quicker way to spell it',
    hook: 'Melodic minor is one note away from the major scale on the same root: the 3rd. A major is A B C♯ D E F♯ G♯. Lower its 3rd, C♯ to C (in amber), and you have A melodic minor: A B C D E F♯ G♯. So to spell any melodic minor, spell the major scale and lower its 3rd. Press ▶\uFE0E Hear: A major, then A melodic minor.',
    score: { measures: scaleScore(A_MELODIC), labels: scaleLabels(A_MELODIC), colors: marked(7, PAPER_HIGHLIGHT, 2) },
    sound: [...scaleSound(A_MAJOR), ...scaleSound(A_MELODIC)],
  }),
  'scales:down': () => ({
    title: 'Coming back down',
    subtitle: 'Classical, jazz and rock',
    hook: 'The raised 6th and 7th pull up toward home, so classical music raises them only on the way up. Coming back down, it plays natural minor: G and F instead of G♯ and F♯ (in amber). Jazz and rock keep them raised both ways; jazz players call it jazz minor. On these tapes, melodic minor always means the way up. Press ▶\uFE0E Hear: up as melodic minor, down as natural minor.',
    score: { measures: UP_AND_DOWN, labels: ['E', 'F♯', 'G♯', 'A', 'G', 'F', 'E'], colors: marked(6, PAPER_HIGHLIGHT, 1, 2, 4, 5) },
    sound: [...scaleSound(A_MELODIC).slice(4), ...scaleSound(A_NATURAL).slice(4, 7).reverse()],
  }),
  'scales:three-minors': () => ({
    title: 'Three minor scales',
    subtitle: 'Look at the 6th and 7th',
    hook: 'All three minor scales share their first five notes: A B C D E in A minor. The 6th and 7th (in amber) tell them apart. Natural minor leaves both alone: F and G. Harmonic minor raises only the 7th: F and G♯. Melodic minor raises both: F♯ and G♯. Press ▶\uFE0E Hear: natural, harmonic, then melodic.',
    score: { measures: scaleScore(A_NATURAL), labels: scaleLabels(A_NATURAL), colors: marked(7, PAPER_HIGHLIGHT, 5, 6) },
    sound: [...scaleSound(A_NATURAL), ...scaleSound(A_HARMONIC), ...scaleSound(A_MELODIC)],
  }),
  'scales:symmetric-why': () => ({
    title: 'Scales with no home',
    subtitle: 'One step pattern, over and over',
    hook: 'Major and minor scales mix whole and half steps unevenly, and that unevenness points the ear to home. A symmetric scale repeats one small step pattern all the way up, so no note stands out as home. That gives it a floating, mysterious sound you’ll hear in film scores and jazz. Press ▶\uFE0E Hear: a whole-tone scale.',
    score: { measures: evenScore(C_WHOLE_TONE), labels: scaleLabels(C_WHOLE_TONE) },
    sound: scaleSound(C_WHOLE_TONE),
  }),
  'scales:whole-tone': () => ({
    title: 'The whole-tone scale',
    subtitle: 'Six notes, all whole steps',
    hook: 'Climb from C in whole steps only and you get six notes: C D E F♯ G♯ A♯, then C again. With every step the same size, any note could be home: start on D and you get the same six notes. So there are only two whole-tone scales: this one, and the one a half step up, C♯ D♯ F G A B.',
    score: { measures: evenScore(C_WHOLE_TONE), labels: scaleLabels(C_WHOLE_TONE) },
    sound: scaleSound(C_WHOLE_TONE),
  }),
  'scales:diminished': () => ({
    title: 'The diminished scale',
    subtitle: 'Whole, half, whole, half',
    hook: 'Alternate whole and half steps and you get eight notes: C D E♭ F G♭ A♭ A B, then C. This is the whole-half diminished scale. Its pattern starts over every minor 3rd, on C, E♭, G♭ and A (in amber), and starting on any of them gives the same eight notes. That’s why there are only three diminished scales.',
    score: { measures: evenScore(C_WHOLE_HALF), labels: scaleLabels(C_WHOLE_HALF), colors: marked(8, PAPER_HIGHLIGHT, 0, 2, 4, 6, 8) },
    sound: scaleSound(C_WHOLE_HALF),
  }),
  'scales:half-whole': () => ({
    title: 'Half-whole diminished',
    subtitle: 'The same pattern, half step first',
    hook: 'Start with a half step instead and you get the half-whole diminished scale: C D♭ E♭ E F♯ G A B♭. Every half-whole scale is a whole-half scale begun one note later: C whole-half from its 2nd note, D, is D half-whole. It starts over every minor 3rd too (in amber). Press ▶\uFE0E Hear: C whole-half, then C half-whole.',
    score: { measures: evenScore(C_HALF_WHOLE), labels: scaleLabels(C_HALF_WHOLE), colors: marked(8, PAPER_HIGHLIGHT, 0, 2, 4, 6, 8) },
    sound: [...scaleSound(C_WHOLE_HALF), ...scaleSound(C_HALF_WHOLE)],
  }),
  'scales:symmetric-neck': () => ({
    title: 'Shapes that slide',
    subtitle: 'Symmetric scales on the neck',
    hook: 'On one string you can see the pattern: whole-tone climbs every 2 frets (low E string), whole-half diminished 2, 1, 2, 1 (A string), and half-whole 1, 2, 1, 2. The shape repeats with the pattern: whole-half starts over every 3 frets (lit). So a whole-tone shape moved 2 frets, or a diminished shape moved 3, is still the same scale.',
    board: symmetricNeck(),
    sound: [...OFFSETS['whole-half'], 12].map((fret) => midiAt({ string: 1, fret })),
  }),
  'scales:symmetric-chords': () => ({
    title: 'The chords inside',
    subtitle: 'And where each scale fits',
    hook: 'Every other note of a symmetric scale makes a chord. Whole-tone is two augmented triads (tape 36): C+ (in amber) and D+. Whole-half diminished is two diminished 7ths (tape 55): C°7 and D°7. So whole-tone fits augmented chords, and whole-half fits diminished 7ths. C half-whole also holds C7’s notes, C E G B♭, so it gives a dominant 7th a tense, jazzy sound.',
    score: { measures: evenScore(C_WHOLE_TONE), labels: scaleLabels(C_WHOLE_TONE), colors: marked(6, PAPER_HIGHLIGHT, 0, 2, 4, 6) },
    sound: [0, 2, 4, 1, 3, 5].map((i) => scaleSound(C_WHOLE_TONE)[i]),
  }),
  'scales:ear-why': () => ({
    title: 'Hearing scales',
    subtitle: 'Listen near the top',
    hook: 'The three minor scales share their first five notes, so by ear they differ only near the top. Each minor question plays the home chord first, so your ear knows where home is, then the scale climbing to the octave. The symmetric scales play with no chord, since they have no home. Press ▶\uFE0E Hear: the A minor chord, then A melodic minor.',
    listen: { home: minorChord(45), notes: climbFrom(stepsOf('melodic'), 45) },
    sound: [],
  }),
  'scales:ear-melodic': () => ({
    title: 'Melodic or natural minor',
    subtitle: 'Listen to the 6th and 7th',
    hook: 'Natural minor climbs to home with its 6th and 7th low and dark, and its last step up is a whole step. Melodic minor raises both, so the top brightens like major and the last step into home is just a half step. Press ▶\uFE0E Hear: the home chord, then natural minor, then melodic minor.',
    listen: { home: minorChord(45), notes: [...climbFrom(stepsOf('natural'), 45), ...climbFrom(stepsOf('melodic'), 45)] },
    sound: [],
  }),
  'scales:ear-harmonic': () => ({
    title: 'Harmonic or melodic minor',
    subtitle: 'Listen for the jump',
    hook: 'Harmonic minor raises only its 7th, which leaves a jump of a step and a half up from the 6th: the exotic sound from tape 55. Melodic minor raises the 6th too, so the same stretch climbs smoothly in whole steps. Press ▶\uFE0E Hear: the home chord, then harmonic minor, then melodic minor.',
    listen: { home: minorChord(45), notes: [...climbFrom(stepsOf('harmonic'), 45), ...climbFrom(stepsOf('melodic'), 45)] },
    sound: [],
  }),
  'scales:ear-minors': () => ({
    title: 'Three minors by ear',
    subtitle: 'Dark, exotic or bright',
    hook: 'With all three in play, listen near the top of the climb. Natural minor stays dark all the way up. Harmonic minor makes its exotic jump from the 6th to the 7th. Melodic minor brightens smoothly, like major. Press ▶\uFE0E Hear: the home chord, then natural, harmonic and melodic minor.',
    listen: { home: minorChord(45), notes: MINOR_KINDS.flatMap((k) => climbFrom(stepsOf(k), 45)) },
    sound: [],
  }),
  'scales:ear-symmetric': () => ({
    title: 'Whole-tone or diminished',
    subtitle: 'Even steps or twisting ones',
    hook: 'With no home chord to lean on, listen to the steps themselves. Whole-tone moves in even whole steps, six to the octave, and floats like a dream. Diminished alternates whole and half steps, eight to the octave, and twists with the tension film scores use for suspense. Press ▶\uFE0E Hear: whole-tone, then diminished.',
    listen: { notes: [...climbFrom(OFFSETS['whole-tone'], 48), ...climbFrom(OFFSETS['whole-half'], 48)] },
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function scalesCard(item: string, counter: string): Card {
  return { ...SCALES_CARDS[item](), counter }
}
