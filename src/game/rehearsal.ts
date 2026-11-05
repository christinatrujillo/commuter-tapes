import type { Marker } from '../components/Fretboard'
import { ALL_LESSONS, findLesson, type ExerciseType, type LessonSpec } from '../music/curriculum'
import {
  allPositions,
  describePosition,
  intervalInfo,
  isNatural,
  LETTERS,
  midiAt,
  noteAt,
  ordinal,
  pcName,
  pitchClass,
  positionsForMidi,
  positionsForPc,
  posKey,
  spelledMidi,
  spelledName,
  spellMidi,
  staffPlace,
  stringName,
  TUNING,
  vexKey,
  written,
  WRITTEN_OCTAVE_SHIFT,
  type Position,
  type Region,
} from '../music/notes'
import { beatsText, countAt, eventQuarters, METER_PULSE, NAMEABLE, note, onsets, rest, SYMBOLS, type Measure, type Meter, type RhythmEvent, type SymbolId } from '../music/rhythm'
import {
  KEY_ORDER,
  resolveNotes,
  type AccidentalRule,
  type KeyId,
  type MotionKind,
  type ScoreMeasure,
  type ScoreNote,
} from '../music/score'
import { buildSession, makeCountBeat, makeMeasureFill, makeTapRhythm, newQuestionId, TAP_BPM, type Listen, type Question, type Rng } from './questions'
import { pick, randomSpelling } from '../lib/random'
import { capitalize } from '../lib/text'
import { makeAccidentalRule, makeKeyName, makeKeyNote, makeMotion, makePhrase } from './reading'
import { isIntroItem, isTheoryItem, THEORY_ORDER, theoryCard, theoryCheck } from './theory'

/**
 * A rehearsal teaches a track's new material before the take tests it: a card for each new
 * note, shape or rhythm idea (two at a time), each pair followed by a quick check, then a
 * mixed check of everything new. Small chunks, anchors first, and immediate recall are what
 * make new facts stick.
 */

export interface Card {
  /** Printed on label tape: the note, group, interval or rhythm idea being taught. */
  title: string
  subtitle: string
  /** A memory hook: how this relates to things you already know. */
  hook: string
  /** Why it matters when you play, set apart under its own label. */
  onGuitar?: string
  /** "New note 2 of 4" */
  counter: string
  board?: { region: Region; markers: Marker[] }
  staff?: { keys: string[]; labels: string[] }
  /** An example measure, with the counts written underneath. */
  notation?: { measure: Measure; labels?: string[]; blankBeats?: number; clef?: boolean; timeSig?: boolean }
  /** Notes (sounding MIDI) to play when the card appears. */
  sound: number[]
  /** A rhythm to play (clicks and notes) when the card appears. */
  rhythm?: { measure: Measure; bpm: number }
  /** A worked example in real notation (key signature, accidentals, a marked note). */
  score?: { measures: ScoreMeasure[]; keySig?: KeyId; meter?: Meter | null; labels?: string[]; marker?: number | null; colors?: (string | undefined)[] }
  /** The circle of fifths with these major keys lit, and the relative minors of `minors`. */
  circle?: { majors: KeyId[]; minors?: KeyId[] }
  /** Ear-training examples, played even with answer sounds off. */
  listen?: Listen
}

export type RehearsalStep = { kind: 'card'; card: Card } | { kind: 'check'; questions: Question[] } | { kind: 'ready' }

export interface Rehearsal {
  lesson: LessonSpec
  /** 'learn' teaches new material; 'warmup' is a quick run-through for tracks with nothing new. */
  mode: 'learn' | 'warmup'
  newCount: number
  /** "note", "shape" or "idea", for wording. */
  noun: string
  steps: RehearsalStep[]
}

type Family = 'position' | 'staff' | 'interval' | 'rhythm' | 'reading' | 'theory'

const READING_PREFIXES = ['rule:', 'key:', 'motion:', 'skill:phrase', 'skill:keyName']

const familyOf = (item: string): Family =>
  /^\d:\d+$/.test(item)
    ? 'position'
    : item.startsWith('staff:')
      ? 'staff'
      : item.startsWith('iv:')
        ? 'interval'
        : READING_PREFIXES.some((p) => item.startsWith(p))
          ? 'reading'
          : isTheoryItem(item)
            ? 'theory'
            : 'rhythm'

const BOARD: ExerciseType[] = ['name', 'find', 'findAll']
const STAFF: ExerciseType[] = ['staffName', 'staffFind']
const INTERVAL: ExerciseType[] = ['interval', 'intervalName']
const RHYTHM: ExerciseType[] = ['symbolName', 'beats', 'measureFill', 'countBeat', 'tapRhythm']
const RHYTHM_SKILLS: ExerciseType[] = ['countBeat', 'measureFill', 'tapRhythm']
const uses = (l: LessonSpec, types: ExerciseType[]) => l.exercises.some((e) => types.includes(e))

const noteName = (p: Position) => pcName(pitchClass(midiAt(p)))
const lessonPositions = (l: LessonSpec) => allPositions(l.region).filter((p) => l.accidentals || isNatural(midiAt(p)))
const metersOf = (l: LessonSpec): Meter[] => l.meters ?? ['4/4']

/** Written pitches a staff lesson uses, low to high. */
function staffNotes(l: LessonSpec): number[] {
  return [...new Set(lessonPositions(l).map((p) => written(midiAt(p))))].sort((a, b) => a - b)
}

/** Interval shapes change when they cross from the G string to the B string. */
function crossesB(semitones: number, rootString: number): boolean {
  return semitones === 12 ? rootString === 2 || rootString === 3 : rootString === 3
}
const stringsAcross = (semitones: number) => (semitones === 12 ? 2 : 1)

