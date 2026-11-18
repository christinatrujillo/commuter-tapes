import type { Card } from './rehearsal'
import type { Marker } from '../components/Fretboard'
import type { LessonSpec } from '../music/curriculum'
import { ALL_STRINGS, allPositions, describePosition, isNatural, midiAt, ordinal, pitchClass, samePos, spellMidi, stringName, type Position, type Region } from '../music/notes'
import type { ScoreMeasure } from '../music/score'
import {
  CHORD_NAMES,
  chordDegrees,
  chordIntervals,
  chordSymbol,
  chordTones,
  degreeName,
  intervalName,
  RARE_SPELLINGS,
  spelled,
  toneName,
  tonePc,
  type ChordKind,
  type Tone,
} from '../music/theory'
import { pick, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { andList, aOrAn, capitalize } from '../lib/text'
import type { Question } from './questions'

/**
 * Arpeggio shapes: a chord's notes picked out of a major scale pattern's position (tape 25), with
 * the root on the low E or A string. Completing a shape, naming one from its notes, and adding
 * the 7th to a triad's shape.
 */

const TRIADS: ChordKind[] = ['maj', 'min', 'dim', 'aug']
const SEVENTHS: ChordKind[] = ['maj7', '7', 'm7', 'm7b5']
/** The chords these tapes play as shapes: major and minor, and the four 7th chords. */
const SHAPE_KINDS: ChordKind[] = ['maj', 'min', ...SEVENTHS]
/** The triad each 7th chord adds its 7th to. */
const TRIAD_OF: Partial<Record<ChordKind, ChordKind>> = { maj7: 'maj', '7': 'maj', m7: 'min', m7b5: 'dim' }
const known = (kinds: string[], pool: ChordKind[]) => {
  const own = kinds.filter((k): k is ChordKind => isOneOf(k, pool))
  return own.length ? own : pool.slice(0, 1)
}
/** "G major", "Gm", "G7": how guitarists name an arpeggio. */
const arpName = (root: Tone, kind: ChordKind) => (kind === 'maj' ? `${toneName(root)} major` : chordSymbol(root, kind))
const ascending = (notes: Position[]) => notes.map(midiAt).sort((a, b) => a - b)
/** "the root", "the 3rd", "the ♭7": a degree as the dots label it. */
const degreeWords = (degree: string) => (degree === '1' ? 'the root' : /^\d$/.test(degree) ? `the ${degreeName(Number(degree))}` : `the ${degree}`)
/** "the D string’s 3rd fret" */
const spotWords = (p: Position) => `the ${stringName(p.string)} string’s ${ordinal(p.fret)} fret`
/** A natural note's name at a spot. */
const toneAt = (p: Position): Tone => {
  const { letter, acc } = spellMidi(midiAt(p), 'sharp')
  return { letter, acc }
}

/**
 * Where a shape can start: natural notes from the 2nd fret to the 8th of the root's string, so
 * the whole position fits on the neck and the chord spells plainly (no B♯ or C♭).
 */
function rootSpots(rootStrings: number[], kind: ChordKind): Position[] {
  const strings = rootStrings.filter((s) => s <= 1)
  return (strings.length ? strings : [0, 1]).flatMap((string) =>
    Array.from({ length: 7 }, (_, i) => ({ string, fret: i + 2 })).filter((p) => {
      const tones = isNatural(pitchClass(midiAt(p))) ? chordTones(toneAt(p), kind) : null
      return !!tones && tones.every((t) => !RARE_SPELLINGS.has(toneName(t)))
    }),
  )
}

/** A chord's notes in the major scale pattern's position: from a fret below the root to three above, on every string. */
function shapeAt(root: Position, kind: ChordKind) {
  const tones = chordTones(toneAt(root), kind)!
  const pcs = tones.map(tonePc)
  const region: Region = { strings: ALL_STRINGS, minFret: root.fret - 1, maxFret: root.fret + 3 }
  const notes = allPositions(region).filter((p) => pcs.includes(pitchClass(midiAt(p))))
  const toneOf = (p: Position) => pcs.indexOf(pitchClass(midiAt(p)))
  const degreeOf = (p: Position) => chordDegrees(kind)[toneOf(p)]
  return { root, tones, region, notes, toneOf, degreeOf, name: arpName(tones[0], kind) }
}
type Shape = ReturnType<typeof shapeAt>

/** A shape's dots: the roots lit, each labeled with its degree (1, 3, 5, ♭7) if `labeled`. */
const dots = (shape: Shape, notes: Position[], labeled: boolean, lit = (p: Position) => shape.toneOf(p) === 0) =>
  notes.map((p): Marker => ({ pos: p, tone: lit(p) ? (shape.toneOf(p) === 0 ? 'root' : 'target') : 'note', ...(labeled ? { label: shape.degreeOf(p) } : {}) }))

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** An arpeggio shape with one note gone: tap where it goes, on the string named. */
export function makeArpMissing(id: number, kinds: string[], rootStrings: number[], rng: Rng, only?: ChordKind): Question {
  const kind = only ?? pick(known(kinds, SHAPE_KINDS), rng)
  const shape = shapeAt(pick(rootSpots(rootStrings, kind), rng), kind)
  const hidden = pick(shape.notes.filter((p) => shape.toneOf(p) !== 0), rng)
  const shown = shape.notes.filter((p) => !samePos(p, hidden))
  const onString = shape.notes.filter((p) => p.string === hidden.string).map(shape.degreeOf)
  const missing = shape.degreeOf(hidden)
  const note = toneName(shape.tones[shape.toneOf(hidden)])
  return {
    id,
    kind: 'arpMissing',
    ask: { text: `Tap the missing note of this ${shape.name} arpeggio, on the ${stringName(hidden.string)} string`, hl: `${shape.name} arpeggio` },
    region: shape.region,
    markers: dots(shape, shown, true),
    from: shape.root,
    targets: [hidden],
    label: missing,
    why:
      onString.length > 1
        ? `On the ${stringName(hidden.string)} string, this shape has ${andList(onString.map(degreeWords))}, so the missing one is ${degreeWords(missing)}, ${note}: ${describePosition(hidden)}.`
        : `On the ${stringName(hidden.string)} string, this shape has just one note, ${degreeWords(missing)}, ${note}: ${describePosition(hidden)}.`,
    sound: ascending(shape.notes),
    facts: [`arpshape:${kind}`],
  }
}

/** An arpeggio shape, roots lit: which chord is it? */
export function makeArpName(id: number, kinds: string[], rootStrings: number[], rng: Rng, only?: ChordKind): Question {
  const kind = only ?? pick(known(kinds, SHAPE_KINDS), rng)
  const shape = shapeAt(pick(rootSpots(rootStrings, kind), rng), kind)
  // The choices are its family on the same root, in the Fretboard tab's order: the four triads, or the four 7th chords.
  const family = SEVENTHS.includes(kind) ? SEVENTHS : TRIADS
  const root = shape.tones[0]
  const intervals = chordIntervals(kind).map((iv) => `${aOrAn(intervalName(iv))} ${intervalName(iv)}`)
  return {
    id,
    kind: 'arpName',
    ask: { text: 'Which arpeggio is this?' },
    options: family.map((k) => chordSymbol(root, k)),
    answer: family.indexOf(kind),
    why: `From the root, it has ${andList(intervals)}: that’s ${shape.name}, ${spelled(shape.tones)}.`,
    board: { region: shape.region, markers: dots(shape, shape.notes, false), after: dots(shape, shape.notes, true) },
    sound: ascending(shape.notes),
    facts: [`arpname:${kind}`],
  }
}

/** A triad's arpeggio shape: tap a note that makes it a 7th chord. */
export function makeArpSeventh(id: number, kinds: string[], rootStrings: number[], rng: Rng, only?: ChordKind): Question | null {
  const seventh = only && SEVENTHS.includes(only) ? only : pick(known(kinds, SEVENTHS), rng)
  const triad = TRIAD_OF[seventh]!
  const shape = shapeAt(pick(rootSpots(rootStrings, seventh), rng), triad)
  const full = chordTones(shape.tones[0], seventh)!
  const targets = allPositions(shape.region).filter((p) => pitchClass(midiAt(p)) === tonePc(full[3]))
  if (!targets.length) return null
  const major = seventh === 'maj7'
  const symbol = chordSymbol(full[0], seventh)
  return {
    id,
    kind: 'arpSeventh',
    ask: { text: `Tap a note that turns this ${shape.name} arpeggio into ${symbol}`, hl: symbol },
    region: shape.region,
    markers: dots(shape, shape.notes, true),
    from: shape.root,
    targets,
    label: chordDegrees(seventh)[3],
    why: `${symbol} adds ${major ? 'a major 7th' : 'a minor 7th'}, ${toneName(full[3])}, ${major ? 'a half step' : 'a whole step'} below the root. In this shape it’s at ${targets.map(spotWords).join(' or ')}.`,
    sound: ascending([...shape.notes, ...targets]),
    facts: [`arp7:${seventh}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const ARPEGGIO_ORDER = ['arp:why', 'arp:major', 'arp:minor', 'arp:a-string', 'arp:sevenths']
/** Explained on a card, not quizzed on their own. */
export const ARPEGGIO_INTRO = ['arp:why']

export const isArpeggioItem = (item: string) => item.startsWith('arp:')
/** Facts practiced on these tapes, per chord: its shape ("arpshape:min"), naming it from its shape ("arpname:m7"), and adding the 7th ("arp7:maj7"). */
export const isArpeggioFact = (fact: string) => /^(arpshape|arpname|arp7):/.test(fact)

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function arpeggioItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  if (!isOneOf(value, SHAPE_KINDS)) return null
  const seventh = SEVENTHS.includes(value)
  switch (kind) {
    case 'arpshape':
      return seventh ? 'arp:sevenths' : value === 'maj' ? 'arp:major' : 'arp:minor'
    case 'arpname':
      return seventh ? 'arp:sevenths' : 'arp:minor'
    case 'arp7':
      return seventh ? 'arp:sevenths' : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function arpeggioCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const kinds = l.chords ?? []
  const strings = l.rootStrings ?? []
  const even = turn % 2 === 0
  switch (item) {
    case 'arp:major':
      return makeArpMissing(id, ['maj'], strings, rng)
    case 'arp:minor':
      return even ? makeArpName(id, kinds, strings, rng) : makeArpMissing(id, ['min'], strings, rng)
    case 'arp:a-string':
      return even ? makeArpMissing(id, kinds, [1], rng) : makeArpName(id, kinds, [1], rng)
    case 'arp:sevenths':
      return even ? makeArpSeventh(id, kinds, strings, rng) : makeArpName(id, SEVENTHS, strings, rng)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function arpeggioReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  if (!isOneOf(value, SHAPE_KINDS)) return null
  switch (kind) {
    case 'arpshape':
      return makeArpMissing(id, [], [0, 1], rng, value)
    case 'arpname':
      return makeArpName(id, [], [0, 1], rng, value)
    case 'arp7':
      return SEVENTHS.includes(value) ? makeArpSeventh(id, [], [0, 1], rng, value) : null
    default:
      return null
  }
}

/** "The minor arpeggio shape", "Spotting a dominant 7th arpeggio"; null if it isn't one of these facts. */
export function describeArpeggioFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  if (!isOneOf(value, SHAPE_KINDS)) return null
  const name = CHORD_NAMES[value]
  switch (kind) {
    case 'arpshape':
      return `The ${name} arpeggio shape`
    case 'arpname':
      return `Spotting ${aOrAn(name)} ${name} arpeggio`
    case 'arp7':
      return SEVENTHS.includes(value) ? `${capitalize(name)} from its triad` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** G major from the low E string's 3rd fret, C major from the A string's: the two shapes. */
const G_MAJOR = shapeAt({ string: 0, fret: 3 }, 'maj')
const G_MINOR = shapeAt({ string: 0, fret: 3 }, 'min')
const G_SEVEN = shapeAt({ string: 0, fret: 3 }, '7')
const C_MAJOR = shapeAt({ string: 1, fret: 3 }, 'maj')
const board = (shape: Shape, lit?: (p: Position) => boolean): Card['board'] => ({ region: shape.region, markers: dots(shape, shape.notes, true, lit) })

/** G B D G, one note at a time. */
const G_ARPEGGIO: ScoreMeasure[] = [
  [
    { letter: 'G', octave: 4, dur: 'q' },
    { letter: 'B', octave: 4, dur: 'q' },
    { letter: 'D', octave: 5, dur: 'q' },
    { letter: 'G', octave: 5, dur: 'q' },
  ],
]

const ARPEGGIO_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'arp:why': () => ({
    title: 'Chords, one note at a time',
    subtitle: 'Why guitarists learn arpeggios',
    hook: 'An arpeggio is a chord played one note at a time: G B D, the notes of G major, picked in turn instead of strummed together. Arpeggios let a solo follow the chords. Play each chord’s notes while it lasts, and every note you land on fits. Press ▶\uFE0E Hear: G major strummed, then as an arpeggio.',
    score: { measures: G_ARPEGGIO, labels: ['G', 'B', 'D', 'G'] },
    listen: { home: [43, 50, 55, 59, 62, 67], notes: ascending(G_MAJOR.notes) },
    sound: [],
  }),
  'arp:major': () => ({
    title: 'The major arpeggio',
    subtitle: 'Root on the low E string',
    hook: 'Pick a chord’s notes out of the major scale pattern (tape 25) and you have its arpeggio shape. Here’s G major, from the 2nd fret to the 6th: each 1 is a G (lit), each 3 a B and each 5 a D. The shape moves: start it on any fret of the low E string and it plays that major arpeggio.',
    board: board(G_MAJOR),
    sound: ascending(G_MAJOR.notes),
  }),
  'arp:minor': () => ({
    title: 'The minor arpeggio',
    subtitle: 'Only the 3rds change',
    hook: 'G minor’s 3rd is B♭ instead of B, so only the 3rds change: in this position the ♭3s sit at the G string’s 3rd fret and the 6th fret of both E strings (lit). The 1s and 5s don’t move. Major or minor is all in the 3rd.',
    board: board(G_MINOR, (p) => G_MINOR.toneOf(p) === 1),
    sound: ascending(G_MINOR.notes),
  }),
  'arp:a-string': () => ({
    title: 'Root on the A string',
    subtitle: 'A second shape for every chord',
    hook: 'A second shape has its root on the A string: C major from the 2nd fret to the 6th, the roots lit. Like the first, it moves anywhere along its string. With both shapes, you can play any major or minor arpeggio in two places on the neck.',
    board: board(C_MAJOR),
    sound: ascending(C_MAJOR.notes),
  }),
  'arp:sevenths': () => ({
    title: 'Adding the 7th',
    subtitle: 'One more note for 7th chords',
    hook: 'A 7th arpeggio is a triad shape plus the chord’s 7th. A major 7th sits a half step below a root; a minor 7th, a whole step below. G7 adds F: here at the D string’s 3rd fret and the B string’s 6th (lit). So maj7 and 7 build on the major shape, m7 on the minor one, and m7♭5 on diminished.',
    board: board(G_SEVEN, (p) => G_SEVEN.toneOf(p) === 3),
    sound: ascending(G_SEVEN.notes),
  }),
}

/** The card that teaches an idea from these tapes. */
export function arpeggioCard(item: string, counter: string): Card {
  return { ...ARPEGGIO_CARDS[item](), counter }
}
