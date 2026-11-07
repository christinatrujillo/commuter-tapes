import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import type { Marker } from '../components/Fretboard'
import { ALL_STRINGS, describePosition, midiAt, ordinal, pitchClass, positionsForPc, samePos, stringName, TUNING, type Position, type Region } from '../music/notes'
import type { KeyId, ScoreMeasure } from '../music/score'
import { chordSymbol, chordTones, degreeName, majorKeyOfMinor, majorScale, minorKeyName as keyName, minorScaleOn, parseTone, scaleScore, scaleSound, spelled, spellOn, toneId, toneName, tonePc, type ChordKind, type Tone } from '../music/theory'
import { CAGED_ORDER, movedShape, SHAPE_NAMES, shiftFor, type CagedShape } from '../music/chordShapes'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { PAPER_HIGHLIGHT, PAPER_RUST } from '../lib/color'
import type { Question } from './questions'
import { chordMeasures, triadSound } from './triads'

/**
 * Blues and pentatonics: the minor and major pentatonic scales, the blues scale and its blue
 * note, the five pentatonic patterns on the neck (and the CAGED shape inside each), and hearing
 * them.
 */

/** Minor keys the scale tapes use, by home note, and major keys for the major pentatonic. */
const MINOR_TONICS = ['A', 'E', 'D', 'G', 'C', 'B']
const MAJOR_KEYS: KeyId[] = ['C', 'G', 'D', 'A', 'E', 'F']
const knownMinor = (tonics: string[]) => {
  const own = tonics.filter((t) => isOneOf(t, MINOR_TONICS))
  return own.length ? own : MINOR_TONICS.slice(0, 3)
}
const knownMajor = (keys: KeyId[]) => {
  const own = keys.filter((k) => isOneOf(k, MAJOR_KEYS))
  return own.length ? own : MAJOR_KEYS.slice(0, 2)
}

const noteName = (t: string) => toneName(parseTone(t))
const minorPentName = (tonic: string) => `${noteName(tonic)} minor pentatonic`
const majorPentName = (key: string) => `${noteName(key)} major pentatonic`

/** The natural minor scale without its 2nd and 6th notes. */
export function minorPentatonic(tonic: string): Tone[] {
  const s = minorScaleOn(tonic)
  return [s[0], s[2], s[3], s[4], s[6]]
}
/** The major scale without its 4th and 7th notes. */
export function majorPentatonic(key: KeyId): Tone[] {
  const s = majorScale(key)
  return [s[0], s[1], s[2], s[4], s[5]]
}
/** The blue note: the minor scale's 5th, lowered a half step (E♭ in A). */
function blueNoteOf(tonic: string): Tone {
  const fifth = minorScaleOn(tonic)[4]
  return spellOn(fifth.letter, pitchClass(tonePc(fifth) - 1))!
}
/** The minor pentatonic with the blue note between its 4th and 5th. */
export function bluesScale(tonic: string): Tone[] {
  const p = minorPentatonic(tonic)
  return [p[0], p[1], p[2], blueNoteOf(tonic), p[3], p[4]]
}
/** The minor pentatonic on a major key's 6th note, which shares its notes. */
const relativeTonic = (key: KeyId) => toneId(majorScale(key)[5])

const labelsOf = (tones: Tone[]) => [...tones, tones[0]].map(toneName)
/** The scale in a single measure, for showing two side by side; a natural cancels an earlier flat on the same line. */
function oneMeasure(tones: Tone[]): ScoreMeasure {
  const earlier = new Map<string, number>()
  return scaleScore(tones)
    .flat()
    .map((n) => {
      const spot = `${n.letter}${n.octave}`
      const before = earlier.get(spot)
      earlier.set(spot, n.sign ?? 0)
      return before && n.sign === undefined ? { ...n, sign: 0 as const } : n
    })
}

// ---------------------------------------------------------------------------
// The minor pentatonic
// ---------------------------------------------------------------------------

/** "Which note of E minor does E minor pentatonic leave out?" With `help`, the minor scale is on the staff. */
export function makePentMissing(id: number, tonics: string[], rng: Rng, help = false, only?: string): Question {
  const tonic = only ?? pick(knownMinor(tonics), rng)
  const scale = minorScaleOn(tonic)
  const pent = minorPentatonic(tonic)
  const d = pick([1, 5], rng)
  const kept = shuffle([2, 3, 4, 6], rng).slice(0, 3)
  const options = shuffle([d, ...kept], rng).map((i) => toneName(scale[i]))
  return {
    id,
    kind: 'pentMissing',
    ask: { text: `Which note of ${keyName(tonic)} does ${minorPentName(tonic)} leave out?`, hl: minorPentName(tonic) },
    options,
    answer: options.indexOf(toneName(scale[d])),
    why: `${minorPentName(tonic)} is ${keyName(tonic)} without its 2nd and 6th notes: ${spelled(scale)} becomes ${spelled(pent)}. So ${toneName(scale[d])}, the ${degreeName(d + 1)}, is left out.`,
    score: help
      ? { measures: scaleScore(scale), labels: labelsOf(scale), afterMeasures: scaleScore(pent), after: labelsOf(pent) }
      : { measures: [[]], keySig: majorKeyOfMinor(tonic), afterMeasures: scaleScore(pent), after: labelsOf(pent) },
    sound: scaleSound(pent),
    facts: [`pmin:${tonic}`],
  }
}

/** "Which notes make A minor pentatonic?" */
export function makePentSpell(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(knownMinor(tonics), rng)
  const s = minorScaleOn(tonic)
  const pent = minorPentatonic(tonic)
  const right = spelled(pent)
  // Near misses: the major pentatonic on the same root, and the minor scale missing the wrong two notes.
  const wrong = [spelled(majorPentatonic(tonic as KeyId)), spelled([s[0], s[1], s[2], s[4], s[5]]), spelled([s[0], s[1], s[3], s[4], s[6]])]
  const options = shuffle([right, ...wrong], rng)
  return {
    id,
    kind: 'pentSpell',
    ask: { text: `Which notes make ${minorPentName(tonic)}?`, hl: minorPentName(tonic) },
    options,
    answer: options.indexOf(right),
    why: `Spell ${keyName(tonic)}: ${spelled(s)}. Leave out the 2nd (${toneName(s[1])}) and the 6th (${toneName(s[5])}): ${right}.`,
    score: { measures: [[]], keySig: majorKeyOfMinor(tonic), afterMeasures: scaleScore(pent), after: labelsOf(pent) },
    sound: scaleSound(pent),
    facts: [`pmin:${tonic}`],
  }
}

/** The minor pentatonic's notes, as degrees of the minor scale. */
/** Each scale's notes as degrees: the minor pentatonic and blues scale counted in the minor scale, the major pentatonic in the major. */
export const SCALE_DEGREES = { majorPent: ['1', '2', '3', '5', '6'], minorPent: ['1', '3', '4', '5', '7'], blues: ['1', '3', '4', '♭5', '5', '7'] }
const PENT_DEGREES = SCALE_DEGREES.minorPent.map(Number)
const DEGREE_LABELS = [...SCALE_DEGREES.minorPent, '1']

/** The minor pentatonic on the staff, one note marked: which degree of the minor scale is it? */
export function makePentDegree(id: number, tonics: string[], rng: Rng, only?: number): Question {
  const tonic = pick(knownMinor(tonics), rng)
  const pent = minorPentatonic(tonic)
  const scale = minorScaleOn(tonic)
  const i = only && PENT_DEGREES.includes(only) && only > 1 ? PENT_DEGREES.indexOf(only) : between(1, 4, rng)
  const d = PENT_DEGREES[i]
  return {
    id,
    kind: 'pentDegree',
    ask: { text: `In ${minorPentName(tonic)}, which degree is the marked note?`, hl: 'degree' },
    options: ['3', '4', '5', '7'],
    answer: i - 1,
    why: `Count up ${keyName(tonic)} from its root: ${scale.slice(0, d).map(toneName).join(' ')}. ${toneName(pent[i])} is the ${degreeName(d)}. The minor pentatonic keeps the 1st, 3rd, 4th, 5th and 7th.`,
    score: { measures: scaleScore(pent), labels: labelsOf(pent), marker: i, after: DEGREE_LABELS },
    sound: [scaleSound(pent)[0], scaleSound(pent)[i]],
    facts: [`pdeg:${d}`],
  }
}

// ---------------------------------------------------------------------------
// The major pentatonic
// ---------------------------------------------------------------------------

