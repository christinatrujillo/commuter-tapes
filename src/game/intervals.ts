import type { Card } from './rehearsal'
import type { Marker } from '../components/Fretboard'
import type { LessonSpec } from '../music/curriculum'
import { between, pick, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { aOrAn, capitalize } from '../lib/text'
import {
  LETTERS,
  midiAt,
  noteAt,
  pcName,
  pitchClass,
  positionsForMidi,
  positionsForPc,
  spelledMidi,
  WRITTEN_OCTAVE_SHIFT,
  type Region,
} from '../music/notes'
import { HIGH_A, KEYS, MIDDLE_C, stepFrom, type KeyId, type ScoreMeasure, type ScoreNote } from '../music/score'
import {
  degreeName,
  intervalAbove,
  intervalName,
  intervalShort,
  intervalSize,
  invertInterval,
  majorScale,
  parseInterval,
  parseTone,
  RARE_SPELLINGS,
  spellOn,
  toneName,
  tonePc,
  type Interval,
  type Tone,
} from '../music/theory'
import type { Question } from './questions'

/**
 * Intervals: naming them by number and quality, reading them on the staff, turning them upside
 * down, and hearing them.
 */

/** An interval's name as a button label: “Major 3rd”, “Octave”. */
export const intervalLabel = (iv: Interval) => capitalize(intervalName(iv))
const named = (iv: Interval) => `${aOrAn(intervalName(iv))} ${intervalName(iv)}`
const sizeOf = (short: string) => intervalSize(parseInterval(short))!

/** Every interval within an octave that these tapes name. */
const ALL_NAMES = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'A5', 'm6', 'M6', 'm7', 'M7', 'P8']
const bySize = (a: string, b: string) => sizeOf(a) - sizeOf(b) || parseInterval(a).number - parseInterval(b).number
const isReal = (iv: Interval) => iv.number >= 2 && iv.number <= 8 && intervalSize(iv) !== null