/**
 * Everything a lesson teaches, as keys: "string:fret", "staff:<written midi>",
 * "iv:<semitones>:<n|b>", "sym:<symbol>", "meter:<time signature>", "skill:<exercise>".
 */
function itemsFor(l: LessonSpec): string[] {
  const items: string[] = []
  if (uses(l, BOARD)) items.push(...lessonPositions(l).map(posKey))
  if (uses(l, STAFF)) items.push(...staffNotes(l).map((w) => `staff:${w}`))
  if (uses(l, INTERVAL)) {
    for (const semi of l.intervals ?? [12]) {
      const roots = (l.rootStrings ?? l.region.strings).filter((s) => s + stringsAcross(semi) <= 5)
      for (const cross of [false, true]) {
        if (roots.some((s) => crossesB(semi, s) === cross)) items.push(`iv:${semi}:${cross ? 'b' : 'n'}`)
      }
    }
  }
  if (uses(l, RHYTHM)) {
    items.push(...(l.symbols ?? []).map((s) => `sym:${s}`), ...metersOf(l).map((m) => `meter:${m}`))
    items.push(...RHYTHM_SKILLS.filter((t) => l.exercises.includes(t)).map((t) => `skill:${t}`))
  }
  if (l.exercises.includes('accidentalRule')) items.push(...(l.rules ?? []).map((r) => `rule:${r}`))
  // Keys with a card of their own; the rest are taught together on the circle of fifths.
  if (l.exercises.includes('keyNote') || l.exercises.includes('keyName')) items.push(...(l.keys ?? []).filter((k) => READING_TEACHING[`key:${k}`]).map((k) => `key:${k}`))
  if (l.exercises.includes('keyName')) items.push('skill:keyName')
  if (l.exercises.includes('motion')) items.push(...(l.motions ?? []).map((m) => `motion:${m}`))
  if (l.exercises.includes('phrase')) items.push('skill:phrase')
  items.push(...(l.topics ?? []))
  return items
}

/** What a lesson leaves you knowing. Reading a note in first position also teaches where it's played. */
export function coveredBy(l: LessonSpec): string[] {
  return l.exercises.includes('staffFind') ? [...itemsFor(l), ...lessonPositions(l).map(posKey)] : itemsFor(l)
}

let taughtIn: Map<string, string> | null = null

/** The first track on the shelf that teaches an item, or null if none does. */
export function firstTaughtIn(item: string): string | null {
  if (!taughtIn) {
    taughtIn = new Map()
    for (const l of ALL_LESSONS) for (const i of coveredBy(l)) if (!taughtIn.has(i)) taughtIn.set(i, l.id)
  }
  return taughtIn.get(item) ?? null
}

/** Items taught by every track before this one on the shelf. */
function introducedBefore(lessonId: string): Set<string> {
  const known = new Set<string>()
  for (const l of ALL_LESSONS) {
    if (l.id === lessonId) break
    for (const item of coveredBy(l)) known.add(item)
  }
  return known
}

const parsePos = (key: string): Position => {
  const [s, f] = key.split(':').map(Number)
  return { string: s, fret: f }
}

// ---------------------------------------------------------------------------
// Memory hooks
// ---------------------------------------------------------------------------

/** Landmarks first: open string, 12th fret, "next string's open note", the dots, then the rest. */
function anchorRank(p: Position): number {
  if (p.fret === 0) return 0
  if (p.fret === 12) return 1
  if (p.string < 5 && midiAt(p) === TUNING[p.string + 1]) return 2
  const dots = [5, 7, 3, 9]
  if (dots.includes(p.fret)) return 3 + dots.indexOf(p.fret) / 10
  return 4 + p.fret / 100
}

function fretHook(p: Position, known: Position[]): string {
  const pc = pitchClass(midiAt(p))
  if (!isNatural(pc)) {
    return `One fret above ${pcName(pc - 1)}, so it’s ${pcName(pc, 'sharp')}. It’s also one fret below ${pcName(pc + 1)}, so it’s ${pcName(pc, 'flat')} too.`
  }
  const parts: string[] = []
  if (p.fret === 0) {
    parts.push(p.string === 5 ? 'The open high E: the same note as the low E, two octaves up.' : 'The open string. It’s named after the string itself.')
  } else if (p.fret === 12) {
    parts.push('The 12th fret (the double dot) is the open string’s note again, one level higher: an octave up.')
  } else {
    if (p.string < 5 && midiAt(p) === TUNING[p.string + 1]) {
      parts.push(`Same note as the open ${stringName(p.string + 1)} string.`)
    } else {
      const anchor = known
        .filter((k) => k.string === p.string && k.fret !== p.fret)
        .sort((a, b) => Math.abs(a.fret - p.fret) - Math.abs(b.fret - p.fret) || a.fret - b.fret)[0]
      if (anchor) {
        const d = p.fret - anchor.fret
        const n = Math.abs(d)
        parts.push(`${n === 1 ? 'One fret' : `${n} frets`} ${d > 0 ? 'above' : 'below'} ${noteName(anchor)}${n === 1 ? ', with no note in between' : ''}.`)
      }
    }
    if ([3, 5, 7, 9].includes(p.fret)) parts.push(`Look for the dot at the ${ordinal(p.fret)} fret.`)
  }
  // The two E strings mirror each other; point it out once the other one is known.
  const mirror = p.string === 5 ? 0 : p.string === 0 ? 5 : -1
  if (p.fret !== 0 && mirror !== -1 && known.some((k) => k.string === mirror && k.fret === p.fret)) {
    parts.push(`Same fret as on the ${stringName(mirror)} string.`)
  }
  return parts.join(' ')
}

/** Staff position counted in steps: 0 = E4 (bottom line), 8 = F5 (top line). */
function staffStep(w: number): number {
  const n = spellMidi(w, 'sharp')
  return n.octave * 7 + LETTERS.indexOf(n.letter) - (4 * 7 + 2)
}