/** "Which note of C major does C major pentatonic leave out?" With `help`, the major scale is on the staff. */
export function makeMajorPentMissing(id: number, keys: KeyId[], rng: Rng, help = false, only?: KeyId): Question {
  const key = only ?? pick(knownMajor(keys), rng)
  const scale = majorScale(key)
  const pent = majorPentatonic(key)
  const d = pick([3, 6], rng)
  const kept = shuffle([1, 2, 4, 5], rng).slice(0, 3)
  const options = shuffle([d, ...kept], rng).map((i) => toneName(scale[i]))
  return {
    id,
    kind: 'majorPentMissing',
    ask: { text: `Which note of ${noteName(key)} major does ${majorPentName(key)} leave out?`, hl: majorPentName(key) },
    options,
    answer: options.indexOf(toneName(scale[d])),
    why: `${majorPentName(key)} is ${noteName(key)} major without its 4th and 7th notes: ${spelled(scale)} becomes ${spelled(pent)}. So ${toneName(scale[d])}, the ${degreeName(d + 1)}, is left out.`,
    score: help
      ? { measures: scaleScore(scale), labels: labelsOf(scale), afterMeasures: scaleScore(pent), after: labelsOf(pent) }
      : { measures: [[]], keySig: key, afterMeasures: scaleScore(pent), after: labelsOf(pent) },
    sound: scaleSound(pent),
    facts: [`pmaj:${key}`],
  }
}

/** "Which notes make G major pentatonic?" */
export function makeMajorPentSpell(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(knownMajor(keys), rng)
  const s = majorScale(key)
  const pent = majorPentatonic(key)
  const right = spelled(pent)
  // Near misses: the minor pentatonic on the same root, and the major scale missing the wrong two notes.
  const wrong = [spelled(minorPentatonic(key)), spelled([s[0], s[2], s[3], s[4], s[6]]), spelled([s[0], s[1], s[3], s[4], s[5]])]
  const options = shuffle([right, ...wrong], rng)
  return {
    id,
    kind: 'majorPentSpell',
    ask: { text: `Which notes make ${majorPentName(key)}?`, hl: majorPentName(key) },
    options,
    answer: options.indexOf(right),
    why: `Spell ${noteName(key)} major: ${spelled(s)}. Leave out the 4th (${toneName(s[3])}) and the 7th (${toneName(s[6])}): ${right}.`,
    score: { measures: [[]], keySig: key, afterMeasures: scaleScore(pent), after: labelsOf(pent) },
    sound: scaleSound(pent),
    facts: [`pmaj:${key}`],
  }
}

/** "C major pentatonic has the same notes as which minor pentatonic?" or the other way round. */
export function makePentRelative(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(knownMajor(keys), rng)
  const major = majorScale(key)
  const rel = relativeTonic(key)
  const minor = minorScaleOn(rel)
  const fromMajor = rng() < 0.5
  // Near misses: the same root, and the scale's other notes in the wrong place.
  const options = fromMajor
    ? shuffle([5, 0, 2, 4].map((i) => minorPentName(toneId(major[i]))), rng)
    : shuffle([2, 0, 5, 6].map((i) => majorPentName(toneId(minor[i]))), rng)
  const right = fromMajor ? minorPentName(rel) : majorPentName(key)
  const [from, to] = fromMajor ? [majorPentatonic(key), minorPentatonic(rel)] : [minorPentatonic(rel), majorPentatonic(key)]
  return {
    id,
    kind: 'pentRelative',
    ask: { text: `${fromMajor ? majorPentName(key) : minorPentName(rel)} has the same notes as which ${fromMajor ? 'minor' : 'major'} pentatonic?`, hl: 'same notes' },
    options,
    answer: options.indexOf(right),
    why: fromMajor
      ? `${majorPentName(key)} is ${spelled(from)}. Start from its 6th note, ${toneName(major[5])}, and you get ${spelled(to)}: ${right}.`
      : `${minorPentName(rel)} is ${spelled(from)}. Its relative major starts on its 3rd note, ${toneName(minor[2])}: ${spelled(to)}, ${right}.`,
    score: { measures: scaleScore(from), labels: labelsOf(from), afterMeasures: scaleScore(to), after: labelsOf(to) },
    sound: scaleSound(to),
    facts: [`prel:${key}`],
  }
}

// ---------------------------------------------------------------------------
// The blues scale
// ---------------------------------------------------------------------------

/** "What's the blue note in the A blues scale?" */
export function makeBlueNote(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(knownMinor(tonics), rng)
  const s = minorScaleOn(tonic)
  const blue = blueNoteOf(tonic)
  const blues = bluesScale(tonic)
  const pent = minorPentatonic(tonic)
  // Near misses: the notes either side, the 4th, the 5th and the 6th.
  const options = shuffle([s[3], blue, s[4], s[5]].map(toneName), rng)
  return {
    id,
    kind: 'blueNote',
    ask: { text: `What’s the blue note in the ${noteName(tonic)} blues scale?`, hl: 'blue note' },
    options,
    answer: options.indexOf(toneName(blue)),
    why: `The blue note is the 5th, lowered a half step. ${keyName(tonic)}’s 5th is ${toneName(s[4])}, so it’s ${toneName(blue)}: ${spelled(blues)}.`,
    score: { measures: scaleScore(pent), labels: labelsOf(pent), afterMeasures: scaleScore(blues), after: labelsOf(blues) },
    sound: scaleSound(blues),
    facts: [`pblues:${tonic}`],
  }
}

/** "Which notes make the E blues scale?" */
export function makeBluesSpell(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(knownMinor(tonics), rng)
  const s = minorScaleOn(tonic)
  const p = minorPentatonic(tonic)
  const blues = bluesScale(tonic)
  const right = spelled(blues)
  const majorThird = spellOn(s[2].letter, pitchClass(tonePc(s[2]) + 1))!
  // Near misses: a lowered 6th instead of the blue note, a major 3rd, and an added 2nd.
  const wrong = [spelled([...p.slice(0, 4), s[5], p[4]]), spelled([p[0], majorThird, ...blues.slice(2)]), spelled([p[0], s[1], ...p.slice(1)])]
  const options = shuffle([right, ...wrong], rng)
  return {
    id,
    kind: 'bluesSpell',
    ask: { text: `Which notes make the ${noteName(tonic)} blues scale?`, hl: `${noteName(tonic)} blues scale` },
    options,
    answer: options.indexOf(right),
    why: `Start with ${minorPentName(tonic)}: ${spelled(p)}. Add the blue note, the 5th lowered to ${toneName(blues[3])}, between the 4th and 5th: ${right}.`,
    score: { measures: [[]], keySig: majorKeyOfMinor(tonic), afterMeasures: scaleScore(blues), after: labelsOf(blues) },
    sound: scaleSound(blues),
    facts: [`pblues:${tonic}`],
  }
}

// ---------------------------------------------------------------------------
// The five patterns on the neck
// ---------------------------------------------------------------------------

const PENT_STEPS = [0, 3, 5, 7, 10]

/**
 * Pattern `n` (1 to 5) of a minor pentatonic: twelve scale notes in a row, two on each string,
 * starting on the low E string from the scale's `n`th note (Pattern 1, the box, starts on the
 * root). Placed between the 1st and 12th frets, or null if it doesn't fit there.
 */
export function pentPattern(tonic: string, n: number): Position[] | null {
  const notes = rawPattern(tonic, n)
  for (const shift of [0, -12, 12]) {
    const moved = notes.map((p) => ({ ...p, fret: p.fret + shift }))
    if (moved.every((p) => p.fret >= 1 && p.fret <= 12)) return moved
  }
  return null
}

/** Pattern `n` from the root on the low E string's first 12 frets, before it's moved to fit the neck. */
function rawPattern(tonic: string, n: number): Position[] {
  const root = TUNING[0] + pitchClass(tonePc(parseTone(tonic)) - TUNING[0])
  const note = (i: number) => root + 12 * Math.floor(i / 5) + PENT_STEPS[i % 5]
  return Array.from({ length: 12 }, (_, k): Position => {
    const string = Math.floor(k / 2)
    return { string, fret: note(n - 1 + k) - TUNING[string] }
  })
}

/** Every spot of pattern `n` from the nut to the 12th fret, in whichever octaves it lands there (for the Fretboard tab). */
export function patternSpots(tonic: string, n: number): Position[] {
  const notes = rawPattern(tonic, n)
  return [-24, -12, 0, 12].flatMap((shift) => notes.map((p) => ({ ...p, fret: p.fret + shift }))).filter((p) => p.fret >= 0 && p.fret <= 12)
}

