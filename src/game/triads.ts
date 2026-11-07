import type { Card } from './rehearsal'
import type { Marker } from '../components/Fretboard'
import type { LessonSpec } from '../music/curriculum'
import {
  ALL_STRINGS,
  allPositions,
  describePosition,
  LETTERS,
  MAX_FRET,
  midiAt,
  pitchClass,
  positionsForPc,
  spelledMidi,
  stringName,
  WRITTEN_OCTAVE_SHIFT,
  type Letter,
  type Position,
  type Region,
} from '../music/notes'
import { KEY_ORDER, KEYS, keyLabel, type KeyId, type ScoreMeasure, type ScoreNote } from '../music/score'
import {
  intervalAbove,
  intervalName,
  intervalSize,
  KEY_ON_PC,
  keyTriads,
  majorName,
  majorScale,
  naturalMinorScale,
  parseInterval,
  parseTone,
  RARE_SPELLINGS,
  scaleScore,
  spelled,
  spellOn,
  toneId,
  toneName,
  tonePc,
  TRIAD_NAMES,
  triadGap,
  triadTones,
  type Tone,
  type TriadQuality,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { PAPER_HIGHLIGHT } from '../lib/color'
import { aOrAn, capitalize } from '../lib/text'
import type { PickQuestion, Question } from './questions'
import { intervalLabel, on } from './intervals'

/**
 * Triads: three notes stacked in 3rds. Spelling the four kinds, telling them apart, reading them
 * on the staff and inverted, finding their shapes on the neck, and hearing them.
 */

const QUALITIES: TriadQuality[] = ['maj', 'min', 'dim', 'aug']
/** How each kind is spelled in fact names: "D", "Dm", "Bdim", "Caug". */
const SUFFIX: Record<TriadQuality, string> = { maj: '', min: 'm', dim: 'dim', aug: 'aug' }
/** How each kind is stacked, for the feedback. */
const STACKED: Record<TriadQuality, string> = {
  maj: 'a major 3rd with a minor 3rd on top',
  min: 'a minor 3rd with a major 3rd on top',
  dim: 'two minor 3rds',
  aug: 'two major 3rds',
}
/** "Two minor 3rds make…", "a major 3rd with a minor 3rd on top makes…" */
const makes = (quality: TriadQuality) => `${STACKED[quality]} ${quality === 'dim' || quality === 'aug' ? 'make' : 'makes'}`
/** The triad each kind is taught from, and what changes: a minor triad is a major one with its 3rd lowered. */
const FROM: Partial<Record<TriadQuality, { kind: TriadQuality; change: string }>> = {
  min: { kind: 'maj', change: 'lower its 3rd a half step' },
  dim: { kind: 'min', change: 'lower its 5th a half step' },
  aug: { kind: 'maj', change: 'raise its 5th a half step' },
}
/** The kinds a triad is most often mistaken for: one note a half step off. */
const NEAR: Record<TriadQuality, [TriadQuality, TriadQuality]> = { maj: ['min', 'aug'], min: ['maj', 'dim'], dim: ['min', 'maj'], aug: ['maj', 'min'] }
/** Roots that make each kind with everyday spellings, for tracks and reviews that don't list their own. */
const USUAL_ROOTS: Record<TriadQuality, string[]> = {
  maj: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'],
  min: ['A', 'E', 'D', 'B', 'G', 'C', 'F', 'F#'],
  dim: ['B', 'E', 'A', 'D', 'F#', 'C#', 'G', 'C'],
  aug: ['C', 'F', 'G', 'D', 'Bb', 'Eb', 'Ab'],
}
const M2 = parseInterval('M2')
const P4 = parseInterval('P4')

/** "D F♯ A" */
const triadName = (root: Tone, quality: TriadQuality) => `${toneName(root)} ${TRIAD_NAMES[quality]}`
/** "an E", "a D": letter names that start with a vowel sound take "an". */
const article = (root: Tone) => (['A', 'E', 'F'].includes(root.letter) ? 'an' : 'a')
const rotate = <T,>(items: T[], n: number) => [...items.slice(n), ...items.slice(0, n)]

/** A triad's name in practice stats: "D", "Dm", "Bdim". */
const triadId = (root: Tone, quality: TriadQuality) => `${toneId(root)}${SUFFIX[quality]}`

function parseTriadId(id: string): { root: string; quality: TriadQuality } | null {
  const m = /^([A-G][#b]?)(m|dim|aug)?$/.exec(id)
  if (!m) return null
  return { root: m[1], quality: QUALITIES.find((q) => SUFFIX[q] === (m[2] ?? ''))! }
}

const everyday = (tones: (Tone | null)[] | null): tones is Tone[] => !!tones && tones.every((t) => !!t && !RARE_SPELLINGS.has(toneName(t)))

/** Whether a kind of triad on this root, and the triad it's taught from, both have everyday spellings. */
function usable(root: string, quality: TriadQuality): boolean {
  const r = parseTone(root)
  const from = FROM[quality]
  return everyday(triadTones(r, quality)) && (!from || everyday(triadTones(r, from.kind)))
}

/** The track's roots that work for this kind of triad, or the usual ones. */
function rootsFor(quality: TriadQuality, roots: string[]): string[] {
  const own = roots.filter((r) => usable(r, quality))
  return own.length ? own : USUAL_ROOTS[quality]
}

/** The triad on one note of a major key (counting from 0, wrapping past the 7th). */
const keyTriad = (key: KeyId, degree: number) => keyTriads(key)[degree % 7]

/** Written octaves for notes stacked up from `octave`: each letter above the one before. */
function stackedOctaves(tones: { letter: Letter }[], from = 4): number[] {
  let octave = from
  return tones.map((t, i) => {
    if (i > 0 && LETTERS.indexOf(t.letter) <= LETTERS.indexOf(tones[i - 1].letter)) octave++
    return octave
  })
}

/**
 * The notes on the staff, bottom up from `octave`: one after another, or `together` on one stem.
 * Signs are printed where the key signature doesn't supply them.
 */
export function triadScore(tones: Tone[], together: boolean, key: KeyId = 'C', octave = 4): ScoreMeasure {
  const octaves = stackedOctaves(tones, octave)
  const notes = tones.map((t, i): ScoreNote => {
    const fromKey = KEYS[key].altered[t.letter] ?? 0
    return { letter: t.letter, octave: octaves[i], dur: together ? 'w' : 'q', ...(t.acc !== fromKey ? { sign: t.acc } : {}) }
  })
  return together ? [{ ...notes[0], with: notes.slice(1).map(({ letter, octave, sign }) => ({ letter, octave, sign })) }] : notes
}

/** Chords written one to a measure, so their names have room underneath. */
export const chordMeasures = (...chords: Tone[][]): ScoreMeasure[] => chords.map((c) => triadScore(c, true))

/** Sounding pitches, low to high, for the notes as `triadScore` writes them. */
export function triadSound(tones: Tone[], octave = 4): number[] {
  const octaves = stackedOctaves(tones, octave)
  return tones.map((t, i) => spelledMidi({ ...t, octave: octaves[i] }) - WRITTEN_OCTAVE_SHIFT)
}

/**
 * The root on the neck, in the major scale shape from tape 24 (root on the 6th or 5th string),
 * and every note of the triad in that shape, spelled. `others` is how the 3rds and 5ths look.
 */
function triadNeck(tones: Tone[], others: Marker['tone'] = 'correct'): { root: Marker; region: Region; notes: Marker[] } {
  const pc = tonePc(tones[0])
  const low = pitchClass(pc - 4)
  const pos = low >= 2 && low <= 8 ? { string: 0, fret: low } : { string: 1, fret: pitchClass(pc - 9) }
  const region: Region = { strings: ALL_STRINGS, minFret: pos.fret - 1, maxFret: pos.fret + 3 }
  const pcs = tones.map(tonePc)
  const notes = allPositions(region)
    .filter((p) => pcs.includes(pitchClass(midiAt(p))))
    .map((p): Marker => {
      const i = pcs.indexOf(pitchClass(midiAt(p)))
      return { pos: p, tone: i === 0 ? 'root' : others, label: toneName(tones[i]) }
    })
  return { root: { pos, tone: 'root', label: toneName(tones[0]) }, region, notes }
}

/** For questions: the root on the neck, and once answered, the whole triad around it. */
export function triadBoard(tones: Tone[]): NonNullable<PickQuestion['board']> {
  const { root, region, notes } = triadNeck(tones)
  return { region, markers: [root], after: notes }
}

/** For cards: the triad in the scale shape, the root glowing and the rest labeled. */
function cardNeck(tones: Tone[]): Card['board'] {
  const { region, notes } = triadNeck(tones, 'note')
  return { region, markers: notes }
}

// ---------------------------------------------------------------------------
// Spelling triads
// ---------------------------------------------------------------------------

/** "Which letters make a triad on D?": skip a letter, then another. */
export function makeTriadLetters(id: number, rng: Rng, only?: Letter): Question {
  const root = only ?? pick(LETTERS, rng)
  const at = (steps: number[]) => steps.map((s) => LETTERS[(LETTERS.indexOf(root) + s) % 7])
  const right = at([0, 2, 4])
  // The usual slips: the next letters instead of every other one, or a skip and a step.
  const options = shuffle([right, at([0, 1, 2]), at([0, 2, 3]), at([0, 1, 3])].map((letters) => letters.join(' ')), rng)
  const tones = right.map((letter): Tone => ({ letter, acc: 0 }))
  return {
    id,
    kind: 'triadLetters',
    ask: { text: `Which letters make a triad on ${root}?`, hl: `triad on ${root}` },
    options,
    answer: options.indexOf(right.join(' ')),
    why: `Skip a letter each time: ${root} (skip ${at([1])}) ${right[1]} (skip ${at([3])}) ${right[2]}.`,
    score: { measures: [triadScore(tones.slice(0, 1), true)], labels: [root], afterMeasures: [triadScore(tones, true)], after: [right.join(' ')] },
    sound: triadSound(tones),
    facts: ['triad:letters'],
  }
}

/** The same note under the neighboring letter's name (G♭ for F♯), or null for a natural note. */
const respell = (t: Tone): Tone | null => (t.acc === 0 ? null : spellOn(LETTERS[(LETTERS.indexOf(t.letter) + (t.acc === 1 ? 1 : 6)) % 7], tonePc(t)))

/**
 * "What notes make a D minor triad?" With `help`, the staff starts you off: the major scale on the
 * root for a major triad, or the triad it's made from for the others (D major for D minor). Without
 * it, just the root, and the finished triad once it's answered.
 */
export function makeTriadSpell(id: number, roots: string[], quality: TriadQuality, rng: Rng, help = false, only?: string): Question | null {
  const rootId = only ?? pick(rootsFor(quality, roots), rng)
  const root = parseTone(rootId)
  const tones = triadTones(root, quality)
  if (!tones) return null
  const [, third, fifth] = tones
  const third2 = respell(third)
  const fifth2 = respell(fifth)
  // In order: the near-miss kinds, the next letters instead of every other one, a note under the
  // neighboring letter's name (which breaks the one-letter-each rule), and a skip then a step.
  const candidates: (Tone | null)[][] = [
    triadTones(root, NEAR[quality][0]) ?? [null],
    [root, intervalAbove(root, M2), third],
    third2 ? [root, third2, fifth] : [null],
    triadTones(root, NEAR[quality][1]) ?? [null],
    fifth2 ? [root, third, fifth2] : [null],
    [root, third, intervalAbove(root, P4)],
  ]
  const right = spelled(tones)
  const wrong = [...new Set(candidates.filter(everyday).map(spelled))].filter((s) => s !== right)
  const options = shuffle([right, ...wrong.slice(0, 3)], rng)
  const name = triadName(root, quality)
  const lower = intervalName(triadGap(quality, 0, 1))
  const upper = intervalName(triadGap(quality, 1, 2))
  const stack = `${toneName(root)} up ${aOrAn(lower)} ${lower} is ${toneName(third)}, then up ${aOrAn(upper)} ${upper} is ${toneName(fifth)}.`
  const scale = quality === 'maj' && isOneOf(rootId, KEY_ORDER) ? majorScale(rootId) : null
  const from = FROM[quality]
  const fromTones = from ? triadTones(root, from.kind)! : null
  const changed = fromTones && tones.findIndex((t, i) => toneName(t) !== toneName(fromTones[i]))
  const change =
    from && fromTones && changed
      ? `${triadName(root, from.kind)} is ${spelled(fromTones)}; ${from.change}, ${toneName(fromTones[changed])} to ${toneName(tones[changed])}, and it’s ${right}.`
      : ''
  const count = scale ? `Count up the ${majorName(rootId as KeyId)} scale: ${scale.slice(0, 5).map(toneName).join(' ')}. The 1st, 3rd and 5th are ${right}.` : ''
  const also = scale ? ` The same notes as the 1st, 3rd and 5th of the ${majorName(rootId as KeyId)} scale.` : change ? ` Or: ${change}` : ''
  const why = help ? count || change : `${stack}${also}`
  const names = scale ? [...scale, scale[0]].map(toneName) : []
  return {
    id,
    kind: 'triadSpell',
    ask: { text: `What notes make ${article(root)} ${name} triad?`, hl: `${name} triad` },
    options,
    answer: options.indexOf(right),
    why,
    score:
      help && scale
        ? { measures: scaleScore(scale), labels: names, after: names.map((_, i) => ([0, 2, 4].includes(i) ? `${i + 1}` : '')) }
        : help && fromTones
          ? { measures: [triadScore(fromTones, true)], labels: [triadName(root, from!.kind)], afterMeasures: [triadScore(tones, true)], after: [right] }
          : { measures: [triadScore([root], true)], labels: [toneName(root)], afterMeasures: [triadScore(tones, true)], after: [right] },
    board: triadBoard(tones),
    sound: triadSound(tones),
    facts: [`tri:${triadId(root, quality)}`],
  }
}

/** The intervals that can sit between two notes of a triad, smallest first. */
const GAP_OPTIONS = ['m3', 'M3', 'P4', 'd5', 'P5', 'A5']

/** "In the D major triad (D F♯ A), what's the interval from F♯ up to A?" `kinds` decides which 5ths are offered. */
export function makeTriadThird(id: number, roots: string[], quality: TriadQuality, rng: Rng, kinds: TriadQuality[] = [quality]): Question | null {
  const root = parseTone(pick(rootsFor(quality, roots), rng))
  const tones = triadTones(root, quality)
  if (!tones) return null
  const [from, to] = pick<[0 | 1, 1 | 2]>(
    [
      [0, 1],
      [1, 2],
      [0, 2],
    ],
    rng,
  )
  const iv = triadGap(quality, from, to)
  const a = toneName(tones[from])
  const b = toneName(tones[to])
  // The two 3rds, the perfect 4th as a near miss, and the 5ths these kinds of triad span.
  const fifths = new Set([...kinds, quality].map((k) => `${triadGap(k, 0, 2).quality}${triadGap(k, 0, 2).number}`))
  const options = GAP_OPTIONS.filter((s) => ['m3', 'M3', 'P4', 'P5'].includes(s) || fifths.has(s)).map((s) => intervalLabel(parseInterval(s)))
  const what = `${a} up to ${b}`
  const name = intervalName(iv)
  const fifth = intervalName(triadGap(quality, 0, 2))
  const sound = triadSound(tones)
  const { region, notes } = triadNeck(tones)
  return {
    id,
    kind: 'triadThird',
    ask: { text: `In the ${triadName(root, quality)} triad (${spelled(tones)}), what’s the interval from ${what}?`, hl: what },
    options,
    answer: options.indexOf(intervalLabel(iv)),
    why: `${capitalize(what)} is ${intervalSize(iv)} half steps: ${aOrAn(name)} ${name}. Every ${TRIAD_NAMES[quality]} triad is ${STACKED[quality]}, spanning ${aOrAn(fifth)} ${fifth} from the root to the top.`,
    score: { measures: [[...triadScore(tones, true), ...triadScore([tones[from], tones[to]], true)]], labels: [spelled(tones), `${a}–${b}`] },
    board: {
      region,
      // The two notes asked about stand out; the third note of the triad stays in the background.
      markers: notes.map((m): Marker => {
        const i = tones.findIndex((t) => toneName(t) === m.label)
        return { ...m, tone: i === from || i === to ? (i === 0 ? 'root' : 'target') : 'note' }
      }),
    },
    sound: [sound[from], sound[to]],
    facts: [`tq:${quality}`],
  }
}

/** "C E♭ G: which kind of triad?" Offers `kinds` (and the right one), in the order they're taught. */
export function makeTriadQuality(id: number, roots: string[], kinds: TriadQuality[], rng: Rng, only?: TriadQuality): Question | null {
  const quality = only ?? pick(kinds, rng)
  const root = parseTone(pick(rootsFor(quality, roots), rng))
  const tones = triadTones(root, quality)
  if (!tones) return null
  const options = QUALITIES.filter((q) => kinds.includes(q) || q === quality).map((q) => capitalize(TRIAD_NAMES[q]))
  const lower = intervalName(triadGap(quality, 0, 1))
  const upper = intervalName(triadGap(quality, 1, 2))
  const [r, t, f] = tones.map(toneName)
  const { region, notes } = triadNeck(tones, 'note')
  return {
    id,
    kind: 'triadQuality',
    ask: { text: `${spelled(tones)}: which kind of triad?`, hl: spelled(tones) },
    options,
    answer: options.indexOf(capitalize(TRIAD_NAMES[quality])),
    why: `${r} up to ${t} is ${aOrAn(lower)} ${lower}, and ${t} up to ${f} is ${aOrAn(upper)} ${upper}. ${capitalize(makes(quality))} ${aOrAn(TRIAD_NAMES[quality])} ${TRIAD_NAMES[quality]} triad.`,
    score: { measures: [triadScore(tones, true)], after: [spelled(tones)] },
    board: { region, markers: notes },
    sound: triadSound(tones),
    facts: [`tq:${quality}`],
  }
}

// ---------------------------------------------------------------------------
// Triads on the staff, and inversions
// ---------------------------------------------------------------------------

const ROLES = ['root', '3rd', '5th']
const INVERSIONS = ['Root position', '1st inversion', '2nd inversion']
/** The other kind most like this one, for near-miss names. */
const FLIP: Record<TriadQuality, TriadQuality> = { maj: 'min', min: 'maj', dim: 'min', aug: 'maj' }

/**
 * A triad from a major key, stacked on the staff with the key signature: name it. `inverted`
 * puts its 3rd or 5th on the bottom some of the time.
 */
export function makeTriadRead(id: number, keys: KeyId[], inverted: boolean, rng: Rng): Question {
  const key = pick(keys, rng)
  const degree = between(0, 6, rng)
  const { tones, quality } = keyTriad(key, degree)
  const inversion = inverted ? between(0, 2, rng) : 0
  const order = rotate(tones, inversion)
  const right = triadName(tones[0], quality)
  // Near misses: the other kind on the same root, the bottom note taken for the root, and the
  // neighboring triads in the key (they share two notes).
  const candidates = [
    triadName(tones[0], FLIP[quality]),
    inversion ? triadName(order[0], quality) : null,
    triadName(keyTriad(key, degree + 2).tones[0], keyTriad(key, degree + 2).quality),
    triadName(keyTriad(key, degree + 5).tones[0], keyTriad(key, degree + 5).quality),
  ]
  const wrong = [...new Set(candidates.filter((c): c is string => !!c && c !== right))]
  const options = shuffle([right, ...wrong.slice(0, 3)], rng)
  const notes = key === 'C' ? `The notes are ${spelled(order)}.` : `In ${majorName(key)} (${KEYS[key].signature}), the notes are ${spelled(order)}.`
  const root = inversion ? `Restacked in 3rds they’re ${spelled(tones)}, so the root is ${toneName(tones[0])}.` : `The bottom one, ${toneName(tones[0])}, is the root.`
  return {
    id,
    kind: 'triadRead',
    ask: { text: 'Name this triad' },
    options,
    answer: options.indexOf(right),
    why: `${notes} ${root} ${capitalize(makes(quality))} it ${right}.`,
    score: { measures: [triadScore(order, true, key)], keySig: key, after: [spelled(order)] },
    sound: triadSound(order),
    facts: [`tri:${triadId(tones[0], quality)}`, ...(inverted ? [`tinv:${inversion}`] : [])],
  }
}

/** "This C major triad: root position, 1st or 2nd inversion?" */
export function makeTriadInversion(id: number, keys: KeyId[], rng: Rng, only?: 0 | 1 | 2): Question {
  const key = pick(keys, rng)
  const { tones, quality } = keyTriad(key, between(0, 6, rng))
  const inversion = only ?? (between(0, 2, rng) as 0 | 1 | 2)
  const order = rotate(tones, inversion)
  const name = triadName(tones[0], quality)
  return {
    id,
    kind: 'triadInversion',
    ask: { text: `This ${name} triad: root position, 1st or 2nd inversion?`, hl: `${name} triad` },
    options: INVERSIONS,
    answer: inversion,
    why: `${name} is ${spelled(tones)}. The bottom note here is ${toneName(order[0])}, its ${ROLES[inversion]}, so it’s in ${INVERSIONS[inversion].toLowerCase()}.`,
    score: { measures: [triadScore(order, true, key)], keySig: key, after: [spelled(order)] },
    sound: triadSound(order),
    facts: [`tinv:${inversion}`],
  }
}

// ---------------------------------------------------------------------------
// Triads on the neck
// ---------------------------------------------------------------------------

/** String sets the neck tape uses, by their lowest string: D G B (the middle) and G B E (the top). */
const SET_NAMES: Record<number, 'middle' | 'top'> = { 2: 'middle', 3: 'top' }

/** The three-string sets within `strings`. */
function stringSets(strings: number[]): number[][] {
  const sets = strings.filter((s) => SET_NAMES[s] && strings.includes(s + 1) && strings.includes(s + 2)).map((s) => [s, s + 1, s + 2])
  return sets.length ? sets : [[3, 4, 5]]
}

/** Every way to play a triad on three neighboring strings, one note each, within four frets. */
function shapesOn(tones: Tone[], set: number[]): Position[][] {
  const pcs = tones.map(tonePc)
  const spots = set.map((string) => Array.from({ length: MAX_FRET + 1 }, (_, fret) => ({ string, fret })).filter((p) => pcs.includes(pitchClass(midiAt(p)))))
  const out: Position[][] = []
  for (const a of spots[0])
    for (const b of spots[1])
      for (const c of spots[2]) {
        const frets = [a.fret, b.fret, c.fret]
        if (new Set([a, b, c].map((p) => pitchClass(midiAt(p)))).size === 3 && Math.max(...frets) - Math.min(...frets) <= 3) out.push([a, b, c])
      }
  return out
}

/** A few frets around a shape, so the board stays readable. */
function shapeRegion(shape: Position[], strings: number[]): Region {
  const frets = shape.map((p) => p.fret)
  const hi = Math.min(MAX_FRET, Math.max(Math.min(...frets) + 3, Math.max(...frets) + 1))
  return { strings, minFret: Math.max(0, Math.min(hi - 4, Math.min(...frets) - 1)), maxFret: hi }
}

function pickShape(roots: string[], kinds: TriadQuality[], strings: number[], rng: Rng) {
  const set = pick(stringSets(strings), rng)
  const quality = pick(kinds, rng)
  const tones = triadTones(parseTone(pick(rootsFor(quality, roots), rng)), quality)!
  const shapes = shapesOn(tones, set)
  if (!shapes.length) return null
  const shape = pick(shapes, rng)
  const role = (p: Position) => tones.findIndex((t) => tonePc(t) === pitchClass(midiAt(p)))
  return { set, quality, tones, shape, role, facts: [`tri:${triadId(tones[0], quality)}`, `tneck:${SET_NAMES[set[0]]}-${quality}`] }
}

const BOTTOM_NOTE = ['', ', with its 3rd on the bottom', ', with its 5th on the bottom']

/** A three-note shape on the neck, every note labeled: which triad is it? */
export function makeTriadShapeName(id: number, roots: string[], kinds: TriadQuality[], strings: number[], rng: Rng): Question | null {
  const s = pickShape(roots, kinds, strings, rng)
  if (!s) return null
  const { set, quality, tones, shape, role, facts } = s
  const right = triadName(tones[0], quality)
  const bottom = role(shape[0])
  const candidates = [
    triadName(tones[0], FLIP[quality]),
    bottom ? triadName(tones[bottom], quality) : null,
    triadName(tones[1], FLIP[quality]),
    triadName(tones[2], quality),
  ]
  const wrong = [...new Set(candidates.filter((c): c is string => !!c && c !== right))]
  const options = shuffle([right, ...wrong.slice(0, 3)], rng)
  const label = (p: Position) => toneName(tones[role(p)])
  return {
    id,
    kind: 'triadShapeName',
    ask: { text: 'Which triad is this?' },
    options,
    answer: options.indexOf(right),
    why: `Low to high, the notes are ${shape.map(label).join(' ')}. Restacked in 3rds: ${spelled(tones)}, so the root is ${toneName(tones[0])}, and ${makes(quality)} it ${right}${BOTTOM_NOTE[bottom]}.`,
    board: {
      region: shapeRegion(shape, set),
      markers: shape.map((p): Marker => ({ pos: p, tone: 'note', label: label(p) })),
      after: shape.map((p): Marker => ({ pos: p, tone: role(p) === 0 ? 'root' : 'correct', label: label(p) })),
    },
    sound: shape.map(midiAt),
    facts,
  }
}

/** Two notes of a triad shape on the neck: tap the third one, on the string that's missing it. */
export function makeTriadShapeFind(id: number, roots: string[], kinds: TriadQuality[], strings: number[], rng: Rng): Question | null {
  const s = pickShape(roots, kinds, strings, rng)
  if (!s) return null
  const { set, quality, tones, shape, role, facts } = s
  const hidden = shape[between(0, 2, rng)]
  const shown = shape.filter((p) => p !== hidden)
  const region = shapeRegion(shape, set)
  const name = triadName(tones[0], quality)
  const missing = tones[role(hidden)]
  return {
    id,
    kind: 'triadShapeFind',
    ask: { text: `Tap the missing note of this ${name} triad, on the ${stringName(hidden.string)} string`, hl: `${name} triad` },
    region,
    markers: shown.map((p): Marker => ({ pos: p, tone: role(p) === 0 ? 'root' : 'note', label: toneName(tones[role(p)]) })),
    from: shown[0],
    targets: positionsForPc(tonePc(missing), { ...region, strings: [hidden.string] }),
    label: toneName(missing),
    why: `${name} is ${spelled(tones)}. ${shown.map((p) => toneName(tones[role(p)])).join(' and ')} are already here, so the missing note is ${toneName(missing)}: ${describePosition(hidden)}.`,
    sound: shape.map(midiAt),
    facts,
  }
}

// ---------------------------------------------------------------------------
// Hearing triads
// ---------------------------------------------------------------------------

/** What to listen for in each kind, for the feedback. */
const EAR_CLUE: Record<TriadQuality, string> = {
  maj: 'Its middle note is a major 3rd above the root, which makes it bright.',
  min: 'Its middle note is a minor 3rd above the root, a half step lower than in major, which makes it darker.',
  dim: 'Two minor 3rds squeeze it together, and its top note is the tritone above the root, which makes it tense.',
  aug: 'Two major 3rds stretch it out, and its top note is a half step higher than in major, so it floats.',
}

/** Hear a triad, one note at a time or all together: which kind? Offers `kinds` (and the right one). */
export function makeTriadHear(id: number, kinds: TriadQuality[], modes: ('up' | 'together')[], rng: Rng, only?: TriadQuality): Question {
  const quality = only ?? pick(kinds, rng)
  const options = QUALITIES.filter((q) => kinds.includes(q) || q === quality).map((q) => capitalize(TRIAD_NAMES[q]))
  const together = pick(modes, rng) === 'together'
  const low = between(45, 60, rng)
  const notes = [low, low + intervalSize(triadGap(quality, 0, 1))!, low + intervalSize(triadGap(quality, 0, 2))!]
  const tones = triadTones(parseTone(KEY_ON_PC[pitchClass(low)]), quality)
  const names = everyday(tones) ? spelled(tones) : ''
  return {
    id,
    kind: 'triadHear',
    ask: { text: 'What kind of triad do you hear?' },
    options,
    answer: options.indexOf(capitalize(TRIAD_NAMES[quality])),
    why: `${capitalize(TRIAD_NAMES[quality])}${together ? ', played together' : ''}${names ? `: ${names}` : ''}. ${EAR_CLUE[quality]}`,
    listen: { notes, together },
    sound: notes,
    facts: [`ear:${quality}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Triad ideas in the order they're taught. */
export const TRIAD_ORDER = [
  'triad:why',
  'triad:what',
  'triad:letters',
  'triad:major',
  'triad:thirds',
  'triad:minor',
  'triad:which',
  'triad:minor-scale',
  'triad:dim',
  'triad:aug',
  'triad:four',
  'triad:staff',
  'triad:staff-key',
  'triad:inversions',
  'triad:restack',
  'triad:neck-top',
  'triad:neck-minor',
  'triad:neck-middle',
  'triad:ear-why',
  'triad:ear-majmin',
  'triad:ear-together',
  'triad:ear-dim',
  'triad:ear-aug',
]
/** Explained on a card, not quizzed on their own. */
export const TRIAD_INTRO = ['triad:why', 'triad:what', 'triad:ear-why']

export const isTriadItem = (item: string) => item.startsWith('triad:')
/**
 * Facts practiced on the triad tapes: triad letters, spelled triads ("tri:D"), how each kind is
 * stacked ("tq:maj"), inversions ("tinv:1"), shapes on the neck ("tneck:top-min") and hearing
 * each kind ("ear:maj").
 */
export const isTriadFact = (fact: string) => /^(tri|tq|triad|tinv|tneck):/.test(fact) || /^ear:(maj|min|dim|aug)$/.test(fact)

/** The idea each kind of triad is spelled in, the one its 3rds are taught in, and the one it's heard in. */
const SPELL_ITEM: Record<TriadQuality, string> = { maj: 'triad:major', min: 'triad:minor', dim: 'triad:dim', aug: 'triad:aug' }
const GAP_ITEM: Record<TriadQuality, string> = { maj: 'triad:thirds', min: 'triad:which', dim: 'triad:four', aug: 'triad:four' }
const EAR_ITEM: Record<TriadQuality, string> = { maj: 'triad:ear-majmin', min: 'triad:ear-majmin', dim: 'triad:ear-dim', aug: 'triad:ear-aug' }
/** What a heard kind is reviewed against: the kinds learned by the time it's taught. */
const EAR_SET: Record<TriadQuality, TriadQuality[]> = { maj: ['maj', 'min'], min: ['maj', 'min'], dim: ['maj', 'min', 'dim'], aug: QUALITIES }

const parseShapeFact = (value: string) => {
  const m = /^(top|middle)-(maj|min|dim|aug)$/.exec(value)
  return m ? { strings: m[1] === 'top' ? [3, 4, 5] : [2, 3, 4], quality: m[2] as TriadQuality, set: m[1] } : null
}

/** The idea a practiced triad fact belongs to, or null if it isn't one. */
export function triadItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'tri': {
      const t = parseTriadId(value)
      return t ? SPELL_ITEM[t.quality] : null
    }
    case 'tq':
      return isOneOf(value, QUALITIES) ? GAP_ITEM[value] : null
    case 'tinv':
      return ['0', '1', '2'].includes(value) ? 'triad:inversions' : null
    case 'tneck': {
      const s = parseShapeFact(value)
      return !s ? null : s.set === 'middle' ? 'triad:neck-middle' : s.quality === 'min' ? 'triad:neck-minor' : 'triad:neck-top'
    }
    case 'ear':
      return isOneOf(value, QUALITIES) ? EAR_ITEM[value] : null
    default:
      return null
  }
}

/** A quick check on the neck: name a shape, or tap its missing note. */
const neckCheck = (id: number, roots: string[], kinds: TriadQuality[], strings: number[], name: boolean, rng: Rng) =>
  name ? makeTriadShapeName(id, roots, kinds, strings, rng) : makeTriadShapeFind(id, roots, kinds, strings, rng)

/** One question on a taught triad idea. `turn` alternates the kind of question. */
export function triadCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const roots = l.keys ?? []
  const even = turn % 2 === 0
  switch (item) {
    case 'triad:letters':
      return makeTriadLetters(id, rng)
    case 'triad:major':
      return makeTriadSpell(id, roots, 'maj', rng, l.showScale)
    case 'triad:thirds':
      return even ? makeTriadThird(id, roots, 'maj', rng) : makeTriadSpell(id, roots, 'maj', rng)
    case 'triad:minor':
      return makeTriadSpell(id, roots, 'min', rng, l.showScale)
    case 'triad:which':
      return makeTriadQuality(id, roots, ['maj', 'min'], rng)
    case 'triad:minor-scale':
      return even ? makeTriadSpell(id, roots, 'min', rng) : makeTriadThird(id, roots, 'min', rng)
    case 'triad:dim':
      return makeTriadSpell(id, roots, 'dim', rng, l.showScale)
    case 'triad:aug':
      return makeTriadSpell(id, roots, 'aug', rng, l.showScale)
    case 'triad:four':
      return even ? makeTriadQuality(id, roots, QUALITIES, rng) : makeTriadThird(id, roots, pick(QUALITIES, rng), rng, QUALITIES)
    case 'triad:staff':
      return makeTriadRead(id, ['C'], false, rng)
    case 'triad:staff-key':
      return makeTriadRead(id, l.keys ?? ['G', 'D', 'F'], false, rng)
    case 'triad:inversions':
      return makeTriadInversion(id, l.keys ?? ['C'], rng)
    case 'triad:restack':
      return makeTriadRead(id, l.keys ?? ['C'], true, rng)
    case 'triad:neck-top':
      return neckCheck(id, roots, ['maj'], [3, 4, 5], even, rng)
    case 'triad:neck-minor':
      return neckCheck(id, roots, ['min'], [3, 4, 5], even, rng)
    case 'triad:neck-middle':
      return neckCheck(id, roots, l.triads ?? ['maj', 'min'], [2, 3, 4], even, rng)
    case 'triad:ear-majmin':
      return makeTriadHear(id, ['maj', 'min'], ['up'], rng)
    case 'triad:ear-together':
      return makeTriadHear(id, ['maj', 'min'], ['together'], rng)
    case 'triad:ear-dim':
      return makeTriadHear(id, ['maj', 'min', 'dim'], l.ear?.filter((e) => e !== 'down') ?? ['up'], rng, even ? 'dim' : undefined)
    case 'triad:ear-aug':
      return makeTriadHear(id, QUALITIES, l.ear?.filter((e) => e !== 'down') ?? ['up'], rng, even ? 'aug' : undefined)
    default:
      return null
  }
}

/** A review question on one triad fact, or null if it isn't one. */
export function triadReview(fact: string, id: number, rng: Rng): Question | null {
  if (fact === 'triad:letters') return makeTriadLetters(id, rng)
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'tri': {
      const t = parseTriadId(value)
      return t && usable(t.root, t.quality) ? makeTriadSpell(id, [], t.quality, rng, false, t.root) : null
    }
    case 'tq':
      if (!isOneOf(value, QUALITIES)) return null
      return value === 'maj' && rng() < 0.5 ? makeTriadThird(id, [], 'maj', rng) : makeTriadQuality(id, [], EAR_SET[value], rng, value)
    case 'tinv':
      return value === '0' || value === '1' || value === '2' ? makeTriadInversion(id, ['C', 'G', 'F'], rng, Number(value) as 0 | 1 | 2) : null
    case 'tneck': {
      const s = parseShapeFact(value)
      return s && neckCheck(id, [], [s.quality], s.strings, rng() < 0.5, rng)
    }
    case 'ear':
      return isOneOf(value, QUALITIES) ? makeTriadHear(id, EAR_SET[value], ['up', 'together'], rng, value) : null
    default:
      return null
  }
}

/** "D major triad", "How minor triads are stacked", "Major triads by ear"; null if it isn't a triad fact. */
export function describeTriadFact(fact: string): string | null {
  if (fact === 'triad:letters') return 'Triad letters'
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'tri': {
      const t = parseTriadId(value)
      return t ? `${keyLabel(t.root)} ${TRIAD_NAMES[t.quality]} triad` : null
    }
    case 'tq':
      return isOneOf(value, QUALITIES) ? `How ${TRIAD_NAMES[value]} triads are stacked` : null
    case 'tinv':
      return value === '0' || value === '1' || value === '2' ? `Triads in ${INVERSIONS[Number(value)].toLowerCase()}` : null
    case 'tneck': {
      const s = parseShapeFact(value)
      return s ? `${capitalize(TRIAD_NAMES[s.quality])} shapes, ${s.set} strings` : null
    }
    case 'ear':
      return isOneOf(value, QUALITIES) ? `${capitalize(TRIAD_NAMES[value])} triads by ear` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

// Worked examples.
const parseTones = (...ids: string[]) => ids.map(parseTone)
const C_TRIAD = parseTones('C', 'E', 'G')
const triad = (root: string, quality: TriadQuality) => triadTones(parseTone(root), quality)!
/** The C triad in open position: C on the 5th string, E on the 4th, the open G string. */
const OPEN_C: Card['board'] = { region: { strings: [1, 2, 3], minFret: 0, maxFret: 4 }, markers: [on(1, 3, 'root'), on(2, 2), on(3, 0)] }
/** Two chords, one after the other: what the comparison cards play. */
const pair = (a: Tone[], b: Tone[]) => [...triadSound(a), ...triadSound(b)]

/** Every shape of a triad on a string set, the roots glowing. */
function shapesCard(t: Tone[], set: number[]): Card['board'] {
  const shapes = shapesOn(t, set)
  const frets = shapes.flat().map((p) => p.fret)
  return {
    region: { strings: set, minFret: 0, maxFret: Math.min(MAX_FRET, Math.max(...frets) + 1) },
    markers: shapes.flat().map((p): Marker => {
      const i = t.findIndex((x) => tonePc(x) === pitchClass(midiAt(p)))
      return { pos: p, tone: i === 0 ? 'root' : 'note', label: toneName(t[i]) }
    }),
  }
}

const TRIAD_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'triad:why': () => ({
    title: 'Why triads',
    subtitle: 'The chords behind most songs',
    hook: 'A chord is several notes played together. The simplest full chord, called a triad, has just three different notes. Most chords you’ll strum are triads with some notes doubled: an open C chord rings five strings, but only three notes, C, E and G.',
    onGuitar: 'Know how triads are built and you can work out the notes of any chord, instead of memorizing shapes one at a time.',
    score: { measures: [triadScore(C_TRIAD, true)], labels: ['C E G'] },
    board: { region: { strings: ALL_STRINGS, minFret: 0, maxFret: 3 }, markers: [on(1, 3, 'root'), on(2, 2), on(3, 0), on(4, 1, 'root'), on(5, 0)] },
    sound: [48, 52, 55, 60, 64],
  }),
  'triad:what': () => ({
    title: 'What a triad is',
    subtitle: 'A root, a 3rd and a 5th',
    hook: 'A triad starts on a root, the note it’s named after. Add the note a 3rd above it (count three letters up, the root included) and the note a 5th above it (five letters up). Those three notes are called the root, the 3rd and the 5th. In a C triad: C, E and G.',
    onGuitar: 'When guitarists talk about “the 3rd” or “the 5th” of a chord, these are the notes they mean.',
    score: { measures: [[...triadScore(C_TRIAD, false), { ...triadScore(C_TRIAD, true)[0], dur: 'q' }]], labels: ['root', '3rd', '5th', 'together'] },
    board: OPEN_C,
    sound: [48, 52, 55],
  }),
  'triad:letters': () => ({
    title: 'Every other letter',
    subtitle: 'Skip, then skip again',
    hook: 'Counting three letters up always skips one letter in between, so building a triad means skipping a letter each time. From C: C (skip D) E (skip F) G. From D: D (E) F (G) A. On the staff the notes sit right on top of each other: all on lines, or all in spaces.',
    onGuitar: 'The letters stay the same whatever the chord shape: every C chord on the neck is made of C, E and G.',
    score: { measures: [[...triadScore(C_TRIAD, true), ...triadScore(parseTones('D', 'F', 'A'), true)]], labels: ['C E G', 'D F A'] },
    sound: [48, 52, 55, 50, 53, 57],
  }),
  'triad:major': () => {
    const scale = majorScale('D')
    return {
      title: 'Major triads',
      subtitle: 'The 1st, 3rd and 5th of the major scale',
      hook: 'To build a major triad, take the 1st, 3rd and 5th notes of the major scale that starts on its root. The D major scale goes D E F♯ G A B C♯, so the D major triad is D, F♯ and A. The scale already has the right sharps or flats, so the triad gets them for free.',
      onGuitar: 'This is the plain chord you know by its letter: a “D chord” means D major. Here are its three notes in the D major scale shape, root on the 5th string.',
      score: { measures: scaleScore(scale), labels: [...scale, scale[0]].map(toneName), colors: [PAPER_HIGHLIGHT, undefined, PAPER_HIGHLIGHT, undefined, PAPER_HIGHLIGHT] },
      board: cardNeck(triad('D', 'maj')),
      sound: triadSound(triad('D', 'maj')),
    }
  },
  'triad:thirds': () => ({
    title: 'Built from 3rds',
    subtitle: 'A major 3rd, then a minor 3rd',
    hook: 'Measure the gaps in a major triad with the intervals from tape 29. The root up to the 3rd is a major 3rd (4 half steps). The 3rd up to the 5th is a minor 3rd (3 half steps). Together they span a perfect 5th, root to top. C up to E, then E up to G: every major triad is built this way.',
    onGuitar: 'That’s how to find a triad without the scale: from the root, up a major 3rd (4 frets on one string), then a minor 3rd (3 more).',
    score: {
      measures: [triadScore(parseTones('C', 'E'), true), triadScore(parseTones('E', 'G'), true), triadScore(parseTones('C', 'G'), true)],
      labels: ['major 3rd', 'minor 3rd', 'perfect 5th'],
    },
    board: OPEN_C,
    sound: [48, 52, 52, 55, 48, 55],
  }),
  'triad:minor': () => ({
    title: 'Minor triads',
    subtitle: 'Lower the 3rd a half step',
    hook: 'Take a major triad and lower its 3rd by a half step: it becomes a minor triad. C major is C E G; C minor is C E♭ G. The root and the 5th stay put; only the middle note moves, one fret down. Press ▶ Hear: C major, then C minor.',
    onGuitar: 'That one fret is the difference between a bright chord and a dark one. Compare an open E chord with an open E minor chord: one finger lifts.',
    score: { measures: [[...triadScore(C_TRIAD, true), ...triadScore(triad('C', 'min'), true)]], labels: ['C major', 'C minor'] },
    board: { region: { strings: [1, 2, 3], minFret: 0, maxFret: 4 }, markers: [on(1, 3, 'root'), on(2, 2, 'note'), { ...on(2, 1), label: 'E♭' }, on(3, 0, 'note')] },
    sound: pair(C_TRIAD, triad('C', 'min')),
  }),
  'triad:which': () => ({
    title: 'Major or minor?',
    subtitle: 'Check the bottom 3rd',
    hook: 'To tell a major triad from a minor one, measure from the root up to the 3rd. 4 half steps (a major 3rd) means major; 3 half steps (a minor 3rd) means minor. The 5th is a perfect 5th in both, so it doesn’t help. A C E: A up to C is 3 half steps, so it’s A minor.',
    onGuitar: 'On one string, the major 3rd is 4 frets above the root and the minor 3rd is 3.',
    score: { measures: [[...triadScore(triad('A', 'min'), true), ...triadScore(triad('A', 'maj'), true)]], labels: ['A minor', 'A major'] },
    board: { region: { strings: [1], minFret: 0, maxFret: 5 }, markers: [on(1, 0, 'root'), on(1, 3), { ...on(1, 4, 'note'), label: 'C♯' }] },
    sound: pair(triad('A', 'min'), triad('A', 'maj')),
  }),
  'triad:minor-scale': () => {
    const scale = naturalMinorScale('C')
    return {
      title: 'Minor in any key',
      subtitle: 'The 1st, 3rd and 5th of the minor scale',
      hook: 'A minor triad is also the 1st, 3rd and 5th notes of the natural minor scale on its root, from tape 27. The A minor scale goes A B C D E F G, so the A minor triad is A, C and E. Either way works: count up the minor scale, or lower the 3rd of the major triad.',
      onGuitar: 'A minor’s notes come from the C major scale too, its relative major: same notes, different home.',
      score: { measures: scaleScore(scale), labels: [...scale, scale[0]].map(toneName), colors: [PAPER_HIGHLIGHT, undefined, PAPER_HIGHLIGHT, undefined, PAPER_HIGHLIGHT] },
      board: cardNeck(triad('A', 'min')),
      sound: triadSound(triad('A', 'min')),
    }
  },
  'triad:dim': () => ({
    title: 'Diminished triads',
    subtitle: 'Two minor 3rds',
    hook: 'Stack two minor 3rds and you get a diminished triad. Another way: take a minor triad and lower its 5th by a half step. B minor is B D F♯; B diminished is B D F. From the root to the top is now the tritone from tape 29, a diminished 5th, which makes it sound tense.',
    onGuitar: 'Diminished chords often pass between two other chords, and one sits on the 7th note of every major scale: B diminished in C major.',
    score: { measures: [[...triadScore(triad('B', 'min'), true), ...triadScore(triad('B', 'dim'), true)]], labels: ['B minor', 'B diminished'] },
    board: cardNeck(triad('B', 'dim')),
    sound: pair(triad('B', 'min'), triad('B', 'dim')),
  }),
  'triad:aug': () => ({
    title: 'Augmented triads',
    subtitle: 'Two major 3rds',
    hook: 'Stack two major 3rds and you get an augmented triad. Or take a major triad and raise its 5th by a half step. C major is C E G; C augmented is C E G♯. The 5th is now an augmented 5th, and the chord sounds unsettled, as if it’s floating.',
    onGuitar: 'The rarest of the four. You’ll mostly hear it for a moment, leading from one chord into the next.',
    score: { measures: [[...triadScore(C_TRIAD, true), ...triadScore(triad('C', 'aug'), true)]], labels: ['C major', 'C augmented'] },
    board: cardNeck(triad('C', 'aug')),
    sound: pair(C_TRIAD, triad('C', 'aug')),
  }),
  'triad:four': () => ({
    title: 'All four kinds',
    subtitle: 'Two 3rds, four ways',
    hook: 'Every triad is two 3rds stacked, and there are only four ways to stack them. Major: a major 3rd, then a minor 3rd. Minor: a minor 3rd, then a major 3rd. Diminished: two minor 3rds. Augmented: two major 3rds. Here are all four on C.',
    onGuitar: 'Most songs use major and minor chords nearly all the time; diminished and augmented add a moment of tension.',
    score: {
      measures: QUALITIES.map((q) => triadScore(triad('C', q), true)),
      labels: QUALITIES.map((q) => TRIAD_NAMES[q]),
    },
    sound: QUALITIES.flatMap((q) => triadSound(triad('C', q))),
  }),
  'triad:staff': () => ({
    title: 'The snowman',
    subtitle: 'All lines or all spaces',
    hook: 'Written with its root on the bottom, called root position, a triad looks like a snowman: three notes stacked right on top of each other, all on lines or all in spaces. The bottom note is the root, so read it first. Here: G B D on lines, and F A C in spaces.',
    onGuitar: 'Guitar music often writes chords this way, stacked on one stem.',
    score: { measures: [[...triadScore(triad('G', 'maj'), true), ...triadScore(triad('F', 'maj'), true)]], labels: ['G B D', 'F A C'] },
    board: cardNeck(triad('G', 'maj')),
    sound: pair(triad('G', 'maj'), triad('F', 'maj')),
  }),
  'triad:staff-key': () => ({
    title: 'Reading in a key',
    subtitle: 'Key signature first',
    hook: 'Read the key signature before naming a triad. In D major (two sharps, F♯ and C♯), the snowman D F A is really D F♯ A: D major, not D minor. Name the notes with the key in mind, then check the bottom 3rd.',
    onGuitar: 'A song in D mostly uses chords made from the D major scale’s notes, so the key signature tells you which ones to expect.',
    score: { measures: [triadScore(triad('D', 'maj'), true, 'D')], keySig: 'D', labels: ['D F♯ A'] },
    board: cardNeck(triad('D', 'maj')),
    sound: triadSound(triad('D', 'maj')),
  }),
  'triad:inversions': () => ({
    title: 'Inversions',
    subtitle: 'A different note on the bottom',
    hook: 'The same three notes can be stacked with any of them on the bottom. With the root on the bottom, a triad is in root position. With the 3rd on the bottom it’s in 1st inversion; with the 5th on the bottom, 2nd inversion. It’s still the same chord with the same name: C E G, E G C and G C E are all C major.',
    onGuitar: 'Chord shapes put different notes on the bottom all the time: the top three strings of an open C chord play G C E, C major in 2nd inversion.',
    score: { measures: [0, 1, 2].map((n) => triadScore(rotate(C_TRIAD, n), true)), labels: ['root position', '1st inversion', '2nd inversion'] },
    board: { region: { strings: [3, 4, 5], minFret: 0, maxFret: 3 }, markers: [on(3, 0, 'note'), on(4, 1, 'root'), on(5, 0, 'note')] },
    sound: [0, 1, 2].flatMap((n) => triadSound(rotate(C_TRIAD, n))),
  }),
  'triad:restack': () => ({
    title: 'Finding the root',
    subtitle: 'Restack it in 3rds',
    hook: 'To name an inverted triad, restack its notes in 3rds, every other letter, until they sit like a snowman. The bottom note of that stack is the root. E G C restacks as C E G, so it’s C major. A C F restacks as F A C: F major.',
    onGuitar: 'That’s how to name any three-note shape on the neck: read its notes, restack them, and the root falls out.',
    score: { measures: [triadScore(parseTones('E', 'G', 'C'), true), triadScore(C_TRIAD, true)], labels: ['E G C', 'C E G'] },
    sound: [...triadSound(parseTones('E', 'G', 'C')), ...triadSound(C_TRIAD)],
  }),
  'triad:neck-top': () => ({
    title: 'Triads on the top strings',
    subtitle: 'One chord, three shapes',
    hook: 'On the G, B and high E strings, every triad has three shapes, one for each inversion. Climbing the neck, C major goes G C E at the open strings and 1st fret, C E G around the 5th fret, and E G C around the 8th. Each shape has the root in a different place, so find the root first.',
    onGuitar: 'Guitarists use these small shapes for rhythm parts high on the neck, and they’re the building blocks of the bigger CAGED chord shapes in Vol. 7.',
    board: shapesCard(C_TRIAD, [3, 4, 5]),
    sound: shapesOn(C_TRIAD, [3, 4, 5]).flatMap((s) => s.map(midiAt)),
  }),
  'triad:neck-minor': () => ({
    title: 'Minor shapes',
    subtitle: 'Lower the 3rd one fret',
    hook: 'To turn each major shape minor, find its 3rd and move it down one fret; everything else stays put. A major’s shapes become A minor’s: each C♯ becomes C. Here are the three A minor shapes on the top strings.',
    onGuitar: 'The first of these is the top of the open A minor chord.',
    board: shapesCard(triad('A', 'min'), [3, 4, 5]),
    sound: shapesOn(triad('A', 'min'), [3, 4, 5]).flatMap((s) => s.map(midiAt)),
  }),
  'triad:neck-middle': () => ({
    title: 'The middle strings',
    subtitle: 'D, G and B',
    hook: 'Move down a string set, to the D, G and B strings, and the shapes change, because the B string is tuned a fret lower than the others (the same B-string rule you met with octaves and intervals). Learn them as new shapes: C major is E G C near the open strings, G C E at the 5th fret, and C E G around the 9th.',
    onGuitar: 'With the top and middle string sets, you can play any triad almost anywhere on the neck.',
    board: shapesCard(C_TRIAD, [2, 3, 4]),
    sound: shapesOn(C_TRIAD, [2, 3, 4]).flatMap((s) => s.map(midiAt)),
  }),
  'triad:ear-why': () => ({
    title: 'Why hear triads',
    subtitle: 'Major or minor, by ear',
    hook: 'Telling a major chord from a minor one by ear is one of the most useful skills a musician has: it’s the first step to working out a song’s chords without looking them up. This tape plays triads one note at a time first, then all together. Press ▶ Hear: C major, then C minor.',
    onGuitar: 'Hear minor, and you know the 3rd is the lower choice: on the neck, one fret down.',
    board: OPEN_C,
    listen: { notes: pair(C_TRIAD, triad('C', 'min')) },
    sound: [],
  }),
  'triad:ear-majmin': () => ({
    title: 'Bright or dark',
    subtitle: 'Listen to the middle note',
    hook: 'One note at a time, major sounds bright and settled; minor sounds darker, even sad. The root and the top note are the same in both. Only the middle note, the 3rd, moves, so that’s the one to listen for. Here: A major, then A minor.',
    onGuitar: 'Strum an open E chord, then E minor, to hear the same difference on your own guitar later.',
    board: { region: { strings: [1], minFret: 0, maxFret: 5 }, markers: [on(1, 0, 'root'), { ...on(1, 4), label: 'C♯' }, { ...on(1, 3, 'note'), label: 'C' }] },
    listen: { notes: pair(triad('A', 'maj'), triad('A', 'min')) },
    sound: [],
  }),
  'triad:ear-together': () => ({
    title: 'All at once',
    subtitle: 'The chord’s color',
    hook: 'Played together, the three notes blend into one sound. Don’t try to pick out each note; listen to the overall color. Major rings bright and open; minor sounds shaded and heavier. Here: C major, then C minor, each played together.',
    onGuitar: 'This is how you’ll hear chords in songs, so it’s the version that matters most.',
    board: OPEN_C,
    listen: { notes: pair(C_TRIAD, triad('C', 'min')), chord: 3 },
    sound: [],
  }),
  'triad:ear-dim': () => ({
    title: 'Diminished',
    subtitle: 'Tense and squeezed',
    hook: 'A diminished triad is two minor 3rds stacked tight, so it sounds tense and squeezed, as if it has to move on. Listen for the top note: it’s a half step lower than in a minor triad, the tritone above the root. Here: C minor, then C diminished.',
    listen: { notes: pair(triad('C', 'min'), triad('C', 'dim')) },
    score: { measures: [[...triadScore(triad('C', 'min'), true), ...triadScore(triad('C', 'dim'), true)]], labels: ['C minor', 'C diminished'] },
    sound: [],
  }),
  'triad:ear-aug': () => ({
    title: 'Augmented',
    subtitle: 'Floating',
    hook: 'An augmented triad is two major 3rds. It sounds unsettled and dreamy, as if it’s floating and hasn’t decided where to go. Its top note is a half step higher than in a major triad. Here: C major, then C augmented.',
    listen: { notes: pair(C_TRIAD, triad('C', 'aug')) },
    score: { measures: [[...triadScore(C_TRIAD, true), ...triadScore(triad('C', 'aug'), true)]], labels: ['C major', 'C augmented'] },
    sound: [],
  }),
}

/** The card that teaches a triad idea. */
export function triadCard(item: string, counter: string): Card {
  return { ...TRIAD_CARDS[item](), counter }
}