function staffHook(w: number, l: LessonSpec): string {
  const note = spellMidi(w, 'sharp')
  const parts: string[] = []
  if (note.acc !== 0) {
    const flat = spellMidi(w, 'flat')
    parts.push(`Same note, two spellings: ${spelledName(note)} and ${spelledName(flat)}.`)
  } else {
    const step = staffStep(w)
    if (step >= 0 && step <= 8) {
      parts.push(step % 2 === 0 ? 'Lines, bottom to top: E G B D F (Every Good Boy Does Fine).' : 'Spaces, bottom to top: F A C E.')
    } else if (step === -2 || step === 10) {
      // Where it sits is the card's subtitle. The first ledger line each way is where ledger lines show up, so say what they are.
      parts.push('Ledger lines are short extra lines that extend the staff up or down.')
    }
  }
  if (w === 60) parts.push('This is middle C, the C in the middle of a piano keyboard.')
  const spot = positionsForMidi(w - WRITTEN_OCTAVE_SHIFT, l.region).sort((a, b) => a.fret - b.fret)[0]
  if (spot) {
    parts.push(`Play it on the ${describePosition(spot)}.`)
    // First position: one finger per fret.
    if (l.region.maxFret <= 4 && spot.fret > 0) parts.push(`Use your ${ordinal(spot.fret)} finger.`)
  }
  return parts.join(' ')
}

const SHAPES: Record<number, { normal: string; cross: string }> = {
  12: { normal: '2 strings over, 2 frets up.', cross: 'Crossing the B string: 2 strings over, 3 frets up.' },
  7: { normal: 'Next string over, 2 frets up. That’s the power chord shape.', cross: 'Onto the B string it’s 3 frets up: the B string adds a fret, just as with octaves.' },
  5: { normal: 'Next string over, same fret.', cross: 'Onto the B string it’s 1 fret up: the B string adds a fret.' },
  4: { normal: 'Next string over, 1 fret back toward the tuning pegs.', cross: 'Onto the B string it’s the same fret: the B string adds a fret back.' },
  3: { normal: 'Next string over, 2 frets back toward the tuning pegs.', cross: 'Onto the B string it’s 1 fret back: the B string adds a fret.' },
}

// ---------------------------------------------------------------------------
// Rhythm teaching material
// ---------------------------------------------------------------------------

// Short names for the example measures below.
const n = note
const r = rest
const m4 = (...events: RhythmEvent[]): Measure => ({ meter: '4/4', events })
const m3 = (...events: RhythmEvent[]): Measure => ({ meter: '3/4', events })
const m2 = (...events: RhythmEvent[]): Measure => ({ meter: '2/4', events })
const cut = (...events: RhythmEvent[]): Measure => ({ meter: '2/2', events })

const SYMBOL_TEACHING: Record<SymbolId, { hook: string; example: Measure }> = {
  whole: { hook: 'A whole note is an open oval with no stem (the stick attached to most notes). Hold it for 4 beats: through 1, 2, 3 and 4.', example: m4(n('w')) },
  half: { hook: 'A half note is an open oval with a stem. Hold it for 2 beats, half as long as a whole note.', example: m4(n('h'), n('h')) },
  quarter: { hook: 'A quarter note is a filled-in oval with a stem. It lasts 1 beat, so four of them fill a measure of 4/4.', example: m4(n('q'), n('q'), n('q'), n('q')) },
  eighth: {
    hook: 'An eighth note is a filled oval with a stem and a little flag; two in a row are joined by a thick line called a beam. Each lasts half a beat, so two fit in one beat: count “1 &”.',
    example: m4(n('q'), n('8'), n('8'), n('q'), n('8'), n('8')),
  },
  dottedHalf: { hook: 'A dot adds half the note’s value: 2 + 1 = 3 beats. It fills a whole measure of 3/4.', example: m3(n('h', 1)) },
  dottedQuarter: {
    hook: 'A dot adds half: 1 + ½ = 1½ beats. It’s usually followed by an eighth to finish the beat.',
    example: m4(n('q', 1), n('8'), n('h')),
  },
  wholeRest: { hook: 'A rest means silence: you play nothing for that long. The whole rest is a block hanging down from the 4th line, and it silences a whole measure.', example: m4(r('w')) },
  halfRest: { hook: 'A block sitting on the middle line, like a hat: 2 beats of silence.', example: m4(n('h'), r('h')) },
  quarterRest: { hook: 'The squiggle: 1 beat of silence.', example: m4(n('q'), r('q'), n('q'), r('q')) },
  tie: {
    hook: 'A tie is a curve joining two of the same note. Play the first and keep holding through the second: their beats add up.',
    example: m4(n('q'), n('q', 0, true), n('q'), n('q')),
  },
}

const METER_TEACHING: Record<Meter, { hook: string; example: Measure }> = {
  '4/4': {
    hook: 'The two numbers at the start are the time signature. The top 4 means four beats in each measure. The bottom 4 means each beat is a quarter note long.',
    example: m4(n('q'), n('q'), n('q'), n('q')),
  },
  '3/4': { hook: 'Three quarter-note beats per measure. Count 1 2 3, with the weight on 1, like a waltz.', example: m3(n('q'), n('q'), n('q')) },
  '2/4': { hook: 'Two quarter-note beats per measure. Count 1 2. Marches and lots of folk songs are in 2/4.', example: m2(n('q'), n('8'), n('8')) },
  '2/2': {
    hook: '¢ means 2/2: two beats per measure, and the half note gets the beat. Count 1 2. Quarter notes land on 1 & 2 &.',
    example: cut(n('h'), n('q'), n('q')),
  },
}