/** Each note's degree in the minor scale (1, 3, 4, 5 or 7). */
const degreeAt = (tonic: string, p: Position) => PENT_DEGREES[PENT_STEPS.indexOf(pitchClass(midiAt(p) - tonePc(parseTone(tonic))))]
const toneAt = (tonic: string, p: Position) => minorScaleOn(tonic)[degreeAt(tonic, p) - 1]
const patternRegion = (notes: Position[]): Region => {
  const frets = notes.map((p) => p.fret)
  return { strings: ALL_STRINGS, minFret: Math.min(...frets) - 1, maxFret: Math.min(12, Math.max(...frets) + 1) }
}
const ascending = (notes: Position[]) => notes.map(midiAt).sort((a, b) => a - b)

/** Keys for the box: roots from the 1st to the 8th fret of the low E string, so the whole box fits. */
const BOX_KEYS = ['F', 'G', 'A', 'B', 'C']
/** Keys for the other patterns, as long as the pattern fits on the neck. */
const PATTERN_KEYS = ['A', 'G', 'C', 'D', 'E', 'B', 'F']
const PATTERNS = [1, 2, 3, 4, 5]
const knownPatterns = (patterns: number[]) => {
  const own = patterns.filter((n) => PATTERNS.includes(n))
  return own.length ? own : [1, 2]
}
/** A key and pattern that fit on the neck. */
function pickPattern(patterns: number[], rng: Rng) {
  const options = knownPatterns(patterns).flatMap((n) => PATTERN_KEYS.map((tonic) => ({ tonic, n, notes: pentPattern(tonic, n) })))
  const o = pick(
    options.filter((x) => x.notes),
    rng,
  )
  const notes = o.notes!
  return { tonic: o.tonic, n: o.n, notes, roots: notes.filter((p) => degreeAt(o.tonic, p) === 1), region: patternRegion(notes) }
}
const boxOf = (tonic: string) => {
  const notes = pentPattern(tonic, 1)!
  return { notes, roots: notes.filter((p) => degreeAt(tonic, p) === 1), region: patternRegion(notes) }
}

/** The box, one note marked: which degree of the minor scale is it? */
export function makeBoxDegree(id: number, rng: Rng, only?: number): Question {
  const tonic = pick(BOX_KEYS, rng)
  const { notes, roots, region } = boxOf(tonic)
  const choices = notes.filter((p) => degreeAt(tonic, p) !== 1 && (!only || degreeAt(tonic, p) === only))
  const target = pick(choices.length ? choices : notes.filter((p) => degreeAt(tonic, p) !== 1), rng)
  const d = degreeAt(tonic, target)
  const scale = minorScaleOn(tonic)
  const others = notes.filter((p) => degreeAt(tonic, p) !== 1 && !samePos(p, target))
  return {
    id,
    kind: 'boxDegree',
    ask: { text: `In the ${minorPentName(tonic)} box, which degree is the marked note?`, hl: 'degree' },
    options: ['3', '4', '5', '7'],
    answer: [3, 4, 5, 7].indexOf(d),
    why: `Count up ${keyName(tonic)} from the root: ${scale.slice(0, d).map(toneName).join(' ')}. The marked note is ${toneName(scale[d - 1])}, the ${degreeName(d)}: ${describePosition(target)}.`,
    board: {
      region,
      markers: [...others.map((p): Marker => ({ pos: p, tone: 'note' })), ...roots.map((p): Marker => ({ pos: p, tone: 'root', label: noteName(tonic) })), { pos: target, tone: 'target', label: '?' }],
      after: [
        ...others.map((p): Marker => ({ pos: p, tone: 'note', label: String(degreeAt(tonic, p)) })),
        ...roots.map((p): Marker => ({ pos: p, tone: 'root', label: '1' })),
        { pos: target, tone: 'correct', label: String(d) },
      ],
    },
    sound: [midiAt(roots[0]), midiAt(target)],
    facts: ['pbox:degree'],
  }
}

/** The box, no labels: tap one of its roots. */
export function makeBoxRoot(id: number, rng: Rng): Question {
  const tonic = pick(BOX_KEYS, rng)
  const { notes, roots, region } = boxOf(tonic)
  const f = roots[0].fret
  return {
    id,
    kind: 'boxRoot',
    ask: { text: `Tap a root in this ${minorPentName(tonic)} box`, hl: 'root' },
    region,
    markers: notes.map((p): Marker => ({ pos: p, tone: 'note' })),
    from: roots[0],
    targets: roots,
    label: noteName(tonic),
    why: `The box’s roots are at its bottom corner on the low E and high E strings (${ordinal(f)} fret), and on the D string two frets up (${ordinal(f + 2)} fret). Here they’re all ${noteName(tonic)}.`,
    sound: ascending(notes),
    facts: ['pbox:root'],
  }
}

/** The box somewhere on the neck, its roots lit: which key's minor pentatonic is it? */
export function makeBoxKey(id: number, rng: Rng, only?: string): Question {
  const tonic = only ?? pick(BOX_KEYS, rng)
  const { notes, roots, region } = boxOf(tonic)
  const options = shuffle([tonic, ...shuffle(BOX_KEYS.filter((k) => k !== tonic), rng).slice(0, 3)].map(minorPentName), rng)
  const low = roots.find((p) => p.string === 0)!
  return {
    id,
    kind: 'boxKey',
    ask: { text: 'Which minor pentatonic is this box?' },
    options,
    answer: options.indexOf(minorPentName(tonic)),
    why: `The box’s root on the low E string is at the ${ordinal(low.fret)} fret, which is ${noteName(tonic)}. So it’s ${minorPentName(tonic)}.`,
    board: {
      region,
      markers: notes.map((p): Marker => ({ pos: p, tone: degreeAt(tonic, p) === 1 ? 'root' : 'note' })),
      after: notes.map((p): Marker => ({ pos: p, tone: degreeAt(tonic, p) === 1 ? 'root' : 'note', label: toneName(toneAt(tonic, p)) })),
    },
    sound: ascending(notes),
    facts: ['pbox:key'],
  }
}

/** A pattern with one note hidden: tap it, on the string that's missing it. */
export function makePatternMissing(id: number, patterns: number[], rng: Rng, only?: number): Question {
  const { tonic, n, notes, region } = pickPattern(only ? [only] : patterns, rng)
  const hidden = pick(notes, rng)
  const shown = notes.filter((p) => !samePos(p, hidden))
  const pair = notes.filter((p) => p.string === hidden.string).map((p) => toneName(toneAt(tonic, p)))
  const missing = toneName(toneAt(tonic, hidden))
  return {
    id,
    kind: 'patternMissing',
    ask: { text: `Tap the missing note of Pattern ${n} of ${minorPentName(tonic)}, on the ${stringName(hidden.string)} string`, hl: `Pattern ${n}` },
    region,
    markers: shown.map((p): Marker => ({ pos: p, tone: degreeAt(tonic, p) === 1 ? 'root' : 'note', label: toneName(toneAt(tonic, p)) })),
    from: shown[0],
    targets: positionsForPc(midiAt(hidden), { ...region, strings: [hidden.string] }),
    label: missing,
    why: `On the ${stringName(hidden.string)} string, Pattern ${n} has two notes: ${pair.join(' and ')}. ${pair.find((x) => x !== missing)} is already there, so the missing one is ${missing}: ${describePosition(hidden)}.`,
    sound: ascending(notes),
    facts: [`ppat:${n}`],
  }
}

/** A pattern, no labels: tap one of its roots. */
export function makePatternRoot(id: number, patterns: number[], rng: Rng, only?: number): Question {
  const { tonic, n, notes, roots, region } = pickPattern(only ? [only] : patterns, rng)
  return {
    id,
    kind: 'patternRoot',
    ask: { text: `Tap a root in Pattern ${n} of ${minorPentName(tonic)}`, hl: `Pattern ${n}` },
    region,
    markers: notes.map((p): Marker => ({ pos: p, tone: 'note' })),
    from: roots[0],
    targets: roots,
    label: noteName(tonic),
    why: `${noteName(tonic)} is the root. In Pattern ${n} it’s here: ${roots.map(describePosition).join('; ')}.`,
    sound: ascending(notes),
    facts: [`ppat:${n}`],
  }
}

