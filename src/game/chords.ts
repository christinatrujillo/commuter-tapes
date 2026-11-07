import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import { describePosition, LETTERS, ordinal, pitchClass } from '../music/notes'
import type { KeyId } from '../music/score'
import {
  CAGED_ORDER,
  movedShape,
  OPEN_CHORDS,
  SHAPE_NAMES,
  shapeMidis,
  shiftFor,
  type CagedShape,
  type ChordShape,
  type DiagramSpec,
} from '../music/chordShapes'
import {
  CHORD_KINDS,
  CHORD_NAMES,
  CHORD_SUFFIX,
  chordIntervals,
  chordSymbol,
  chordTones,
  degreeName,
  intervalName,
  intervalSize,
  keySevenths,
  majorName,
  majorScale,
  parseTone,
  RARE_SPELLINGS,
  SEVENTH_NUMERALS,
  spelled,
  toneId,
  toneName,
  tonePc,
  type ChordKind,
  type Tone,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { aOrAn, capitalize } from '../lib/text'
import type { Question } from './questions'
import { chordMeasures, triadBoard, triadScore, triadSound } from './triads'

/**
 * Building chords: chord symbols, 7th chords and the 7th chords in a key, sus, add and 6 chords,
 * chord diagrams, the CAGED shapes, and hearing 7th chords.
 */

const TRIADS: ChordKind[] = ['maj', 'min', 'dim', 'aug']
const SEVENTHS: ChordKind[] = ['maj7', '7', 'm7', 'm7b5']
const isTriad = (k: ChordKind) => TRIADS.includes(k)
/** How the triad tapes name each triad in practice stats: "D", "Dm", "Bdim". */
const TRIAD_ID: Partial<Record<ChordKind, string>> = { maj: '', min: 'm', dim: 'dim', aug: 'aug' }

/** A chord's name in practice stats, in plain letters: "G7", "Bm7b5", "Dsus4", "Cdim". */
const ID_SUFFIX: Record<ChordKind, string> = { ...CHORD_SUFFIX, dim: 'dim', aug: 'aug', m7b5: 'm7b5', dim7: 'dim7' }
const chordId = (root: Tone, kind: ChordKind) => `${toneId(root)}${ID_SUFFIX[kind]}`
function parseChordId(id: string): { root: string; kind: ChordKind } | null {
  const m = /^([A-G][#b]?)(maj7|m7b5|m7|dim7|7|sus2|sus4|add9|m6|6|m|dim|aug)?$/.exec(id)
  if (!m) return null
  return { root: m[1], kind: CHORD_KINDS.find((k) => ID_SUFFIX[k] === (m[2] ?? ''))! }
}

/** Roots that make each kind with everyday spellings, for tracks and reviews that don't list their own. */
const USUAL_ROOTS: Record<ChordKind, string[]> = {
  maj: ['C', 'G', 'D', 'A', 'E', 'F'],
  min: ['A', 'E', 'D', 'B', 'G', 'C'],
  dim: ['B', 'E', 'A', 'D', 'F#', 'C#'],
  aug: ['C', 'F', 'G', 'D', 'Bb', 'Eb'],
  maj7: ['C', 'F', 'G', 'D', 'A', 'E', 'Bb'],
  '7': ['G', 'C', 'D', 'A', 'E', 'B', 'F'],
  m7: ['A', 'E', 'D', 'B', 'G', 'C', 'F'],
  m7b5: ['B', 'E', 'A', 'D', 'F#', 'C#', 'G'],
  // Diminished 7ths sit on a minor key's raised 7th: G♯ in A minor, D♯ in E minor.
  dim7: ['G#', 'C#', 'D#', 'B', 'F#', 'A#'],
  sus2: ['C', 'D', 'E', 'G', 'A'],
  sus4: ['C', 'D', 'E', 'G', 'A'],
  add9: ['C', 'D', 'G', 'A', 'E', 'F'],
  '6': ['C', 'G', 'D', 'A', 'F'],
  m6: ['A', 'E', 'D', 'G'],
}

const everyday = (tones: Tone[] | null): tones is Tone[] => !!tones && tones.every((t) => !RARE_SPELLINGS.has(toneName(t)))
const rootsFor = (kind: ChordKind, roots: string[]) => {
  const own = roots.filter((r) => everyday(chordTones(parseTone(r), kind)))
  return own.length ? own : USUAL_ROOTS[kind]
}

/** "G B D F" */
const fullName = (root: Tone, kind: ChordKind) => `${toneName(root)} ${CHORD_NAMES[kind]}`

/** What each kind is, in a phrase, for the feedback. */
const BUILT: Record<ChordKind, string> = {
  maj: 'a major 3rd with a minor 3rd on top',
  min: 'a minor 3rd with a major 3rd on top',
  dim: 'two minor 3rds',
  aug: 'two major 3rds',
  maj7: 'a major triad with a major 7th on top',
  '7': 'a major triad with a minor 7th on top',
  m7: 'a minor triad with a minor 7th on top',
  m7b5: 'a diminished triad with a minor 7th on top',
  dim7: 'three minor 3rds stacked',
  sus2: 'a triad with its 3rd swapped for the 2nd',
  sus4: 'a triad with its 3rd swapped for the 4th',
  add9: 'a major triad plus the 9th',
  '6': 'a major triad plus the 6th',
  m6: 'a minor triad plus the 6th',
}

/** "B is a major 3rd up, D a perfect 5th and F a minor 7th": each note's interval from the root. */
function intervalsText(tones: Tone[], kind: ChordKind): string {
  const parts = chordIntervals(kind).map((iv, i) => {
    // add9's 2nd sits an octave up, where it's called a 9th.
    const name = kind === 'add9' && iv.number === 2 ? 'major 9th (the 2nd, an octave up)' : intervalName(iv)
    return `${toneName(tones[i + 1])} ${i === 0 ? `is ${aOrAn(name)} ${name} up` : `${aOrAn(name)} ${name}`}`
  })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
}

// ---------------------------------------------------------------------------
// Chord symbols
// ---------------------------------------------------------------------------

/** What each sign in a symbol means, for the feedback. */
const SIGN_MEANS: Record<ChordKind, string> = {
  maj: 'A letter on its own means a major chord',
  min: 'A small m means minor',
  dim: 'A small circle (°) means diminished',
  aug: 'A plus sign (+) means augmented',
  maj7: '“maj7” means a major 7th chord',
  '7': 'A plain 7 means a dominant 7th',
  m7: '“m7” means a minor 7th chord',
  m7b5: '“m7♭5” means half-diminished',
  dim7: '“°7” means a diminished 7th',
  sus2: '“sus2” means the 3rd is swapped for the 2nd',
  sus4: '“sus4” means the 3rd is swapped for the 4th',
  add9: '“add9” means the 9th is added',
  '6': 'A 6 means the 6th is added',
  m6: '“m6” means a minor chord with the 6th added',
}

/** "What does F♯m mean?" */
export function makeSymbolRead(id: number, roots: string[], kinds: ChordKind[], rng: Rng, only?: ChordKind): Question {
  const kind = only ?? pick(kinds, rng)
  const root = parseTone(pick(rootsFor(kind, roots), rng))
  const offered = CHORD_KINDS.filter((k) => kinds.includes(k) || k === kind)
  const options = offered.map((k) => fullName(root, k))
  const tones = chordTones(root, kind)!
  return {
    id,
    kind: 'chordSymbolRead',
    ask: { text: `What does ${chordSymbol(root, kind)} mean?`, hl: chordSymbol(root, kind) },
    options,
    answer: options.indexOf(fullName(root, kind)),
    why: `${SIGN_MEANS[kind]}, so ${chordSymbol(root, kind)} is ${fullName(root, kind)}: ${spelled(tones)}.`,
    score: { measures: [triadScore(tones, true)], after: [chordSymbol(root, kind)] },
    sound: triadSound(tones),
    facts: [`csym:${kind}`],
  }
}

/** "How is B diminished written?" */
export function makeSymbolWrite(id: number, roots: string[], kinds: ChordKind[], rng: Rng, only?: ChordKind): Question {
  const kind = only ?? pick(kinds, rng)
  const root = parseTone(pick(rootsFor(kind, roots), rng))
  const offered = CHORD_KINDS.filter((k) => kinds.includes(k) || k === kind)
  const options = offered.map((k) => chordSymbol(root, k))
  const tones = chordTones(root, kind)!
  return {
    id,
    kind: 'chordSymbolWrite',
    ask: { text: `How is ${fullName(root, kind)} written?`, hl: fullName(root, kind) },
    options,
    answer: options.indexOf(chordSymbol(root, kind)),
    why: `${SIGN_MEANS[kind]}, so ${fullName(root, kind)} is written ${chordSymbol(root, kind)}.`,
    score: { measures: [triadScore(tones, true)], after: [chordSymbol(root, kind)] },
    sound: triadSound(tones),
    facts: [`csym:${kind}`],
  }
}

// ---------------------------------------------------------------------------
// Spelling chords, and naming them from their notes
// ---------------------------------------------------------------------------

/** The kinds a chord is most often mixed up with, for near-miss spellings. */
const SPELL_NEAR: Record<ChordKind, ChordKind[]> = {
  maj: ['min', 'aug', 'sus4'],
  min: ['maj', 'dim', 'm7'],
  dim: ['min', 'aug', 'm7b5'],
  aug: ['maj', 'min', '6'],
  maj7: ['7', 'm7', '6'],
  '7': ['maj7', 'm7', 'maj'],
  m7: ['7', 'm7b5', 'm6'],
  m7b5: ['m7', 'dim', '7'],
  dim7: ['m7b5', 'dim', '7'],
  sus2: ['sus4', 'maj', 'add9'],
  sus4: ['sus2', 'maj', 'add9'],
  add9: ['maj', 'sus2', '6'],
  '6': ['maj7', 'm6', 'add9'],
  m6: ['6', 'm7', 'min'],
}

/** "What notes make G7?" The root alone on the staff, and the whole chord once it's answered. */
export function makeChordSpell(id: number, roots: string[], kinds: ChordKind[], rng: Rng, only?: { root: string; kind: ChordKind }): Question {
  const kind = only?.kind ?? pick(kinds, rng)
  const root = parseTone(only?.root ?? pick(rootsFor(kind, roots), rng))
  const tones = chordTones(root, kind)!
  const right = spelled(tones)
  const near = SPELL_NEAR[kind].map((k) => chordTones(root, k)).filter(everyday).map(spelled)
  const options = shuffle([right, ...[...new Set(near)].filter((s) => s !== right).slice(0, 3)], rng)
  const symbol = chordSymbol(root, kind)
  return {
    id,
    kind: 'chordSpell',
    ask: { text: `What notes make ${symbol}?`, hl: symbol },
    options,
    answer: options.indexOf(right),
    why: `${symbol} is ${BUILT[kind]}. From ${toneName(root)}, ${intervalsText(tones, kind)}: ${right}.`,
    score: { measures: [triadScore([root], true)], labels: [toneName(root)], afterMeasures: [triadScore(tones, true)], after: [symbol] },
    board: triadBoard(tones),
    sound: triadSound(tones),
    // Triads keep the facts they were learned under on the triad tapes.
    facts: [isTriad(kind) ? `tri:${toneId(root)}${TRIAD_ID[kind]}` : `chd:${chordId(root, kind)}`],
  }
}

/** Kinds offered when naming a chord from its notes: the ones it's easily confused with. */
const FAMILY: Record<ChordKind, ChordKind[]> = {
  maj: TRIADS,
  min: TRIADS,
  dim: TRIADS,
  aug: TRIADS,
  maj7: SEVENTHS,
  '7': SEVENTHS,
  m7: SEVENTHS,
  m7b5: SEVENTHS,
  dim7: ['7', 'm7b5', 'dim7'],
  sus2: ['maj', 'sus2', 'sus4'],
  sus4: ['maj', 'sus2', 'sus4'],
  add9: ['maj', 'sus2', 'add9'],
  '6': ['maj', 'maj7', '6'],
  m6: ['min', 'm7', 'm6'],
}

/** "G B D F: which chord?" Offers the kinds in the track's family, as symbols on the same root. */
export function makeChordKind(id: number, roots: string[], kinds: ChordKind[], rng: Rng, only?: ChordKind): Question {
  const kind = only ?? pick(kinds, rng)
  const family = new Set([...kinds, kind].flatMap((k) => FAMILY[k]))
  // Roots where every choice is spelled the everyday way, so none drops out.
  const complete = rootsFor(kind, roots).filter((r) => [...family].every((k) => everyday(chordTones(parseTone(r), k))))
  const root = parseTone(pick(complete.length ? complete : rootsFor(kind, roots), rng))
  const tones = chordTones(root, kind)!
  const options = CHORD_KINDS.filter((k) => family.has(k) && everyday(chordTones(root, k))).map((k) => chordSymbol(root, k))
  const symbol = chordSymbol(root, kind)
  return {
    id,
    kind: 'chordKind',
    ask: { text: `${spelled(tones)}: which chord?`, hl: spelled(tones) },
    options,
    answer: options.indexOf(symbol),
    why: `From ${toneName(root)}, ${intervalsText(tones, kind)}. That’s ${BUILT[kind]}: ${aOrAn(CHORD_NAMES[kind])} ${CHORD_NAMES[kind]} chord, written ${symbol}.`,
    score: { measures: [triadScore(tones, true)], after: [symbol] },
    sound: triadSound(tones),
    facts: [`chq:${kind}`],
  }
}

// ---------------------------------------------------------------------------
// 7th chords in a key
// ---------------------------------------------------------------------------

const KEY_SEVENTH_NEAR: ChordKind[] = ['maj7', '7', 'm7', 'm7b5']
/** The written octave of a chord's root, so a key's chords climb the staff from its home note. */
const rootOctave = (key: KeyId, d: number) => {
  const scale = majorScale(key)
  return 4 + (LETTERS.indexOf(scale[d].letter) < LETTERS.indexOf(scale[0].letter) ? 1 : 0)
}

/** "What's the 7th chord on the 5th note of G major?" */
export function makeSeventhOnDegree(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? between(1, 6, rng)
  const { tones, kind } = keySevenths(key)[d]
  const root = tones[0]
  const right = chordSymbol(root, kind)
  const neighbor = keySevenths(key)[(d + 1) % 7]
  const wrong = [...KEY_SEVENTH_NEAR.filter((k) => k !== kind).map((k) => chordSymbol(root, k)), chordSymbol(neighbor.tones[0], neighbor.kind)]
  const options = shuffle([right, ...wrong.slice(0, 3)], rng)
  const scale = majorScale(key)
  const where = `${degreeName(d + 1)} note of ${majorName(key)}`
  return {
    id,
    kind: 'seventhOnDegree',
    ask: { text: `What’s the 7th chord on the ${where}?`, hl: where },
    options,
    answer: options.indexOf(right),
    why: `Count up ${majorName(key)} to the ${degreeName(d + 1)} note: ${scale.slice(0, d + 1).map(toneName).join(' ')}. Stack four notes of the scale from ${toneName(root)}: ${spelled(tones)}. That’s ${aOrAn(CHORD_NAMES[kind])} ${CHORD_NAMES[kind]} chord, ${right}, the key’s ${SEVENTH_NUMERALS[d]}.`,
    score: { measures: [[]], keySig: key, afterMeasures: [triadScore(tones, true, key, rootOctave(key, d))], after: [right] },
    sound: triadSound(tones, rootOctave(key, d)),
    facts: [`h7:${d + 1}`],
  }
}

/** "In F major, which numeral is Gm7?" */
export function makeSeventhNumeral(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? between(1, 6, rng)
  const { tones, kind } = keySevenths(key)[d]
  const symbol = chordSymbol(tones[0], kind)
  // Neighbors, and the right numeral in the wrong case.
  const roman = SEVENTH_NUMERALS[d].match(/^[ivIV]+/)![0]
  const swapped = SEVENTH_NUMERALS[d].replace(roman, roman === roman.toUpperCase() ? roman.toLowerCase() : roman.toUpperCase())
  const wanted = [SEVENTH_NUMERALS[(d + 6) % 7], SEVENTH_NUMERALS[d], swapped, SEVENTH_NUMERALS[(d + 1) % 7]]
  const options = [...new Set(wanted)]
  const scale = majorScale(key)
  return {
    id,
    kind: 'seventhNumeral',
    ask: { text: `In ${majorName(key)}, which numeral is ${symbol}?`, hl: symbol },
    options,
    answer: options.indexOf(SEVENTH_NUMERALS[d]),
    why: `${toneName(tones[0])} is the ${degreeName(d + 1)} note of ${majorName(key)} (${scale.slice(0, d + 1).map(toneName).join(' ')}), and ${symbol} is ${aOrAn(CHORD_NAMES[kind])} ${CHORD_NAMES[kind]} chord: ${SEVENTH_NUMERALS[d]}.`,
    score: { measures: [triadScore(tones, true, key, rootOctave(key, d))], keySig: key, after: [symbol] },
    sound: triadSound(tones, rootOctave(key, d)),
    facts: [`h7:${d + 1}`],
  }
}

/** "In D major, what are the chords of ii7–V7–Imaj7?" */
export function makeTwoFiveSpell(id: number, keys: KeyId[], rng: Rng): Question {
  const key = pick(keys, rng)
  const chords = keySevenths(key)
  const named = (ds: number[], kinds?: ChordKind[]) => ds.map((d, i) => chordSymbol(chords[d].tones[0], kinds?.[i] ?? chords[d].kind)).join(' – ')
  const right = named([1, 4, 0])
  // Near misses: the right roots with the kinds mixed up, and the roots counted one note off.
  const wrong = [named([1, 4, 0], ['maj7', '7', 'maj7']), named([1, 4, 0], ['m7', 'm7', 'maj7']), named([1, 4, 0], ['7', '7', '7']), named([2, 5, 1])]
  const options = shuffle([right, ...[...new Set(wrong)].filter((w) => w !== right).slice(0, 3)], rng)
  return {
    id,
    kind: 'twoFiveSpell',
    ask: { text: `In ${majorName(key)}, what are the chords of ii7–V7–Imaj7?`, hl: 'ii7–V7–Imaj7' },
    options,
    answer: options.indexOf(right),
    why: `ii7 is the minor 7th on the 2nd note, V7 the dominant 7th on the 5th, and Imaj7 the major 7th on the root: ${right}.`,
    score: {
      measures: [[]],
      keySig: key,
      afterMeasures: [[1, 4, 0].flatMap((d) => triadScore(chords[d].tones, true, key, rootOctave(key, d)))],
      after: ['ii7', 'V7', 'Imaj7'],
    },
    sound: [1, 4, 0].flatMap((d) => triadSound(chords[d].tones, rootOctave(key, d))),
    facts: ['h7:two-five'],
  }
}

// ---------------------------------------------------------------------------
// Chord diagrams
// ---------------------------------------------------------------------------

const ROLE_LABELS = ['R', '3', '5', '7']
const ROLE_NAMES = ['Root', '3rd', '5th']

/** For each string a shape plays: the chord note it is, as its index in `tones`, or −1 if it doesn't play. */
const shapeRoles = (shape: ChordShape, tones: Tone[]) =>
  shapeMidis(shape).map((m) => (m === null ? -1 : tones.findIndex((t) => tonePc(t) === pitchClass(m))))

/** A diagram with its notes named under the strings and its roots in amber. */
function namedDiagram(shape: ChordShape, tones: Tone[]): DiagramSpec {
  const roles = shapeRoles(shape, tones)
  return {
    shape,
    names: roles.map((r) => (r < 0 ? null : toneName(tones[r]))),
    roots: roles.flatMap((r, s) => (r === 0 ? [s] : [])),
  }
}

const strum = (shape: ChordShape) => shapeMidis(shape).filter((m): m is number => m !== null)

/** An open chord's diagram: which chord is it? */
export function makeDiagramName(id: number, shapes: string[], rng: Rng, only?: string): Question {
  const known = shapes.filter((s) => s in OPEN_CHORDS)
  const name = only ?? pick(known.length ? known : Object.keys(OPEN_CHORDS), rng)
  const chord = OPEN_CHORDS[name]
  const tones = chordTones(chord.root, chord.kind)!
  // Near misses: the same letter in the other kind first, then the other shapes learned.
  const twin = chord.kind === 'maj' ? `${name}m` : name.replace('m', '')
  const others = [twin, ...shuffle(Object.keys(OPEN_CHORDS), rng)].filter((n) => n !== name && n in OPEN_CHORDS && (n === twin || known.includes(n)))
  const options = shuffle([name, ...[...new Set(others)].slice(0, 3)], rng)
  const played = shapeRoles(chord.shape, tones).filter((r) => r >= 0).map((r) => toneName(tones[r]))
  return {
    id,
    kind: 'diagramName',
    ask: { text: 'Which chord is this?' },
    options,
    answer: options.indexOf(name),
    why: `Low to high it plays ${played.join(' ')}: the notes of ${fullName(chord.root, chord.kind)} (${spelled(tones)}), so it’s ${name}.`,
    diagram: { shape: chord.shape, after: namedDiagram(chord.shape, tones) },
    sound: strum(chord.shape),
    facts: [`diag:${name}`],
  }
}

/** An open chord with one dot ringed: is it the root, the 3rd or the 5th? */
export function makeDiagramRole(id: number, shapes: string[], rng: Rng, only?: string): Question {
  const known = shapes.filter((s) => s in OPEN_CHORDS)
  const name = only ?? pick(known.length ? known : Object.keys(OPEN_CHORDS), rng)
  const chord = OPEN_CHORDS[name]
  const tones = chordTones(chord.root, chord.kind)!
  const roles = shapeRoles(chord.shape, tones)
  const string = pick(
    chord.shape.frets.flatMap((f, s) => (f > 0 ? [s] : [])),
    rng,
  )
  const role = roles[string]
  const note = toneName(tones[role])
  return {
    id,
    kind: 'diagramRole',
    ask: { text: `In this ${name} chord, which note is the ringed dot?`, hl: `${name} chord` },
    options: ROLE_NAMES,
    answer: role,
    why: `That dot is ${note}: ${describePosition({ string, fret: chord.shape.frets[string] })}. ${name} is ${spelled(tones)}, so ${note} is its ${ROLE_NAMES[role].toLowerCase()}.`,
    diagram: {
      shape: chord.shape,
      dots: chord.shape.frets.map((_, s) => (s === string ? '?' : null)),
      mark: string,
      after: { ...namedDiagram(chord.shape, tones), dots: roles.map((r) => (r < 0 ? null : ROLE_LABELS[r])), mark: string },
    },
    sound: strum(chord.shape),
    facts: [`diag:${name}`],
  }
}

// ---------------------------------------------------------------------------
// CAGED
// ---------------------------------------------------------------------------

/** The string each shape's lowest root sits on. */
const ROOT_STRING: Record<CagedShape, number> = { C: 1, A: 1, G: 0, E: 0, D: 2 }
const STRING_WORD = ['low E', 'A', 'D']
const MAJOR_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb']

/** A major chord in one CAGED shape, moved somewhere up the neck (not open). */
function pickMoved(shapes: CagedShape[], rng: Rng) {
  const options = shapes.flatMap((name) =>
    MAJOR_ROOTS.map(parseTone)
      .map((root) => ({ name, root, shift: shiftFor(name, root) }))
      .filter((o) => o.shift >= 1 && o.shift <= 9),
  )
  const o = pick(options, rng)
  const shape = movedShape(o.name, o.shift)
  const tones = chordTones(o.root, 'maj')!
  return { ...o, shape, tones, rootFret: shape.frets[ROOT_STRING[o.name]] }
}

const knownShapes = (shapes: string[]) => {
  const own = shapes.filter((s): s is CagedShape => isOneOf(s, CAGED_ORDER))
  return own.length ? own : CAGED_ORDER
}

/** A shape somewhere up the neck: which CAGED shape is it? */
export function makeCagedShape(id: number, shapes: string[], rng: Rng, only?: CagedShape): Question {
  const m = pickMoved(only ? [only] : knownShapes(shapes), rng)
  return {
    id,
    kind: 'cagedShape',
    ask: { text: 'Which CAGED shape is this?' },
    options: SHAPE_NAMES,
    answer: CAGED_ORDER.indexOf(m.name),
    why: `It’s an open ${m.name} chord moved up ${m.shift} fret${m.shift === 1 ? '' : 's'}, with the barre where the open strings were: the ${m.name} shape. Its root is on the ${STRING_WORD[ROOT_STRING[m.name]]} string.`,
    diagram: { shape: m.shape, roots: shapeRoles(m.shape, m.tones).flatMap((r, s) => (r === 0 ? [s] : [])), after: namedDiagram(m.shape, m.tones) },
    sound: strum(m.shape),
    facts: [`caged:${m.name}`],
  }
}

/** A shape somewhere up the neck: which chord does it play? */
export function makeCagedChord(id: number, shapes: string[], rng: Rng, only?: CagedShape): Question {
  const m = pickMoved(only ? [only] : knownShapes(shapes), rng)
  const right = toneName(m.root)
  // The usual slip is naming the shape instead of the chord; then the notes a fret either side.
  const nearby = MAJOR_ROOTS.map(parseTone).filter((r) => Math.abs(pitchClass(tonePc(r) - tonePc(m.root) + 6) - 6) <= 2)
  const wrong = [m.name, ...shuffle(nearby.map(toneName), rng)].filter((n) => n !== right)
  const options = shuffle([right, ...[...new Set(wrong)].slice(0, 3)], rng)
  return {
    id,
    kind: 'cagedChord',
    ask: { text: 'Which chord is this?' },
    options,
    answer: options.indexOf(right),
    why: `It’s the ${m.name} shape, moved up ${m.shift} fret${m.shift === 1 ? '' : 's'}. Its root is on the ${STRING_WORD[ROOT_STRING[m.name]]} string at the ${ordinal(m.rootFret)} fret: ${right}. So it’s ${right} major.`,
    diagram: { shape: m.shape, after: namedDiagram(m.shape, m.tones) },
    sound: strum(m.shape),
    facts: [`caged:${m.name}`],
  }
}

/** "Going up the neck, which shape comes after the G shape?" Shown on C major. */
export function makeCagedNext(id: number, rng: Rng, only?: CagedShape): Question {
  const name = only ?? pick(CAGED_ORDER, rng)
  const next = CAGED_ORDER[(CAGED_ORDER.indexOf(name) + 1) % 5]
  const c = parseTone('C')
  const tones = chordTones(c, 'maj')!
  const shape = movedShape(name, shiftFor(name, c))
  return {
    id,
    kind: 'cagedNext',
    ask: { text: `Going up the neck, which shape comes after the ${name} shape?`, hl: `${name} shape` },
    options: SHAPE_NAMES,
    answer: CAGED_ORDER.indexOf(next),
    why: `Up the neck the shapes go C, A, G, E, D, and then C again: after the ${name} shape comes the ${next} shape. Here it’s C major in the ${name} shape.`,
    diagram: { shape, roots: shapeRoles(shape, tones).flatMap((r, s) => (r === 0 ? [s] : [])) },
    sound: strum(shape),
    facts: ['caged:order'],
  }
}

// ---------------------------------------------------------------------------
// Hearing 7th chords
// ---------------------------------------------------------------------------

const EAR_CLUE: Partial<Record<ChordKind, string>> = {
  maj7: 'Its top note sits a half step below the octave, which gives it a soft, dreamy shimmer.',
  '7': 'Its top note sits a whole step below the octave, which makes it bluesy and restless, wanting to move on.',
  m7: 'It’s a minor triad softened by a minor 7th: mellow and smooth.',
  m7b5: 'Its lowered 5th darkens the whole chord: dark and tense.',
}

/** Hear a 7th chord, one note at a time or together: which kind? */
export function makeSeventhHear(id: number, kinds: ChordKind[], modes: ('up' | 'together')[], rng: Rng, only?: ChordKind): Question {
  const sevenths = kinds.filter((k) => SEVENTHS.includes(k))
  const kind = only ?? pick(sevenths.length ? sevenths : SEVENTHS, rng)
  const options = SEVENTHS.filter((k) => sevenths.includes(k) || k === kind).map((k) => capitalize(CHORD_NAMES[k]))
  const together = pick(modes, rng) === 'together'
  const low = between(45, 57, rng)
  const notes = [low, ...chordIntervals(kind).map((iv) => low + intervalSize(iv)!)]
  return {
    id,
    kind: 'seventhHear',
    ask: { text: 'What kind of 7th chord do you hear?' },
    options,
    answer: options.indexOf(capitalize(CHORD_NAMES[kind])),
    why: `${capitalize(CHORD_NAMES[kind])}${together ? ', played together' : ''}. ${EAR_CLUE[kind]}`,
    listen: { notes, together },
    sound: notes,
    facts: [`ear:${kind}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const CHORD_ORDER = [
  'chord:symbols-why',
  'chord:symbols',
  'chord:dim-aug-symbols',
  'chord:symbol-spell',
  'chord:seventh-what',
  'chord:maj7',
  'chord:dom7',
  'chord:m7',
  'chord:m7b5',
  'chord:seventh-which',
  'chord:key7-stack',
  'chord:key7-numerals',
  'chord:key7-dominant',
  'chord:key7-two-five',
  'chord:sus',
  'chord:add9',
  'chord:six',
  'chord:diagram-read',
  'chord:open-major',
  'chord:open-minor',
  'chord:roles',
  'chord:caged-why',
  'chord:caged-move',
  'chord:caged-order',
  'chord:caged-name',
  'chord:ear-why',
  'chord:ear-maj-dom',
  'chord:ear-m7',
  'chord:ear-m7b5',
]
/** Explained on a card, not quizzed on their own. */
export const CHORD_INTRO = ['chord:symbols-why', 'chord:seventh-what', 'chord:diagram-read', 'chord:caged-why', 'chord:ear-why']

export const isChordItem = (item: string) => item.startsWith('chord:')
/**
 * Facts practiced on these tapes: spelled chords ("chd:G7"), telling kinds apart ("chq:m7"),
 * symbols ("csym:dim"), the 7th chords in a key ("h7:5", "h7:two-five"), open chord diagrams
 * ("diag:Am"), the CAGED shapes ("caged:A", "caged:order") and hearing 7ths ("ear:maj7").
 */
export const isChordFact = (fact: string) => /^(chd|chq|csym|h7|diag|caged):/.test(fact) || /^ear:(maj7|7|m7|m7b5)$/.test(fact)

const OPEN_MAJORS = ['C', 'A', 'G', 'E', 'D']
const OPEN_MINORS = ['Am', 'Em', 'Dm']
const REVIEW_KEYS: KeyId[] = ['C', 'G', 'D', 'F', 'A']
const KIND_ITEM: Partial<Record<ChordKind, string>> = {
  maj7: 'chord:maj7',
  '7': 'chord:dom7',
  m7: 'chord:m7',
  m7b5: 'chord:m7b5',
  sus2: 'chord:sus',
  sus4: 'chord:sus',
  add9: 'chord:add9',
  '6': 'chord:six',
  m6: 'chord:six',
}
const EAR_ITEM: Partial<Record<ChordKind, string>> = { maj7: 'chord:ear-maj-dom', '7': 'chord:ear-maj-dom', m7: 'chord:ear-m7', m7b5: 'chord:ear-m7b5' }
/** What each heard kind is reviewed against: the kinds learned by the time it's taught. */
const EAR_SET: Partial<Record<ChordKind, ChordKind[]>> = { maj7: ['maj7', '7'], '7': ['maj7', '7'], m7: ['maj7', '7', 'm7'], m7b5: SEVENTHS }
const degreeFact = (value: string) => (/^[1-7]$/.test(value) ? Number(value) - 1 : null)

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function chordItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'chd': {
      const c = parseChordId(value)
      return (c && KIND_ITEM[c.kind]) ?? null
    }
    case 'chq':
      return isOneOf(value, CHORD_KINDS) ? (SEVENTHS.includes(value) ? 'chord:seventh-which' : (KIND_ITEM[value] ?? null)) : null
    case 'csym':
      return isOneOf(value, CHORD_KINDS) ? (value === 'dim' || value === 'aug' ? 'chord:dim-aug-symbols' : 'chord:symbols') : null
    case 'h7':
      return value === 'two-five' ? 'chord:key7-two-five' : degreeFact(value) !== null ? 'chord:key7-stack' : null
    case 'diag':
      return OPEN_MAJORS.includes(value) ? 'chord:open-major' : OPEN_MINORS.includes(value) ? 'chord:open-minor' : null
    case 'caged':
      return value === 'order' ? 'chord:caged-order' : isOneOf(value, CAGED_ORDER) ? 'chord:caged-name' : null
    case 'ear':
      return isOneOf(value, CHORD_KINDS) ? (EAR_ITEM[value] ?? null) : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function chordCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const roots = l.keys ?? []
  const keys = l.keys ?? ['C', 'G']
  const shapes = l.shapes ?? []
  const even = turn % 2 === 0
  switch (item) {
    case 'chord:symbols':
      return even ? makeSymbolRead(id, roots, ['maj', 'min'], rng) : makeSymbolWrite(id, roots, ['maj', 'min'], rng)
    case 'chord:dim-aug-symbols': {
      const focus = pick<ChordKind>(['dim', 'aug'], rng)
      return even ? makeSymbolRead(id, roots, TRIADS, rng, focus) : makeSymbolWrite(id, roots, TRIADS, rng, focus)
    }
    case 'chord:symbol-spell':
      return makeChordSpell(id, roots, TRIADS, rng)
    case 'chord:maj7':
      return makeChordSpell(id, roots, ['maj7'], rng)
    case 'chord:dom7':
      return makeChordSpell(id, roots, ['7'], rng)
    case 'chord:m7':
      return makeChordSpell(id, roots, ['m7'], rng)
    case 'chord:m7b5':
      return makeChordSpell(id, roots, ['m7b5'], rng)
    case 'chord:seventh-which':
      return makeChordKind(id, roots, SEVENTHS, rng)
    case 'chord:key7-stack':
      return makeSeventhOnDegree(id, keys, rng)
    case 'chord:key7-numerals':
      return makeSeventhNumeral(id, keys, rng)
    case 'chord:key7-dominant':
      return even ? makeSeventhOnDegree(id, keys, rng, 4) : makeSeventhNumeral(id, keys, rng, 4)
    case 'chord:key7-two-five':
      return makeTwoFiveSpell(id, keys, rng)
    case 'chord:sus':
      return even ? makeChordSpell(id, roots, ['sus2', 'sus4'], rng) : makeChordKind(id, roots, ['sus2', 'sus4'], rng)
    case 'chord:add9':
      return even ? makeChordSpell(id, roots, ['add9'], rng) : makeChordKind(id, roots, ['add9'], rng)
    case 'chord:six':
      return even ? makeChordSpell(id, roots, ['6', 'm6'], rng) : makeChordKind(id, roots, ['6', 'm6'], rng)
    case 'chord:open-major':
      return makeDiagramName(id, shapes.length ? shapes : OPEN_MAJORS, rng)
    case 'chord:open-minor':
      return makeDiagramName(id, shapes.length ? shapes : [...OPEN_MINORS, ...OPEN_MAJORS], rng, pick(OPEN_MINORS, rng))
    case 'chord:roles':
      return makeDiagramRole(id, shapes, rng)
    case 'chord:caged-move':
      return makeCagedChord(id, ['E', 'A'], rng)
    case 'chord:caged-order':
      return even ? makeCagedNext(id, rng) : makeCagedShape(id, CAGED_ORDER, rng)
    case 'chord:caged-name':
      return even ? makeCagedChord(id, CAGED_ORDER, rng) : makeCagedShape(id, CAGED_ORDER, rng)
    case 'chord:ear-maj-dom':
      return makeSeventhHear(id, ['maj7', '7'], ['up'], rng)
    case 'chord:ear-m7':
      return makeSeventhHear(id, ['maj7', '7', 'm7'], ['up', 'together'], rng, even ? 'm7' : undefined)
    case 'chord:ear-m7b5':
      return makeSeventhHear(id, SEVENTHS, ['up', 'together'], rng, even ? 'm7b5' : undefined)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function chordReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'chd': {
      const c = parseChordId(value)
      return c && !isTriad(c.kind) && everyday(chordTones(parseTone(c.root), c.kind)) ? makeChordSpell(id, [], [c.kind], rng, c) : null
    }
    case 'chq':
      return isOneOf(value, CHORD_KINDS) && !isTriad(value) ? makeChordKind(id, [], [value], rng, value) : null
    case 'csym':
      if (!isOneOf(value, CHORD_KINDS)) return null
      return rng() < 0.5 ? makeSymbolRead(id, [], FAMILY[value], rng, value) : makeSymbolWrite(id, [], FAMILY[value], rng, value)
    case 'h7': {
      if (value === 'two-five') return makeTwoFiveSpell(id, REVIEW_KEYS, rng)
      const d = degreeFact(value)
      return d === null ? null : rng() < 0.5 ? makeSeventhOnDegree(id, REVIEW_KEYS, rng, d) : makeSeventhNumeral(id, REVIEW_KEYS, rng, d)
    }
    case 'diag':
      if (!Object.hasOwn(OPEN_CHORDS, value)) return null
      return rng() < 0.5 ? makeDiagramName(id, [...OPEN_MAJORS, ...OPEN_MINORS], rng, value) : makeDiagramRole(id, [value], rng, value)
    case 'caged':
      if (value === 'order') return makeCagedNext(id, rng)
      if (!isOneOf(value, CAGED_ORDER)) return null
      return rng() < 0.5 ? makeCagedShape(id, CAGED_ORDER, rng, value) : makeCagedChord(id, CAGED_ORDER, rng, value)
    case 'ear':
      return isOneOf(value, SEVENTHS) ? makeSeventhHear(id, EAR_SET[value]!, ['up', 'together'], rng, value) : null
    default:
      return null
  }
}

/** "G7 (dominant 7th)", "The A shape"; null if it isn't one of these facts. */
export function describeChordFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'chd': {
      const c = parseChordId(value)
      return c ? `${chordSymbol(parseTone(c.root), c.kind)} (${CHORD_NAMES[c.kind]})` : null
    }
    case 'chq':
      return isOneOf(value, CHORD_KINDS) ? `Spotting ${CHORD_NAMES[value]} chords` : null
    case 'csym':
      return isOneOf(value, CHORD_KINDS) ? `The symbol for ${CHORD_NAMES[value]}` : null
    case 'h7': {
      if (value === 'two-five') return 'ii7–V7–Imaj7'
      const d = degreeFact(value)
      return d === null ? null : `The 7th chord on the ${degreeName(d + 1)} note`
    }
    case 'diag':
      return Object.hasOwn(OPEN_CHORDS, value) ? `The ${value} chord diagram` : null
    case 'caged':
      return value === 'order' ? 'The CAGED order' : isOneOf(value, CAGED_ORDER) ? `The CAGED ${value} shape` : null
    case 'ear':
      return isOneOf(value, SEVENTHS) ? `${capitalize(CHORD_NAMES[value])} chords by ear` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const chord = (root: string, kind: ChordKind) => chordTones(parseTone(root), kind)!
/** Chords to hear one after another, each played together. */
const chordsHeard = (size: number, ...chords: Tone[][]) => ({ notes: chords.flatMap((c) => triadSound(c)), chord: size })
const stacked = (...chords: Tone[][]) => [chords.flatMap((c) => triadScore(c, true))]
const C_MAJOR_SEVENTHS = keySevenths('C')
const G_MAJOR_SEVENTHS = keySevenths('G')
/** One chord per measure, so their names have room underneath. */
const roleDiagram = (name: string): DiagramSpec => {
  const c = OPEN_CHORDS[name]
  const tones = chordTones(c.root, c.kind)!
  const roles = shapeRoles(c.shape, tones)
  return { ...namedDiagram(c.shape, tones), dots: roles.map((r) => (r < 0 ? null : ROLE_LABELS[r])) }
}
const fingerDiagram = (shape: ChordShape, root: Tone): DiagramSpec => ({
  shape,
  roots: shapeRoles(shape, chordTones(root, 'maj')!).flatMap((r, s) => (r === 0 ? [s] : [])),
})

const CHORD_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'chord:symbols-why': () => ({
    title: 'Why chord symbols',
    subtitle: 'Chords written above the words',
    hook: 'Songbooks and chord charts don’t write chords out note by note. They print a short symbol above the lyrics, like C or Am, and you play that chord until the next one. Reading symbols is how most guitarists learn songs.',
    onGuitar: 'A whole song’s chords can fit on one line: C · Am · F · G.',
    score: { measures: chordMeasures(chord('C', 'maj'), chord('A', 'min'), chord('F', 'maj'), chord('G', 'maj')), labels: ['C', 'Am', 'F', 'G'] },
    listen: chordsHeard(3, chord('C', 'maj'), chord('A', 'min'), chord('F', 'maj'), chord('G', 'maj')),
    sound: [],
  }),
  'chord:symbols': () => ({
    title: 'Letters and m',
    subtitle: 'Major and minor',
    hook: 'A letter on its own means a major chord: C is C major. Add a small m and it’s minor: Cm is C minor, Am is A minor. The letter is always the root, the note the chord is named after.',
    onGuitar: 'You’ll sometimes see “min” or “−” instead of m. They all mean minor.',
    score: { measures: chordMeasures(chord('C', 'maj'), chord('C', 'min')), labels: ['C', 'Cm'] },
    listen: chordsHeard(3, chord('C', 'maj'), chord('C', 'min')),
    sound: [],
  }),
  'chord:dim-aug-symbols': () => ({
    title: '° and +',
    subtitle: 'Diminished and augmented',
    hook: 'A small circle means diminished: B° is B diminished (sometimes written Bdim). A plus sign means augmented: C+ is C augmented (or Caug).',
    score: { measures: chordMeasures(chord('B', 'dim'), chord('C', 'aug')), labels: ['B°', 'C+'] },
    listen: chordsHeard(3, chord('B', 'dim'), chord('C', 'aug')),
    sound: [],
  }),
  'chord:symbol-spell': () => ({
    title: 'From symbol to notes',
    subtitle: 'Root first, then the kind',
    hook: 'To spell a chord from its symbol, read the root, then the kind, and build it the way you did on tapes 33 to 35. F♯m: the root is F♯ and the chord is minor, so up a minor 3rd is A, and up a major 3rd from there is C♯: F♯ A C♯.',
    score: { measures: chordMeasures(chord('F#', 'min')), labels: ['F♯m'] },
    board: triadBoard(chord('F#', 'min')),
    sound: triadSound(chord('F#', 'min')),
  }),
  'chord:seventh-what': () => ({
    title: '7th chords',
    subtitle: 'One more 3rd on top',
    hook: 'Stack one more 3rd on top of a triad and you get a 7th chord: four notes, the root, 3rd, 5th and 7th. The new note is a 7th above the root. 7th chords sound richer than triads, and they’re everywhere in jazz, blues, soul and pop.',
    onGuitar: 'Many chords you’ll play have a 7th version a finger away, like G and G7.',
    score: { measures: chordMeasures(chord('C', 'maj'), chord('C', 'maj7')), labels: ['C', 'Cmaj7'] },
    listen: chordsHeard(4, [...chord('C', 'maj'), parseTone('C')], chord('C', 'maj7')),
    sound: [],
  }),
  'chord:maj7': () => ({
    title: 'Major 7th',
    subtitle: 'Cmaj7: C E G B',
    hook: 'A major triad with a major 7th on top, a half step below the octave, is a major 7th chord: C E G B, written Cmaj7 (sometimes CΔ7 or CM7). It sounds soft and dreamy.',
    score: { measures: chordMeasures(chord('C', 'maj7')), labels: ['Cmaj7'] },
    board: triadBoard(chord('C', 'maj7')),
    sound: triadSound(chord('C', 'maj7')),
  }),
  'chord:dom7': () => ({
    title: 'Dominant 7th',
    subtitle: 'G7: G B D F',
    hook: 'A major triad with a minor 7th on top, a whole step below the octave, is a dominant 7th: G B D F, written just G7. It sounds bluesy and restless, as if it wants to move on. A symbol with only a 7 always means this one.',
    onGuitar: 'Blues lives on dominant 7ths: a 12-bar blues can use one on every chord.',
    score: { measures: chordMeasures(chord('G', '7')), labels: ['G7'] },
    board: triadBoard(chord('G', '7')),
    sound: triadSound(chord('G', '7')),
  }),
  'chord:m7': () => ({
    title: 'Minor 7th',
    subtitle: 'Am7: A C E G',
    hook: 'A minor triad with a minor 7th on top is a minor 7th chord: A C E G, written Am7. It sounds mellow and smooth, softer than a plain minor chord.',
    score: { measures: chordMeasures(chord('A', 'm7')), labels: ['Am7'] },
    board: triadBoard(chord('A', 'm7')),
    sound: triadSound(chord('A', 'm7')),
  }),
  'chord:m7b5': () => ({
    title: 'Half-diminished',
    subtitle: 'Bm7♭5: B D F A',
    hook: 'A diminished triad with a minor 7th on top is half-diminished: B D F A, written Bm7♭5 (said “B minor 7 flat 5”), or Bø7. It sounds dark and tense.',
    score: { measures: chordMeasures(chord('B', 'm7b5')), labels: ['Bm7♭5'] },
    board: triadBoard(chord('B', 'm7b5')),
    sound: triadSound(chord('B', 'm7b5')),
  }),
  'chord:seventh-which': () => ({
    title: 'Which 7th?',
    subtitle: 'Check the triad, then the 7th',
    hook: 'To name a 7th chord, look at its triad first, then at its 7th: a major 7th is a half step below the octave, a minor 7th a whole step below. Major triad + major 7th = maj7. Major + minor 7th = 7. Minor + minor 7th = m7. Diminished + minor 7th = m7♭5.',
    score: { measures: chordMeasures(chord('C', 'maj7'), chord('C', '7'), chord('C', 'm7'), chord('C', 'm7b5')), labels: ['Cmaj7', 'C7', 'Cm7', 'Cm7♭5'] },
    listen: chordsHeard(4, chord('C', 'maj7'), chord('C', '7'), chord('C', 'm7'), chord('C', 'm7b5')),
    sound: [],
  }),
  'chord:key7-stack': () => ({
    title: '7th chords in a key',
    subtitle: 'Four notes on every scale note',
    hook: 'Stack four notes of the scale on each of its notes, and every major key gives the same seven 7th chords. In C major: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7 and Bm7♭5. The pattern: maj7, m7, m7, maj7, 7, m7, m7♭5.',
    score: { measures: stacked(...C_MAJOR_SEVENTHS.map((c) => c.tones)), labels: C_MAJOR_SEVENTHS.map((c) => chordSymbol(c.tones[0], c.kind)) },
    listen: chordsHeard(4, ...C_MAJOR_SEVENTHS.map((c) => c.tones)),
    sound: [],
  }),
  'chord:key7-numerals': () => ({
    title: 'Numerals with 7ths',
    subtitle: 'Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7',
    hook: 'Numerals work the same way, with the kind of 7th written after: Imaj7, ii7, iii7, IVmaj7, V7, vi7 and viiø7 (the ø means half-diminished). In G major, ii7 is Am7 and V7 is D7.',
    score: { measures: stacked(...G_MAJOR_SEVENTHS.map((c) => c.tones)), keySig: 'G', labels: SEVENTH_NUMERALS },
    listen: chordsHeard(4, ...G_MAJOR_SEVENTHS.map((c) => c.tones)),
    sound: [],
  }),
  'chord:key7-dominant': () => ({
    title: 'V7',
    subtitle: 'The strongest pull home',
    hook: 'Only one chord in a major key is a dominant 7th: V7, G7 in C major. Its 3rd and 7th, B and F, are a tritone apart, and that tension wants to settle, so V7 pulls home to I harder than any other chord. Press ▶ Hear: G7, then C.',
    score: { measures: chordMeasures(chord('G', '7'), chord('C', 'maj')), labels: ['V7', 'I'] },
    listen: chordsHeard(4, chord('G', '7'), [...chord('C', 'maj'), parseTone('C')]),
    sound: [],
  }),
  'chord:key7-two-five': () => ({
    title: 'ii7–V7–Imaj7',
    subtitle: 'The jazz cadence',
    hook: 'Add 7ths to the ii–V–I from tape 43 and you get the most common move in jazz: Dm7, G7, Cmaj7 in C major. Each chord leads smoothly into the next.',
    score: { measures: chordMeasures(chord('D', 'm7'), chord('G', '7'), chord('C', 'maj7')), labels: ['ii7', 'V7', 'Imaj7'] },
    listen: chordsHeard(4, chord('D', 'm7'), chord('G', '7'), chord('C', 'maj7')),
    sound: [],
  }),
  'chord:sus': () => ({
    title: 'Sus chords',
    subtitle: 'The 3rd swapped out',
    hook: 'A sus chord swaps the 3rd for a neighbor: the 4th in a sus4 (C F G), or the 2nd in a sus2 (C D G). With no 3rd, it’s neither major nor minor; it sounds open and unresolved, and often moves back to the plain chord. Press ▶ Hear: Csus4, then C.',
    onGuitar: 'Adding or lifting one finger on an open D or A chord turns it into a sus chord: a classic guitar move.',
    score: { measures: chordMeasures(chord('C', 'sus4'), chord('C', 'maj'), chord('C', 'sus2')), labels: ['Csus4', 'C', 'Csus2'] },
    listen: chordsHeard(3, chord('C', 'sus4'), chord('C', 'maj'), chord('C', 'sus2')),
    sound: [],
  }),
  'chord:add9': () => ({
    title: 'Add9',
    subtitle: 'A note added on top',
    hook: 'An add9 chord keeps the whole triad and adds the 9th: the 2nd note of the scale, an octave up. Cadd9 is C E G with a D on top. It sounds bright and full.',
    onGuitar: 'Cadd9 is a favorite in acoustic pop: on guitar it’s a C chord with one finger moved.',
    score: { measures: chordMeasures(chord('C', 'maj'), chord('C', 'add9')), labels: ['C', 'Cadd9'] },
    listen: chordsHeard(4, [...chord('C', 'maj'), parseTone('C')], chord('C', 'add9')),
    sound: [],
  }),
  'chord:six': () => ({
    title: '6 chords',
    subtitle: 'Add the 6th',
    hook: 'A 6 chord adds the 6th note of the scale to a triad: C6 is C E G A, and Cm6 is C E♭ G A. It sounds sweet and a little old-fashioned, like swing and early rock and roll.',
    score: { measures: chordMeasures(chord('C', '6'), chord('C', 'm6')), labels: ['C6', 'Cm6'] },
    listen: chordsHeard(4, chord('C', '6'), chord('C', 'm6')),
    sound: [],
  }),
  'chord:diagram-read': () => ({
    title: 'Chord diagrams',
    subtitle: 'The neck, standing up',
    hook: 'Chord diagrams stand the neck up: low E on the left, the nut at the top. Dots are where your fingers go, numbered by finger; ○ means play the string open, × means leave it out.',
    diagram: { shape: OPEN_CHORDS.C.shape },
    sound: strum(OPEN_CHORDS.C.shape),
  }),
  'chord:open-major': () => ({
    title: 'Open major chords',
    subtitle: 'C, A, G, E and D',
    hook: 'The five open major chords are the first most guitarists learn: C, A, G, E and D. Each rings open strings, and each holds just the three notes of its triad, some of them twice. Here’s G: G B D, with G played three times.',
    diagram: namedDiagram(OPEN_CHORDS.G.shape, chord('G', 'maj')),
    sound: strum(OPEN_CHORDS.G.shape),
  }),
  'chord:open-minor': () => ({
    title: 'Open minor chords',
    subtitle: 'Am, Em and Dm',
    hook: 'Am, Em and Dm are the open minor chords. Each is its major chord with the 3rd moved down one fret: from E to Em, the G♯ on the 3rd string becomes the open G.',
    diagram: namedDiagram(OPEN_CHORDS.Em.shape, chord('E', 'min')),
    sound: strum(OPEN_CHORDS.Em.shape),
  }),
  'chord:roles': () => ({
    title: 'Root, 3rd and 5th',
    subtitle: 'Every dot has a job',
    hook: 'Each dot in a chord shape is the root, the 3rd or the 5th. In the open C chord: C (the root) on the 5th string, E (the 3rd) on the 4th, the open G (the 5th), C again on the 2nd string and the open E on top.',
    onGuitar: 'Knowing which dot is which helps you change chords quickly, and build new ones from shapes you know.',
    diagram: roleDiagram('C'),
    sound: strum(OPEN_CHORDS.C.shape),
  }),
  'chord:caged-why': () => ({
    title: 'Why CAGED',
    subtitle: 'Five shapes cover the neck',
    hook: 'Each open major chord, C, A, G, E and D, is also a shape you can slide up the neck. Line the five shapes up and they cover the whole neck, for any chord. Their order up the neck spells the name: CAGED.',
    onGuitar: 'It’s the bigger version of the three-string triad shapes from tape 38: the same notes, more strings.',
    diagram: fingerDiagram(movedShape('A', 3), parseTone('C')),
    sound: strum(movedShape('A', 3)),
  }),
  'chord:caged-move': () => ({
    title: 'Moving a shape',
    subtitle: 'The open strings become a barre',
    hook: 'Slide an open chord shape up the neck and the open strings have to move too, so your first finger presses them all at once: a barre. The E shape slid up one fret is F; slid up three frets, it’s G. The root moves with the shape, and its note names the chord.',
    diagram: fingerDiagram(movedShape('E', 1), parseTone('F')),
    sound: strum(movedShape('E', 1)),
  }),
  'chord:caged-order': () => ({
    title: 'The CAGED order',
    subtitle: 'C, A, G, E, D, and round again',
    hook: 'Going up the neck, the shapes always come in the same order: C, A, G, E, D, and then C again, each sharing notes with the next. For a C chord: the C shape at the open position, the A shape at the 3rd fret, the G shape at the 5th, the E shape at the 8th and the D shape at the 10th.',
    diagram: fingerDiagram(movedShape('A', 3), parseTone('C')),
    sound: strum(movedShape('A', 3)),
  }),
  'chord:caged-name': () => ({
    title: 'Naming a shape',
    subtitle: 'Find the root',
    hook: 'To name a shape anywhere on the neck, find its root. In the E and G shapes it’s on the low E string, in the C and A shapes on the A string, and in the D shape on the D string. The note at that fret names the chord: an A shape with its root at the 5th fret is D major.',
    diagram: fingerDiagram(movedShape('A', 5), parseTone('D')),
    sound: strum(movedShape('A', 5)),
  }),
  'chord:ear-why': () => ({
    title: 'Why hear 7th chords',
    subtitle: 'The color of jazz and blues',
    hook: '7th chords give music its color: dreamy in jazz ballads, bluesy in the blues, mellow in soul. Telling them apart by ear helps you work out songs that go beyond plain major and minor. Press ▶ Hear: Cmaj7, then C7.',
    score: { measures: chordMeasures(chord('C', 'maj7'), chord('C', '7')), labels: ['Cmaj7', 'C7'] },
    listen: chordsHeard(4, chord('C', 'maj7'), chord('C', '7')),
    sound: [],
  }),
  'chord:ear-maj-dom': () => ({
    title: 'Major or dominant',
    subtitle: 'Dreamy or bluesy',
    hook: 'Both start with a major triad. The major 7th adds a note a half step below the octave: soft and dreamy. The dominant 7th adds one a whole step below: bluesy and restless, wanting to move. Listen to the top note. Here: Cmaj7, then C7.',
    score: { measures: chordMeasures(chord('C', 'maj7'), chord('C', '7')), labels: ['Cmaj7', 'C7'] },
    listen: { notes: [...triadSound(chord('C', 'maj7')), ...triadSound(chord('C', '7'))] },
    sound: [],
  }),
  'chord:ear-m7': () => ({
    title: 'Minor 7th',
    subtitle: 'Mellow',
    hook: 'A minor 7th starts from a minor triad, so it’s darker than the other two, but its 7th softens it: mellow and smooth. Here: C7, then Cm7.',
    score: { measures: chordMeasures(chord('C', '7'), chord('C', 'm7')), labels: ['C7', 'Cm7'] },
    listen: chordsHeard(4, chord('C', '7'), chord('C', 'm7')),
    sound: [],
  }),
  'chord:ear-m7b5': () => ({
    title: 'Half-diminished',
    subtitle: 'Dark and tense',
    hook: 'Half-diminished lowers the 5th of a minor 7th, and the whole chord darkens and tightens. Here: Cm7, then Cm7♭5.',
    score: { measures: chordMeasures(chord('C', 'm7'), chord('C', 'm7b5')), labels: ['Cm7', 'Cm7♭5'] },
    listen: chordsHeard(4, chord('C', 'm7'), chord('C', 'm7b5')),
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function chordCard(item: string, counter: string): Card {
  return { ...CHORD_CARDS[item](), counter }
}
