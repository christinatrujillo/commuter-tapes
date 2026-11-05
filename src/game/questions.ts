import type { Marker } from '../components/Fretboard'
import type { ExerciseType, LessonSpec } from '../music/curriculum'
import { KEYS, type AccidentalRule, type KeyId, type Motion, type ScoreMeasure, type ScoreNote } from '../music/score'
import { daysBetween, today } from '../lib/date'
import { pick, randomSpelling, shuffle, type Rng } from '../lib/random'
import { makeAccidentalRule, makeKeyName, makeKeyNote, makeMotion, makePhrase } from './reading'
import {
  makeDegreeFind,
  makeDegreeName,
  makeCircleNext,
  makeKeySignature,
  makeMinorNote,
  makeRelativeFind,
  makeRelativeKey,
  makeScaleNote,
  makeScaleStep,
  makeStepFind,
  makeStepNote,
  makeStepRead,
  makeStepSize,
} from './theory'
import { makeIvBelow, makeIvFlip, makeIvHear, makeIvHearFind, makeIvInvert, makeIvName, makeIvNumber, makeIvReadName, makeIvReadNumber } from './intervals'
import {
  makeTriadHear,
  makeTriadInversion,
  makeTriadLetters,
  makeTriadQuality,
  makeTriadRead,
  makeTriadShapeFind,
  makeTriadShapeName,
  makeTriadSpell,
  makeTriadThird,
} from './triads'
import {
  makeBoxFind,
  makeCadenceHear,
  makeChordOnDegree,
  makeChordToNumeral,
  makeDegreeQuality,
  makeFourFiveHear,
  makeNumeralRead,
  makeNumeralToChord,
  makePrimaryChord,
  makeProgressionHear,
  makeProgressionName,
  makeProgressionSpell,
} from './harmony'
import {
  eventQuarters,
  NAMEABLE,
  onsets,
  playedIndexes,
  randomMeasure,
  SYMBOLS,
  symbolOf,
  type Measure,
  type Meter,
  type SymbolId,
} from '../music/rhythm'
import {
  FULL_NECK,
  allPositions,
  isNatural,
  midiAt,
  parsePosKey,
  pcName,
  pitchClass,
  posKey,
  positionsForMidi,
  positionsForPc,
  spellMidi,
  written,
  type Position,
  type Region,
  type SpelledNote,
} from '../music/notes'

export interface FactStat {
  seen: number
  correct: number
  /** Recent accuracy, 0–1 (exponential moving average). */
  recent: number
  /** Recent response time in ms (exponential moving average). */
  ms: number
  /** Recent speed against the fluency target (moving average of time ÷ target): 1 = right on target, lower is faster. */
  pace?: number
  /** Days until the next review once it's answered right on time (spaced repetition). */
  interval?: number
  /** When it's next due for review (YYYY-MM-DD). Facts seen before scheduling existed count as due. */
  due?: string
}

/** Whether a fact you've already met is due for review on `day`. */
export const isDue = (stat: FactStat | undefined, day: string) => !!stat && stat.seen > 0 && (!stat.due || stat.due <= day)

export type Stats = Record<string, FactStat>

interface Base {
  id: number
  /** Set on review questions mixed into a take: which tape the material first came from. */
  review?: { tape: number }
  /** Stat keys this question practices: "string:fret" positions, "staff:<midi>", "iv:<semitones>". */
  facts: string[]
}

/** The words of a question, with the part to pick out in amber. */
export interface Ask {
  text: string
  hl?: string
}

/** A theory question answered with buttons. */
export interface TheoryPick {
  ask: Ask
  /** Button labels, or 'notes' for the note keyboard (then `answer` is a pitch class). */
  options: string[] | 'notes'
  answer: number
  /** Why the answer is right, shown once it's answered. */
  why: string
  /** A fretboard to look at (not tap), with more labels once it's answered. */
  board?: { region: Region; markers: Marker[]; after?: Marker[] }
  /** Music to read, with note labels once it's answered (`after`), and the answer written out then too (`afterMeasures`). */
  score?: {
    measures: ScoreMeasure[]
    keySig?: KeyId
    colors?: (string | undefined)[]
    labels?: string[]
    after?: string[]
    afterMeasures?: ScoreMeasure[]
    marker?: number | null
  }
  /** Notes to play once it's answered (sounding MIDI). */
  sound: number[]
  /** For ear questions: what to play when it appears, with a button to hear it again. */
  listen?: Listen
}