/** The right answer and three near misses: the same number with another quality first, then the nearest sizes. */
function choicesFor(right: Interval, pool: string[], rng: Rng): { options: string[]; answer: number } {
  const want = intervalShort(right)
  const others = [...new Set([...pool, ...ALL_NAMES])]
    .filter((s) => s !== want && intervalLabel(parseInterval(s)) !== intervalLabel(right))
    .map((s) => ({ s, d: (parseInterval(s).number === right.number ? 0 : 10) + Math.abs(sizeOf(s) - intervalSize(right)!) + (pool.includes(s) ? 0 : 5) + rng() }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((o) => o.s)
  const options = [want, ...others].sort(bySize).map((s) => intervalLabel(parseInterval(s)))
  return { options, answer: options.indexOf(intervalLabel(right)) }
}

// Roots to name intervals from.
const ROOTS: Tone[] = [...LETTERS.map((letter): Tone => ({ letter, acc: 0 })), ...['Bb', 'Eb', 'F#', 'Ab'].map(parseTone)]

/** A root and the note an interval above it, spelled the usual way. */
function spellPair(iv: Interval, rng: Rng, roots = ROOTS): { root: Tone; top: Tone } | null {
  const pairs = roots
    .map((root) => ({ root, top: intervalAbove(root, iv) }))
    .filter((p): p is { root: Tone; top: Tone } => !!p.top && !RARE_SPELLINGS.has(toneName(p.top)) && !RARE_SPELLINGS.has(toneName(p.root)))
  return pairs.length ? pick(pairs, rng) : null
}

/** The letters an interval spans, both ends included: "C D E". */
function lettersBetween(root: Tone, n: number): string {
  return Array.from({ length: n }, (_, i) => LETTERS[(LETTERS.indexOf(root.letter) + i) % 7]).join(' ')
}

const lowMidi = (root: Tone) => 48 + tonePc(root)

/** Two spelled notes on the staff, one after the other or stacked, with their signs printed. */
function pairScore(root: Tone, top: Tone, stacked = false): ScoreMeasure[] {
  const low = { letter: root.letter, octave: 4, ...(root.acc ? { sign: root.acc } : {}) }
  const high = { letter: top.letter, octave: 4 + (LETTERS.indexOf(top.letter) <= LETTERS.indexOf(root.letter) ? 1 : 0), ...(top.acc ? { sign: top.acc } : {}) }
  return stacked ? [[{ ...low, dur: 'w', with: [high] }]] : [[{ ...low, dur: 'w' }, { ...high, dur: 'w' }]]
}

/** How an interval's quality follows from its size: "one half step smaller than major". */
function sizeReason(iv: Interval): string {
  const perfect = [1, 4, 5, 8].includes(iv.number)
  return {
    P: 'the perfect size',
    M: 'the major size',
    m: 'one half step smaller than major',
    A: `one half step bigger than ${perfect ? 'perfect' : 'major'}`,
    d: `one half step smaller than ${perfect ? 'perfect' : 'minor'}`,
  }[iv.quality]
}

// ---------------------------------------------------------------------------
// Naming intervals
// ---------------------------------------------------------------------------

const NUMBERS = ['2', '3', '4', '5', '6', '7', '8']
const numberWord = (n: number) => (n === 8 ? 'an octave' : `a ${degreeName(n)}`)

/** "What number interval is C up to G?": count the letters. */
export function makeIvNumber(id: number, rng: Rng, only?: number): Question | null {
  const n = only ?? between(2, 8, rng)
  const iv = parseInterval(pick(ALL_NAMES.filter((s) => parseInterval(s).number === n), rng))
  const pair = spellPair(iv, rng)
  if (!pair) return null
  const what = `${toneName(pair.root)} up to ${toneName(pair.top)}`
  const low = lowMidi(pair.root)
  return {
    id,
    kind: 'ivNumber',
    ask: { text: `What number interval is ${what}?`, hl: what },
    options: NUMBERS,
    answer: n - 2,
    why: `${capitalize(what)} spans ${n} letters (${lettersBetween(pair.root, n)}), so it’s ${numberWord(n)}.`,
    score: { measures: pairScore(pair.root, pair.top), labels: [toneName(pair.root), toneName(pair.top)] },
    sound: [low, low + intervalSize(iv)!],
    facts: [`ivnum:${n}`],
  }
}

/** "What's the interval from C up to E♭?": number and quality. */
export function makeIvName(id: number, names: string[], rng: Rng, only?: string): Question | null {
  const iv = parseInterval(only ?? pick(names, rng))
  const pair = spellPair(iv, rng)
  if (!pair) return null
  const what = `${toneName(pair.root)} up to ${toneName(pair.top)}`
  const size = intervalSize(iv)!
  const low = lowMidi(pair.root)
  return {
    id,
    kind: 'ivName',
    ask: { text: `What’s the interval from ${what}?`, hl: what },
    ...choicesFor(iv, names, rng),
    why: `${capitalize(what)}: ${lettersBetween(pair.root, iv.number)} is ${iv.number} letters, so it’s ${numberWord(iv.number)}. ${size} half steps is ${sizeReason(iv)}, so it’s ${named(iv)}.`,
    score: { measures: pairScore(pair.root, pair.top), labels: [toneName(pair.root), toneName(pair.top)] },
    sound: [low, low + size],
    facts: [`ivn:${intervalShort(iv)}`],
  }
}

// ---------------------------------------------------------------------------
// Intervals on the staff
// ---------------------------------------------------------------------------


/** Two natural notes on the staff: what number interval? */
export function makeIvReadNumber(id: number, rng: Rng, only?: number): Question {
  const n = only ?? between(2, 8, rng)
  const lo = stepFrom({ letter: 'C', octave: 0 }, between(MIDDLE_C, HIGH_A - (n - 1), rng))
  const hi = stepFrom(lo, n - 1)
  const [a, b] = rng() < 0.5 ? [lo, hi] : [hi, lo]
  const measures: ScoreMeasure[] = [[{ ...a, dur: 'w' }, { ...b, dur: 'w' }]]
  const odd = n % 2 === 1
  return {
    id,
    kind: 'ivReadNumber',
    ask: { text: 'What number interval is this?' },
    options: NUMBERS,
    answer: n - 2,
    why: `${lo.letter} to ${hi.letter}: count every line and space, both notes included, and you get ${n}. ${
      odd ? 'Line to line or space to space is always an odd number.' : 'A line and a space always make an even number.'
    }`,
    score: { measures, after: [a.letter, b.letter] },
    sound: [a, b].map((x) => spelledMidi({ ...x, acc: 0 }) - WRITTEN_OCTAVE_SHIFT),
    facts: [`ivnum:${n}`],
  }
}

/** The sign to print in front of a note in this key: only where it differs from the key signature. */
function printedSign(t: Tone, key: KeyId): ScoreNote['sign'] {
  const fromKey = KEYS[key].altered[t.letter] ?? 0
  return t.acc === fromKey ? undefined : t.acc
}

/** Two notes on the staff in a key, one after the other or stacked: name the interval. */
export function makeIvReadName(id: number, keys: KeyId[], names: string[], stacked: boolean, rng: Rng, only?: string): Question | null {
  const key = pick(keys, rng)
  const iv = parseInterval(only ?? pick(names, rng))
  const pair = spellPair(iv, rng, majorScale(key))
  if (!pair) return null
  const { root, top } = pair
  const topOctave = 4 + (LETTERS.indexOf(top.letter) <= LETTERS.indexOf(root.letter) ? 1 : 0)
  const low = { letter: root.letter, octave: 4, sign: printedSign(root, key) }
  const high = { letter: top.letter, octave: topOctave, sign: printedSign(top, key) }
  const measures: ScoreMeasure[] = stacked ? [[{ ...low, dur: 'w', with: [high] }]] : [[{ ...low, dur: 'w' }, { ...high, dur: 'w' }]]
  const names2 = [toneName(root), toneName(top)]
  const size = intervalSize(iv)!
  const lowSound = spelledMidi({ ...root, octave: 4 }) - WRITTEN_OCTAVE_SHIFT
  const inKey = key === 'C' ? '' : `In ${KEYS[key].name}, these are ${names2.join(' and ')}. `
  return {
    id,
    kind: 'ivReadName',
    ask: { text: stacked ? 'Name this interval, played together' : 'Name this interval' },
    ...choicesFor(iv, names, rng),
    why: `${inKey}${names2.join(' up to ')}: ${iv.number} letters and ${size} half steps make ${named(iv)}.`,
    score: { measures, keySig: key, after: stacked ? [names2.join('–')] : names2 },
    sound: [lowSound, lowSound + size],
    facts: [`ivn:${intervalShort(iv)}`],
  }
}

// ---------------------------------------------------------------------------
// Inversions
// ---------------------------------------------------------------------------

/** "Turn a 3rd upside down: what number is it now?" */
export function makeIvFlip(id: number, rng: Rng, only?: number): Question {
  const n = only ?? between(2, 7, rng)
  const top = stepFrom({ letter: 'C', octave: 4 }, n - 1)
  return {
    id,
    kind: 'ivFlip',
    ask: { text: `Turn a ${degreeName(n)} upside down. What number is it now?`, hl: `${degreeName(n)} upside down` },
    options: ['2', '3', '4', '5', '6', '7'],
    answer: 9 - n - 2,
    why: `Move the bottom note up an octave and the numbers always add up to 9: a ${degreeName(n)} turns into a ${degreeName(9 - n)}.`,
    score: { measures: [[{ letter: 'C', octave: 4, dur: 'w', with: [top] }]], after: [`C–${top.letter}`] },
    sound: [48, 48 + MAJOR_OR_PERFECT[n]],
    facts: [`invnum:${n}`],
  }
}

// The major or perfect size of each number, for examples built on C.
const MAJOR_OR_PERFECT: Record<number, number> = { 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 }

const QUALITY_RULE: Record<Interval['quality'], string> = {
  P: 'perfect stays perfect',
  M: 'major becomes minor',
  m: 'minor becomes major',
  A: 'augmented becomes diminished',
  d: 'diminished becomes augmented',
}

/** "Turn a major 3rd upside down: what is it now?" */
export function makeIvInvert(id: number, names: string[], rng: Rng, only?: string): Question | null {
  const pool = names.filter((s) => parseInterval(s).number <= 7)
  const iv = parseInterval(only ?? pick(pool.length ? pool : names, rng))
  const flipped = invertInterval(iv)
  // The usual mistakes: flipping the number but not the quality, or the quality but not the number.
  const traps = [
    { quality: iv.quality, number: flipped.number },
    { quality: flipped.quality, number: iv.number },
  ].filter(isReal)
  const near = choicesFor(flipped, [...traps.map(intervalShort), ...names], rng)
  const pair = spellPair(iv, rng)
  if (!pair) return null
  const low = lowMidi(pair.root)
  const size = intervalSize(iv)!
  return {
    id,
    kind: 'ivInvert',
    ask: { text: `Turn ${named(iv)} upside down. What is it now?`, hl: intervalName(iv) },
    ...near,
    why: `${capitalize(named(iv))} turns into ${named(flipped)}: ${iv.number} + ${flipped.number} = 9, and ${QUALITY_RULE[iv.quality]}.`,
    score: { measures: pairScore(pair.root, pair.top, true), labels: [`${toneName(pair.root)}–${toneName(pair.top)}`] },
    sound: [low, low + size, low + 12],
    facts: [`inv:${intervalShort(iv)}`],
  }
}

/** A note on the neck: tap the note an interval below it. */
export function makeIvBelow(id: number, names: string[], rng: Rng, only?: string): Question | null {
  const iv = parseInterval(only ?? pick(names.filter((s) => parseInterval(s).number <= 7), rng))
  const size = intervalSize(iv)!
  for (let attempt = 0; attempt < 40; attempt++) {
    const from = { string: between(1, 5, rng), fret: between(0, 10, rng) }
    const root: Tone = { letter: noteAt(from)[0] as Tone['letter'], acc: 0 }
    if (noteAt(from).length > 1) continue
    const below = spellOn(LETTERS[(LETTERS.indexOf(root.letter) + 8 - iv.number) % 7], pitchClass(midiAt(from) - size))
    const region: Region = { strings: [0, 1, 2, 3, 4, 5], minFret: Math.max(0, from.fret - 4), maxFret: Math.min(12, from.fret + 3) }
    const targets = positionsForMidi(midiAt(from) - size, region)
    if (!below || RARE_SPELLINGS.has(toneName(below)) || !targets.length) continue
    const flipped = invertInterval(iv)
    return {
      id,
      kind: 'ivBelow',
      ask: { text: `Tap ${named(iv)} below this ${root.letter}`, hl: `${intervalName(iv)} below` },
      region,
      markers: [{ pos: from, tone: 'root', label: root.letter }],
      from,
      targets,
      label: toneName(below),
      why: `${toneName(below)} is ${named(iv)} below ${root.letter}: the same letter as ${named(flipped)} above ${root.letter}, an octave lower.`,
      facts: [`inv:${intervalShort(iv)}`],
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Hearing intervals
// ---------------------------------------------------------------------------

/** Every interval the ear tapes play. The tritone is one sound with two names, so it's heard as one. */
const EAR_NAMES = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8']
/** What an interval is called when you hear it; the tritone is one sound with two spellings. */
export const earLabel = (short: string) => (short === 'A4' ? 'Tritone' : intervalLabel(parseInterval(short)))
const heard = (midi: number) => pcName(pitchClass(midi), 'sharp')

/** Hear two notes (rising, falling or together): which interval? */
export function makeIvHear(id: number, names: string[], modes: ('up' | 'down' | 'together')[], rng: Rng, only?: string): Question {
  const short = only ?? pick(names, rng)
  // Reviewing one interval on its own: offer it with the intervals nearest in size.
  const set = names.includes(short) ? names : [...EAR_NAMES].sort((a, b) => Math.abs(sizeOf(a) - sizeOf(short)) - Math.abs(sizeOf(b) - sizeOf(short))).slice(0, 4)
  const size = sizeOf(short)
  const mode = pick(modes, rng)
  const low = between(45, 69 - size, rng)
  const notes = mode === 'down' ? [low + size, low] : [low, low + size]
  const options = [...set].sort(bySize).map(earLabel)
  const how = mode === 'together' ? 'played together' : mode === 'down' ? 'falling' : 'rising'
  return {
    id,
    kind: 'ivHear',
    ask: { text: 'What interval do you hear?' },
    options,
    answer: options.indexOf(earLabel(short)),
    why: `${earLabel(short)}, ${how}: ${heard(notes[0])} ${mode === 'together' ? 'and' : 'to'} ${heard(notes[1])}, ${size} half steps apart.`,
    listen: { notes, together: mode === 'together' },
    sound: notes,
    facts: [`ear:${short}`],
  }
}

/** A root on the neck: hear it and a second note, then tap where the second note is. */
export function makeIvHearFind(id: number, names: string[], rng: Rng, only?: string): Question | null {
  const short = only ?? pick(names, rng)
  const size = sizeOf(short)
  for (let attempt = 0; attempt < 40; attempt++) {
    const from = { string: between(0, 3, rng), fret: between(0, 7, rng) }
    if (noteAt(from).length > 1) continue
    const region: Region = { strings: [0, 1, 2, 3, 4, 5], minFret: Math.max(0, from.fret - 1), maxFret: Math.min(12, from.fret + 5) }
    const targets = positionsForMidi(midiAt(from) + size, region)
    if (!targets.length) continue
    return {
      id,
      kind: 'ivHearFind',
      ask: { text: 'Listen, then tap the second note' },
      region,
      markers: [{ pos: from, tone: 'root', label: noteAt(from) }],
      from,
      targets,
      label: heard(midiAt(from) + size),
      why: `That was ${short === 'A4' ? 'a tritone' : named(parseInterval(short))}: ${noteAt(from)} up to ${heard(midiAt(from) + size)}.`,
      listen: { notes: [midiAt(from), midiAt(from) + size] },
      facts: [`ear:${short}`],
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Interval ideas in the order they're taught. */
export const INTERVAL_ORDER = [
  'ivshape:what',
  'ivshape:why',
  'oct:what',
  'oct:why',
  'oct:e-strings',
  'ivname:parts',
  'ivname:number',
  'ivname:major',
  'ivname:minor',
  'ivname:altered',
  'ivname:tritone',
  'ivstaff:why',
  'ivstaff:number',
  'ivstaff:name',
  'ivstaff:stacked',
  'invert:what',
  'invert:numbers',
  'invert:qualities',
  'invert:neck',
  'ear:why',
  'ear:octave-fifth',
  'ear:fourth',
  'ear:thirds',
  'ear:seconds',
  'ear:wide',
  'ear:neck',
]

export const isIntervalItem = (item: string) => /^(ivshape|oct|ivname|ivstaff|invert|ear):/.test(item)

/** Which ear idea teaches each interval's sound. */
const EAR_TOPIC: Record<string, string> = {
  P8: 'ear:octave-fifth',
  P5: 'ear:octave-fifth',
  P4: 'ear:fourth',
  M3: 'ear:thirds',
  m3: 'ear:thirds',
  M2: 'ear:seconds',
  m2: 'ear:seconds',
  m6: 'ear:wide',
  M6: 'ear:wide',
  m7: 'ear:wide',
  M7: 'ear:wide',
  A4: 'ear:wide',
}

/** The idea a practiced interval fact belongs to, or null if it isn't one. */
export function intervalItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'ivnum':
      return 'ivname:number'
    case 'ivn':
      return value[0] === 'm' ? 'ivname:minor' : value[0] === 'A' || value[0] === 'd' ? 'ivname:altered' : 'ivname:major'
    case 'invnum':
      return 'invert:numbers'
    case 'inv':
      return 'invert:qualities'
    case 'ear':
      return Object.hasOwn(EAR_TOPIC, value) ? EAR_TOPIC[value] : null
    default:
      return null
  }
}

/** The intervals an idea is about, to focus its quick checks. */
const FOCUS: Record<string, (s: string) => boolean> = {
  'ivname:major': (s) => s[0] === 'M' || s[0] === 'P',
  'ivname:minor': (s) => s[0] === 'm',
  'ivname:altered': (s) => s[0] === 'A' || s[0] === 'd',
  'ivname:tritone': (s) => s === 'A4' || s === 'd5',
}

/** One question on a taught interval idea. */
export function intervalCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const names = l.ivNames ?? ALL_NAMES
  const focused = (test: (s: string) => boolean) => {
    const some = names.filter(test)
    return some.length ? pick(some, rng) : undefined
  }
  switch (item) {
    case 'ivname:number':
      return makeIvNumber(id, rng)
    case 'ivname:major':
    case 'ivname:minor':
    case 'ivname:altered':
    case 'ivname:tritone':
      return makeIvName(id, names, rng, focused(FOCUS[item]))
    case 'ivstaff:number':
      return makeIvReadNumber(id, rng)
    case 'ivstaff:name':
    case 'ivstaff:stacked':
      return makeIvReadName(id, l.keys ?? ['C'], names, item === 'ivstaff:stacked', rng)
    case 'invert:numbers':
      return makeIvFlip(id, rng)
    case 'invert:qualities':
      return makeIvInvert(id, names, rng)
    case 'invert:neck':
      return makeIvBelow(id, names, rng)
    case 'ear:neck':
      return makeIvHearFind(id, names, rng)
    default:
      if (!item.startsWith('ear:')) return null
      return makeIvHear(id, names, l.ear ?? ['up'], rng, focused((s) => EAR_TOPIC[s] === item) ?? (turn % 2 === 0 ? undefined : pick(names, rng)))
  }
}

/** A review question on one interval fact, or null if it isn't one. */
export function intervalReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  const n = Number(value)
  switch (kind) {
    case 'ivnum':
      if (!Number.isInteger(n) || n < 2 || n > 8) return null
      return rng() < 0.5 ? makeIvNumber(id, rng, n) : makeIvReadNumber(id, rng, n)
    case 'ivn':
      if (!isOneOf(value, ALL_NAMES)) return null
      return (rng() < 0.5 && makeIvReadName(id, ['C', 'G', 'D', 'F'], ALL_NAMES, rng() < 0.5, rng, value)) || makeIvName(id, ALL_NAMES, rng, value)
    case 'invnum':
      return Number.isInteger(n) && n >= 2 && n <= 7 ? makeIvFlip(id, rng, n) : null
    case 'inv':
      return isOneOf(value, ALL_NAMES) ? makeIvInvert(id, ALL_NAMES, rng, value) : null
    case 'ear':
      return Object.hasOwn(EAR_TOPIC, value) ? makeIvHear(id, [], ['up', 'down'], rng, value) : null
    default:
      return null
  }
}

// Worked examples for the cards.
const w = (letter: ScoreNote['letter'], octave: number, sign?: ScoreNote['sign']): ScoreNote => ({ letter, octave, dur: 'w', ...(sign !== undefined ? { sign } : {}) })
const stack = (low: ScoreNote, high: ScoreNote): ScoreNote => ({ ...low, with: [{ letter: high.letter, octave: high.octave, sign: high.sign }] })
/** A labeled dot on the neck, for the worked examples on cards. */
export const on = (string: number, fret: number, tone: Marker['tone'] = 'target'): Marker => ({ pos: { string, fret }, tone, label: noteAt({ string, fret }) })

const INTERVAL_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'ivshape:what': () => ({
    title: 'What an interval is',
    subtitle: 'The distance between two notes',
    hook: 'An interval is the distance between two notes: how far one is above the other. Every melody and every chord is built from intervals, and each one has a name, like “perfect 5th” or “major 3rd”. This tape learns them as shapes on the neck; the next tape explains how the names work.',
    score: { measures: [[w('C', 4), w('G', 4)]], labels: ['C', 'G'] },
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 5)] },
    sound: [48, 55],
  }),
  'ivshape:why': () => ({
    title: 'Why shapes',
    subtitle: 'Same distance, same shape',
    hook: 'On the guitar, an interval makes the same shape wherever you start. From any note, a perfect 5th is one string over and two frets up. Learn the shape once and you can find that interval from every note on the neck.',
    onGuitar: 'The perfect 5th shape is the power chord: the two-note chord behind most rock riffs.',
    board: {
      region: { strings: [0, 1, 2], minFret: 1, maxFret: 8 },
      markers: [{ ...on(1, 3), tone: 'root' }, on(2, 5), { ...on(0, 5), tone: 'root' }, on(1, 7)],
    },
    sound: [48, 55, 45, 52],
  }),
  'oct:what': () => ({
    title: 'What an octave is',
    subtitle: 'Same name, one level up',
    hook: 'Two notes with the same name, one higher than the other, like A and the next A up. They sound like the same note in a higher voice. Count up a scale and the octave is the 8th note (A B C D E F G A), which is where the name comes from: “oct” means eight. On one string, the octave is 12 frets up, at the double dot.',
    score: { measures: [[w('A', 3), w('A', 4)]], labels: ['A', 'A'] },
    board: { region: { strings: [1], minFret: 0, maxFret: 12 }, markers: [{ ...on(1, 0), tone: 'root' }, on(1, 12)] },
    sound: [45, 57],
  }),
  'oct:why': () => ({
    title: 'Why octaves matter',
    subtitle: 'Every note lives in several places',
    hook: 'Each note shows up in several places on the neck. If you know one, an octave shape takes you straight to the same note somewhere else, with no counting along the string. Here are all the G’s.',
    onGuitar: 'A melody played in octaves (the same tune on two notes an octave apart) is a classic jazz and rock sound.',
    board: { region: { strings: [0, 1, 2, 3, 4, 5], minFret: 0, maxFret: 12 }, markers: positionsForPc(7, { strings: [0, 1, 2, 3, 4, 5], minFret: 0, maxFret: 12 }).map((p) => ({ pos: p, tone: 'root', label: 'G' })) },
    sound: [43, 55, 67],
  }),
  'oct:e-strings': () => ({
    title: 'The two E strings',
    subtitle: 'Same fret, two octaves apart',
    hook: 'The thickest and thinnest strings are both E, two octaves apart (two levels up). They have the same notes on the same frets, so if you know one, you know the other.',
    board: { region: { strings: [0, 5], minFret: 0, maxFret: 5 }, markers: [0, 5].flatMap((s) => [0, 1, 3, 5].map((f) => on(s, f, f === 0 ? 'root' : 'note'))) },
    sound: [40, 64],
  }),
  'ivname:parts': () => ({
    title: 'Number and quality',
    subtitle: 'Two parts to every name',
    hook: 'Every interval’s name has two parts. The number says how many letters it spans: C up to E is C D E, a 3rd. The quality says its exact size: major, minor, perfect, augmented or diminished. Together they make names like “major 3rd”.',
    onGuitar: 'The number tells you roughly where to look on the neck; the quality tells you the exact fret.',
    score: { measures: [[w('C', 4), w('E', 4)]], labels: ['C', 'E'] },
    board: { region: { strings: [1], minFret: 1, maxFret: 8 }, markers: [{ ...on(1, 3), tone: 'root' }, on(1, 7)] },
    sound: [48, 52],
  }),
  'ivname:number': () => ({
    title: 'Interval numbers',
    subtitle: 'Count the letters',
    hook: 'Count the letters from the lower note to the higher one, including both. C up to G is C D E F G: a 5th. Sharps and flats don’t change the number: C up to G♯ is still a 5th.',
    onGuitar: 'Counting letters works the same whether the two notes are on one string or across strings.',
    score: { measures: [[w('C', 4), w('G', 4)]], labels: ['C', 'G'] },
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 5)] },
    sound: [48, 55],
  }),
  'ivname:major': () => ({
    title: 'Major and perfect',
    subtitle: 'Measured up from a scale’s root',
    hook: 'Count up from the root of a major scale and every note makes a major or a perfect interval with it. 2nds, 3rds, 6ths and 7ths come out major; 4ths, 5ths and the octave come out perfect.',
    onGuitar: 'Here’s C major around the 3rd fret, each note labeled with its interval from the root C.',
    score: {
      measures: [
        [w('C', 4), w('D', 4), w('E', 4), w('F', 4)].map((n) => ({ ...n, dur: 'q' as const })),
        [w('G', 4), w('A', 4), w('B', 4), w('C', 5)].map((n) => ({ ...n, dur: 'q' as const })),
      ],
      labels: ['1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7', 'P8'],
    },
    board: {
      region: { strings: [1, 2, 3], minFret: 1, maxFret: 6 },
      markers: [
        { ...on(1, 3), tone: 'root', label: '1' },
        { ...on(1, 5), tone: 'note', label: 'M2' },
        { ...on(2, 2), tone: 'note', label: 'M3' },
        { ...on(2, 3), tone: 'note', label: 'P4' },
        { ...on(2, 5), tone: 'note', label: 'P5' },
        { ...on(3, 2), tone: 'note', label: 'M6' },
        { ...on(3, 4), tone: 'note', label: 'M7' },
        { ...on(3, 5), tone: 'note', label: 'P8' },
      ],
    },
    sound: [48, 50, 52, 53, 55, 57, 59, 60],
  }),
  'ivname:minor': () => ({
    title: 'Minor intervals',
    subtitle: 'A half step smaller than major',
    hook: 'Make a major interval a half step smaller and it becomes minor: C up to E is a major 3rd, and C up to E♭ is a minor 3rd, one fret less. Perfect intervals never become minor.',
    onGuitar: 'On one string you can see it: the minor 3rd is one fret short of the major 3rd.',
    score: { measures: [[w('C', 4), w('E', 4)], [w('C', 4), w('E', 4, -1)]], labels: ['C', 'E', 'C', 'E♭'] },
    board: {
      region: { strings: [1], minFret: 1, maxFret: 8 },
      markers: [{ ...on(1, 3), tone: 'root' }, { ...on(1, 6), label: 'E♭' }, { ...on(1, 7), tone: 'correct' }],
    },
    sound: [48, 52, 48, 51],
  }),
  'ivname:altered': () => ({
    title: 'Augmented and diminished',
    subtitle: 'A half step past the usual size',
    hook: 'Make a perfect or major interval a half step bigger and it becomes augmented. Make a perfect or minor interval a half step smaller and it becomes diminished. C up to G♯ is an augmented 5th: one fret past the perfect 5th, G.',
    score: { measures: [[w('C', 4), w('G', 4)], [w('C', 4), w('G', 4, 1)]], labels: ['C', 'G', 'C', 'G♯'] },
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 7 }, markers: [{ ...on(1, 3), tone: 'root' }, { ...on(2, 5), tone: 'note' }, { ...on(2, 6), label: 'G♯' }] },
    sound: [48, 55, 48, 56],
  }),
  'ivname:tritone': () => ({
    title: 'The tritone',
    subtitle: 'Six half steps, two names',
    hook: 'Halfway between a 4th and a 5th sits the tritone: 6 half steps. Spelled C up to F♯ it’s an augmented 4th; spelled C up to G♭ it’s a diminished 5th. Same sound, two names, depending on the letters.',
    onGuitar: 'The tritone sounds tense and unsettled, which is why blues and rock lean on it for grit.',
    score: { measures: [[w('C', 4), w('F', 4, 1)], [w('C', 4), w('G', 4, -1)]], labels: ['C', 'F♯', 'C', 'G♭'] },
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, { ...on(2, 4), label: 'F♯/G♭' }] },
    sound: [48, 54],
  }),
  'ivstaff:why': () => ({
    title: 'Why read intervals',
    subtitle: 'See the distance, not just the notes',
    hook: 'Good readers don’t name every note. They see how far the next note is, the way you saw steps and skips on tape 18. Spot the interval on the staff and your hand already knows which shape to play.',
    onGuitar: 'A 3rd on the staff is a 3rd shape on the neck, wherever it’s written.',
    score: { measures: [[w('E', 4), w('G', 4), w('B', 4), w('D', 5)]], labels: ['E', 'G', 'B', 'D'] },
    sound: [52, 55, 59, 62],
  }),
  'ivstaff:number': () => ({
    title: 'Numbers on the staff',
    subtitle: 'Lines and spaces',
    hook: 'Line to line, or space to space, is an odd number: a 3rd is the next line up, a 5th skips a line. A line and a space make an even number: 2nd, 4th, 6th.',
    onGuitar: 'Stacked 3rds, line to line to line, are the notes most chords are built from.',
    score: { measures: [[w('E', 4), w('G', 4)], [w('E', 4), w('B', 4)]], labels: ['E', 'G', 'E', 'B'] },
    sound: [52, 55, 52, 59],
  }),
  'ivstaff:name': () => ({
    title: 'Names in a key',
    subtitle: 'Read the key signature first',
    hook: 'Name both notes with the key signature in mind, then name the interval. In D major, F is F♯, so F up to A is a minor 3rd, not a major one.',
    score: { measures: [[w('F', 4), w('A', 4)]], keySig: 'D', labels: ['F♯', 'A'] },
    board: { region: { strings: [2, 3], minFret: 1, maxFret: 5 }, markers: [{ ...on(2, 4), tone: 'root', label: 'F♯' }, on(3, 2)] },
    sound: [54, 57],
  }),
  'ivstaff:stacked': () => ({
    title: 'Stacked notes',
    subtitle: 'Two notes at once',
    hook: 'Notes written one above the other are played together. Read the bottom note first, then count up to the top one: here, C up to E is a major 3rd.',
    onGuitar: 'Two notes played together usually sit on neighboring strings, in the shapes from tape 28.',
    score: { measures: [[stack(w('C', 4), w('E', 4)), stack(w('D', 4), w('A', 4))]], labels: ['C–E', 'D–A'] },
    board: { region: { strings: [1, 2], minFret: 0, maxFret: 5 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 2)] },
    sound: [48, 52],
  }),
  'invert:what': () => ({
    title: 'What inverting means',
    subtitle: 'Same two notes, swapped',
    hook: 'To invert an interval, take its bottom note up an octave so it ends up on top. The two letters stay the same, but the distance changes: C up to E becomes E up to C.',
    onGuitar: 'Inverting is how you find a note below instead of above, and later it’s how chords get rearranged into new shapes.',
    score: { measures: [[stack(w('C', 4), w('E', 4)), stack(w('E', 4), w('C', 5))]], labels: ['C–E', 'E–C'] },
    board: { region: { strings: [1, 2, 3], minFret: 0, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 2), { ...on(3, 5), tone: 'root' }] },
    sound: [48, 52, 52, 60],
  }),
  'invert:numbers': () => ({
    title: 'The numbers add up to 9',
    subtitle: 'Count it both ways',
    hook: 'Move the bottom note up an octave and the interval turns upside down. The two numbers always add up to 9: a 3rd becomes a 6th, a 2nd becomes a 7th, a 4th becomes a 5th.',
    score: { measures: [[stack(w('C', 4), w('E', 4)), stack(w('E', 4), w('C', 5))]], labels: ['3rd', '6th'] },
    sound: [48, 52, 52, 60],
  }),
  'invert:qualities': () => ({
    title: 'Qualities flip',
    subtitle: 'Major ↔ minor, augmented ↔ diminished',
    hook: 'Major turns into minor and minor into major; augmented turns into diminished. Perfect stays perfect: a perfect 4th turns into a perfect 5th. C up to E♭ (minor 3rd) turned over is E♭ up to C (major 6th).',
    score: { measures: [[stack(w('C', 4), w('E', 4, -1)), stack(w('E', 4, -1), w('C', 5))]], labels: ['m3', 'M6'] },
    sound: [48, 51, 51, 60],
  }),
  'invert:neck': () => ({
    title: 'Up one way, down the other',
    subtitle: 'A 4th up, a 5th down',
    hook: 'A 4th above C is F, next string, same fret. A 5th below C is F too, an octave lower: one string down, two frets back. Same letter either way, because 4 + 5 = 9.',
    board: {
      region: { strings: [0, 1, 2], minFret: 0, maxFret: 5 },
      markers: [{ ...on(1, 3), tone: 'root' }, on(2, 3), on(0, 1)],
    },
    sound: [48, 53, 48, 41],
  }),
  'ear:why': () => ({
    title: 'Why train your ear',
    subtitle: 'Hearing distances',
    hook: 'Ear training here isn’t about naming a single note by its sound. It’s hearing the distance between two notes. That skill, called relative pitch, is what lets musicians pick out a melody and play it back.',
    onGuitar: 'Hear a jump of a 5th and you already know the shape: one string over, two frets up.',
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 5)] },
    listen: { notes: [48, 55] },
    sound: [],
  }),
  'ear:octave-fifth': () => ({
    title: 'Octaves and 5ths',
    subtitle: 'The widest, most open sounds',
    hook: 'An octave sounds like the same note, higher. A perfect 5th sounds open and strong. Memory aid: “Twinkle, Twinkle, Little Star” leaps up a 5th on its second “twinkle”.',
    onGuitar: 'The 5th is the power chord shape; the octave is the shape from tape 21.',
    board: { region: { strings: [1, 2, 3], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 5), on(3, 5)] },
    listen: { notes: [48, 60, 48, 55] },
    sound: [],
  }),
  'ear:fourth': () => ({
    title: 'Perfect 4ths',
    subtitle: 'A call to begin',
    hook: 'A perfect 4th sounds settled but not finished, like a call to start something. Memory aid: “Here Comes the Bride” opens with one.',
    onGuitar: 'Next string over, same fret.',
    board: { region: { strings: [1, 2], minFret: 1, maxFret: 5 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 3)] },
    listen: { notes: [48, 53] },
    sound: [],
  }),
  'ear:thirds': () => ({
    title: 'Major and minor 3rds',
    subtitle: 'Bright and dark',
    hook: 'A major 3rd sounds bright; a minor 3rd sounds darker. Memory aids: “When the Saints Go Marching In” opens with a major 3rd, “Greensleeves” with a minor 3rd.',
    onGuitar: 'These two are what make a chord sound happy or sad. On the neck they’re one fret apart.',
    board: { region: { strings: [1, 2], minFret: 0, maxFret: 5 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 2), { ...on(2, 1), label: 'E♭' }] },
    listen: { notes: [48, 52, 48, 51] },
    sound: [],
  }),
  'ear:seconds': () => ({
    title: '2nds',
    subtitle: 'Next-door neighbors',
    hook: 'A major 2nd is a whole step, like the start of a scale: “Frère Jacques” opens with one. A minor 2nd is a half step that rubs: “Für Elise” rocks back and forth on one.',
    onGuitar: 'On one string, a major 2nd is two frets and a minor 2nd is one.',
    board: { region: { strings: [1], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(1, 5), { ...on(1, 4), label: 'D♭' }] },
    listen: { notes: [48, 50, 48, 49] },
    sound: [],
  }),
  'ear:wide': () => ({
    title: '6ths, 7ths and the tritone',
    subtitle: 'Wide, sweet and tense',
    hook: '6ths sound wide and sweet: “My Bonnie Lies Over the Ocean” opens with a major 6th. A minor 7th sounds bluesy and wants to move on; a major 7th is almost an octave and clashes. The tritone sounds tense and unsettled.',
    onGuitar: 'From C on the 5th string: the 6th, 7th and tritone all sit on the next string, a few frets up.',
    board: {
      region: { strings: [1, 2], minFret: 1, maxFret: 10 },
      markers: [{ ...on(1, 3), tone: 'root' }, { ...on(2, 4), label: 'F♯' }, on(2, 7), { ...on(2, 8), label: 'B♭' }, on(2, 9)],
    },
    listen: { notes: [48, 57, 48, 58, 48, 54] },
    sound: [],
  }),
  'ear:neck': () => ({
    title: 'By ear on the neck',
    subtitle: 'Hear it, then find it',
    hook: 'Hear the two notes, name the interval to yourself, then find the second note with the shapes you know: a 5th is next string, two frets up; a 4th is next string, same fret.',
    board: { region: { strings: [0, 1, 2], minFret: 1, maxFret: 6 }, markers: [{ ...on(1, 3), tone: 'root' }, on(2, 5)] },
    listen: { notes: [48, 55] },
    sound: [],
  }),
}

/** The card that teaches an interval idea. */
export function intervalCard(item: string, counter: string): Card {
  return { ...INTERVAL_CARDS[item](), counter }
}