const SKILL_TEACHING: Record<string, { title: string; subtitle: string; hook: string; example: Measure; blankBeats?: number }> = {
  countBeat: {
    title: 'Counting',
    subtitle: 'Every note starts on a count',
    hook: 'Say the counts in your head as you read. A half note on 1 covers 1 and 2, so the next note starts on 3.',
    example: m4(n('h'), n('q'), n('q')),
  },
  measureFill: {
    title: 'Full measures',
    subtitle: 'The beats always add up',
    hook: 'The notes in a measure always add up to the top number of the time signature: 4 beats in 4/4. Here only 3 beats are written, so 1 beat is missing.',
    example: m4(n('h'), n('q')),
    blankBeats: 1,
  },
  tapRhythm: {
    title: 'Tapping rhythms',
    subtitle: 'One tap per note, right on its count',
    hook: 'First you’ll hear one measure of clicks, a count-in, to set the speed. Then tap once at the start of each note, and wait through long notes. On a laptop, Space taps too.',
    example: m4(n('q'), n('q'), n('h')),
  },
}

/** The counts each note covers, written under it: "1 2" for a half note on 1, "(3) (4)" for a half rest on 3. */
export function heldCounts(m: Measure): string[] {
  const starts = onsets(m)
  const beatLength = METER_PULSE[m.meter].quarters
  return m.events.map((e, i) => {
    const end = starts[i] + eventQuarters(e)
    const counts = [countAt(starts[i], m.meter)]
    // Each further beat the note (or rest) is held through gets its count too.
    for (let b = (Math.floor(starts[i] / beatLength) + 1) * beatLength; b < end; b += beatLength) counts.push(countAt(b, m.meter))
    // Silent counts get their own brackets, so each one still lines up under its beat.
    return (e.rest ? counts.map((c) => `(${c})`) : counts).join(' ')
  })
}

const RHYTHM_BPM = 72

function rhythmCard(item: string, counter: string): Card {
  const [kind, value] = item.split(':')
  if (kind === 'sym') {
    const s = value as SymbolId
    const t = SYMBOL_TEACHING[s]
    return {
      title: SYMBOLS[s].name,
      subtitle: s === 'tie' ? 'Joins two notes into one' : beatsText(SYMBOLS[s].beats),
      hook: t.hook,
      counter,
      notation: { measure: t.example, labels: heldCounts(t.example) },
      sound: [],
      rhythm: { measure: t.example, bpm: RHYTHM_BPM },
    }
  }
  if (kind === 'meter') {
    const t = METER_TEACHING[value as Meter]
    return {
      title: value === '2/2' ? 'Cut time (¢)' : `${value} time`,
      subtitle: `${METER_PULSE[value as Meter].beats} beats per measure`,
      hook: t.hook,
      counter,
      notation: { measure: t.example, labels: heldCounts(t.example) },
      sound: [],
      rhythm: { measure: t.example, bpm: RHYTHM_BPM },
    }
  }
  const t = SKILL_TEACHING[value]
  return {
    title: t.title,
    subtitle: t.subtitle,
    hook: t.hook,
    counter,
    notation: { measure: t.example, labels: t.blankBeats ? undefined : heldCounts(t.example), blankBeats: t.blankBeats },
    sound: [],
    rhythm: t.blankBeats ? undefined : { measure: t.example, bpm: RHYTHM_BPM },
  }
}

// ---------------------------------------------------------------------------
// Reading material: the measure rule, key signatures, steps and skips, phrases
// ---------------------------------------------------------------------------

const sn = (letter: ScoreNote['letter'], octave: number, dur: ScoreNote['dur'] = 'q', sign?: ScoreNote['sign']): ScoreNote => ({
  letter,
  octave,
  dur,
  ...(sign !== undefined ? { sign } : {}),
})

interface ReadingTeaching {
  title: string
  subtitle: string
  hook: string
  measures: ScoreMeasure[]
  keySig?: KeyId
  meter?: Meter | null
  /** The note to point at, if one matters most. */
  marker?: number
}