/** Notes (sounding MIDI) an ear question plays, one after another or together. */
export interface Listen {
  notes: number[]
  together?: boolean
  /** Played as chords of this many notes, one chord after another. */
  chord?: number
}

/** A theory question answered by tapping the fretboard. */
export interface TheoryTap {
  ask: Ask
  region: Region
  /** On the board from the start: the note to count from, and any pattern around it. */
  markers: Marker[]
  from: Position
  targets: Position[]
  /** Printed on the answer once it's shown ("A", "5"). */
  label: string
  why: string
  listen?: Listen
  /** Notes to play once it's answered, if not the starting note and the tap (a whole chord). */
  sound?: number[]
}

const PICK_KINDS = [
  'stepSize',
  'stepRead',
  'stepNote',
  'scaleStep',
  'scaleNote',
  'degreeName',
  'keySignature',
  'relativeKey',
  'minorNote',
  'ivNumber',
  'ivName',
  'ivReadNumber',
  'ivReadName',
  'ivFlip',
  'ivInvert',
  'ivHear',
  'circleNext',
  'triadLetters',
  'triadSpell',
  'triadThird',
  'triadQuality',
  'triadRead',
  'triadInversion',
  'triadShapeName',
  'triadHear',
  'chordOnDegree',
  'degreeQuality',
  'numeralToChord',
  'chordToNumeral',
  'numeralRead',
  'primaryChord',
  'progressionSpell',
  'progressionName',
  'cadenceHear',
  'fourFiveHear',
  'progressionHear',
] as const
const TAP_KINDS = ['stepFind', 'degreeFind', 'relativeFind', 'ivBelow', 'ivHearFind', 'triadShapeFind', 'boxFind'] as const
export type PickKind = (typeof PICK_KINDS)[number]
export type TapKind = (typeof TAP_KINDS)[number]

export type Question = Base &
  (
    | { kind: 'name'; target: Position; choices: 'naturals' | 'all'; region: Region }
    | { kind: 'find'; pc: number; label: string; string: number; targets: Position[]; region: Region }
    | { kind: 'findAll'; pc: number; label: string; targets: Position[]; region: Region }
    | { kind: 'staffName'; note: SpelledNote; choices: 'naturals' | 'all' }
    | { kind: 'staffFind'; note: SpelledNote; targets: Position[]; region: Region }
    | { kind: 'interval'; root: Position; semitones: number; targets: Position[]; region: Region }
    | { kind: 'intervalName'; root: Position; other: Position; semitones: number; options: number[]; region: Region }
    | { kind: 'symbolName'; symbol: SymbolId; options: SymbolId[] }
    | { kind: 'beats'; symbol: SymbolId; options: number[] }
    | { kind: 'measureFill'; measure: Measure; missing: number; options: SymbolId[] }
    | { kind: 'countBeat'; measure: Measure; beat: number; target: number }
    | { kind: 'tapRhythm'; measure: Measure; bpm: number }
    | { kind: 'accidentalRule'; measures: ScoreMeasure[]; target: number; rule: AccidentalRule }
    | { kind: 'keyName'; key: KeyId; options: KeyId[] }
    | { kind: 'keyNote'; key: KeyId; note: ScoreNote; mode: 'name' | 'find'; region: Region; targets: Position[] }
    | { kind: 'motion'; from: ScoreNote; to: ScoreNote; options: Motion[] }
    | { kind: 'phrase'; measures: ScoreMeasure[]; key: KeyId; region: Region; targets: Position[][] }
    | ({ kind: PickKind } & TheoryPick)
    | ({ kind: TapKind } & TheoryTap)
  )

export type PickQuestion = Extract<Question, { kind: PickKind }>
export type TapQuestion = Extract<Question, { kind: TapKind }>
export const isPick = (q: Question): q is PickQuestion => (PICK_KINDS as readonly string[]).includes(q.kind)
export const isTap = (q: Question): q is TapQuestion => (TAP_KINDS as readonly string[]).includes(q.kind)