/** The CAGED shape of the relative major's chord that fits inside a pattern, if one does. */
function cagedInside(tonic: string, notes: Position[]): { name: CagedShape; spots: Position[] } | null {
  const root = minorScaleOn(tonic)[2]
  for (const name of CAGED_ORDER) {
    for (const extra of [0, 12, -12]) {
      const shift = shiftFor(name, root) + extra
      if (shift < 0) continue
      const spots = movedShape(name, shift)
        .frets.map((fret, string) => ({ string, fret }))
        .filter((p) => p.fret >= 0)
      if (spots.every((p) => notes.some((q) => samePos(p, q)))) return { name, spots }
    }
  }
  return null
}

/** A pattern with its relative major chord lit: which CAGED shape do those notes make? */
export function makePatternCaged(id: number, patterns: number[], rng: Rng): Question {
  let p = pickPattern(patterns, rng)
  let inside = cagedInside(p.tonic, p.notes)
  for (let i = 0; i < 20 && !inside; i++) {
    p = pickPattern(patterns, rng)
    inside = cagedInside(p.tonic, p.notes)
  }
  const { tonic, n, notes, region } = p
  const { name, spots } = inside!
  const major = minorScaleOn(tonic)[2]
  const chord = chordTones(major, 'maj')!
  const lit = (q: Position) => spots.some((s) => samePos(s, q))
  const markers = notes.map((q): Marker => (lit(q) ? { pos: q, tone: 'correct', label: toneName(toneAt(tonic, q)) } : { pos: q, tone: 'note' }))
  return {
    id,
    kind: 'patternCaged',
    ask: { text: `In Pattern ${n} of ${minorPentName(tonic)}, the lit notes make ${toneName(major)} major. Which CAGED shape?`, hl: 'CAGED shape' },
    options: SHAPE_NAMES,
    answer: CAGED_ORDER.indexOf(name),
    why: `${minorPentName(tonic)} has the same notes as ${toneName(major)} major pentatonic, so ${toneName(major)} major’s chord, ${spelled(chord)}, is inside every pattern. In Pattern ${n} its notes make the ${name} shape.`,
    board: { region, markers },
    sound: spots.map(midiAt).sort((a, b) => a - b),
    facts: ['ppat:caged'],
  }
}

// ---------------------------------------------------------------------------
// The 12-bar blues
// ---------------------------------------------------------------------------

/** Keys the 12-bar tapes use, the usual guitar blues keys; minor blues in the first three. */
const BLUES_KEYS: KeyId[] = ['A', 'E', 'G', 'D', 'C']
const MINOR_BLUES = ['A', 'E', 'D']
const knownBlues = (keys: KeyId[]) => {
  const own = keys.filter((k) => isOneOf(k, BLUES_KEYS))
  return own.length ? own : BLUES_KEYS.slice(0, 3)
}
const knownMinorBlues = (tonics: string[]) => {
  const own = tonics.filter((t) => isOneOf(t, MINOR_BLUES))
  return own.length ? own : MINOR_BLUES
}

/** The 12 bars as scale notes from 0: I, IV and V. Three lines of four: I I I I, IV IV I I, V IV I I. */
const TWELVE = [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 0]
type Variation = 'quick' | 'turn'
const VARIATIONS: Variation[] = ['quick', 'turn']
/** The 12 bars with a quick change (IV in bar 2) or a turnaround (V in bar 12). */
const twelveWith = (variation?: Variation) => TWELVE.map((d, i) => (variation === 'quick' && i === 1 ? 3 : variation === 'turn' && i === 11 ? 4 : d))
const NUMERALS: Record<number, string> = { 0: 'I', 3: 'IV', 4: 'V' }
const MINOR_NUMERALS: Record<number, string> = { 0: 'i', 3: 'iv', 4: 'v' }
const LINES = 'Line 1 (bars 1–4) is all I. Line 2 is IV, IV, I, I. Line 3 is V, IV, I, I'
/** Bars to ask about: mostly the ones where the chord changes. */
const BAR_PICKS = [4, 4, 8, 8, 9, 9, 5, 6, 7, 10, 11, 0, 1, 2, 3]

/** A key's I7, IV7 and V7 (or a minor key's i7, iv7 and v7), by scale note. */
function bluesChord(key: string, d: number, minor = false): { tones: Tone[]; symbol: string } {
  const root = (minor ? minorScaleOn(key) : majorScale(key as KeyId))[d]
  const kind: ChordKind = minor ? 'm7' : '7'
  return { tones: chordTones(root, kind)!, symbol: chordSymbol(root, kind) }
}
const chartOf = (bars: number[], symbol: (d: number) => string, hidden: number) => ({
  bars: bars.map((d, i) => (i === hidden ? null : symbol(d))),
  mark: hidden,
})

/** The chart in numerals, one bar hidden: "In a 12-bar blues, which chord is in bar 9?" */
export function makeTwelveNumeral(id: number, rng: Rng, only?: number): Question {
  const bar = only !== undefined && only >= 0 && only < 12 ? only : pick(BAR_PICKS, rng)
  const d = TWELVE[bar]
  const options = ['I', 'IV', 'V']
  return {
    id,
    kind: 'twelveNumeral',
    ask: { text: `In a 12-bar blues, which chord is in bar ${bar + 1}?`, hl: `bar ${bar + 1}` },
    options,
    answer: options.indexOf(NUMERALS[d]),
    why: `${LINES}. Bar ${bar + 1} is on line ${Math.floor(bar / 4) + 1}, so it’s ${NUMERALS[d]}.`,
    chart: { ...chartOf(TWELVE, (x) => NUMERALS[x], bar), after: { bars: TWELVE.map((x) => NUMERALS[x]) } },
    sound: triadSound(bluesChord('A', d).tones),
    facts: [`b12:${bar + 1}`],
  }
}

/** The chart in a key, one bar hidden: "In a 12-bar blues in A, what chord is in bar 5?" */
export function makeTwelveChord(id: number, keys: KeyId[], rng: Rng, only?: KeyId, onlyBar?: number): Question {
  const key = only ?? pick(knownBlues(keys), rng)
  const bar = onlyBar ?? pick(BAR_PICKS, rng)
  const d = TWELVE[bar]
  const symbol = (x: number) => bluesChord(key, x).symbol
  // Near misses: the other two chords, and the 7th chord on the 2nd note (B7 in A).
  const options = shuffle([0, 3, 4, 1].map(symbol), rng)
  return {
    id,
    kind: 'twelveChord',
    ask: { text: `In a 12-bar blues in ${noteName(key)}, what chord is in bar ${bar + 1}?`, hl: `bar ${bar + 1}` },
    options,
    answer: options.indexOf(symbol(d)),
    why: `In ${noteName(key)}, I7 is ${symbol(0)}, IV7 is ${symbol(3)} and V7 is ${symbol(4)}. Bar ${bar + 1} is ${NUMERALS[d]}, so it’s ${symbol(d)}.`,
    // The other bars as numerals, so the key's chords are worked out rather than read off the chart.
    chart: { ...chartOf(TWELVE, (x) => `${NUMERALS[x]}7`, bar), after: { bars: TWELVE.map(symbol), numerals: TWELVE.map((x) => `${NUMERALS[x]}7`) } },
    sound: triadSound(bluesChord(key, d).tones),
    facts: [`b12:${bar + 1}`, `b12key:${key}`],
  }
}

/** "In a 12-bar blues in G, what are the I7, IV7 and V7 chords?" */
export function makeTwelveSpell(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(knownBlues(keys), rng)
  const scale = majorScale(key)
  const set = (ds: number[]) => ds.map((d) => bluesChord(key, d).symbol).join(' ')
  const right = set([0, 3, 4])
  // Near misses: one chord on the wrong note of the scale.
  const options = shuffle([right, set([0, 1, 4]), set([0, 3, 5]), set([0, 2, 4])], rng)
  return {
    id,
    kind: 'twelveSpell',
    ask: { text: `In a 12-bar blues in ${noteName(key)}, what are the I7, IV7 and V7 chords?`, hl: 'I7, IV7 and V7' },
    options,
    answer: options.indexOf(right),
    why: `Count up ${noteName(key)} major: ${spelled(scale)}. I is ${toneName(scale[0])}, IV is ${toneName(scale[3])} and V is ${toneName(scale[4])}, and in a blues each is a dominant 7th: ${right}.`,
    chart: { bars: TWELVE.map((d) => `${NUMERALS[d]}7`), after: { bars: TWELVE.map((d) => bluesChord(key, d).symbol), numerals: TWELVE.map((d) => `${NUMERALS[d]}7`) } },
    sound: [0, 3, 4].flatMap((d) => triadSound(bluesChord(key, d).tones)),
    facts: [`b12key:${key}`],
  }
}