const READING_TEACHING: Record<string, ReadingTeaching> = {
  'rule:carry': {
    title: 'The measure rule',
    subtitle: 'An accidental lasts to the bar line',
    hook: 'A sharp or flat keeps working for the rest of the measure, on that same line or space. The second F here is F♯ too, even with no sign.',
    measures: [[sn('F', 4, 'q', 1), sn('G', 4), sn('F', 4), sn('E', 4)]],
    meter: '4/4',
    marker: 2,
  },
  'rule:natural': {
    title: 'Natural sign',
    subtitle: 'Cancels a sharp or flat',
    hook: 'The natural sign (♮) turns a note back to plain. After F♯, an F with a ♮ is plain F.',
    measures: [[sn('F', 4, 'q', 1), sn('G', 4), sn('F', 4, 'q', 0), sn('E', 4)]],
    meter: '4/4',
    marker: 2,
  },
  'rule:barline': {
    title: 'Bar lines reset',
    subtitle: 'Each measure starts fresh',
    hook: 'Accidentals end at the bar line. In the next measure, F is plain F again unless it’s marked.',
    measures: [
      [sn('G', 4), sn('A', 4), sn('F', 4, 'q', 1), sn('A', 4)],
      [sn('F', 4, 'h'), sn('G', 4, 'h')],
    ],
    meter: '4/4',
    marker: 4,
  },
  'rule:octave': {
    title: 'Same line or space only',
    subtitle: 'Other octaves aren’t affected',
    hook: 'An accidental only changes notes on its own line or space. The F up on the top line isn’t sharp.',
    measures: [[sn('F', 4, 'q', 1), sn('A', 4), sn('F', 5), sn('D', 5)]],
    meter: '4/4',
    marker: 2,
  },
  'key:G': {
    title: 'Key of G',
    subtitle: 'One sharp: F♯',
    hook: 'The G major scale has one sharp, F♯ (you built it on tape 23). Instead of writing a ♯ on every F, music writes it once, right after the clef: that’s the key signature. Every F, on every line and space, is played F♯ for the whole piece.',
    measures: [[sn('E', 4), sn('F', 4), sn('G', 4), sn('A', 4)]],
    keySig: 'G',
    marker: 1,
  },
  'key:D': {
    title: 'Key of D',
    subtitle: 'Two sharps: F♯ and C♯',
    hook: 'In D major every F and every C is sharp. The other letters stay as they are.',
    measures: [[sn('F', 4), sn('A', 4), sn('C', 5), sn('D', 5)]],
    keySig: 'D',
    marker: 2,
  },
  'key:F': {
    title: 'Key of F',
    subtitle: 'One flat: B♭',
    hook: 'In F major every B is played B♭, one fret below B.',
    measures: [[sn('F', 4), sn('G', 4), sn('A', 4), sn('B', 4)]],
    keySig: 'F',
    marker: 3,
  },
  'key:C': {
    title: 'Key of C',
    subtitle: 'No sharps or flats',
    hook: 'An empty key signature means C major: every note is natural unless a sign in front of it says otherwise.',
    measures: [[sn('C', 5), sn('D', 5), sn('E', 5), sn('F', 5)]],
    keySig: 'C',
  },
  'skill:keyName': {
    title: 'Naming the key',
    subtitle: 'Read the key signature',
    hook: 'For sharp keys, go one fret above the last sharp: F♯ means G major, F♯ and C♯ mean D major. One flat (B♭) means F major. None means C major.',
    measures: [[]],
    keySig: 'D',
  },
  'motion:step': {
    title: 'Steps',
    subtitle: 'To the very next line or space',
    hook: 'A step goes from a line to the next space, or a space to the next line: the next letter, like E to F. On the guitar it’s usually the next note on the same string.',
    measures: [[sn('E', 4, 'w'), sn('F', 4, 'w')]],
  },
  'motion:skip': {
    title: 'Skips',
    subtitle: 'Line to line, or space to space',
    hook: 'A skip jumps over one letter: E to G, both on lines. Melodies that skip often trace out chords, groups of notes that sound good together.',
    measures: [[sn('E', 4, 'w'), sn('G', 4, 'w')]],
  },
  'motion:leap': {
    title: 'Leaps',
    subtitle: 'Bigger than a skip',
    hook: 'Anything wider than a skip is a leap. Count the lines and spaces it crosses: E up to B jumps over F, G and A.',
    measures: [[sn('E', 4, 'w'), sn('B', 4, 'w')]],
  },
  'motion:same': {
    title: 'Same note',
    subtitle: 'It stays put',
    hook: 'When the next note sits on the same line or space, play the same note again.',
    measures: [[sn('G', 4, 'w'), sn('G', 4, 'w')]],
  },
  'skill:phrase': {
    title: 'Reading phrases',
    subtitle: 'Read ahead, then play',
    hook: 'Look over the whole phrase first: where it starts and how it moves (here: step up, step up, skip down). Then tap the notes in order on the fretboard.',
    measures: [[sn('G', 4), sn('A', 4), sn('B', 4), sn('G', 4)]],
    meter: '4/4',
  },
}

function readingCard(item: string, counter: string): Card {
  const t = READING_TEACHING[item]
  const notes = resolveNotes(t.measures, t.keySig ?? 'C')
  return {
    title: t.title,
    subtitle: t.subtitle,
    hook: t.hook,
    counter,
    score: { measures: t.measures, keySig: t.keySig, meter: t.meter ?? null, labels: notes.map((x) => spelledName(x)), marker: t.marker ?? null },
    sound: notes.map((x) => spelledMidi(x) - WRITTEN_OCTAVE_SHIFT),
  }
}

// ---------------------------------------------------------------------------
// Note, shape and staff cards
// ---------------------------------------------------------------------------

function fretCard(p: Position, known: Position[], l: LessonSpec, counter: string): Card {
  const context = known
    .filter((k) => k.string === p.string && k.fret >= l.region.minFret && k.fret <= l.region.maxFret && k.fret !== p.fret)
    .map((k): Marker => ({ pos: k, tone: 'note', label: noteAt(k) }))
  return {
    title: noteName(p),
    subtitle: capitalize(describePosition(p)),
    hook: fretHook(p, known),
    counter,
    board: { region: l.region, markers: [...context, { pos: p, tone: 'target', label: noteAt(p) }] },
    sound: [midiAt(p)],
  }
}

function fretGroupCard(items: Position[], l: LessonSpec, counter: string): Card {
  const strings = [...new Set(items.map((p) => p.string))]
  const list = items.map((p) => `${noteAt(p)} ${p.fret === 0 ? 'open' : ordinal(p.fret)}`).join(' · ')
  const intro = items.every((p) => !isNatural(midiAt(p)))
    ? 'Each one is a fret above the natural note below it (♯) and a fret below the one above it (♭).'
    : ''
  return {
    title: `${strings.map((s) => stringName(s)).join(' & ')} string${strings.length > 1 ? 's' : ''}`,
    subtitle: `Frets ${Math.min(...items.map((p) => p.fret))}–${Math.max(...items.map((p) => p.fret))}`,
    hook: [intro, list].filter(Boolean).join(' '),
    counter,
    board: { region: l.region, markers: items.map((p) => ({ pos: p, tone: 'target', label: noteAt(p) })) },
    sound: [...items].sort((a, b) => midiAt(a) - midiAt(b)).map(midiAt),
  }
}

const hasStaffFind = (l: LessonSpec) => l.exercises.includes('staffFind')

function staffBoard(notes: number[], l: LessonSpec): Card['board'] {
  if (!hasStaffFind(l)) return undefined
  const markers: Marker[] = notes.flatMap((w) =>
    positionsForMidi(w - WRITTEN_OCTAVE_SHIFT, l.region).map((p): Marker => ({ pos: p, tone: 'target', label: noteAt(p) })),
  )
  return { region: l.region, markers }
}