export type { Rng } from '../lib/random'

let nextId = 1
export const newQuestionId = () => nextId++

/**
 * How fast a correct answer has to be to count as fluent, by question type. Knowing a note
 * is only useful while playing if it's instant. "Find every copy" isn't timed (it's several taps).
 */
export const FLUENT_MS: Partial<Record<Question['kind'], number>> = {
  name: 2000,
  find: 2500,
  staffName: 2000,
  staffFind: 3000,
  interval: 3000,
  intervalName: 2500,
  symbolName: 2000,
  beats: 2500,
  measureFill: 4000,
  countBeat: 4000,
  accidentalRule: 4000,
  keyName: 3000,
  keyNote: 3000,
  motion: 2000,
  stepSize: 2000,
  stepRead: 2000,
  stepFind: 2500,
  stepNote: 3000,
  scaleStep: 3000,
  scaleNote: 4000,
  degreeName: 3000,
  degreeFind: 3000,
  keySignature: 3000,
  relativeKey: 3000,
  relativeFind: 3000,
  minorNote: 4000,
  ivNumber: 3000,
  ivName: 4000,
  ivReadNumber: 3000,
  ivReadName: 5000,
  ivFlip: 3000,
  ivInvert: 4000,
  ivBelow: 4000,
  // Ear questions are timed from when the notes start playing.
  ivHear: 5000,
  ivHearFind: 6000,
  circleNext: 4000,
  triadLetters: 3000,
  triadSpell: 5000,
  triadThird: 4000,
  triadQuality: 3000,
  triadRead: 5000,
  triadInversion: 4000,
  triadShapeName: 5000,
  triadShapeFind: 4000,
  triadHear: 5000,
  chordOnDegree: 5000,
  degreeQuality: 3000,
  numeralToChord: 5000,
  chordToNumeral: 5000,
  numeralRead: 6000,
  primaryChord: 4000,
  boxFind: 3000,
  progressionSpell: 8000,
  progressionName: 8000,
  // Progressions take a few seconds to play: 1.6 seconds a chord.
  cadenceHear: 9000,
  fourFiveHear: 6000,
  progressionHear: 10000,
}

/** Whether a question needs you to listen. */
export const needsListening = (q: Question) => (isPick(q) || isTap(q)) && !!q.listen

/** Facts never answered quickly count as slow. */
const paceOf = (stat: FactStat) => stat.pace ?? 2

export type Mastery = 'new' | 'learning' | 'accurate' | 'fluent'

/**
 * learning = still getting it wrong; accurate = right but slow; fluent = right and fast, consistently.
 * Knowledge fades: something long past its review date drops back from fluent until it's reviewed.
 */
export function mastery(stat: FactStat | undefined, day: string = today()): Mastery {
  if (!stat || stat.seen === 0) return 'new'
  if (stat.correct < 2 || stat.recent < 0.75) return 'learning'
  if (stat.correct >= 3 && paceOf(stat) <= 1) {
    const overdue = stat.due ? daysBetween(stat.due, day) : 0
    return stat.interval && overdue > stat.interval ? 'accurate' : 'fluent'
  }
  return 'accurate'
}

/**
 * How much a fact needs practice: 0 = solid, 1+ = shaky. Being slow counts, not just being wrong,
 * and so does being due for review.
 */
export function weakness(stat: FactStat | undefined, day: string = today()): number {
  if (!stat || stat.seen === 0) return 0.6
  return 1 - stat.recent + Math.min(0.5, Math.max(0, paceOf(stat) - 1) * 0.5) + (isDue(stat, day) ? 0.3 : 0)
}

const weightOf = (stats: Stats, keys: string[]) =>
  0.4 + 2 * Math.max(...keys.map((k) => weakness(stats[k])))

function weightedPick<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const weights = items.map(weight)
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}