/** "This 12-bar blues in E has a quick change. What chord is in bar 2?" (or a turnaround, bar 12) */
export function makeTwelveVariation(id: number, keys: KeyId[], rng: Rng, only?: Variation): Question {
  const key = pick(knownBlues(keys), rng)
  const variation = only ?? pick(VARIATIONS, rng)
  const bars = twelveWith(variation)
  const bar = variation === 'quick' ? 1 : 11
  const symbol = (x: number) => bluesChord(key, x).symbol
  const options = [0, 3, 4].map(symbol)
  return {
    id,
    kind: 'twelveVariation',
    ask: {
      text: variation === 'quick' ? `This 12-bar blues in ${noteName(key)} has a quick change. What chord is in bar 2?` : `This 12-bar blues in ${noteName(key)} ends with a turnaround. What chord is in bar 12?`,
      hl: variation === 'quick' ? 'quick change' : 'turnaround',
    },
    options,
    answer: options.indexOf(symbol(bars[bar])),
    why:
      variation === 'quick'
        ? `A quick change jumps to IV in bar 2, then comes straight back to I in bar 3. In ${noteName(key)}, IV7 is ${symbol(3)}.`
        : `A turnaround puts V in the last bar, and its pull back to I leads round to the top of the chart. In ${noteName(key)}, V7 is ${symbol(4)}.`,
    chart: { ...chartOf(bars, (x) => `${NUMERALS[x]}7`, bar), after: { bars: bars.map(symbol), numerals: bars.map((x) => `${NUMERALS[x]}7`) } },
    sound: triadSound(bluesChord(key, bars[bar]).tones),
    facts: [`b12var:${variation}`],
  }
}

/** "In a minor blues in A, what chord is in bar 9?" */
export function makeMinorBlues(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(knownMinorBlues(tonics), rng)
  const bar = pick(BAR_PICKS, rng)
  const d = TWELVE[bar]
  const symbol = (x: number) => bluesChord(tonic, x, true).symbol
  // Near misses: the other two chords, and the major blues's IV7 on the same root.
  const options = shuffle([...[0, 3, 4].map(symbol), bluesChord(tonic, 3).symbol.replace('m7', '7')], rng)
  return {
    id,
    kind: 'minorBlues',
    ask: { text: `In a minor blues in ${noteName(tonic)} minor, what chord is in bar ${bar + 1}?`, hl: `bar ${bar + 1}` },
    options,
    answer: options.indexOf(symbol(d)),
    why: `A minor blues keeps the 12 bars but uses minor 7th chords. In ${keyName(tonic)}, i7 is ${symbol(0)}, iv7 is ${symbol(3)} and v7 is ${symbol(4)}. Bar ${bar + 1} is ${MINOR_NUMERALS[d]}7, so it’s ${symbol(d)}.`,
    chart: { ...chartOf(TWELVE, (x) => `${MINOR_NUMERALS[x]}7`, bar), after: { bars: TWELVE.map(symbol), numerals: TWELVE.map((x) => `${MINOR_NUMERALS[x]}7`) } },
    sound: triadSound(bluesChord(tonic, d, true).tones),
    facts: [`bminor:${tonic}`],
  }
}

// ---------------------------------------------------------------------------
// Hearing the blues
// ---------------------------------------------------------------------------

const MAJOR_PENT_STEPS = [0, 2, 4, 7, 9, 12]
const MINOR_PENT_STEPS = [0, 3, 5, 7, 10, 12]
const BLUES_STEPS = [0, 3, 5, 6, 7, 10, 12]

/** Hear a pentatonic scale climb: major or minor? */
export function makePentHear(id: number, rng: Rng, only?: 'Major' | 'Minor'): Question {
  const mode = only ?? pick<'Major' | 'Minor'>(['Major', 'Minor'], rng)
  const low = between(45, 57, rng)
  const notes = (mode === 'Major' ? MAJOR_PENT_STEPS : MINOR_PENT_STEPS).map((s) => low + s)
  return {
    id,
    kind: 'pentHear',
    ask: { text: 'Major or minor pentatonic?' },
    options: ['Major pentatonic', 'Minor pentatonic'],
    answer: mode === 'Major' ? 0 : 1,
    why:
      mode === 'Major'
        ? 'Major pentatonic: it climbs a whole step, then another, up to a bright major 3rd.'
        : 'Minor pentatonic: it leaps straight up a minor 3rd first, which sounds darker and bluesy.',
    listen: { notes },
    sound: [],
    facts: ['ear:pent'],
  }
}

/** Hear a scale climb: minor pentatonic, or the blues scale with its blue note? */
export function makeBluesHear(id: number, rng: Rng, only?: 'Minor pentatonic' | 'Blues scale'): Question {
  const which = only ?? pick<'Minor pentatonic' | 'Blues scale'>(['Minor pentatonic', 'Blues scale'], rng)
  const low = between(45, 57, rng)
  const notes = (which === 'Blues scale' ? BLUES_STEPS : MINOR_PENT_STEPS).map((s) => low + s)
  return {
    id,
    kind: 'bluesHear',
    ask: { text: 'Minor pentatonic or blues scale?' },
    options: ['Minor pentatonic', 'Blues scale'],
    answer: which === 'Minor pentatonic' ? 0 : 1,
    why:
      which === 'Blues scale'
        ? 'Blues scale: in the middle, three notes climb a half step at a time, the 4th, the blue note and the 5th.'
        : 'Minor pentatonic: it steps straight from the 4th to the 5th, a whole step, with no blue note between.',
    listen: { notes },
    sound: [],
    facts: ['ear:blues'],
  }
}

/** A dominant 7th, stacked from a root around the A string's range. */
const seventh = (root: number) => [root, root + 4, root + 7, root + 10]