function staffCard(w: number, l: LessonSpec, counter: string): Card {
  const sharp = spellMidi(w, 'sharp')
  const flat = spellMidi(w, 'flat')
  const both = sharp.acc !== 0
  return {
    title: both ? `${spelledName(sharp)} / ${spelledName(flat)}` : spelledName(sharp),
    subtitle: capitalize(staffPlace(sharp)),
    hook: staffHook(w, l),
    counter,
    staff: both ? { keys: [vexKey(sharp), vexKey(flat)], labels: [spelledName(sharp), spelledName(flat)] } : { keys: [vexKey(sharp)], labels: [] },
    board: staffBoard([w], l),
    sound: [w - WRITTEN_OCTAVE_SHIFT],
  }
}

function staffGroupCard(notes: number[], l: LessonSpec, counter: string): Card {
  const steps = notes.map(staffStep)
  const inside = steps.every((s) => s >= 0 && s <= 8)
  let title = 'New notes'
  let hook = notes.map((w) => spelledName(spellMidi(w, 'sharp'))).join(' · ')
  if (notes.every((w) => !isNatural(w))) {
    title = 'Sharps & flats'
    hook = `A ♯ raises a note one fret, a ♭ lowers it one fret. Each of these has a flat name too. ${hook}`
  } else if (inside && steps.every((s) => s % 2 === 0)) {
    title = 'The lines'
    hook = 'Bottom to top: E G B D F. Every Good Boy Does Fine.'
  } else if (inside && steps.every((s) => s % 2 === 1)) {
    title = 'The spaces'
    hook = 'Bottom to top: F A C E. It spells FACE.'
  } else if (steps.every((s) => s < 0)) {
    title = 'Below the staff'
    hook = `Each step down alternates space, ledger line, space. ${notes.includes(60) ? 'Middle C sits on the first ledger line. ' : ''}${hook}`
  } else if (steps.every((s) => s > 8)) {
    title = 'Above the staff'
    hook = `Each step up alternates space, ledger line, space. ${hook}`
  }
  const sorted = [...notes].sort((a, b) => a - b)
  return {
    title,
    subtitle: `${notes.length} notes`,
    hook,
    counter,
    staff: { keys: sorted.map((w) => vexKey(spellMidi(w, 'sharp'))), labels: sorted.map((w) => spelledName(spellMidi(w, 'sharp'))) },
    board: staffBoard(sorted, l),
    sound: sorted.map((w) => w - WRITTEN_OCTAVE_SHIFT),
  }
}

function intervalCard(semi: number, cross: boolean, l: LessonSpec, counter: string): Card {
  // A worked example of the shape: from C on the A string, or across the G–B gap when it bends.
  const root: Position = cross ? (semi === 12 ? { string: 2, fret: 3 } : { string: 3, fret: 5 }) : { string: 1, fret: 3 }
  const targetString = root.string + stringsAcross(semi)
  const target: Position = { string: targetString, fret: midiAt(root) + semi - TUNING[targetString] }
  const info = intervalInfo(semi)
  const where = (p: Position) => `${noteName(p)} at the ${ordinal(p.fret)} fret of the ${ordinal(6 - p.string)} string`
  const octave =
    semi === 12 &&
    (cross
      ? {
          title: 'Crossing the B string',
          subtitle: '2 strings over, 3 frets up',
          hook: `The 2nd string, B, is tuned one fret lower than the pattern expects, so a shape that lands on it gains a fret. From the 4th or 3rd string, the octave is 2 strings over and 3 frets up: ${where(root)} → ${where(target)}.`,
          onGuitar: 'That extra fret at the B string shows up in every shape that crosses it: octaves, intervals and chords.',
        }
      : {
          title: 'From the 6th and 5th strings',
          subtitle: '2 strings over, 2 frets up',
          hook: `From a note on the 6th or 5th string, skip one string and go 2 frets up: the same note, an octave higher. ${where(root)} → ${where(target)}.`,
          onGuitar: 'Guitarists use octave shapes to find the same note fast, and to play a melody in octaves for a fuller sound.',
        })
  return {
    title: capitalize(info.name),
    subtitle: `${noteName(root)} → ${noteName(target)}`,
    hook: cross ? SHAPES[semi].cross : SHAPES[semi].normal,
    ...(octave || {}),
    counter,
    board: {
      region: l.region,
      markers: [
        { pos: root, tone: 'root', label: noteName(root) },
        { pos: target, tone: 'target', label: noteName(target) },
      ],
    },
    sound: [midiAt(root), midiAt(target)],
  }
}

// ---------------------------------------------------------------------------
// Quick checks
// ---------------------------------------------------------------------------