/** Builds a lesson's questions. Weak notes (from past answers) come up more often. */
export function buildSession(spec: LessonSpec, stats: Stats, rng: Rng = Math.random): Question[] {
  const count = spec.count ?? 10
  const region = spec.region
  const pool = allPositions(region).filter((p) => spec.accidentals || isNatural(midiAt(p)))
  const choices = spec.accidentals ? 'all' : 'naturals'

  // Distinct pitches for staff exercises.
  const staffMidis = [...new Set(pool.map(midiAt))]

  const rootStrings = spec.rootStrings ?? region.strings
  const roots = pool.filter((p) => rootStrings.includes(p.string))
  const intervals = spec.intervals ?? [12]
  const findAllLimit = spec.exercises.every((e) => e === 'findAll') ? count : Math.ceil(count / 4)
  let findAllUsed = 0
  const symbols = spec.symbols ?? []
  const meters = spec.meters ?? ['4/4']
  const nameable = NAMEABLE.filter((s) => symbols.includes(s))
  const pickSymbol = () => weightedPick(nameable, (s) => weightOf(stats, [`sym:${s}`]), rng)
  // Reading notes in a key stops at four sharps or flats; the rarer keys are learned by name and signature.
  const readKeys = (spec.keys ?? ['G']).filter((k) => Math.abs(KEYS[k].count) <= 4)
  const triads = spec.triads ?? ['maj']

  const make = (kind: ExerciseType): Question | null => {
    const id = newQuestionId()
    switch (kind) {
      case 'name': {
        const target = weightedPick(pool, (p) => weightOf(stats, [posKey(p)]), rng)
        return { id, kind, target, choices, region, facts: [posKey(target)] }
      }
      case 'find': {
        const p = weightedPick(pool, (q) => weightOf(stats, [posKey(q)]), rng)
        const pc = pitchClass(midiAt(p))
        const targets = positionsForPc(pc, { ...region, strings: [p.string] })
        const label = pcName(pc, randomSpelling(rng))
        return { id, kind, pc, label, string: p.string, targets, region, facts: targets.map(posKey) }
      }
      case 'findAll': {
        if (findAllUsed >= findAllLimit) return null
        const pcs = [...new Set(pool.map((p) => pitchClass(midiAt(p))))]
        const pc = weightedPick(pcs, (c) => weightOf(stats, positionsForPc(c, region).map(posKey)), rng)
        const targets = positionsForPc(pc, region)
        if (targets.length < 2) return null
        return { id, kind, pc, label: pcName(pc, randomSpelling(rng)), targets, region, facts: targets.map(posKey) }
      }
      case 'staffName': {
        if (staffMidis.length === 0) return null
        const midi = weightedPick(staffMidis, (m) => weightOf(stats, [`staff:${written(m)}`]), rng)
        const note = spellMidi(written(midi), randomSpelling(rng))
        return { id, kind, note, choices, facts: [`staff:${written(midi)}`] }
      }
      case 'staffFind': {
        if (staffMidis.length === 0) return null
        const midi = weightedPick(
          staffMidis,
          (m) => weightOf(stats, [`staff:${written(m)}`, ...positionsForMidi(m, region).map(posKey)]),
          rng,
        )
        const note = spellMidi(written(midi), randomSpelling(rng))
        const targets = positionsForMidi(midi, region)
        return { id, kind, note, targets, region, facts: [`staff:${written(midi)}`, ...targets.map(posKey)] }
      }
      case 'interval': {
        const semitones = pick(intervals, rng)
        const root = pick(roots, rng)
        const targets = positionsForMidi(midiAt(root) + semitones, region)
        if (targets.length === 0) return null
        return { id, kind, root, semitones, targets, region, facts: [`iv:${semitones}`] }
      }
      case 'intervalName': {
        const semitones = pick(intervals, rng)
        const root = pick(roots, rng)
        const all = positionsForMidi(midiAt(root) + semitones, region)
        // Prefer the compact shape players actually use: a higher string, within a few frets.
        const near = all.filter((p) => p.string > root.string && Math.abs(p.fret - root.fret) <= 3)
        if (all.length === 0) return null
        const other = pick(near.length ? near : all, rng)
        return { id, kind, root, other, semitones, options: [...intervals].sort((a, b) => a - b), region, facts: [`iv:${semitones}`] }
      }
      case 'symbolName': {
        if (nameable.length < 2) return null
        const symbol = pickSymbol()
        const others = shuffle(nameable.filter((s) => s !== symbol), rng).slice(0, 5)
        const options = NAMEABLE.filter((s) => s === symbol || others.includes(s))
        return { id, kind, symbol, options, facts: [`sym:${symbol}`] }
      }
      case 'beats': {
        if (nameable.length === 0) return null
        const symbol = pickSymbol()
        const options = [...new Set([1, 2, 4, ...nameable.map((s) => SYMBOLS[s].beats)])].sort((a, b) => a - b)
        return { id, kind, symbol, options, facts: [`sym:${symbol}`] }
      }
      case 'measureFill':
        return makeMeasureFill(id, pick(meters, rng), symbols, rng)
      case 'countBeat':
        return makeCountBeat(id, pick(meters, rng), symbols, rng)
      case 'tapRhythm':
        return makeTapRhythm(id, pick(meters, rng), symbols, TAP_BPM, rng)
      case 'accidentalRule':
        return makeAccidentalRule(id, pick(spec.rules ?? ['carry'], rng), rng)
      case 'keyName':
        return makeKeyName(id, spec.keys ?? ['C', 'G', 'D', 'F'], rng)
      case 'keyNote':
        return makeKeyNote(id, pick(readKeys, rng), rng() < 0.5 ? 'name' : 'find', region, rng)
      case 'motion':
        return makeMotion(id, spec.motions ?? ['step', 'skip'], rng)
      case 'phrase':
        return makePhrase(id, pick(spec.keys ?? ['C'], rng), region, rng() < 0.5 ? 3 : 4, rng)
      case 'stepSize':
        return makeStepSize(id, region, rng)
      case 'stepRead':
        return makeStepRead(id, rng)
      case 'stepFind':
        return makeStepFind(id, region, rng)
      case 'stepNote':
        return makeStepNote(id, rng)
      case 'scaleStep':
        return makeScaleStep(id, rng)
      case 'scaleNote':
        return makeScaleNote(id, spec.keys ?? ['C'], rng)
      case 'degreeName':
        return makeDegreeName(id, rootStrings, rng)
      case 'degreeFind':
        return makeDegreeFind(id, rootStrings, rng)
      case 'keySignature':
        return makeKeySignature(id, spec.keys ?? ['C', 'G', 'D', 'F'], rng)
      case 'relativeKey':
        return makeRelativeKey(id, spec.keys ?? ['C'], rng, undefined, spec.showScale)
      case 'relativeFind':
        return makeRelativeFind(id, region, rng)
      case 'minorNote':
        return makeMinorNote(id, spec.keys ?? ['C'], rng)
      case 'ivNumber':
        return makeIvNumber(id, rng)
      case 'ivName':
        return makeIvName(id, spec.ivNames ?? ['M3', 'P5'], rng)
      case 'ivReadNumber':
        return makeIvReadNumber(id, rng)
      case 'ivReadName':
        return makeIvReadName(id, spec.keys ?? ['C'], spec.ivNames ?? ['M3', 'P5'], !!spec.stacked, rng)
      case 'ivFlip':
        return makeIvFlip(id, rng)
      case 'ivInvert':
        return makeIvInvert(id, spec.ivNames ?? ['M3', 'P5'], rng)
      case 'ivBelow':
        return makeIvBelow(id, spec.ivNames ?? ['P4', 'P5'], rng)
      case 'ivHear':
        return makeIvHear(id, spec.ivNames ?? ['P8', 'P5'], spec.ear ?? ['up'], rng)
      case 'ivHearFind':
        return makeIvHearFind(id, spec.ivNames ?? ['P8', 'P5'], rng)
      case 'circleNext':
        return makeCircleNext(id, spec.keys ?? ['C', 'G', 'D'], rng)
      case 'triadLetters':
        return makeTriadLetters(id, rng)
      case 'triadSpell':
        return makeTriadSpell(id, spec.keys ?? [], pick(triads, rng), rng, spec.showScale)
      case 'triadThird':
        return makeTriadThird(id, spec.keys ?? [], pick(triads, rng), rng, triads)
      case 'triadQuality':
        return makeTriadQuality(id, spec.keys ?? [], triads, rng)
      case 'triadRead':
        return makeTriadRead(id, spec.keys ?? ['C'], !!spec.inverted, rng)
      case 'triadInversion':
        return makeTriadInversion(id, spec.keys ?? ['C'], rng)
      case 'triadShapeName':
        return makeTriadShapeName(id, spec.keys ?? [], triads, region.strings, rng)
      case 'triadShapeFind':
        return makeTriadShapeFind(id, spec.keys ?? [], triads, region.strings, rng)
      case 'triadHear':
        return makeTriadHear(id, triads, (spec.ear ?? ['up']).filter((e) => e !== 'down'), rng)
      case 'chordOnDegree':
        return makeChordOnDegree(id, spec.keys ?? ['C'], rng, spec.showScale)
      case 'degreeQuality':
        return makeDegreeQuality(id, rng)
      case 'numeralToChord':
        return makeNumeralToChord(id, spec.keys ?? ['C'], rng)
      case 'chordToNumeral':
        return makeChordToNumeral(id, spec.keys ?? ['C'], rng)
      case 'numeralRead':
        return makeNumeralRead(id, spec.keys ?? ['C'], rng)
      case 'primaryChord':
        return makePrimaryChord(id, spec.keys ?? ['C'], rng() < 0.5, rng)
      case 'boxFind':
        return makeBoxFind(id, rng)
      case 'progressionSpell':
        return makeProgressionSpell(id, spec.keys ?? ['C'], spec.progressions ?? ['I-IV-V-I'], rng)
      case 'progressionName':
        return makeProgressionName(id, spec.keys ?? ['C'], spec.progressions ?? ['I-IV-V-I'], rng)
      case 'cadenceHear':
        return makeCadenceHear(id, rng)
      case 'fourFiveHear':
        return makeFourFiveHear(id, rng)
      case 'progressionHear':
        return makeProgressionHear(id, spec.progressions ?? [], rng)
    }
  }

  const questions: Question[] = []
  let last = ''
  while (questions.length < count) {
    let added = false
    for (let attempt = 0; attempt < 30 && !added; attempt++) {
      const q = make(pick(spec.exercises, rng))
      if (!q) continue
      const sig = signature(q)
      if (sig === last) continue
      questions.push(q)
      if (q.kind === 'findAll') findAllUsed++
      last = sig
      added = true
    }
    // A tiny pool can make every pick a repeat; accept it rather than loop forever.
    if (!added) {
      const q = make(spec.exercises.find((e) => e !== 'findAll') ?? spec.exercises[0])
      if (!q) break
      questions.push(q)
      if (q.kind === 'findAll') findAllUsed++
    }
  }
  return questions
}