/** Hear the first four bars of a blues: does bar 2 make the quick change to IV? */
export function makeQuickHear(id: number, rng: Rng, only?: boolean): Question {
  const quick = only ?? rng() < 0.5
  const key = pick(BLUES_KEYS, rng)
  const root = 45 + pitchClass(tonePc(parseTone(key)) - 9)
  const four = root + 5 > 57 ? root - 7 : root + 5
  const roots = quick ? [root, four, root, root] : [root, root, root, root]
  const I = `${noteName(key)}7`
  const IV = `${toneName(majorScale(key)[3])}7`
  return {
    id,
    kind: 'quickHear',
    ask: { text: 'Quick change, or does it stay on I?' },
    options: ['Quick change', 'Stays on I'],
    answer: quick ? 0 : 1,
    why: quick
      ? `Quick change: the second chord moves up to IV (${IV}) and comes straight back to I (${I}).`
      : `It stays on I (${I}) for all four bars, the usual start of a 12-bar blues.`,
    listen: { notes: roots.flatMap(seventh), chord: 4 },
    sound: [],
    facts: ['ear:quick'],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const BLUES_ORDER = [
  'blues:pent-why',
  'blues:pent-what',
  'blues:pent-keys',
  'blues:pent-degrees',
  'blues:major-pent',
  'blues:pent-relative',
  'blues:blues-why',
  'blues:blue-note',
  'blues:blues-spell',
  'blues:box-why',
  'blues:box',
  'blues:box-move',
  'blues:patterns',
  'blues:caged-link',
  'blues:all-patterns',
  'blues:twelve-why',
  'blues:twelve',
  'blues:twelve-sevenths',
  'blues:quick-change',
  'blues:turnaround',
  'blues:minor-blues',
  'blues:ear-why',
  'blues:ear-pent',
  'blues:ear-blues',
  'blues:ear-quick',
]
/** Explained on a card, not quizzed on their own. */
export const BLUES_INTRO = ['blues:pent-why', 'blues:blues-why', 'blues:box-why', 'blues:twelve-why', 'blues:ear-why']

export const isBluesItem = (item: string) => item.startsWith('blues:')
/**
 * Facts practiced on these tapes: each key's minor pentatonic ("pmin:A"), its degrees ("pdeg:3"),
 * major pentatonics ("pmaj:C") and their relative minors ("prel:C"), blues scales ("pblues:E"),
 * the box ("pbox:degree", "pbox:root", "pbox:key"), the five patterns ("ppat:3") and the CAGED
 * shape inside them ("ppat:caged"), each bar of the 12-bar blues ("b12:5"), its chords in a key
 * ("b12key:A"), the quick change and turnaround ("b12var:quick"), minor blues ("bminor:A"), and
 * hearing them ("ear:pent", "ear:blues", "ear:quick").
 */
export const isBluesFact = (fact: string) => /^(pmin|pdeg|pmaj|prel|pblues|pbox|ppat|b12|b12key|b12var|bminor):/.test(fact) || /^ear:(pent|blues|quick)$/.test(fact)

const BOX_FACTS = ['degree', 'root', 'key']
const patternFact = (value: string) => (/^[1-5]$/.test(value) ? Number(value) : null)
const degreeFact = (value: string) => (/^[3457]$/.test(value) ? Number(value) : null)
/** A bar of the 12-bar blues, from 0, or null. */
const barFact = (value: string) => (/^([1-9]|1[0-2])$/.test(value) ? Number(value) - 1 : null)

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function bluesItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'pmin':
      return isOneOf(value, MINOR_TONICS) ? 'blues:pent-what' : null
    case 'pdeg':
      return degreeFact(value) ? 'blues:pent-degrees' : null
    case 'pmaj':
      return isOneOf(value, MAJOR_KEYS) ? 'blues:major-pent' : null
    case 'prel':
      return isOneOf(value, MAJOR_KEYS) ? 'blues:pent-relative' : null
    case 'pblues':
      return isOneOf(value, MINOR_TONICS) ? 'blues:blue-note' : null
    case 'pbox':
      return value === 'key' ? 'blues:box-move' : BOX_FACTS.includes(value) ? 'blues:box' : null
    case 'ppat': {
      if (value === 'caged') return 'blues:caged-link'
      const n = patternFact(value)
      return n === null ? null : n <= 2 ? 'blues:patterns' : 'blues:all-patterns'
    }
    case 'b12':
      return barFact(value) !== null ? 'blues:twelve' : null
    case 'b12key':
      return isOneOf(value, BLUES_KEYS) ? 'blues:twelve-sevenths' : null
    case 'b12var':
      return value === 'quick' ? 'blues:quick-change' : value === 'turn' ? 'blues:turnaround' : null
    case 'bminor':
      return isOneOf(value, MINOR_BLUES) ? 'blues:minor-blues' : null
    case 'ear':
      return value === 'pent' ? 'blues:ear-pent' : value === 'blues' ? 'blues:ear-blues' : value === 'quick' ? 'blues:ear-quick' : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function bluesCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const tonics = l.minorKeys ?? []
  const keys = l.keys ?? []
  const patterns = l.patterns ?? []
  const even = turn % 2 === 0
  switch (item) {
    case 'blues:pent-what':
      return makePentMissing(id, tonics, rng, l.showScale)
    case 'blues:pent-keys':
      return even ? makePentSpell(id, tonics, rng) : makePentMissing(id, tonics, rng)
    case 'blues:pent-degrees':
      return makePentDegree(id, tonics, rng)
    case 'blues:major-pent':
      return even ? makeMajorPentMissing(id, keys, rng, l.showScale) : makeMajorPentSpell(id, keys, rng)
    case 'blues:pent-relative':
      return makePentRelative(id, keys, rng)
    case 'blues:blue-note':
      return makeBlueNote(id, tonics, rng)
    case 'blues:blues-spell':
      return makeBluesSpell(id, tonics, rng)
    case 'blues:box':
      return even ? makeBoxDegree(id, rng) : makeBoxRoot(id, rng)
    case 'blues:box-move':
      return makeBoxKey(id, rng)
    case 'blues:patterns':
      return makePatternMissing(id, patterns, rng)
    case 'blues:caged-link':
      return makePatternCaged(id, patterns, rng)
    case 'blues:all-patterns':
      return even ? makePatternRoot(id, patterns, rng) : makePatternMissing(id, patterns, rng)
    case 'blues:twelve':
      return makeTwelveNumeral(id, rng)
    case 'blues:twelve-sevenths':
      return even ? makeTwelveChord(id, keys, rng) : makeTwelveSpell(id, keys, rng)
    case 'blues:quick-change':
      return makeTwelveVariation(id, keys, rng, 'quick')
    case 'blues:turnaround':
      return makeTwelveVariation(id, keys, rng, 'turn')
    case 'blues:minor-blues':
      return makeMinorBlues(id, tonics, rng)
    case 'blues:ear-pent':
      return makePentHear(id, rng)
    case 'blues:ear-blues':
      return makeBluesHear(id, rng)
    case 'blues:ear-quick':
      return makeQuickHear(id, rng)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function bluesReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'pmin':
      if (!isOneOf(value, MINOR_TONICS)) return null
      return rng() < 0.5 ? makePentSpell(id, MINOR_TONICS, rng, value) : makePentMissing(id, MINOR_TONICS, rng, false, value)
    case 'pdeg': {
      const d = degreeFact(value)
      return d ? makePentDegree(id, MINOR_TONICS, rng, d) : null
    }
    case 'pmaj':
      if (!isOneOf(value, MAJOR_KEYS)) return null
      return rng() < 0.5 ? makeMajorPentSpell(id, MAJOR_KEYS, rng, value) : makeMajorPentMissing(id, MAJOR_KEYS, rng, false, value)
    case 'prel':
      return isOneOf(value, MAJOR_KEYS) ? makePentRelative(id, MAJOR_KEYS, rng, value) : null
    case 'pblues':
      if (!isOneOf(value, MINOR_TONICS)) return null
      return rng() < 0.5 ? makeBlueNote(id, MINOR_TONICS, rng, value) : makeBluesSpell(id, MINOR_TONICS, rng, value)
    case 'pbox':
      return value === 'degree' ? makeBoxDegree(id, rng) : value === 'root' ? makeBoxRoot(id, rng) : value === 'key' ? makeBoxKey(id, rng) : null
    case 'ppat': {
      if (value === 'caged') return makePatternCaged(id, PATTERNS, rng)
      const n = patternFact(value)
      if (n === null) return null
      return rng() < 0.5 ? makePatternMissing(id, PATTERNS, rng, n) : makePatternRoot(id, PATTERNS, rng, n)
    }
    case 'b12': {
      const bar = barFact(value)
      if (bar === null) return null
      return rng() < 0.5 ? makeTwelveNumeral(id, rng, bar) : makeTwelveChord(id, BLUES_KEYS, rng, undefined, bar)
    }
    case 'b12key':
      if (!isOneOf(value, BLUES_KEYS)) return null
      return rng() < 0.5 ? makeTwelveChord(id, BLUES_KEYS, rng, value) : makeTwelveSpell(id, BLUES_KEYS, rng, value)
    case 'b12var':
      return isOneOf(value, VARIATIONS) ? makeTwelveVariation(id, BLUES_KEYS, rng, value) : null
    case 'bminor':
      return isOneOf(value, MINOR_BLUES) ? makeMinorBlues(id, MINOR_BLUES, rng, value) : null
    case 'ear':
      return value === 'pent' ? makePentHear(id, rng) : value === 'blues' ? makeBluesHear(id, rng) : value === 'quick' ? makeQuickHear(id, rng) : null
    default:
      return null
  }
}

/** "A minor pentatonic", "Pentatonic Pattern 3"; null if it isn't one of these facts. */
export function describeBluesFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'pmin':
      return isOneOf(value, MINOR_TONICS) ? minorPentName(value) : null
    case 'pdeg':
      return degreeFact(value) ? `The ${degreeName(Number(value))} in the minor pentatonic` : null
    case 'pmaj':
      return isOneOf(value, MAJOR_KEYS) ? majorPentName(value) : null
    case 'prel':
      return isOneOf(value, MAJOR_KEYS) ? `${majorPentName(value)} and its relative minor` : null
    case 'pblues':
      return isOneOf(value, MINOR_TONICS) ? `The ${noteName(value)} blues scale` : null
    case 'pbox':
      return value === 'degree' ? 'Degrees in the pentatonic box' : value === 'root' ? 'Roots in the pentatonic box' : value === 'key' ? 'Naming the box’s key' : null
    case 'ppat':
      if (value === 'caged') return 'The CAGED shape in each pattern'
      return patternFact(value) ? `Pentatonic Pattern ${value}` : null
    case 'b12':
      return barFact(value) !== null ? `Bar ${value} of the 12-bar blues` : null
    case 'b12key':
      return isOneOf(value, BLUES_KEYS) ? `The 12-bar blues in ${noteName(value)}` : null
    case 'b12var':
      return value === 'quick' ? 'The quick change' : value === 'turn' ? 'The turnaround' : null
    case 'bminor':
      return isOneOf(value, MINOR_BLUES) ? `Minor blues in ${keyName(value)}` : null
    case 'ear':
      return value === 'pent' ? 'Hearing major or minor pentatonic' : value === 'blues' ? 'Hearing the blue note' : value === 'quick' ? 'Hearing the quick change' : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const A_PENT = minorPentatonic('A')
const A_MINOR = minorScaleOn('A')
const A_BLUES = bluesScale('A')
/** Colors for a scale on the staff, with these notes (by index) marked. */
const marked = (count: number, color: string, ...indexes: number[]) => Array.from({ length: count + 1 }, (_, i) => (indexes.includes(i) ? color : undefined))

/** A pattern on the neck, labeled with note names or degrees, roots lit. */
function patternBoard(tonic: string, n: number, labels: 'names' | 'degrees'): Card['board'] {
  const notes = pentPattern(tonic, n)!
  return {
    region: patternRegion(notes),
    markers: notes.map(
      (p): Marker => ({
        pos: p,
        tone: degreeAt(tonic, p) === 1 ? 'root' : 'note',
        label: labels === 'names' ? toneName(toneAt(tonic, p)) : String(degreeAt(tonic, p)),
      }),
    ),
  }
}

/** Pattern 1 of A minor pentatonic with C major's G shape lit inside it. */
function cagedBoard(): Card['board'] {
  const notes = pentPattern('A', 1)!
  const { spots } = cagedInside('A', notes)!
  return {
    region: patternRegion(notes),
    markers: notes.map((p): Marker => (spots.some((s) => samePos(s, p)) ? { pos: p, tone: 'correct', label: toneName(toneAt('A', p)) } : { pos: p, tone: 'note' })),
  }
}

const sevenths = (...roots: string[]) => roots.map((r) => chordTones(parseTone(r), '7')!)
/** A whole 12-bar chart in A to hear: a 7th chord a bar. */
const hearBars = (bars: number[], minor = false) => ({ notes: bars.flatMap((d) => triadSound(bluesChord('A', d, minor).tones)), chord: 4 })
const inA = (bars: number[]) => bars.map((d) => bluesChord('A', d).symbol)

const BLUES_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'blues:pent-why': () => ({
    title: 'Why pentatonics',
    subtitle: 'The scale behind the solos',
    hook: 'Most rock, blues and pop guitar solos are built from one five-note scale, the minor pentatonic. With so few notes, and none that rub against each other, almost anything you play from it fits the song. It’s the first scale most guitarists learn to solo with.',
    score: { measures: scaleScore(A_PENT), labels: labelsOf(A_PENT) },
    sound: scaleSound(A_PENT),
  }),
  'blues:pent-what': () => ({
    title: 'The minor pentatonic',
    subtitle: 'The minor scale, minus two notes',
    hook: '“Penta” means five. Take the natural minor scale (tape 27) and leave out its 2nd and 6th notes. A minor is A B C D E F G; without B and F (in red) it’s A C D E G, the A minor pentatonic. B and F were each a half step from a neighbor, so the scale that’s left has no half steps at all.',
    score: { measures: scaleScore(A_MINOR), labels: labelsOf(A_MINOR), colors: marked(7, PAPER_RUST, 1, 5) },
    sound: scaleSound(A_PENT),
  }),
  'blues:pent-keys': () => {
    const e = minorScaleOn('E')
    return {
      title: 'In any key',
      subtitle: 'Leave out the 2nd and 6th',
      hook: 'The recipe works in every key: spell the natural minor scale, then leave out its 2nd and 6th notes. E minor is E F♯ G A B C D. Without F♯ and C, E minor pentatonic is E G A B D.',
      score: { measures: scaleScore(e), labels: labelsOf(e), colors: marked(7, PAPER_RUST, 1, 5) },
      sound: scaleSound(minorPentatonic('E')),
    }
  },
  'blues:pent-degrees': () => ({
    title: 'Numbering the notes',
    subtitle: '1, 3, 4, 5 and 7',
    hook: 'Each note keeps its number from the minor scale: the root is 1, then come the 3rd, 4th, 5th and 7th. In A minor pentatonic, C is the 3rd, D the 4th, E the 5th and G the 7th. Many books write ♭3 and ♭7, because those two are a half step lower than in the major scale.',
    score: { measures: scaleScore(A_PENT), labels: DEGREE_LABELS },
    sound: scaleSound(A_PENT),
  }),
  'blues:major-pent': () => {
    const c = majorScale('C')
    return {
      title: 'The major pentatonic',
      subtitle: 'The major scale, minus the 4th and 7th',
      hook: 'The major scale has a pentatonic too: leave out its 4th and 7th notes. C major is C D E F G A B; without F and B (in red) it’s C D E G A. It has no half steps either, but it sounds bright and open. You’ll hear it all over country, pop and rock.',
      score: { measures: scaleScore(c), labels: labelsOf(c), colors: marked(7, PAPER_RUST, 3, 6) },
      sound: scaleSound(majorPentatonic('C')),
    }
  },
  'blues:pent-relative': () => {
    const c = majorPentatonic('C')
    return {
      title: 'Same notes, new home',
      subtitle: 'C major pentatonic is A minor pentatonic',
      hook: 'C major pentatonic is C D E G A. Start it from A instead and you have A C D E G, the A minor pentatonic. Like relative keys (tape 27), every major pentatonic shares its notes with the minor pentatonic on its 6th note. Which one you hear depends on which note feels like home.',
      score: { measures: [oneMeasure(c), oneMeasure(A_PENT)], labels: [...labelsOf(c), ...labelsOf(A_PENT)] },
      sound: [...scaleSound(c), ...scaleSound(A_PENT)],
    }
  },
  'blues:blues-why': () => ({
    title: 'The blues scale',
    subtitle: 'The minor pentatonic, plus one',
    hook: 'Add one note to the minor pentatonic and you get the blues scale, the sound of blues guitar. In A it’s A C D E♭ E G: six notes. The extra note, E♭ here, is called the blue note.',
    score: { measures: scaleScore(A_BLUES), labels: labelsOf(A_BLUES), colors: marked(6, PAPER_HIGHLIGHT, 3) },
    sound: scaleSound(A_BLUES),
  }),
  'blues:blue-note': () => ({
    title: 'The blue note',
    subtitle: 'The 5th, lowered',
    hook: 'The blue note is the 5th, lowered a half step: in A, E becomes E♭. It sits between the 4th and the 5th, a tritone above the root (tape 29), so it sounds tense and gritty. Blues players slide through it on the way to the 4th or the 5th rather than stopping on it.',
    score: { measures: scaleScore(A_BLUES), labels: [...SCALE_DEGREES.blues, '1'], colors: marked(6, PAPER_HIGHLIGHT, 3) },
    sound: [50, 51, 52, 51, 50],
  }),
  'blues:blues-spell': () => {
    const e = bluesScale('E')
    return {
      title: 'Spelling the blues scale',
      subtitle: 'Flat the 5th',
      hook: 'To spell it, write the minor pentatonic and add the 5th with a flat. In E, the 5th is B, so the blue note is B♭: E G A B♭ B D. In B, the 5th is F♯, and a flat brings it down to F: B D E F F♯ A.',
      score: { measures: scaleScore(e), labels: labelsOf(e), colors: marked(6, PAPER_HIGHLIGHT, 3) },
      sound: scaleSound(e),
    }
  },
  'blues:box-why': () => ({
    title: 'Why the box',
    subtitle: 'The whole scale under one hand',
    hook: 'Spread across all six strings, the minor pentatonic fits in four frets, two notes on every string. Guitarists call this shape the box. Every note falls under a finger without moving your hand, so it’s the first shape most players solo with. Here’s A minor pentatonic at the 5th fret.',
    board: patternBoard('A', 1, 'names'),
    sound: ascending(pentPattern('A', 1)!),
  }),
  'blues:box': () => ({
    title: 'Pattern 1: the box',
    subtitle: 'Roots on both E strings and the D string',
    hook: 'The box’s roots (lit) are at its bottom corner on the low E and high E strings, and on the D string two frets up. Around them the 3rd, 4th, 5th and 7th sit in the same spots wherever you play the box.',
    board: patternBoard('A', 1, 'degrees'),
    sound: ascending(pentPattern('A', 1)!),
  }),
  'blues:box-move': () => ({
    title: 'Moving the box',
    subtitle: 'The low E root names the key',
    hook: 'Slide the box along the neck and it plays a new key’s minor pentatonic. The key is the note under its root on the low E string: at the 5th fret, A minor pentatonic; at the 8th fret, C; at the 3rd fret, G. Here it is at the 8th fret, in C.',
    onGuitar: 'Know the notes on the low E string (tape 9) and you can play the box in any key.',
    board: patternBoard('C', 1, 'names'),
    sound: ascending(pentPattern('C', 1)!),
  }),
  'blues:patterns': () => ({
    title: 'Five patterns',
    subtitle: 'The box and its neighbors',
    hook: 'The box is Pattern 1 of five. Each pattern starts where the last one ends: the higher note on each string of Pattern 1 is the lower note of Pattern 2, and so on up to Pattern 5, then Pattern 1 again, 12 frets up. All five use the same five notes. Here’s Pattern 2 of A minor pentatonic.',
    board: patternBoard('A', 2, 'names'),
    sound: ascending(pentPattern('A', 2)!),
  }),
  'blues:caged-link': () => ({
    title: 'Patterns and CAGED',
    subtitle: 'A chord inside every pattern',
    hook: 'A minor pentatonic has the same notes as C major pentatonic (tape 58), so every pattern holds a C major chord, C E G. In each one those notes make a CAGED shape (tape 50): Pattern 1 holds the G shape (lit here), Pattern 2 the E shape, then the D, C and A shapes, the same order as CAGED up the neck.',
    board: cagedBoard(),
    sound: [...cagedInside('A', pentPattern('A', 1)!)!.spots.map(midiAt)].sort((a, b) => a - b),
  }),
  'blues:all-patterns': () => ({
    title: 'Roots in every pattern',
    subtitle: 'Find home anywhere',
    hook: 'Every pattern has two or three roots. Find them and you know where you are: the root is home, and the other notes sit around it in the same places every time you play that pattern. Here’s Pattern 5 of A minor pentatonic, just below the box, its roots lit.',
    board: patternBoard('A', 5, 'names'),
    sound: ascending(pentPattern('A', 5)!),
  }),
  'blues:twelve-why': () => ({
    title: 'Why the 12-bar blues',
    subtitle: 'One chart, thousands of songs',
    hook: 'The 12-bar blues is the chord pattern behind countless blues and rock and roll songs. It’s 12 bars long, uses just three chords, I, IV and V, and repeats over and over. Know its order and you can follow along with all of them. In A, the three chords are A7, D7 and E7.',
    score: { measures: chordMeasures(...sevenths('A', 'D', 'E')), labels: ['I · A7', 'IV · D7', 'V · E7'] },
    listen: { notes: sevenths('A', 'D', 'E', 'A').flatMap((c) => triadSound(c)), chord: 4 },
    sound: [],
  }),
  'blues:twelve': () => ({
    title: 'The 12 bars',
    subtitle: 'Three lines of four',
    hook: 'A bar is another word for a measure, and each slash is one beat. The chart reads in three lines of four bars. Line 1 is all I. Line 2 is IV, IV, I, I. Line 3 is V, IV, I, I. Then it starts again from the top. Press ▶ Hear for all 12 bars in A.',
    chart: { bars: TWELVE.map((d) => NUMERALS[d]) },
    listen: hearBars(TWELVE),
    sound: [],
  }),
  'blues:twelve-sevenths': () => ({
    title: 'Every chord a 7th',
    subtitle: 'I7, IV7 and V7',
    hook: 'Blues plays all three chords as dominant 7ths (tape 46), which gives them their bluesy, restless sound. In a major key only V is normally a dominant 7th (tape 47); blues bends that rule on purpose. In A: A7, D7 and E7.',
    chart: { bars: inA(TWELVE), numerals: TWELVE.map((d) => `${NUMERALS[d]}7`) },
    listen: hearBars([0, 3, 4, 0]),
    sound: [],
  }),
  'blues:quick-change': () => ({
    title: 'The quick change',
    subtitle: 'IV in bar 2',
    hook: 'Many blues songs make a quick change: bar 2 jumps to IV, and bar 3 comes straight back to I. It breaks up the four bars of I at the start. In A: A7, D7, A7, A7.',
    chart: { bars: inA(twelveWith('quick')), mark: 1 },
    listen: hearBars(twelveWith('quick').slice(0, 4)),
    sound: [],
  }),
  'blues:turnaround': () => ({
    title: 'The turnaround',
    subtitle: 'V in bar 12',
    hook: 'The last bar often goes to V instead of staying on I. That’s the turnaround: V pulls back to I, leading round to the top of the chart again. In A, bar 12 becomes E7. Here: bars 9 to 12, then bar 1 again.',
    chart: { bars: inA(twelveWith('turn')), mark: 11 },
    listen: hearBars([...twelveWith('turn').slice(8), 0]),
    sound: [],
  }),
  'blues:minor-blues': () => ({
    title: 'Minor blues',
    subtitle: 'i7, iv7 and v7',
    hook: 'A minor blues keeps the same 12 bars but uses minor 7th chords (tape 46): i7, iv7 and v7. In A minor that’s Am7, Dm7 and Em7. Bar 9 is often E7 instead, using the raised 7th from tape 53.',
    chart: { bars: TWELVE.map((d) => bluesChord('A', d, true).symbol), numerals: TWELVE.map((d) => `${MINOR_NUMERALS[d]}7`) },
    listen: hearBars([0, 3, 4, 0], true),
    sound: [],
  }),
  'blues:ear-why': () => {
    const major = MAJOR_PENT_STEPS.map((s) => 48 + s)
    const minor = MINOR_PENT_STEPS.map((s) => 48 + s)
    return {
      title: 'Why hear the scale',
      subtitle: 'Bright or bluesy',
      hook: 'Hearing whether a solo uses the major or the minor pentatonic tells you which one to reach for when you play along. Press ▶ Hear: C major pentatonic, then C minor pentatonic.',
      score: { measures: [oneMeasure(majorPentatonic('C')), oneMeasure(minorPentatonic('C'))], labels: [...labelsOf(majorPentatonic('C')), ...labelsOf(minorPentatonic('C'))] },
      listen: { notes: [...major, ...minor] },
      sound: [],
    }
  },
  'blues:ear-pent': () => ({
    title: 'Major or minor pentatonic',
    subtitle: 'Listen to the first step',
    hook: 'The major pentatonic climbs a whole step from the root, then another, to a bright 3rd. The minor pentatonic leaps straight up a minor 3rd: darker and bluesy. Here: A major pentatonic, then A minor pentatonic.',
    score: { measures: [oneMeasure(majorPentatonic('A')), oneMeasure(A_PENT)], labels: [...labelsOf(majorPentatonic('A')), ...labelsOf(A_PENT)] },
    listen: { notes: [...MAJOR_PENT_STEPS.map((s) => 45 + s), ...MINOR_PENT_STEPS.map((s) => 45 + s)] },
    sound: [],
  }),
  'blues:ear-blues': () => ({
    title: 'Hear the blue note',
    subtitle: 'Three notes, a half step apart',
    hook: 'The blue note fills the gap between the 4th and the 5th, so in the middle of the blues scale you hear three notes climbing a half step at a time: D, E♭, E in A. The minor pentatonic steps straight from the 4th to the 5th. Here: A minor pentatonic, then A blues.',
    score: { measures: [oneMeasure(A_PENT), oneMeasure(A_BLUES)], labels: [...labelsOf(A_PENT), ...labelsOf(A_BLUES)] },
    listen: { notes: [...MINOR_PENT_STEPS.map((s) => 45 + s), ...BLUES_STEPS.map((s) => 45 + s)] },
    sound: [],
  }),
  'blues:ear-quick': () => ({
    title: 'The quick change',
    subtitle: 'Listen to the second chord',
    hook: 'A 12-bar blues (tape 61) can start two ways: four bars on I, or a quick change, jumping to IV in the second bar and straight back. Listen to the second chord. Here: A7 A7 A7 A7, then A7 D7 A7 A7.',
    score: { measures: chordMeasures(...sevenths('A', 'D')), labels: ['A7 (I)', 'D7 (IV)'] },
    listen: { notes: [...sevenths('A', 'A', 'A', 'A'), ...sevenths('A', 'D', 'A', 'A')].flatMap((c) => triadSound(c)), chord: 4 },
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function bluesCard(item: string, counter: string): Card {
  return { ...BLUES_CARDS[item](), counter }
}