/** One question about one item. `turn` alternates the question type so both directions get practiced. */
function questionFor(item: string, turn: number, l: LessonSpec, rng: Rng): Question | null {
  const id = newQuestionId()
  const symbols = l.symbols ?? []
  const nameable = NAMEABLE.filter((s) => symbols.includes(s))
  const meter = pick(metersOf(l), rng)

  switch (familyOf(item)) {
    case 'reading': {
      const [kind, value] = item.split(':')
      if (kind === 'rule') return makeAccidentalRule(id, value as AccidentalRule, rng)
      if (kind === 'key' && l.exercises.includes('keyNote')) return makeKeyNote(id, value as KeyId, turn % 2 === 0 ? 'name' : 'find', l.region, rng)
      if (kind === 'key') return makeKeyName(id, l.keys ?? KEY_ORDER, rng, value as KeyId)
      if (value === 'keyName') return makeKeyName(id, l.keys ?? KEY_ORDER, rng)
      if (kind === 'motion') return makeMotion(id, l.motions ?? ['step', 'skip'], rng, value as MotionKind)
      return makePhrase(id, pick(l.keys ?? ['C'], rng), l.region, 3 + (turn % 2), rng)
    }
    case 'rhythm': {
      const [kind, value] = item.split(':')
      if (kind === 'sym' && value !== 'tie') {
        const s = value as SymbolId
        if (turn % 2 === 0 && nameable.length >= 2) {
          const options = NAMEABLE.filter((x) => nameable.includes(x)).slice(0, 6)
          if (!options.includes(s)) options[options.length - 1] = s
          return { id, kind: 'symbolName', symbol: s, options: NAMEABLE.filter((x) => options.includes(x)), facts: [item] }
        }
        const beats = [...new Set([1, 2, 4, ...nameable.map((x) => SYMBOLS[x].beats)])].sort((a, b) => a - b)
        return { id, kind: 'beats', symbol: s, options: beats, facts: [item] }
      }
      if (kind === 'sym') return makeCountBeat(id, meter, symbols, rng, ['tie'])
      if (kind === 'meter') {
        const m = value as Meter
        if (l.exercises.includes('measureFill')) return makeMeasureFill(id, m, symbols, rng)
        if (l.exercises.includes('countBeat')) return makeCountBeat(id, m, symbols, rng)
        return nameable.length ? { id, kind: 'beats', symbol: pick(nameable, rng), options: [1, 2, 4], facts: [item] } : null
      }
      if (value === 'measureFill') return makeMeasureFill(id, meter, symbols, rng)
      if (value === 'countBeat') return makeCountBeat(id, meter, symbols, rng)
      return makeTapRhythm(id, meter, symbols, TAP_BPM, rng)
    }
    case 'staff': {
      const w = Number(item.slice(6))
      const note = spellMidi(w, randomSpelling(rng))
      const targets = positionsForMidi(w - WRITTEN_OCTAVE_SHIFT, l.region)
      const canFind = hasStaffFind(l) && targets.length > 0
      const canName = l.exercises.includes('staffName')
      if (canFind && (!canName || turn % 2 === 0)) return { id, kind: 'staffFind', note, targets, region: l.region, facts: [item] }
      return { id, kind: 'staffName', note, choices: l.accidentals ? 'all' : 'naturals', facts: [item] }
    }
    case 'interval': {
      const [, s, shape] = item.split(':')
      const semi = Number(s)
      const roots = allPositions(l.region).filter(
        (p) =>
          (l.rootStrings ?? l.region.strings).includes(p.string) &&
          isNatural(midiAt(p)) &&
          p.string + stringsAcross(semi) <= 5 &&
          crossesB(semi, p.string) === (shape === 'b'),
      )
      for (let attempt = 0; attempt < 20; attempt++) {
        const root = pick(roots, rng)
        if (!root) return null
        const targets = positionsForMidi(midiAt(root) + semi, l.region)
        if (targets.length) return { id, kind: 'interval', root, semitones: semi, targets, region: l.region, facts: [item] }
      }
      return null
    }
    case 'theory':
      return theoryCheck(item, l, turn, rng, id)
    case 'position': {
      const p = parsePos(item)
      const pc = pitchClass(midiAt(p))
      if (turn % 2 === 0) {
        const targets = positionsForPc(pc, { ...l.region, strings: [p.string] })
        return { id, kind: 'find', pc, label: pcName(pc, randomSpelling(rng)), string: p.string, targets, region: l.region, facts: [item] }
      }
      return { id, kind: 'name', target: p, choices: l.accidentals ? 'all' : 'naturals', region: l.region, facts: [item] }
    }
  }
}

/** Every item in `focus` once, then extra picks from `pool` (focus items twice as likely), never the same twice in a row. */
function check(focus: string[], pool: string[], count: number, l: LessonSpec, rng: Rng): Question[] {
  const order = [...focus].sort(() => rng() - 0.5)
  while (order.length < count) {
    const weighted = pool.flatMap((item) => (focus.includes(item) ? [item, item] : [item]))
    const item = weighted[Math.floor(rng() * weighted.length)]
    if (item !== order[order.length - 1] || pool.length === 1) order.push(item)
  }
  return order.flatMap((item, turn) => {
    const q = questionFor(item, turn, l, rng)
    return q ? [q] : []
  })
}

// ---------------------------------------------------------------------------

const SYMBOL_ORDER: SymbolId[] = [...NAMEABLE, 'tie']

/** Rules before keys, keys before naming them, steps and skips before the rarer moves, phrases last. */
const READING_ORDER = [
  'rule:carry',
  'rule:natural',
  'rule:barline',
  'rule:octave',
  'key:G',
  'key:D',
  'key:F',
  'key:C',
  'skill:keyName',
  'motion:step',
  'motion:skip',
  'motion:leap',
  'motion:same',
  'skill:phrase',
]

/** Puts new items in teaching order: landmarks first on the neck, lines before spaces on the staff, rhythm in method order. */
function teachingOrder(items: string[]): string[] {
  // Theory first, so a tape's explanations come before the shapes and notes that use them.
  const families: Family[] = ['theory', 'position', 'staff', 'interval', 'rhythm', 'reading']
  return families.flatMap((family) => {
    const group = items.filter((i) => familyOf(i) === family)
    if (family === 'position') return group.map(parsePos).sort((a, b) => a.string - b.string || anchorRank(a) - anchorRank(b)).map(posKey)
    if (family === 'staff') {
      const ws = group.map((k) => Number(k.slice(6)))
      const inside = ws.every((w) => staffStep(w) >= 0 && staffStep(w) <= 8 && isNatural(w))
      const order = inside
        ? [...ws].sort((a, b) => (staffStep(a) % 2) - (staffStep(b) % 2) || a - b)
        : [...ws].sort((a, b) => Math.abs(staffStep(a) - 4) - Math.abs(staffStep(b) - 4) || a - b)
      return order.map((w) => `staff:${w}`)
    }
    if (family === 'rhythm') {
      const rank = (i: string) => {
        const [kind, value] = i.split(':')
        return kind === 'sym' ? SYMBOL_ORDER.indexOf(value as SymbolId) : kind === 'meter' ? 50 : 100
      }
      return [...group].sort((a, b) => rank(a) - rank(b))
    }
    if (family === 'reading') return [...group].sort((a, b) => READING_ORDER.indexOf(a) - READING_ORDER.indexOf(b))
    if (family === 'theory') return [...group].sort((a, b) => THEORY_ORDER.indexOf(a) - THEORY_ORDER.indexOf(b))
    return group
  })
}