/** A measure and a count ("beat 3", "the & of 2") to find in it. */
export function makeCountBeat(id: number, meter: Meter, symbols: SymbolId[], rng: Rng, focus: SymbolId[] = []): Question {
  // A measure with at least two notes to choose between (a lone whole note makes it trivial).
  let measure = randomMeasure(meter, symbols, rng, focus)
  for (let i = 0; i < 20 && playedIndexes(measure).length < 2; i++) measure = randomMeasure(meter, symbols, rng, focus)
  const starts = onsets(measure)
  const played = playedIndexes(measure)
  // Beat 1 is too easy; ask about a later note when there is one.
  const later = played.filter((i) => starts[i] > 0)
  const target = pick(later.length ? later : played, rng)
  return { id, kind: 'countBeat', measure, beat: starts[target], target, facts: [`count:${meter}`] }
}

/** Tempo for tapping rhythms, in beats per minute. */
export const TAP_BPM = 60

/** A measure to tap in time. */
export function makeTapRhythm(id: number, meter: Meter, symbols: SymbolId[], bpm: number, rng: Rng, focus: SymbolId[] = []): Question {
  let measure = randomMeasure(meter, symbols, rng, focus)
  for (let i = 0; i < 10 && playedIndexes(measure).length < 2; i++) measure = randomMeasure(meter, symbols, rng, focus)
  const used = [...new Set(measure.events.map(symbolOf))]
  // In cut time the beat is a half note, so the same tempo would feel twice as fast; ease it off.
  const tempo = meter === '2/2' ? Math.round(bpm * 0.8) : bpm
  return { id, kind: 'tapRhythm', measure, bpm: tempo, facts: used.map((s) => `sym:${s}`) }
}

