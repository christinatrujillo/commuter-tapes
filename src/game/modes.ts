import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import type { Marker } from '../components/Fretboard'
import { ALL_STRINGS, allPositions, midiAt, pitchClass, samePos, type Position, type Region } from '../music/notes'
import { KEY_ORDER, KEYS, keyLabel, type KeyId } from '../music/score'
import {
  CHORD_NAMES,
  chordSymbol,
  degreeName,
  KEY_ON_PC,
  majorScale,
  NUMERALS,
  parseTone,
  RARE_SPELLINGS,
  scaleLabels,
  scaleScore,
  scaleSound,
  spelled,
  toneId,
  toneName,
  tonePc,
  type ChordKind,
  type Tone,
  type TriadQuality,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { marked, PAPER_HIGHLIGHT } from '../lib/color'
import type { Question } from './questions'
import { triadSound } from './triads'

/**
 * Modes: a major scale played from one of its other notes, so the same seven notes get a new
 * home. Volume 10 names the seven modes and finds them in any key, gives each its color note
 * against major or minor, puts a mode on every chord in a key, finds modes in the major scale
 * patterns on the neck, and hears them.
 */

export type ModeId = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'
/** The modes in order: the one on the major scale's 1st note, then its 2nd, and so on up. */
export const MODES: ModeId[] = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']
export const MODE_NAMES: Record<ModeId, string> = {
  ionian: 'Ionian',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Aeolian',
  locrian: 'Locrian',
}
/** Ionian is the parent scale itself, so finding it in a key asks nothing. */
const KEYED_MODES: ModeId[] = MODES.filter((m) => m !== 'ionian')

/** Major keys the mode tapes borrow notes from, all spelled on the Major scale tape. */
const PARENT_KEYS: KeyId[] = ['C', 'G', 'F', 'D', 'A', 'Bb']
const knownKeys = (keys: KeyId[]) => {
  const own = keys.filter((k) => isOneOf(k, PARENT_KEYS))
  return own.length ? own : PARENT_KEYS.slice(0, 1)
}

/** `key`'s major scale played from the note `mode` starts on: D E F G A B C for C major's Dorian. */
export function modeScale(key: KeyId, mode: ModeId): Tone[] {
  const s = majorScale(key)
  const i = MODES.indexOf(mode)
  return [...s.slice(i), ...s.slice(0, i)]
}
/** A mode's notes as half steps up from its root: Dorian is 0 2 3 5 7 9 10. */
const halfSteps = (mode: ModeId) => {
  const tones = modeScale('C', mode)
  return tones.map((t) => pitchClass(tonePc(t) - tonePc(tones[0])))
}
/** A mode's notes as degrees, counted against the major scale on its own root: Dorian is 1 2 ♭3 4 5 6 ♭7. */
export function modeDegrees(mode: ModeId): string[] {
  const major = halfSteps('ionian')
  return halfSteps(mode).map((s, i) => `${s < major[i] ? '♭' : s > major[i] ? '♯' : ''}${i + 1}`)
}
/** "D Dorian" */
const modeName = (key: KeyId, mode: ModeId) => `${toneName(modeScale(key, mode)[0])} ${MODE_NAMES[mode]}`
/** The modes up to `mode`, numbered: "1 Ionian, 2 Dorian, 3 Phrygian". */
const countUp = (mode: ModeId) =>
  MODES.slice(0, MODES.indexOf(mode) + 1)
    .map((m, i) => `${i + 1} ${MODE_NAMES[m]}`)
    .join(', ')
/** A mode and two neighbors in the order (the easy slips when counting), plus one more, shuffled. */
function modeOptions(mode: ModeId, rng: Rng): string[] {
  const i = MODES.indexOf(mode)
  const near = [MODES[(i + 6) % 7], MODES[(i + 1) % 7]]
  const other = pick(
    MODES.filter((m) => m !== mode && !near.includes(m)),
    rng,
  )
  return shuffle([mode, ...near, other], rng).map((m) => MODE_NAMES[m])
}
/** Ionian and Aeolian are scales you met before under other names. */
const alsoKnownAs = (mode: ModeId) => (mode === 'ionian' ? ' That’s the major scale itself.' : mode === 'aeolian' ? ' That’s the natural minor scale.' : '')

// ---------------------------------------------------------------------------
// The seven modes
// ---------------------------------------------------------------------------

/** "C major’s notes, played from D to D: which mode?" With `help`, the major scale is on the staff, the start note marked. */
export function makeModeOnDegree(id: number, keys: KeyId[], rng: Rng, help = false, only?: ModeId): Question {
  const key = pick(knownKeys(keys), rng)
  const mode = only ?? pick(MODES, rng)
  const i = MODES.indexOf(mode)
  const scale = majorScale(key)
  const tones = modeScale(key, mode)
  const root = toneName(tones[0])
  const options = modeOptions(mode, rng)
  return {
    id,
    kind: 'modeOnDegree',
    ask: { text: `${keyLabel(key)} major’s notes, played from ${root} to ${root}: which mode?`, hl: `${root} to ${root}` },
    options,
    answer: options.indexOf(MODE_NAMES[mode]),
    why: `${root} is the ${degreeName(i + 1)} note of ${keyLabel(key)} major, and the mode on the ${degreeName(i + 1)} note is ${MODE_NAMES[mode]}: ${spelled(tones)}.${alsoKnownAs(mode)}`,
    score: help
      ? { measures: scaleScore(scale), labels: scaleLabels(scale), colors: marked(7, PAPER_HIGHLIGHT, i), afterMeasures: scaleScore(tones), after: scaleLabels(tones) }
      : { measures: scaleScore(tones), labels: scaleLabels(tones) },
    sound: scaleSound(tones),
    facts: [`mode:${mode}`],
  }
}

/** "Which degree of the major scale does Lydian start on?" or "Which mode starts on the 4th degree of the major scale?" */
export function makeModeDegree(id: number, rng: Rng, only?: ModeId): Question {
  const mode = only ?? pick(MODES, rng)
  const i = MODES.indexOf(mode)
  const name = MODE_NAMES[mode]
  const nth = `${degreeName(i + 1)} degree`
  const byName = rng() < 0.5
  const options = byName ? ['1', '2', '3', '4', '5', '6', '7'] : modeOptions(mode, rng)
  return {
    id,
    kind: 'modeDegree',
    ask: byName
      ? { text: `Which degree of the major scale does ${name} start on?`, hl: name }
      : { text: `Which mode starts on the ${nth} of the major scale?`, hl: nth },
    options,
    answer: byName ? i : options.indexOf(name),
    why: `Count up the order: ${countUp(mode)}. ${byName ? `${name} starts on the ${degreeName(i + 1)}.` : `The mode on the ${degreeName(i + 1)} is ${name}.`}`,
    sound: scaleSound(modeScale('C', mode)),
    facts: [`mode:${mode}`],
  }
}

/** Major keys one and two steps around the circle of fifths from `key`, nearest first. */
function neighborKeys(key: KeyId): KeyId[] {
  const count = KEYS[key].count
  return [1, -1, 2, -2].map((d) => KEY_ORDER.find((k) => KEYS[k].count === count + d)).filter((k): k is KeyId => !!k)
}

/** "A Dorian has the same notes as which major scale?" */
export function makeModeParent(id: number, keys: KeyId[], rng: Rng, only?: ModeId): Question {
  const key = pick(knownKeys(keys), rng)
  const mode = only && KEYED_MODES.includes(only) ? only : pick(KEYED_MODES, rng)
  const i = MODES.indexOf(mode)
  const tones = modeScale(key, mode)
  const name = modeName(key, mode)
  // Near misses: the major scale on the mode's own first note, then the keys next door on the circle.
  const own = KEY_ORDER.find((k) => k === toneId(tones[0]))
  const wrong = [...new Set([own, ...neighborKeys(key)].filter((k): k is KeyId => !!k && k !== key))].slice(0, 3)
  const options = shuffle([key, ...wrong], rng).map((k) => `${keyLabel(k)} major`)
  return {
    id,
    kind: 'modeParent',
    ask: { text: `${name} has the same notes as which major scale?`, hl: name },
    options,
    answer: options.indexOf(`${keyLabel(key)} major`),
    why: `${MODE_NAMES[mode]} starts on the ${degreeName(i + 1)} note of its parent scale. ${toneName(tones[0])} is the ${degreeName(i + 1)} note of ${keyLabel(key)} major (${spelled(majorScale(key))}), so ${name} is ${spelled(tones)}.`,
    score: { measures: [[]], afterMeasures: scaleScore(tones), after: scaleLabels(tones) },
    sound: scaleSound(tones),
    facts: [`modek:${mode}`],
  }
}

/** "In F major, which note does Mixolydian start on?" */
export function makeModeRoot(id: number, keys: KeyId[], rng: Rng, only?: ModeId): Question {
  const key = pick(knownKeys(keys), rng)
  const mode = only && KEYED_MODES.includes(only) ? only : pick(KEYED_MODES, rng)
  const i = MODES.indexOf(mode)
  const scale = majorScale(key)
  const tones = modeScale(key, mode)
  // Near misses: the notes either side (a slip in counting), and one more from the key.
  const options = shuffle([i, (i + 6) % 7, (i + 1) % 7, (i + 3) % 7], rng).map((j) => toneName(scale[j]))
  return {
    id,
    kind: 'modeRoot',
    ask: { text: `In ${keyLabel(key)} major, which note does ${MODE_NAMES[mode]} start on?`, hl: MODE_NAMES[mode] },
    options,
    answer: options.indexOf(toneName(scale[i])),
    why: `${MODE_NAMES[mode]} starts on the ${degreeName(i + 1)} note. Count up ${keyLabel(key)} major: ${scale
      .slice(0, i + 1)
      .map(toneName)
      .join(' ')}. So it’s ${modeName(key, mode)}: ${spelled(tones)}.`,
    score: { measures: [[]], keySig: key, afterMeasures: scaleScore(tones), after: scaleLabels(tones) },
    sound: scaleSound(tones),
    facts: [`modek:${mode}`],
  }
}

// ---------------------------------------------------------------------------
// Mode colors: each mode next to the major or minor scale on its own root
// ---------------------------------------------------------------------------

/**
 * The modes that move one note of major or minor. They get the one-note color questions, the vamps
 * and the ear tape; Locrian moves two and never settles, so it's asked about by name and spelling.
 */
const ONE_NOTE_MODES: ModeId[] = ['lydian', 'mixolydian', 'dorian', 'phrygian']
/** Modes with a color note: all but plain major (Ionian) and natural minor (Aeolian). */
const COLOR_MODES: ModeId[] = [...ONE_NOTE_MODES, 'locrian']
/** Major modes have a major 3rd and sit next to the major scale; the rest sit next to natural minor. */
const isMajorMode = (mode: ModeId) => mode === 'ionian' || mode === 'lydian' || mode === 'mixolydian'
/** The degrees each mode moves from its plain scale, and which way. */
const COLOR_NOTES: Record<ModeId, { degrees: number[]; way: 'raised' | 'lowered' }> = {
  ionian: { degrees: [], way: 'raised' },
  dorian: { degrees: [6], way: 'raised' },
  phrygian: { degrees: [2], way: 'lowered' },
  lydian: { degrees: [4], way: 'raised' },
  mixolydian: { degrees: [7], way: 'lowered' },
  aeolian: { degrees: [], way: 'lowered' },
  locrian: { degrees: [2, 5], way: 'lowered' },
}
/** From brightest to darkest: each mode lowers one more note than the one before it. */
const BRIGHT_ORDER: ModeId[] = ['lydian', 'ionian', 'mixolydian', 'dorian', 'aeolian', 'phrygian', 'locrian']
const plainWord = (mode: ModeId) => (isMajorMode(mode) ? 'major' : 'minor')
/** "7th", or "2nd and 5th" for Locrian. */
const moved = (mode: ModeId) => COLOR_NOTES[mode].degrees.map(degreeName).join(' and ')
/** "major with a lowered 7th" */
const formula = (mode: ModeId) => `${plainWord(mode)} with a ${COLOR_NOTES[mode].way} ${moved(mode)}`
/** "Lowered 7th" */
const colorLabel = (mode: ModeId) => `${COLOR_NOTES[mode].way === 'raised' ? 'Raised' : 'Lowered'} ${moved(mode)}`

/** Roots the color tapes use: major keys for the major modes, minor keys (by home note) for the minor ones. */
const MAJOR_ROOTS: KeyId[] = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb']
const MINOR_ROOTS = ['A', 'E', 'B', 'D', 'G', 'C', 'F']

/** `mode` on `root` ("D"), spelled from its parent scale; null if that takes a rare spelling like E♯. */
function modeOn(root: string, mode: ModeId): Tone[] | null {
  const i = MODES.indexOf(mode)
  const parent = KEY_ORDER.find((k) => toneId(majorScale(k)[i]) === root)
  if (!parent) return null
  const tones = modeScale(parent, mode)
  return tones.some((t) => RARE_SPELLINGS.has(toneName(t))) ? null : tones
}
/** "D Dorian", from a root ("D") and a mode. */
const nameOn = (root: string, mode: ModeId) => `${keyLabel(root)} ${MODE_NAMES[mode]}`
/** The plain scale a mode is compared with: major on its root, or natural minor. */
const plainScale = (root: string, mode: ModeId) => modeOn(root, isMajorMode(mode) ? 'ionian' : 'aeolian')

/** Roots from a track's keys that suit `mode` and spell cleanly. */
function rootsFor(mode: ModeId, keys: string[], minorKeys: string[]): string[] {
  const [own, all] = isMajorMode(mode) ? [keys, MAJOR_ROOTS as string[]] : [minorKeys, MINOR_ROOTS]
  const fits = (roots: string[]) => roots.filter((r) => all.includes(r) && modeOn(r, mode) && plainScale(r, mode))
  return fits(own).length ? fits(own) : fits(all.slice(0, 3))
}
/** The modes a track asks about, out of `pool`. */
function knownModes(modes: string[], pool: ModeId[]): ModeId[] {
  const own = pool.filter((m) => modes.includes(m))
  return own.length ? own : pool
}

/** "Which note of G Mixolydian isn’t in G major?" */
export function makeModeColor(id: number, keys: string[], minorKeys: string[], modes: string[], rng: Rng, only?: ModeId): Question {
  const mode = only && ONE_NOTE_MODES.includes(only) ? only : pick(knownModes(modes, ONE_NOTE_MODES), rng)
  const root = pick(rootsFor(mode, keys, minorKeys), rng)
  const tones = modeOn(root, mode)!
  const plain = plainScale(root, mode)!
  const d = COLOR_NOTES[mode].degrees[0]
  // The other choices are notes the two scales share (never the root).
  const others = shuffle([1, 2, 3, 4, 5, 6].filter((j) => j !== d - 1), rng).slice(0, 3)
  const options = shuffle([d - 1, ...others], rng).map((j) => toneName(tones[j]))
  const name = nameOn(root, mode)
  const plainLabel = `${keyLabel(root)} ${plainWord(mode)}`
  return {
    id,
    kind: 'modeColor',
    ask: { text: `Which note of ${name} isn’t in ${plainLabel}?`, hl: name },
    options,
    answer: options.indexOf(toneName(tones[d - 1])),
    why: `${plainLabel} is ${spelled(plain)}. ${name} ${COLOR_NOTES[mode].way === 'raised' ? 'raises' : 'lowers'} the ${degreeName(d)}: ${toneName(plain[d - 1])} becomes ${toneName(tones[d - 1])}, ${MODE_NAMES[mode]}’s color note.`,
    score: { measures: scaleScore(plain), labels: scaleLabels(plain), afterMeasures: scaleScore(tones), after: scaleLabels(tones) },
    sound: scaleSound(tones),
    facts: [`modec:${mode}`],
  }
}

/** "Which mode is major with a lowered 7th?" or "What’s Mixolydian’s color note?" */
export function makeModeFormula(id: number, modes: string[], rng: Rng, only?: ModeId): Question {
  const mode = only && COLOR_MODES.includes(only) ? only : pick(knownModes(modes, COLOR_MODES), rng)
  const byFormula = rng() < 0.5
  const picks = shuffle([mode, ...shuffle(COLOR_MODES.filter((m) => m !== mode), rng).slice(0, 3)], rng)
  // The example is the mode on the white keys: C major's notes, from the mode's own note.
  const tones = modeScale('C', mode)
  const root = toneName(tones[0])
  const plain = plainScale(root, mode)!
  const name = MODE_NAMES[mode]
  return {
    id,
    kind: 'modeFormula',
    ask: byFormula
      ? { text: `Which mode is ${formula(mode)}?`, hl: formula(mode) }
      : { text: mode === 'locrian' ? 'What are Locrian’s color notes?' : `What’s ${name}’s color note?`, hl: name },
    options: picks.map((m) => (byFormula ? MODE_NAMES[m] : colorLabel(m))),
    answer: picks.indexOf(mode),
    why: `${name} is ${formula(mode)}. ${root} ${name} is ${spelled(tones)}, where ${root} ${plainWord(mode)} is ${spelled(plain)}.`,
    score: { measures: [[]], afterMeasures: scaleScore(tones), after: scaleLabels(tones) },
    sound: scaleSound(tones),
    facts: [`modec:${mode}`],
  }
}

/** "Which notes make A Mixolydian?" */
export function makeModeSpell(id: number, keys: string[], minorKeys: string[], modes: string[], rng: Rng, only?: ModeId): Question {
  const mode = only && COLOR_MODES.includes(only) ? only : pick(knownModes(modes, COLOR_MODES), rng)
  const root = pick(rootsFor(mode, keys, minorKeys), rng)
  const tones = modeOn(root, mode)!
  const plain = plainScale(root, mode)!
  const right = spelled(tones)
  // Near misses: the plain scale, then the modes either side in brightness (one note off), then the rest.
  const b = BRIGHT_ORDER.indexOf(mode)
  const nearby = [BRIGHT_ORDER[b - 1], BRIGHT_ORDER[b + 1], ...shuffle(BRIGHT_ORDER.filter((_, j) => Math.abs(j - b) > 1), rng)].filter((m): m is ModeId => !!m)
  const wrong = [...new Set([plain, ...nearby.map((m) => modeOn(root, m))].filter((s): s is Tone[] => !!s).map(spelled))].filter((s) => s !== right).slice(0, 3)
  const options = shuffle([right, ...wrong], rng)
  const name = nameOn(root, mode)
  return {
    id,
    kind: 'modeSpell',
    ask: { text: `Which notes make ${name}?`, hl: name },
    options,
    answer: options.indexOf(right),
    why: `Start from ${keyLabel(root)} ${plainWord(mode)}: ${spelled(plain)}. ${MODE_NAMES[mode]} is ${formula(mode)}, so ${COLOR_NOTES[mode].way === 'raised' ? 'raise' : 'lower'} the ${moved(mode)}: ${right}.`,
    score: { measures: [[]], afterMeasures: scaleScore(tones), after: scaleLabels(tones) },
    sound: scaleSound(tones),
    facts: [`modesp:${mode}`],
  }
}

// ---------------------------------------------------------------------------
// Modes and chords
// ---------------------------------------------------------------------------

/** "Dm": a triad named from its notes. */
function triadName(tones: Tone[]): string {
  const third = pitchClass(tonePc(tones[1]) - tonePc(tones[0]))
  const fifth = pitchClass(tonePc(tones[2]) - tonePc(tones[0]))
  const quality: TriadQuality = third === 4 ? (fifth === 8 ? 'aug' : 'maj') : fifth === 6 ? 'dim' : 'min'
  return chordSymbol(tones[0], quality)
}
/** The triad on degree `d` of a seven-note scale, stacked from its own notes. */
const triadOn = (tones: Tone[], d: number) => [0, 2, 4].map((k) => tones[(d - 1 + k) % 7])

/** "In a major key, which mode starts on the root of the V chord?" or the other way round. */
export function makeModeNumeral(id: number, rng: Rng, only?: ModeId): Question {
  const mode = only ?? pick(MODES, rng)
  const i = MODES.indexOf(mode)
  const byNumeral = rng() < 0.5
  const near = [(i + 6) % 7, (i + 1) % 7]
  const other = pick(
    [0, 1, 2, 3, 4, 5, 6].filter((j) => j !== i && !near.includes(j)),
    rng,
  )
  const picks = shuffle([i, ...near, other], rng)
  return {
    id,
    kind: 'modeNumeral',
    ask: byNumeral
      ? { text: `In a major key, which mode starts on the root of the ${NUMERALS[i]} chord?`, hl: `${NUMERALS[i]} chord` }
      : { text: `In a major key, ${MODE_NAMES[mode]} starts on the root of which chord?`, hl: MODE_NAMES[mode] },
    options: picks.map((j) => (byNumeral ? MODE_NAMES[MODES[j]] : NUMERALS[j])),
    answer: picks.indexOf(i),
    why: `The ${NUMERALS[i]} chord is built on the ${degreeName(i + 1)} note, where ${MODE_NAMES[mode]} starts. In C major, that’s ${triadName(triadOn(majorScale('C'), i + 1))} and ${modeName('C', mode)}.`,
    sound: scaleSound(modeScale('C', mode)),
    facts: [`moden:${mode}`],
  }
}

/** The 7th chord on each mode's first note, stacked from its own notes. */
const HOME_KINDS: Record<ModeId, ChordKind> = { ionian: 'maj7', dorian: 'm7', phrygian: 'm7', lydian: 'maj7', mixolydian: '7', aeolian: 'm7', locrian: 'm7b5' }
const SEVENTH_KINDS: ChordKind[] = ['maj7', '7', 'm7', 'm7b5']
/** Home chords no other mode shares, so the chord alone names the mode. */
const OWN_HOME: ModeId[] = ['mixolydian', 'locrian']
const chordWords = (kind: ChordKind) => `${CHORD_NAMES[kind]}${kind === 'm7b5' ? ' chord' : ''}`

/** "What’s the home chord of A Dorian?" or, for a chord only one mode has at home, "Which mode has G7 as its home chord?" */
export function makeModeHomeChord(id: number, keys: KeyId[], rng: Rng, only?: ModeId): Question {
  const key = pick(knownKeys(keys), rng)
  const mode = only ?? pick(MODES, rng)
  const tones = modeScale(key, mode)
  const root = toneName(tones[0])
  const kind = HOME_KINDS[mode]
  const symbol = chordSymbol(tones[0], kind)
  const stack = [tones[0], tones[2], tones[4], tones[6]]
  const name = modeName(key, mode)
  const built = `Stack 3rds from ${root} using ${name}’s notes: ${spelled(stack)}, ${symbol}, a ${chordWords(kind)}.`
  const shared = { id, kind: 'modeHomeChord' as const, score: { measures: [[]], afterMeasures: scaleScore(tones), after: scaleLabels(tones) }, sound: triadSound(stack), facts: [`modeh:${mode}`] }
  if (OWN_HOME.includes(mode) && rng() < 0.5) {
    const picks = shuffle([mode, ...shuffle(MODES.filter((m) => m !== mode), rng).slice(0, 3)], rng)
    const options = picks.map((m) => `${root} ${MODE_NAMES[m]}`)
    return { ...shared, ask: { text: `Which mode has ${symbol} as its home chord?`, hl: symbol }, options, answer: picks.indexOf(mode), why: `Only ${MODE_NAMES[mode]} has a ${chordWords(kind)} at home. ${built}` }
  }
  const options = shuffle(
    SEVENTH_KINDS.map((k) => chordSymbol(tones[0], k)),
    rng,
  )
  return { ...shared, ask: { text: `What’s the home chord of ${name}?`, hl: name }, options, answer: options.indexOf(symbol), why: built }
}

/** Vamps that point to a mode: its home chord, then the chord on this degree of the mode, which holds the color note. */
const VAMP_DEGREE: Partial<Record<ModeId, number>> = { dorian: 4, mixolydian: 7, lydian: 2, phrygian: 2 }
/** A mode's vamp: its home triad and the triad holding its color note. */
const vampOf = (tones: Tone[], mode: ModeId) => [triadOn(tones, 1), triadOn(tones, VAMP_DEGREE[mode]!)]

/** "Am – D, over and over: which mode?" */
export function makeModeVamp(id: number, keys: string[], minorKeys: string[], modes: string[], rng: Rng, only?: ModeId): Question {
  const mode = only && ONE_NOTE_MODES.includes(only) ? only : pick(knownModes(modes, ONE_NOTE_MODES), rng)
  const root = pick(rootsFor(mode, keys, minorKeys), rng)
  const tones = modeOn(root, mode)!
  const [home, away] = vampOf(tones, mode)
  const [homeName, awayName] = [triadName(home), triadName(away)]
  const color = tones[COLOR_NOTES[mode].degrees[0] - 1]
  const name = nameOn(root, mode)
  // Only the mode named holds both chords: every other mode on the root misses a note of one.
  const picks = shuffle([mode, ...shuffle(MODES.filter((m) => m !== mode), rng).slice(0, 3)], rng)
  return {
    id,
    kind: 'modeVamp',
    ask: { text: `${homeName} – ${awayName}, over and over: which mode?`, hl: `${homeName} – ${awayName}` },
    options: picks.map((m) => nameOn(root, m)),
    answer: picks.indexOf(mode),
    why: `${awayName} holds ${toneName(color)}, the ${COLOR_NOTES[mode].way} ${moved(mode)} of ${name}. Against ${homeName}, that color note makes the vamp sound ${MODE_NAMES[mode]}.`,
    sound: [...triadSound(home), ...triadSound(away)],
    facts: [`modev:${mode}`],
  }
}

// ---------------------------------------------------------------------------
// Modes on the neck
// ---------------------------------------------------------------------------

/** Parent keys for the neck tapes, all spelled on the Major scale tape, so every mode's name spells cleanly. */
const NECK_KEYS: KeyId[] = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb']

/** A parent major scale in one position, as on tape 24: its root on the 6th or 5th string, every note from a fret below the root to three above. */
function parentPattern(rootStrings: number[], rng: Rng) {
  const strings = rootStrings.filter((s) => s <= 1)
  for (let tries = 0; ; tries++) {
    const root = { string: pick(strings.length ? strings : [0, 1], rng), fret: between(2, 8, rng) }
    const key = KEY_ON_PC[pitchClass(midiAt(root))]
    if (!NECK_KEYS.includes(key) && tries < 50) continue
    const region: Region = { strings: ALL_STRINGS, minFret: root.fret - 1, maxFret: root.fret + 3 }
    const pcs = majorScale(key).map(tonePc)
    return { root, key, region, notes: allPositions(region).filter((p) => pcs.includes(pitchClass(midiAt(p)))) }
  }
}

/** "Tap a root of A Dorian in this G major pattern" */
export function makeModeNeckRoot(id: number, rootStrings: number[], rng: Rng, only?: ModeId): Question {
  const { root, key, region, notes } = parentPattern(rootStrings, rng)
  const mode = only && KEYED_MODES.includes(only) ? only : pick(KEYED_MODES, rng)
  const i = MODES.indexOf(mode)
  const home = modeScale(key, mode)[0]
  const name = modeName(key, mode)
  return {
    id,
    kind: 'modeNeckRoot',
    ask: { text: `Tap a root of ${name} in this ${keyLabel(key)} major pattern`, hl: name },
    region,
    markers: [...notes.filter((p) => !samePos(p, root)).map((p): Marker => ({ pos: p, tone: 'note' })), { pos: root, tone: 'root', label: keyLabel(key) }],
    from: root,
    targets: notes.filter((p) => pitchClass(midiAt(p)) === tonePc(home)),
    label: toneName(home),
    why: `${name} uses ${keyLabel(key)} major’s notes. ${MODE_NAMES[mode]} starts on the ${degreeName(i + 1)} note, ${toneName(home)}, so every ${toneName(home)} in the pattern is home.`,
    facts: [`modeneck:${mode}`],
  }
}

/** A pattern with one note lit as home, the parent's root labeled: which mode is it? */
export function makeModeNeckName(id: number, rootStrings: number[], rng: Rng, only?: ModeId): Question {
  const { root, key, region, notes } = parentPattern(rootStrings, rng)
  const mode = only && KEYED_MODES.includes(only) ? only : pick(KEYED_MODES, rng)
  const i = MODES.indexOf(mode)
  const scale = majorScale(key)
  const pcs = scale.map(tonePc)
  const isHome = (p: Position) => pitchClass(midiAt(p)) === pcs[i]
  const options = modeOptions(mode, rng)
  return {
    id,
    kind: 'modeNeckName',
    ask: { text: `In this ${keyLabel(key)} major pattern, the lit notes are home. Which mode is it?`, hl: 'home' },
    options,
    answer: options.indexOf(MODE_NAMES[mode]),
    why: `${toneName(scale[i])} is the ${degreeName(i + 1)} note of ${keyLabel(key)} major, so with it as home the pattern plays ${modeName(key, mode)}.`,
    board: {
      region,
      markers: notes.map((p): Marker => (isHome(p) ? { pos: p, tone: 'root' } : samePos(p, root) ? { pos: p, tone: 'note', label: keyLabel(key) } : { pos: p, tone: 'note' })),
      after: notes.map((p): Marker => ({ pos: p, tone: isHome(p) ? 'root' : 'note', label: toneName(scale[pcs.indexOf(pitchClass(midiAt(p)))]) })),
    },
    sound: scaleSound(modeScale(key, mode)),
    facts: [`modeneck:${mode}`],
  }
}

// ---------------------------------------------------------------------------
// Hearing modes
// ---------------------------------------------------------------------------

const plainName = (mode: ModeId) => (isMajorMode(mode) ? 'Major' : 'Natural minor')
/** What to listen for: when the mode plays, and when the plain scale does. */
const HEAR_WHY: Partial<Record<ModeId, { mode: string; plain: string }>> = {
  dorian: {
    mode: 'Dorian: from the 5th, it climbs a whole step to a bright, raised 6th.',
    plain: 'Natural minor: from the 5th, it climbs only a half step, to a darker 6th.',
  },
  mixolydian: {
    mode: 'Mixolydian: its 7th sits a whole step below the top note, easy to hear as the scale turns back down.',
    plain: 'Major: its 7th sits just a half step below the top note and leans into home.',
  },
  lydian: {
    mode: 'Lydian: the first four notes climb in whole steps, up to a bright, raised 4th.',
    plain: 'Major: from the 3rd up to the 4th is only a half step.',
  },
  phrygian: {
    mode: 'Phrygian: its 2nd is only a half step above home, so the scale starts and ends with that dark little step.',
    plain: 'Natural minor: its 2nd is a whole step above home.',
  },
}
/** A mode climbing from `low` to the octave. */
const climb = (mode: ModeId, low: number) => [...halfSteps(mode), 12].map((s) => low + s)
/**
 * A mode up to the octave and back down. Ending on the root makes home unmistakable, and each color
 * note goes by twice, once in each direction (Phrygian's lowered 2nd is clearest falling to the root).
 */
const upAndDown = (mode: ModeId, low: number) => {
  const up = climb(mode, low)
  return [...up, ...up.slice(0, -1).reverse()]
}

/** A root-position triad on `root`: major, or minor. */
const triadAt = (root: number, minor: boolean) => [root, root + (minor ? 3 : 4), root + 7]

/** Hear the home chord, then a scale up and back down: the mode, or the plain scale it changes? */
export function makeModeHear(id: number, modes: string[], rng: Rng, only?: ModeId): Question {
  const mode = only && ONE_NOTE_MODES.includes(only) ? only : pick(knownModes(modes, ONE_NOTE_MODES), rng)
  const playMode = rng() < 0.5
  const low = between(45, 55, rng)
  return {
    id,
    kind: 'modeHear',
    ask: { text: `${MODE_NAMES[mode]} or ${plainName(mode).toLowerCase()}?` },
    options: [MODE_NAMES[mode], plainName(mode)],
    answer: playMode ? 0 : 1,
    why: playMode ? HEAR_WHY[mode]!.mode : HEAR_WHY[mode]!.plain,
    listen: { home: triadAt(low, !isMajorMode(mode)), notes: upAndDown(playMode ? mode : isMajorMode(mode) ? 'ionian' : 'aeolian', low) },
    sound: [],
    facts: [`ear:${mode}`],
  }
}

const VAMP_WHY: Partial<Record<ModeId, string>> = {
  mixolydian: 'Mixolydian: a major home chord, then a major chord a whole step down, holding the lowered 7th.',
  lydian: 'Lydian: a major home chord, then a major chord a whole step up, holding the raised 4th.',
  dorian: 'Dorian: a minor home chord, then a major chord a 4th up, holding the raised 6th.',
  phrygian: 'Phrygian: a minor home chord, then a major chord just a half step up, holding the lowered 2nd.',
}

/** Hear a vamp, home chord and back, twice over: which mode does it sound like? */
export function makeVampHear(id: number, modes: string[], rng: Rng, only?: ModeId): Question {
  const mode = only && ONE_NOTE_MODES.includes(only) ? only : pick(knownModes(modes, ONE_NOTE_MODES), rng)
  const root = between(45, 52, rng)
  const home = triadAt(root, !isMajorMode(mode))
  // The second chord (always major) on its degree of the mode, the nearer way round: a whole step down for Mixolydian.
  const step = halfSteps(mode)[VAMP_DEGREE[mode]! - 1]
  const away = triadAt(root + (step > 6 ? step - 12 : step), false)
  // Always in the same order, major home chords first: decide major or minor, then where the second chord goes.
  const options = ONE_NOTE_MODES.map((m) => MODE_NAMES[m])
  return {
    id,
    kind: 'vampHear',
    ask: { text: 'Which mode does this vamp sound like?' },
    options,
    answer: options.indexOf(MODE_NAMES[mode]),
    why: VAMP_WHY[mode]!,
    listen: { notes: [...home, ...away, ...home, ...away], chord: 3 },
    sound: [],
    facts: [`ear:vamp-${mode}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const MODES_ORDER = [
  'modes:why',
  'modes:what',
  'modes:seven',
  'modes:order',
  'modes:parent',
  'modes:any-key',
  'modes:colors-why',
  'modes:lydian',
  'modes:mixolydian',
  'modes:dorian',
  'modes:phrygian',
  'modes:locrian',
  'modes:bright',
  'modes:spell',
  'modes:chords-why',
  'modes:chords',
  'modes:home-chord',
  'modes:vamps',
  'modes:neck-why',
  'modes:neck',
  'modes:neck-name',
  'modes:ear-why',
  'modes:ear-dorian',
  'modes:ear-mixolydian',
  'modes:ear-lydian',
  'modes:ear-phrygian',
  'modes:ear-vamps',
]
/** Explained on a card, not quizzed on their own. */
export const MODES_INTRO = ['modes:why', 'modes:what', 'modes:colors-why', 'modes:bright', 'modes:chords-why', 'modes:neck-why', 'modes:ear-why']

export const isModesItem = (item: string) => item.startsWith('modes:')
/**
 * Facts practiced on these tapes, each per mode: where it starts in the major scale ("mode:dorian")
 * and finding it in a key ("modek:dorian"), its color note ("modec:dorian") and spelling
 * ("modesp:dorian"), its chord in a key ("moden:dorian"), home chord ("modeh:dorian") and vamp
 * ("modev:dorian"), its home in a pattern on the neck ("modeneck:dorian"), and hearing it, as a
 * scale ("ear:dorian") and as a vamp ("ear:vamp-dorian").
 */
export const isModesFact = (fact: string) =>
  /^(mode|modek|modec|modesp|moden|modeh|modev|modeneck):/.test(fact) || /^ear:(vamp-)?(dorian|mixolydian|lydian|phrygian)$/.test(fact)
/** The mode a vamp listening fact is about ("ear:vamp-dorian"), or null. */
const vampEar = (fact: string) => {
  const mode = /^ear:vamp-(\w+)$/.exec(fact)?.[1] ?? ''
  return isOneOf(mode, ONE_NOTE_MODES) ? mode : null
}

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function modesItemFor(fact: string): string | null {
  if (vampEar(fact)) return 'modes:ear-vamps'
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'mode':
      return isOneOf(value, MODES) ? 'modes:seven' : null
    case 'modek':
      return isOneOf(value, KEYED_MODES) ? 'modes:parent' : null
    case 'modec':
      return isOneOf(value, COLOR_MODES) ? `modes:${value}` : null
    case 'modesp':
      return isOneOf(value, COLOR_MODES) ? 'modes:spell' : null
    case 'moden':
      return isOneOf(value, MODES) ? 'modes:chords' : null
    case 'modeh':
      return isOneOf(value, MODES) ? 'modes:home-chord' : null
    case 'modev':
      return isOneOf(value, ONE_NOTE_MODES) ? 'modes:vamps' : null
    case 'modeneck':
      return isOneOf(value, KEYED_MODES) ? 'modes:neck' : null
    case 'ear':
      return isOneOf(value, ONE_NOTE_MODES) ? `modes:ear-${value}` : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function modesCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const keys = l.keys ?? []
  const minorKeys = l.minorKeys ?? []
  const modes = l.modes ?? []
  const even = turn % 2 === 0
  switch (item) {
    case 'modes:seven':
      return makeModeOnDegree(id, keys, rng, l.showScale)
    case 'modes:order':
      return even ? makeModeDegree(id, rng) : makeModeOnDegree(id, keys, rng)
    case 'modes:parent':
      return makeModeParent(id, keys, rng)
    case 'modes:any-key':
      return makeModeRoot(id, keys, rng)
    case 'modes:lydian':
    case 'modes:mixolydian':
    case 'modes:dorian':
    case 'modes:phrygian': {
      const mode = item.slice('modes:'.length) as ModeId
      return even ? makeModeColor(id, keys, minorKeys, modes, rng, mode) : makeModeFormula(id, modes, rng, mode)
    }
    case 'modes:locrian':
      return makeModeFormula(id, modes, rng, 'locrian')
    case 'modes:spell':
      return makeModeSpell(id, keys, minorKeys, modes, rng)
    case 'modes:chords':
      return makeModeNumeral(id, rng)
    case 'modes:home-chord':
      return makeModeHomeChord(id, keys, rng)
    case 'modes:vamps':
      return makeModeVamp(id, keys, minorKeys, modes, rng)
    case 'modes:neck':
      return makeModeNeckRoot(id, l.rootStrings ?? [], rng)
    case 'modes:neck-name':
      return makeModeNeckName(id, l.rootStrings ?? [], rng)
    case 'modes:ear-dorian':
    case 'modes:ear-mixolydian':
    case 'modes:ear-lydian':
    case 'modes:ear-phrygian':
      return makeModeHear(id, modes, rng, item.slice('modes:ear-'.length) as ModeId)
    case 'modes:ear-vamps':
      return makeVampHear(id, modes, rng)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function modesReview(fact: string, id: number, rng: Rng): Question | null {
  const vamp = vampEar(fact)
  if (vamp) return makeVampHear(id, [], rng, vamp)
  const [kind, value] = fact.split(':')
  if (!isOneOf(value, MODES)) return null
  const coin = rng() < 0.5
  switch (kind) {
    case 'mode':
      return coin ? makeModeOnDegree(id, PARENT_KEYS, rng, false, value) : makeModeDegree(id, rng, value)
    case 'modek':
      if (!KEYED_MODES.includes(value)) return null
      return coin ? makeModeParent(id, PARENT_KEYS, rng, value) : makeModeRoot(id, PARENT_KEYS, rng, value)
    case 'modec':
      if (!COLOR_MODES.includes(value)) return null
      return coin && ONE_NOTE_MODES.includes(value) ? makeModeColor(id, MAJOR_ROOTS, MINOR_ROOTS, [], rng, value) : makeModeFormula(id, [], rng, value)
    case 'modesp':
      return COLOR_MODES.includes(value) ? makeModeSpell(id, MAJOR_ROOTS, MINOR_ROOTS, [], rng, value) : null
    case 'moden':
      return makeModeNumeral(id, rng, value)
    case 'modeh':
      return makeModeHomeChord(id, PARENT_KEYS, rng, value)
    case 'modev':
      return ONE_NOTE_MODES.includes(value) ? makeModeVamp(id, MAJOR_ROOTS, MINOR_ROOTS, [], rng, value) : null
    case 'modeneck':
      if (!KEYED_MODES.includes(value)) return null
      return coin ? makeModeNeckRoot(id, [0, 1], rng, value) : makeModeNeckName(id, [0, 1], rng, value)
    case 'ear':
      return ONE_NOTE_MODES.includes(value) ? makeModeHear(id, [], rng, value) : null
    default:
      return null
  }
}

/** "Dorian, the mode on the 2nd note", "Dorian’s color note"; null if it isn't one of these facts. */
export function describeModesFact(fact: string): string | null {
  const vamp = vampEar(fact)
  if (vamp) return `Hearing the ${MODE_NAMES[vamp]} vamp`
  const [kind, value] = fact.split(':')
  if (!isOneOf(value, MODES)) return null
  const name = MODE_NAMES[value]
  switch (kind) {
    case 'mode':
      return `${name}, the mode on the ${degreeName(MODES.indexOf(value) + 1)} note`
    case 'modek':
      return KEYED_MODES.includes(value) ? `${name} in any key` : null
    case 'modec':
      return COLOR_MODES.includes(value) ? (value === 'locrian' ? 'Locrian’s color notes' : `${name}’s color note`) : null
    case 'modesp':
      return COLOR_MODES.includes(value) ? `Spelling ${name}` : null
    case 'moden':
      return `${name} and the ${NUMERALS[MODES.indexOf(value)]} chord`
    case 'modeh':
      return `${name}’s home chord`
    case 'modev':
      return ONE_NOTE_MODES.includes(value) ? `The ${name} vamp` : null
    case 'modeneck':
      return KEYED_MODES.includes(value) ? `${name} on the neck` : null
    case 'ear':
      return ONE_NOTE_MODES.includes(value) ? `Hearing ${name}` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const C_MAJOR = majorScale('C')
const D_DORIAN = modeScale('C', 'dorian')
const G_MAJOR = majorScale('G')
const F_LYDIAN = modeScale('C', 'lydian')
const G_MIXOLYDIAN = modeScale('C', 'mixolydian')
const E_PHRYGIAN = modeScale('C', 'phrygian')
const B_LOCRIAN = modeScale('C', 'locrian')
const A_DORIAN = modeScale('G', 'dorian')
const A_MIXOLYDIAN = modeOn('A', 'mixolydian')!
const D_MINOR = plainScale('D', 'dorian')!

/** The G major pattern from tape 24 (root on the low E string, 3rd fret), its Gs labeled and every `home` lit. */
function gPattern(home: string): Card['board'] {
  const region: Region = { strings: ALL_STRINGS, minFret: 2, maxFret: 6 }
  const pcs = G_MAJOR.map(tonePc)
  const homePc = tonePc(parseTone(home))
  return {
    region,
    markers: allPositions(region)
      .filter((p) => pcs.includes(pitchClass(midiAt(p))))
      .map((p): Marker => {
        const pc = pitchClass(midiAt(p))
        const label = toneName(G_MAJOR[pcs.indexOf(pc)])
        return pc === homePc ? { pos: p, tone: 'root', label } : pc === pcs[0] ? { pos: p, tone: 'note', label } : { pos: p, tone: 'note' }
      }),
  }
}
/** Ear examples on D: the home chord, then the plain scale climbing, then the mode. */
const hearPair = (plain: ModeId, mode: ModeId) => ({ home: triadAt(50, !isMajorMode(mode)), notes: [...climb(plain, 50), ...climb(mode, 50)] })

const MODES_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'modes:why': () => ({
    title: 'Why modes',
    subtitle: 'New moods from notes you know',
    hook: 'Play C major’s notes but treat D as home instead of C, and the same seven notes take on a new mood: minor, but brighter than the minor scale you know. Each mood you get this way is a mode. Modes give songs like “Scarborough Fair” their sound, and guitarists use them to make a solo fit the chords underneath.',
    score: { measures: scaleScore(D_DORIAN), labels: scaleLabels(D_DORIAN) },
    sound: scaleSound(D_DORIAN),
  }),
  'modes:what': () => ({
    title: 'What a mode is',
    subtitle: 'A major scale from another note',
    hook: 'A mode is a major scale played from one of its other notes. C major is C D E F G A B. Start on D instead and climb to the next D: D E F G A B C D. The notes haven’t changed, only which one is home (in amber). Like relative keys (tape 27), it’s the same set of notes heard from a new home.',
    score: { measures: scaleScore(D_DORIAN), labels: scaleLabels(D_DORIAN), colors: marked(7, PAPER_HIGHLIGHT, 0, 7) },
    sound: scaleSound(D_DORIAN),
  }),
  'modes:seven': () => ({
    title: 'Seven modes',
    subtitle: 'One on every note of the scale',
    hook: 'A major scale has seven notes, so it has seven modes, one starting on each. In C major: C Ionian, D Dorian, E Phrygian, F Lydian, G Mixolydian, A Aeolian and B Locrian. You know two of them already, both in amber: Ionian is the major scale itself, and Aeolian, from the 6th note, is the natural minor scale (tape 27).',
    score: { measures: scaleScore(C_MAJOR), labels: scaleLabels(C_MAJOR), colors: marked(7, PAPER_HIGHLIGHT, 0, 5) },
    sound: scaleSound(C_MAJOR),
  }),
  'modes:order': () => ({
    title: 'Mode names in order',
    subtitle: 'From the 1st note to the 7th',
    hook: 'The modes always come in the same order, from the scale’s 1st note to its 7th: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian. A saying helps it stick: I Don’t Particularly Like Modes A Lot. Know the order and you know where each mode starts: Lydian is 4th in line, so it starts on the 4th note (in amber).',
    score: { measures: scaleScore(C_MAJOR), labels: ['1', '2', '3', '4', '5', '6', '7', '1'], colors: marked(7, PAPER_HIGHLIGHT, 3) },
    sound: scaleSound(modeScale('C', 'lydian')),
  }),
  'modes:parent': () => ({
    title: 'The parent scale',
    subtitle: 'Where a mode borrows its notes',
    hook: 'Every mode borrows its notes from a major scale, its parent scale. To find it, ask which major scale has the mode’s first note in the right place. Dorian starts on the 2nd note, so for A Dorian, ask which major scale has A as its 2nd note: G major, G A B C D E F♯ (A in amber). So A Dorian is A B C D E F♯ G.',
    onGuitar: 'Find the parent and you already know the frets: A Dorian uses G major’s notes, with A as home.',
    score: { measures: scaleScore(G_MAJOR), labels: scaleLabels(G_MAJOR), colors: marked(7, PAPER_HIGHLIGHT, 1) },
    sound: scaleSound(modeScale('G', 'dorian')),
  }),
  'modes:any-key': () => ({
    title: 'Modes in any key',
    subtitle: 'Count up to the mode’s note',
    hook: 'Every major key holds all seven modes. To find where one starts, count up the key’s scale to the mode’s number. In G major, G A B C D E F♯: Dorian starts on the 2nd note, A; Lydian on the 4th, C; Mixolydian on the 5th, D (in amber). So G major’s notes from D to D make D Mixolydian.',
    score: { measures: scaleScore(G_MAJOR), labels: scaleLabels(G_MAJOR), colors: marked(7, PAPER_HIGHLIGHT, 4) },
    sound: scaleSound(modeScale('G', 'mixolydian')),
  }),
  'modes:colors-why': () => ({
    title: 'Color notes',
    subtitle: 'What makes each mode sound different',
    hook: 'Tape 63 found each mode inside a major scale. Musicians also compare a mode with the plain major or minor scale on the same root: D Dorian with D minor. Then only one note is different (in amber), and that note gives the mode its color. It’s called the mode’s color note, and it’s the note to lean on when you play the mode. Press ▶\uFE0E Hear: D minor, then D Dorian.',
    score: { measures: scaleScore(D_DORIAN), labels: scaleLabels(D_DORIAN), colors: marked(7, PAPER_HIGHLIGHT, 5) },
    sound: [...scaleSound(D_MINOR), ...scaleSound(D_DORIAN)],
  }),
  'modes:lydian': () => ({
    title: 'Lydian',
    subtitle: 'Major with a raised 4th',
    hook: 'Put F Lydian next to F major. F major is F G A B♭ C D E; F Lydian is F G A B C D E. Only the 4th changed: B♭ became B, a half step higher (in amber). That raised 4th is Lydian’s color note. It makes the mode sound bright and dreamy, even brighter than major.',
    score: { measures: scaleScore(F_LYDIAN), labels: scaleLabels(F_LYDIAN), colors: marked(7, PAPER_HIGHLIGHT, 3) },
    sound: scaleSound(F_LYDIAN),
  }),
  'modes:mixolydian': () => ({
    title: 'Mixolydian',
    subtitle: 'Major with a lowered 7th',
    hook: 'G major is G A B C D E F♯; G Mixolydian is G A B C D E F. Only the 7th changed: F♯ dropped to F (in amber). That lowered 7th is Mixolydian’s color note. It takes the edge off major and gives it an easygoing, bluesy sound that’s all over rock and folk.',
    onGuitar: 'The lowered 7th is the note a dominant 7th chord adds (tape 46), so Mixolydian fits right over G7.',
    score: { measures: scaleScore(G_MIXOLYDIAN), labels: scaleLabels(G_MIXOLYDIAN), colors: marked(7, PAPER_HIGHLIGHT, 6) },
    sound: scaleSound(G_MIXOLYDIAN),
  }),
  'modes:dorian': () => ({
    title: 'Dorian',
    subtitle: 'Minor with a raised 6th',
    hook: 'D natural minor is D E F G A B♭ C; D Dorian is D E F G A B C. Only the 6th changed: B♭ rose to B (in amber). That raised 6th is Dorian’s color note. It brightens minor without losing its mood: the sound of “Scarborough Fair”, and of a lot of funk and jazz.',
    score: { measures: scaleScore(D_DORIAN), labels: scaleLabels(D_DORIAN), colors: marked(7, PAPER_HIGHLIGHT, 5) },
    sound: scaleSound(D_DORIAN),
  }),
  'modes:phrygian': () => ({
    title: 'Phrygian',
    subtitle: 'Minor with a lowered 2nd',
    hook: 'E natural minor is E F♯ G A B C D; E Phrygian is E F G A B C D. Only the 2nd changed: F♯ dropped to F (in amber), just a half step above home. That lowered 2nd is Phrygian’s color note. It sounds dark and tense, and you’ll hear it in flamenco and heavy metal.',
    score: { measures: scaleScore(E_PHRYGIAN), labels: scaleLabels(E_PHRYGIAN), colors: marked(7, PAPER_HIGHLIGHT, 1) },
    sound: scaleSound(E_PHRYGIAN),
  }),
  'modes:locrian': () => ({
    title: 'Locrian',
    subtitle: 'Minor with a lowered 2nd and 5th',
    hook: 'B natural minor is B C♯ D E F♯ G A; B Locrian is B C D E F G A. This time two notes changed: the 2nd and the 5th are both lowered (in amber). With no perfect 5th above home, Locrian never quite settles. It’s the darkest mode, and songs rarely stay in it for long.',
    score: { measures: scaleScore(B_LOCRIAN), labels: scaleLabels(B_LOCRIAN), colors: marked(7, PAPER_HIGHLIGHT, 1, 4) },
    sound: scaleSound(B_LOCRIAN),
  }),
  'modes:bright': () => ({
    title: 'Bright to dark',
    subtitle: 'One note lower at each step',
    hook: 'Line the modes up from brightest to darkest and each one lowers one more note: Lydian, then Ionian (the 4th comes down), Mixolydian (the 7th), Dorian (the 3rd), Aeolian (the 6th), Phrygian (the 2nd) and Locrian (the 5th). Press ▶\uFE0E Hear: C Lydian, then C Locrian.',
    sound: [...scaleSound(modeOn('C', 'lydian')!), ...scaleSound(modeOn('C', 'locrian')!)],
  }),
  'modes:spell': () => ({
    title: 'Spelling a mode',
    subtitle: 'Start from major or minor',
    hook: 'To spell a mode on any root, start from the major or minor scale on that root and move its color note. A Mixolydian: A major is A B C♯ D E F♯ G♯, so lower the 7th: A B C♯ D E F♯ G (in amber). C Dorian: C minor is C D E♭ F G A♭ B♭, so raise the 6th: C D E♭ F G A B♭.',
    score: { measures: scaleScore(A_MIXOLYDIAN), labels: scaleLabels(A_MIXOLYDIAN), colors: marked(7, PAPER_HIGHLIGHT, 6) },
    sound: scaleSound(A_MIXOLYDIAN),
  }),
  'modes:chords-why': () => ({
    title: 'Modes over chords',
    subtitle: 'Pick the scale that fits',
    hook: 'When a song sits on one chord for a while, players reach for the mode that fits it. Over Dm7 in C major, D Dorian fits: every note belongs to the key, and the chord’s root is home. Tape 40 built a chord on every note of a key; each of those chords has a mode too.',
    score: { measures: scaleScore(D_DORIAN), labels: scaleLabels(D_DORIAN) },
    sound: scaleSound(D_DORIAN),
  }),
  'modes:chords': () => ({
    title: 'Chords and their modes',
    subtitle: 'Same note, same number',
    hook: 'Each chord in a major key sits on one of the scale’s notes, and so does each mode, so every chord gets a mode: I Ionian, ii Dorian, iii Phrygian, IV Lydian, V Mixolydian, vi Aeolian, vii° Locrian. In C major, the ii chord is Dm, and D Dorian is C major’s notes from D.',
    score: { measures: scaleScore(C_MAJOR), labels: [...NUMERALS, 'I'] },
    sound: scaleSound(C_MAJOR),
  }),
  'modes:home-chord': () => ({
    title: 'Home chords',
    subtitle: 'The 7th chord on a mode’s root',
    hook: 'Stack 3rds from a mode’s first note, using only its notes, and you get its home chord (in amber). Ionian and Lydian give a major 7th, Mixolydian a dominant 7th, Dorian, Phrygian and Aeolian a minor 7th, and Locrian a half-diminished chord (tape 47). D Dorian stacks to D F A C: Dm7.',
    score: { measures: scaleScore(D_DORIAN), labels: scaleLabels(D_DORIAN), colors: marked(7, PAPER_HIGHLIGHT, 0, 2, 4, 6) },
    sound: triadSound([D_DORIAN[0], D_DORIAN[2], D_DORIAN[4], D_DORIAN[6]]),
  }),
  'modes:vamps': () => {
    const [home, away] = vampOf(modeOn('A', 'dorian')!, 'dorian').map((t) => triadSound(t))
    return {
      title: 'Modal vamps',
      subtitle: 'Two chords that point to a mode',
      hook: 'A vamp rocks between two chords, over and over. When the second chord holds a mode’s color note, the vamp sounds like that mode. Am to D has F♯, A Dorian’s raised 6th. G to F has F, G Mixolydian’s lowered 7th. C to D has F♯, C Lydian’s raised 4th. Em to F has F, E Phrygian’s lowered 2nd. Press ▶\uFE0E Hear: Am to D.',
      listen: { notes: [...home, ...away, ...home, ...away], chord: 3 },
      sound: [],
    }
  },
  'modes:neck-why': () => ({
    title: 'Modes on the neck',
    subtitle: 'No new shapes to learn',
    hook: 'A mode uses its parent scale’s notes, so it uses the parent’s pattern too. To play A Dorian, play the G major pattern from tape 24 and treat A as home: start and end your lines on the As (lit), and lean on them.',
    board: gPattern('A'),
    sound: scaleSound(A_DORIAN),
  }),
  'modes:neck': () => ({
    title: 'Finding home',
    subtitle: 'Count up from the parent’s root',
    hook: 'The pattern’s roots are labeled G. To find a mode’s home, count up G major from G. Dorian starts on the 2nd note, so A Dorian’s home is every A; Mixolydian starts on the 5th, so D Mixolydian’s home is every D (lit). The frets stay the same; only home moves.',
    board: gPattern('D'),
    sound: scaleSound(modeScale('G', 'mixolydian')),
  }),
  'modes:neck-name': () => ({
    title: 'Which mode is lit?',
    subtitle: 'Name it from its home',
    hook: 'Turn it around: with a note lit as home, which mode is the pattern playing? Count up from the parent’s root to the lit note. In the G major pattern, B is the 3rd note, so with every B as home (lit), it’s B Phrygian.',
    board: gPattern('B'),
    sound: scaleSound(modeScale('G', 'phrygian')),
  }),
  'modes:ear-why': () => ({
    title: 'Hearing modes',
    subtitle: 'Listen for one note',
    hook: 'Each mode on this tape is a plain major or minor scale with one note moved, so hearing a mode means listening for that note. Each question plays the home chord first, so your ear knows where home is, then a scale up from its root and back down: the mode, or the plain scale it changes. Press ▶\uFE0E Hear: the home chord, D minor, then D Dorian.',
    listen: hearPair('aeolian', 'dorian'),
    sound: [],
  }),
  'modes:ear-dorian': () => ({
    title: 'Dorian or minor',
    subtitle: 'Listen to the 6th',
    hook: 'Dorian and natural minor share every note but the 6th. In Dorian it’s a whole step above the 5th and sounds brighter, almost hopeful; in minor it’s only a half step up and sounds sadder. “Scarborough Fair” and Santana’s “Oye Como Va” are both Dorian. Press ▶\uFE0E Hear: the home chord, then minor, then Dorian.',
    listen: hearPair('aeolian', 'dorian'),
    sound: [],
  }),
  'modes:ear-mixolydian': () => ({
    title: 'Mixolydian or major',
    subtitle: 'Listen to the 7th',
    hook: 'Mixolydian and major differ only near the top. Major’s 7th sits a half step below the octave and leans hard into home; Mixolydian’s sits a whole step below and sounds relaxed and bluesy, like “Norwegian Wood” or “Sweet Home Alabama”. Press ▶\uFE0E Hear: the home chord, then major, then Mixolydian.',
    listen: hearPair('ionian', 'mixolydian'),
    sound: [],
  }),
  'modes:ear-lydian': () => ({
    title: 'Lydian or major',
    subtitle: 'Listen to the 4th',
    hook: 'Lydian raises major’s 4th, so the scale climbs three whole steps in a row from home before its first half step. It sounds bright and floating, like the theme from The Simpsons. Press ▶\uFE0E Hear: the home chord, then major, then Lydian.',
    listen: hearPair('ionian', 'lydian'),
    sound: [],
  }),
  'modes:ear-phrygian': () => ({
    title: 'Phrygian or minor',
    subtitle: 'Listen to the 2nd',
    hook: 'Phrygian lowers minor’s 2nd, so its very first step up from home is only a half step. That squeeze right next to home gives Phrygian its dark, Spanish sound. Press ▶\uFE0E Hear: the home chord, then minor, then Phrygian.',
    listen: hearPair('aeolian', 'phrygian'),
    sound: [],
  }),
  'modes:ear-vamps': () => ({
    title: 'Hearing vamps',
    subtitle: 'Home first, then where it goes',
    hook: 'You can hear a vamp’s mode too (tape 65). First listen to home: a major chord means Mixolydian or Lydian, a minor one Dorian or Phrygian. Then listen to where the second chord goes: a whole step down is Mixolydian, a whole step up is Lydian, a 4th up is Dorian, and just a half step up is Phrygian. Press ▶\uFE0E Hear: Am to D, then Em to F.',
    listen: {
      notes: [...triadAt(45, true), ...triadAt(50, false), ...triadAt(45, true), ...triadAt(50, false), ...triadAt(52, true), ...triadAt(53, false), ...triadAt(52, true), ...triadAt(53, false)],
      chord: 3,
    },
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function modesCard(item: string, counter: string): Card {
  return { ...MODES_CARDS[item](), counter }
}