/** Plans the rehearsal for a track, or null if the track doesn't exist. */
export function buildRehearsal(lessonId: string, rng: Rng = Math.random): Rehearsal | null {
  const found = findLesson(lessonId)
  if (!found) return null
  const l = found.lesson
  const known = introducedBefore(lessonId)
  const fresh = teachingOrder(itemsFor(l).filter((item) => !known.has(item)))
  const families = new Set(fresh.map(familyOf))
  const only = families.size === 1 ? [...families][0] : null
  // "note" only when it's all notes; explanations and rhythm make it an "idea".
  const noun = only === 'interval' ? 'shape' : only === 'position' || only === 'staff' ? 'note' : families.has('theory') || only ? 'idea' : 'note'

  if (fresh.length === 0) {
    const fretOnly = uses(l, BOARD) && !uses(l, STAFF) && !uses(l, RHYTHM)
    const overview: Card = {
      title: 'Warm-up',
      subtitle: l.title,
      hook: 'Nothing new on this track. Five quick ones to warm up, then record.',
      counter: 'Review',
      board: fretOnly
        ? { region: l.region, markers: lessonPositions(l).map((p) => ({ pos: p, tone: 'note', label: noteAt(p) })) }
        : undefined,
      sound: [],
    }
    return { lesson: l, mode: 'warmup', newCount: 0, noun, steps: [{ kind: 'card', card: overview }, { kind: 'check', questions: buildSession({ ...l, count: 5 }, {}, rng) }, { kind: 'ready' }] }
  }

  // Chunks: up to four items of a kind get a card each, two at a time; more are taught in groups of up to four.
  const chunks: { items: string[]; oneByOne: boolean }[] = []
  for (const family of ['theory', 'position', 'staff', 'interval', 'rhythm', 'reading'] as Family[]) {
    const group = fresh.filter((i) => familyOf(i) === family)
    if (!group.length) continue
    const oneByOne = group.length <= 4 || family === 'rhythm' || family === 'interval' || family === 'reading' || family === 'theory'
    if (oneByOne) {
      for (let i = 0; i < group.length; i += 2) chunks.push({ items: group.slice(i, i + 2), oneByOne })
    } else if (family === 'staff' && group.every((k) => staffStep(Number(k.slice(6))) >= 0 && staffStep(Number(k.slice(6))) <= 8)) {
      const lines = group.filter((k) => staffStep(Number(k.slice(6))) % 2 === 0)
      const spaces = group.filter((k) => staffStep(Number(k.slice(6))) % 2 === 1)
      for (const c of [lines, spaces]) if (c.length) chunks.push({ items: c, oneByOne: false })
    } else {
      for (let i = 0; i < group.length; i += 4) chunks.push({ items: group.slice(i, i + 4), oneByOne: false })
    }
  }

  const knownPositions = [...known].filter((k) => familyOf(k) === 'position').map(parsePos)
  const steps: RehearsalStep[] = []
  const taught: string[] = []
  let shown = 0
  for (const chunk of chunks) {
    if (chunk.oneByOne) {
      for (const item of chunk.items) {
        shown++
        const counter = `New ${noun} ${shown} of ${fresh.length}`
        const family = familyOf(item)
        const card =
          family === 'position'
            ? fretCard(parsePos(item), [...knownPositions, ...taught.filter((t) => familyOf(t) === 'position').map(parsePos)], l, counter)
            : family === 'staff'
              ? staffCard(Number(item.slice(6)), l, counter)
              : family === 'interval'
                ? intervalCard(Number(item.split(':')[1]), item.endsWith(':b'), l, counter)
                : family === 'reading'
                  ? readingCard(item, counter)
                  : family === 'theory'
                    ? theoryCard(item, counter)
                    : rhythmCard(item, counter)
        steps.push({ kind: 'card', card })
        taught.push(item)
      }
    } else {
      const counter = `New ${noun}s ${shown + 1}–${shown + chunk.items.length} of ${fresh.length}`
      shown += chunk.items.length
      const card =
        familyOf(chunk.items[0]) === 'position'
          ? fretGroupCard(chunk.items.map(parsePos), l, counter)
          : staffGroupCard(chunk.items.map((k) => Number(k.slice(6))), l, counter)
      steps.push({ kind: 'card', card })
      taught.push(...chunk.items)
    }
    // Explanation-only cards (why it matters, what something is) aren't quizzed on their own.
    const testable = chunk.items.filter((i) => !isIntroItem(i))
    const pool = taught.filter((i) => !isIntroItem(i))
    if (testable.length) steps.push({ kind: 'check', questions: check(testable, pool, Math.max(2, Math.min(6, testable.length * 2)), l, rng) })
  }
  const testable = fresh.filter((i) => !isIntroItem(i))
  // A mixed check at the end needs at least two ideas to mix.
  if (chunks.length > 1 && testable.length > 1) steps.push({ kind: 'check', questions: check([], testable, Math.min(6, testable.length + 2), l, rng) })
  steps.push({ kind: 'ready' })
  return { lesson: l, mode: 'learn', newCount: fresh.length, noun, steps }
}