/** A measure with its last value blanked out, and choices for what fills it. */
export function makeMeasureFill(id: number, meter: Meter, symbols: SymbolId[], rng: Rng): Question | null {
  const nameable = NAMEABLE.filter((s) => symbols.includes(s) && s !== 'eighth')
  for (let attempt = 0; attempt < 30; attempt++) {
    const full = randomMeasure(meter, symbols, rng)
    // Leave at least one value standing, so there's a measure to read.
    if (full.events.length < 2) continue
    const last = full.events[full.events.length - 1]
    const before = full.events[full.events.length - 2]
    // Only blank a value that stands alone (not half of an eighth pair, a dotted pair, or a tie).
    if (last.dur === '8' || before?.tie || before?.dots) continue
    const answer = symbolOf(last)
    if (!nameable.includes(answer)) continue
    const missing = eventQuarters(last)
    const distractors = shuffle(nameable.filter((s) => SYMBOLS[s].beats !== missing), rng).slice(0, 3)
    if (distractors.length === 0) continue
    const options = shuffle([answer, ...distractors], rng)
    const measure = { meter, events: full.events.slice(0, -1) }
    return { id, kind: 'measureFill', measure, missing, options, facts: [`fill:${meter}`] }
  }
  return null
}

/** Identifies "the same question" so we don't ask it twice in a row. */
function signature(q: Question): string {
  // The same words can go with different notes on the board or staff.
  if (isPick(q)) return `${q.kind}:${q.ask.text}:${JSON.stringify(q.board?.markers ?? q.score?.measures ?? null)}`
  if (isTap(q)) return `${q.kind}:${q.ask.text}:${posKey(q.from)}`
  switch (q.kind) {
    case 'name':
      return `pos:${posKey(q.target)}`
    case 'find':
    case 'findAll':
      return `pc:${q.pc}`
    case 'staffName':
    case 'staffFind':
      return `staff:${q.note.letter}${q.note.acc}${q.note.octave}`
    case 'interval':
    case 'intervalName':
      return `iv:${posKey(q.root)}:${q.semitones}`
    case 'symbolName':
    case 'beats':
      return `sym:${q.symbol}`
    case 'measureFill':
    case 'countBeat':
    case 'tapRhythm':
      return `${q.kind}:${JSON.stringify(q.measure.events)}`
    case 'accidentalRule':
    case 'phrase':
      return `${q.kind}:${JSON.stringify(q.measures)}`
    case 'keyName':
      return `key:${q.key}`
    case 'keyNote':
      return `keyNote:${q.key}:${q.note.letter}${q.note.octave}`
    case 'motion':
      return `motion:${q.from.letter}${q.from.octave}:${q.to.letter}${q.to.octave}`
  }
}

/** A long run of name/find questions on specific spots (weak ones more often), for sprints. */
export function buildFromPositions(positions: Position[], stats: Stats, count: number, rng: Rng = Math.random): Question[] {
  const choices = positions.some((p) => !isNatural(midiAt(p))) ? 'all' : 'naturals'
  const questions: Question[] = []
  let last = ''
  while (questions.length < count) {
    const p = weightedPick(positions, (q) => weightOf(stats, [posKey(q)]), rng)
    if (posKey(p) === last && positions.length > 1) continue
    last = posKey(p)
    const pc = pitchClass(midiAt(p))
    if (rng() < 0.5) {
      questions.push({ id: newQuestionId(), kind: 'name', target: p, choices, region: FULL_NECK, facts: [posKey(p)] })
    } else {
      const targets = positionsForPc(pc, { ...FULL_NECK, strings: [p.string] })
      const label = pcName(pc, randomSpelling(rng))
      questions.push({ id: newQuestionId(), kind: 'find', pc, label, string: p.string, targets, region: FULL_NECK, facts: targets.map(posKey) })
    }
  }
  return questions
}

/** Every spot on the neck you've answered at least once. */
export function practicedPositions(stats: Stats): Position[] {
  return Object.entries(stats).flatMap(([key, stat]) => {
    const pos = parsePosKey(key)
    return pos && stat.seen > 0 ? [pos] : []
  })
}
