import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import { pitchClass } from '../music/notes'
import { keyLabel, type KeyId } from '../music/score'
import {
  chordSymbol,
  chordTones,
  degreeName,
  intervalAbove,
  keySevenths,
  keyTriads,
  majorScale,
  minorKeyTriads,
  minorScaleOn,
  NUMERALS,
  parseInterval,
  parseTone,
  RARE_SPELLINGS,
  scaleLabels,
  scaleScore,
  scaleSound,
  spelled,
  toneName,
  tonePc,
  type ChordKind,
  type Tone,
  type TriadQuality,
} from '../music/theory'
import { pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { marked, PAPER_HIGHLIGHT } from '../lib/color'
import { andList } from '../lib/text'
import { chordsScore, heard } from './harmony'
import { chordMeasures, triadSound } from './triads'
import type { Question } from './questions'

/**
 * Chord swaps: a key's chords in three families by the job they do (tonic, subdominant and
 * dominant), why chords in a family can stand in for each other (two notes in common), and
 * swapping them; then secondary dominants, the V7 of a chord other than I, chords borrowed from
 * the parallel minor, the tritone sub, jazz's swap for V7, and hearing each swap.
 */

type Family = 'tonic' | 'subdominant' | 'dominant'
const FAMILIES: Family[] = ['tonic', 'subdominant', 'dominant']
/** Each scale note's family, from I: I, iii and vi are tonic; ii and IV subdominant; V and vii° dominant. */
const FAMILY_OF: Family[] = ['tonic', 'subdominant', 'tonic', 'subdominant', 'dominant', 'tonic', 'dominant']
/** The chord each family is named for: I, IV and V. */
const HEAD: Record<Family, number> = { tonic: 0, subdominant: 3, dominant: 4 }
const FAMILY_LABELS: Record<Family, string> = { tonic: 'Tonic (home)', subdominant: 'Subdominant (away)', dominant: 'Dominant (tension)' }
/** Each chord's stand-in: the chord a 3rd away in its own family, which shares two of its notes (I and vi, IV and ii, V and vii°, iii and I). */
const STAND_IN = [5, 3, 0, 1, 6, 0, 4]
/** The pairs the shared-notes questions use, head first. */
const PAIRS: [number, number][] = [
  [0, 5],
  [0, 2],
  [3, 1],
  [4, 6],
]
const DEGREES = [0, 1, 2, 3, 4, 5, 6]
/** Chords a 3rd apart share two notes. */
const thirdApart = (a: number, b: number) => [2, 5].includes((b - a + 7) % 7)
const KEYS: KeyId[] = ['C', 'G', 'D', 'F', 'A', 'E', 'Bb']
const knownKeys = (keys: KeyId[]) => (keys.length ? keys : KEYS.slice(0, 4))
const symbolOf = (c: { tones: Tone[]; quality: TriadQuality }) => chordSymbol(c.tones[0], c.quality)
/** The notes of `a` that `b` has too, in `a`'s order. */
const shared = (a: Tone[], b: Tone[]) => a.filter((t) => b.some((u) => tonePc(u) === tonePc(t)))
const both = (tones: Tone[]) => `${toneName(tones[0])} and ${toneName(tones[1])}`
/** "IV and ii": a family's chords, the one it's named for first. */
const membersOf = (family: Family) => andList([HEAD[family], ...DEGREES.filter((d) => FAMILY_OF[d] === family && d !== HEAD[family])].map((d) => NUMERALS[d]))
const pairFact = ([a, b]: [number, number]) => `${NUMERALS[a]}-${NUMERALS[b]}`

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** "In C major, which family is Am in?" */
export function makeChordFamily(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const d = only ?? pick(DEGREES, rng)
  const chords = keyTriads(key)
  const family = FAMILY_OF[d]
  const head = HEAD[family]
  const name = symbolOf(chords[d])
  const where = `${name} is ${NUMERALS[d]} in ${keyLabel(key)} major`
  return {
    id,
    kind: 'chordFamily',
    ask: { text: `In ${keyLabel(key)} major, which family is ${name} in?`, hl: name },
    // Always in the same order: home, away, tension.
    options: FAMILIES.map((f) => FAMILY_LABELS[f]),
    answer: FAMILIES.indexOf(family),
    why:
      d === head
        ? `${where}, the chord the ${family} family is named for: ${membersOf(family)}.`
        : `${where}. It shares two notes with ${NUMERALS[head]}, ${both(shared(chords[d].tones, chords[head].tones))}, so it’s in the ${family} family: ${membersOf(family)}.`,
    score: { measures: [chordsScore(key, [d])], keySig: key, after: [NUMERALS[d]] },
    sound: heard(key, [d]).notes,
    facts: [`cfam:${d + 1}`],
  }
}

/** "Which two notes do F and Dm share?" */
export function makeChordShared(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const pair = PAIRS[only ?? pick([0, 1, 2, 3], rng)]
  const [d, s] = rng() < 0.5 ? pair : [pair[1], pair[0]]
  const chords = keyTriads(key)
  const [a, b] = [chords[d], chords[s]]
  const common = shared(a.tones, b.tones)
  const right = both(common)
  // The four notes between them, and every pair of them but the right one.
  const notes = [...a.tones, ...b.tones.filter((t) => !a.tones.some((u) => tonePc(u) === tonePc(t)))]
  const pairs = notes.flatMap((x, i) => notes.slice(i + 1).map((y) => both([x, y]))).filter((p) => p !== right)
  const options = shuffle([right, ...shuffle(pairs, rng).slice(0, 3)], rng)
  return {
    id,
    kind: 'chordShared',
    ask: { text: `Which two notes do ${symbolOf(a)} and ${symbolOf(b)} share?` },
    options,
    answer: options.indexOf(right),
    why: `${symbolOf(a)} is ${spelled(a.tones)} and ${symbolOf(b)} is ${spelled(b.tones)}: they share ${right}. In ${keyLabel(key)} major they’re ${NUMERALS[d]} and ${NUMERALS[s]}, in the ${FAMILY_OF[d]} family.`,
    score: { measures: [chordsScore(key, [d, s])], keySig: key },
    sound: heard(key, [d, s]).notes,
    facts: [`cshare:${pairFact(pair)}`],
  }
}

/** "In C major, which chord can stand in for F?" */
export function makeChordSwap(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const d = only ?? pick([0, 1, 3, 4, 5], rng)
  const s = STAND_IN[d]
  const chords = keyTriads(key)
  // Near misses: chords from the other families that don't share two notes with it.
  const wrong = shuffle(DEGREES.filter((x) => x !== d && FAMILY_OF[x] !== FAMILY_OF[d] && !thirdApart(d, x)), rng).slice(0, 3)
  const options = shuffle([s, ...wrong].map((x) => symbolOf(chords[x])), rng)
  const name = symbolOf(chords[d])
  const right = symbolOf(chords[s])
  return {
    id,
    kind: 'chordSwap',
    ask: { text: `In ${keyLabel(key)} major, which chord can stand in for ${name}?`, hl: name },
    options,
    answer: options.indexOf(right),
    why: `${name} is ${NUMERALS[d]}, in the ${FAMILY_OF[d]} family with ${right} (${NUMERALS[s]}). They share ${both(shared(chords[d].tones, chords[s].tones))}, so ${right} can take its place.`,
    score: { measures: [chordsScore(key, [d])], keySig: key },
    sound: heard(key, [d, s]).notes,
    facts: [`cswap:${d + 1}`],
  }
}

// ---------------------------------------------------------------------------
// Secondary dominants
// ---------------------------------------------------------------------------

/** The chords a secondary dominant can lead to: ii, iii, IV, V and vi (vii° is diminished, so it can't sound like home). */
const TARGETS = [1, 2, 3, 4, 5]
const plain = (tones: Tone[]) => tones.every((n) => !RARE_SPELLINGS.has(toneName(n)))

/** The V7 of the chord on scale note `t`: a dominant 7th a 5th above that chord's root. */
function secondaryOf(key: KeyId, t: number) {
  const target = keyTriads(key)[t]
  const root = intervalAbove(target.tones[0], parseInterval('P5'))!
  const tones = chordTones(root, '7')!
  const scale = majorScale(key).map(tonePc)
  return { target, tones, symbol: chordSymbol(root, '7'), numeral: `V7/${NUMERALS[t]}`, outside: tones.filter((n) => !scale.includes(tonePc(n))) }
}
/** The chords whose secondary dominant spells plainly in this key (D major's V7/iii would need a B♯). */
const targetsIn = (key: KeyId) => TARGETS.filter((t) => plain(secondaryOf(key, t).tones))
const targetFor = (pool: number[], rng: Rng, only?: number) => (only !== undefined && pool.includes(only) ? only : pick(pool, rng))
/** The ones with a single outside note, a half step below the chord they lead to (ii, V and vi). */
const leadingIn = (key: KeyId) =>
  targetsIn(key).filter((t) => {
    const s = secondaryOf(key, t)
    return s.outside.length === 1 && pitchClass(tonePc(s.outside[0]) + 1) === tonePc(s.target.tones[0])
  })
/** A chord in four voices (a triad doubles its root), so chords of three and four notes play in step. */
const fourNotes = (tones: Tone[]) => {
  const sound = triadSound(tones)
  return sound.length === 4 ? sound : [...sound, sound[0] + 12]
}
const chordsToHear = (...chords: Tone[][]) => ({ notes: chords.flatMap(fourNotes), chord: 4 })
/** A chord from its root and kind, for the cards: C, A7, Dm7. */
const chordOf = (id: string, kind: ChordKind) => chordTones(parseTone(id), kind)!
const numeralIndex = (value: string) => NUMERALS.indexOf(value)

/** "In C major, what's V7/ii?" */
export function makeSecondaryChord(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const t = targetFor(targetsIn(key), rng, only)
  const sec = secondaryOf(key, t)
  const right = sec.symbol
  // Near misses: the key's own 7th chord on the same root (one note off), the key's V7, then other secondary dominants.
  const own = keySevenths(key).find((c) => tonePc(c.tones[0]) === tonePc(sec.tones[0]))!
  const others = shuffle(targetsIn(key).filter((x) => x !== t), rng).map((x) => secondaryOf(key, x).symbol)
  const wrong = [...new Set([chordSymbol(own.tones[0], own.kind), chordSymbol(majorScale(key)[4], '7'), ...others])].filter((s) => s !== right).slice(0, 3)
  const options = shuffle([right, ...wrong], rng)
  const target = symbolOf(sec.target)
  return {
    id,
    kind: 'secondaryChord',
    ask: { text: `In ${keyLabel(key)} major, what’s ${sec.numeral}?`, hl: sec.numeral },
    options,
    answer: options.indexOf(right),
    why: `${sec.numeral} is the V7 of ${NUMERALS[t]}, ${target}. A 5th above ${toneName(sec.target.tones[0])} is ${toneName(sec.tones[0])}, so it’s ${right}: ${spelled(sec.tones)}.`,
    score: { measures: [[]], afterMeasures: chordMeasures(sec.tones, sec.target.tones), after: [right, target] },
    sound: [...fourNotes(sec.tones), ...fourNotes(sec.target.tones)],
    facts: [`secd:${NUMERALS[t]}`],
  }
}

/** "In C major, E7 leads to which chord?" */
export function makeSecondaryTarget(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const t = targetFor(targetsIn(key), rng, only)
  const sec = secondaryOf(key, t)
  const chords = keyTriads(key)
  const right = symbolOf(chords[t])
  // Near misses: the key's chord on its own root, home, the chord a 5th up instead of down, then the rest.
  const on = (pc: number) => chords.find((c) => tonePc(c.tones[0]) === pitchClass(pc))
  const near = [on(tonePc(sec.tones[0])), chords[0], on(tonePc(sec.tones[0]) + 7), ...shuffle(chords, rng)].filter((c): c is (typeof chords)[number] => !!c)
  const wrong = [...new Set(near.map(symbolOf))].filter((s) => s !== right).slice(0, 3)
  const options = shuffle([right, ...wrong], rng)
  return {
    id,
    kind: 'secondaryTarget',
    ask: { text: `In ${keyLabel(key)} major, ${sec.symbol} leads to which chord?`, hl: sec.symbol },
    options,
    answer: options.indexOf(right),
    why: `${sec.symbol} is ${sec.numeral}: its root, ${toneName(sec.tones[0])}, is a 5th above ${toneName(chords[t].tones[0])}. So it pulls down a 5th, to ${right}.`,
    score: { measures: [[]], afterMeasures: chordMeasures(sec.tones, chords[t].tones), after: [sec.symbol, right] },
    sound: [...fourNotes(sec.tones), ...fourNotes(chords[t].tones)],
    facts: [`secd:${NUMERALS[t]}`],
  }
}

/** "In C major, which note of E7 isn't in the key?" */
export function makeSecondaryNote(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const t = targetFor(leadingIn(key), rng, only)
  const sec = secondaryOf(key, t)
  const out = sec.outside[0]
  const inKey = majorScale(key).find((n) => n.letter === out.letter)!
  return {
    id,
    kind: 'secondaryNote',
    ask: { text: `In ${keyLabel(key)} major, which note of ${sec.symbol} isn’t in the key?`, hl: sec.symbol },
    // The chord's notes, root up.
    options: sec.tones.map(toneName),
    answer: sec.tones.indexOf(out),
    why: `${keyLabel(key)} major has ${toneName(inKey)}, not ${toneName(out)}. ${toneName(out)} is a half step below ${toneName(sec.target.tones[0])}, so ${sec.symbol} pulls up into ${symbolOf(sec.target)}.`,
    score: { measures: [[]], afterMeasures: chordMeasures(sec.tones, sec.target.tones), after: [sec.symbol, symbolOf(sec.target)] },
    sound: [...fourNotes(sec.tones), ...fourNotes(sec.target.tones)],
    facts: [`secn:${NUMERALS[t]}`],
  }
}

/** What follows the chord each secondary dominant leads to, so the progression comes back toward home. */
const AFTER = [-1, 4, 3, 4, 0, 3]

/** "In C major, which chord of C – E7 – Am – F is a secondary dominant?" */
export function makeSecondarySpot(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(knownKeys(keys), rng)
  const t = targetFor(targetsIn(key), rng, only)
  const sec = secondaryOf(key, t)
  const chords = keyTriads(key)
  const progression = [symbolOf(chords[0]), sec.symbol, symbolOf(chords[t]), symbolOf(chords[AFTER[t]])]
  const outside = sec.outside.map(toneName)
  return {
    id,
    kind: 'secondarySpot',
    ask: { text: `In ${keyLabel(key)} major, which chord of ${progression.join(' – ')} is a secondary dominant?`, hl: progression.join(' – ') },
    // Each chord once, in the order it comes.
    options: [...new Set(progression)],
    answer: [...new Set(progression)].indexOf(sec.symbol),
    why: `${sec.symbol} isn’t in ${keyLabel(key)} major: ${andList(outside)} ${outside.length > 1 ? 'are' : 'is'} outside the key. It’s ${sec.numeral}, leading to ${symbolOf(chords[t])}.`,
    sound: [chords[0].tones, sec.tones, chords[t].tones, chords[AFTER[t]].tones].flatMap(fourNotes),
    facts: [`secd:${NUMERALS[t]}`],
  }
}

// ---------------------------------------------------------------------------
// Borrowed chords
// ---------------------------------------------------------------------------

/** The chords most often borrowed from the parallel minor, by the minor scale note they sit on (from 0). */
const BORROWED = [
  { id: 'iv', degree: 3, numeral: 'iv' },
  { id: 'bVI', degree: 5, numeral: '♭VI' },
  { id: 'bVII', degree: 6, numeral: '♭VII' },
  { id: 'bIII', degree: 2, numeral: '♭III' },
]
type Borrowed = (typeof BORROWED)[number]
const borrowedById = (id?: string) => BORROWED.find((b) => b.id === id)
const pickBorrowed = (rng: Rng, only?: string) => borrowedById(only) ?? pick(BORROWED, rng)
/** A borrowed chord in a major key: the chord on that note of the minor key with the same home note. */
const borrowedIn = (key: KeyId, b: Borrowed) => minorKeyTriads(key)[b.degree]

/** "In C major, what's ♭VII?" */
export function makeBorrowedChord(id: number, keys: KeyId[], rng: Rng, only?: string): Question {
  const key = pick(knownKeys(keys), rng)
  const b = pickBorrowed(rng, only)
  const chord = borrowedIn(key, b)
  const right = symbolOf(chord)
  // Near misses: the major key's own chord on the same letter (F for Fm, B° for B♭), then the other borrowed chords.
  const near = [symbolOf(keyTriads(key)[b.degree]), ...shuffle(BORROWED.filter((x) => x !== b), rng).map((x) => symbolOf(borrowedIn(key, x)))]
  const options = shuffle([right, ...[...new Set(near)].filter((s) => s !== right).slice(0, 3)], rng)
  return {
    id,
    kind: 'borrowedChord',
    ask: { text: `In ${keyLabel(key)} major, what’s ${b.numeral}?`, hl: b.numeral },
    options,
    answer: options.indexOf(right),
    why: `${b.numeral} comes from ${keyLabel(key)} minor: its chord on the ${degreeName(b.degree + 1)} note is ${right}, ${spelled(chord.tones)}.`,
    score: { measures: [[]], afterMeasures: chordMeasures(chord.tones), after: [right] },
    sound: fourNotes(chord.tones),
    facts: [`borr:${b.id}`],
  }
}

/** "In C major, which numeral is the borrowed A♭?" */
export function makeBorrowedNumeral(id: number, keys: KeyId[], rng: Rng, only?: string): Question {
  const key = pick(knownKeys(keys), rng)
  const b = pickBorrowed(rng, only)
  const chord = borrowedIn(key, b)
  const symbol = symbolOf(chord)
  const root = toneName(chord.tones[0])
  // Near misses: the major key's numeral on that note (IV for Fm, vi for A♭), then the other borrowed numerals.
  const others = shuffle(BORROWED.filter((x) => x !== b), rng).map((x) => x.numeral)
  const options = shuffle([b.numeral, NUMERALS[b.degree], ...others.slice(0, 2)], rng)
  const borrowed = `borrowed from ${keyLabel(key)} minor`
  return {
    id,
    kind: 'borrowedNumeral',
    ask: { text: `In ${keyLabel(key)} major, which numeral is the borrowed ${symbol}?`, hl: symbol },
    options,
    answer: options.indexOf(b.numeral),
    why:
      b.id === 'iv'
        ? `${symbol} sits on ${root}, ${keyLabel(key)} major’s 4th note, but it’s minor, so it’s written lowercase: iv, ${borrowed}.`
        : `${symbol}’s root is a half step below ${toneName(majorScale(key)[b.degree])}, ${keyLabel(key)} major’s ${degreeName(b.degree + 1)} note, so it’s ${b.numeral}, ${borrowed}.`,
    score: { measures: [[]], afterMeasures: chordMeasures(chord.tones), after: [b.numeral] },
    sound: fourNotes(chord.tones),
    facts: [`borr:${b.id}`],
  }
}

/** Where each borrowed chord is spotted: home, a chord of the key, the borrowed one (-1), and home. */
const SPOT: Record<string, number[]> = { iv: [0, 3, -1, 0], bVI: [0, -1, 4, 0], bVII: [0, -1, 3, 0], bIII: [0, -1, 3, 0] }

/** "In C major, which chord of C – F – Fm – C is borrowed from C minor?" */
export function makeBorrowedSpot(id: number, keys: KeyId[], rng: Rng, only?: string): Question {
  const key = pick(knownKeys(keys), rng)
  const b = pickBorrowed(rng, only)
  const chord = borrowedIn(key, b)
  const chords = SPOT[b.id].map((d) => (d < 0 ? chord : keyTriads(key)[d]))
  const progression = chords.map(symbolOf).join(' – ')
  const symbol = symbolOf(chord)
  const scale = majorScale(key).map(tonePc)
  const outside = chord.tones.filter((n) => !scale.includes(tonePc(n))).map(toneName)
  // Each chord once, in the order it comes.
  const options = [...new Set(chords.map(symbolOf))]
  return {
    id,
    kind: 'borrowedSpot',
    ask: { text: `In ${keyLabel(key)} major, which chord of ${progression} is borrowed from ${keyLabel(key)} minor?`, hl: progression },
    options,
    answer: options.indexOf(symbol),
    why: `${symbol} isn’t in ${keyLabel(key)} major: ${andList(outside)} ${outside.length > 1 ? 'are' : 'is'} outside the key. It’s ${b.numeral}, from ${keyLabel(key)} minor.`,
    sound: chords.flatMap((c) => fourNotes(c.tones)),
    facts: [`borr:${b.id}`],
  }
}

// ---------------------------------------------------------------------------
// Tritone substitution
// ---------------------------------------------------------------------------

/** The keys tritone subs are asked in: each one's ♭II7 has a plain root. */
const TRITONE_KEYS: KeyId[] = ['C', 'G', 'D', 'A', 'F', 'E']
const subKeys = (keys: KeyId[]) => {
  const own = keys.filter((k) => TRITONE_KEYS.includes(k))
  return own.length ? own : TRITONE_KEYS.slice(0, 3)
}
/** A key's V7 and its tritone sub, ♭II7: the dominant 7th a half step above home, a tritone from V. */
function tritoneIn(key: KeyId) {
  const scale = majorScale(key)
  const subRoot = intervalAbove(scale[0], parseInterval('m2'))!
  return { root: scale[4], five: chordTones(scale[4], '7')!, sub: chordTones(subRoot, '7')!, fiveSymbol: chordSymbol(scale[4], '7'), subSymbol: chordSymbol(subRoot, '7'), subRoot }
}
/** Keys whose tritone sub spells plainly, for the question that spells it out (C major's D♭7 has a C♭). */
const plainSubKeys = (keys: KeyId[]) => keys.filter((k) => plain(tritoneIn(k).sub))

/** "In C major, what's the tritone sub for G7?" */
export function makeTritoneSub(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(subKeys(keys), rng)
  const { root, five, sub, fiveSymbol, subSymbol, subRoot } = tritoneIn(key)
  // Near misses: dominant 7ths a half step either side of V, and on home.
  const near = ['m2', 'M7', 'P4'].map((iv) => chordSymbol(intervalAbove(root, parseInterval(iv))!, '7'))
  const options = shuffle([subSymbol, ...near.filter((s) => s !== subSymbol)], rng)
  return {
    id,
    kind: 'tritoneSub',
    ask: { text: `In ${keyLabel(key)} major, what’s the tritone sub for ${fiveSymbol}?`, hl: fiveSymbol },
    options,
    answer: options.indexOf(subSymbol),
    why: `A tritone, 6 half steps, from ${toneName(root)} is ${toneName(subRoot)}. So ${fiveSymbol}’s tritone sub is ${subSymbol}: ♭II7 in ${keyLabel(key)} major, a half step above home.`,
    sound: [...fourNotes(five), ...fourNotes(sub), ...fourNotes(keyTriads(key)[0].tones)],
    facts: [`tsub:${key}`],
  }
}

/** "Which two notes do D7 and A♭7 share?" */
export function makeTritoneShared(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const pool = plainSubKeys(subKeys(keys))
  const key = only && plainSubKeys([only]).length ? only : pick(pool.length ? pool : plainSubKeys(TRITONE_KEYS), rng)
  const { five, sub, fiveSymbol, subSymbol } = tritoneIn(key)
  // V7's 3rd and 7th; the tritone sub spells the 3rd another way.
  const common = shared(five, sub)
  const right = both(common)
  const respelled = sub.find((n) => tonePc(n) === tonePc(common[0]))!
  const pairs = five.flatMap((x, i) => five.slice(i + 1).map((y) => both([x, y]))).filter((pair) => pair !== right)
  const options = shuffle([right, ...shuffle(pairs, rng).slice(0, 3)], rng)
  return {
    id,
    kind: 'tritoneShared',
    ask: { text: `Which two notes do ${fiveSymbol} and ${subSymbol} share?` },
    options,
    answer: options.indexOf(right),
    why: `${fiveSymbol} is ${spelled(five)} and ${subSymbol} is ${spelled(sub)}. ${toneName(respelled)} sounds the same as ${toneName(common[0])}, so they share ${right}: ${fiveSymbol}’s 3rd and 7th, a tritone apart.`,
    score: { measures: [[]], afterMeasures: chordMeasures(five, sub), after: [fiveSymbol, subSymbol] },
    sound: [...fourNotes(five), ...fourNotes(sub)],
    facts: [`tsub:${key}`],
  }
}

/** "In C major, Dm7 – G7 – Cmaj7 with a tritone sub becomes which progression?" */
export function makeTritoneProgression(id: number, keys: KeyId[], rng: Rng, only?: KeyId): Question {
  const key = only ?? pick(subKeys(keys), rng)
  const sevenths = keySevenths(key)
  const [ii, five, one] = [1, 4, 0].map((d) => chordSymbol(sevenths[d].tones[0], sevenths[d].kind))
  const { sub, subSymbol, subRoot } = tritoneIn(key)
  const scale = majorScale(key)
  const through = (middle: string) => `${ii} – ${middle} – ${one}`
  const right = through(subSymbol)
  // Near misses: the right root as the wrong kind, a 7th chord on ii's root, and one a tritone from home instead of from V.
  const wrong = [chordSymbol(subRoot, 'maj7'), chordSymbol(scale[1], '7'), chordSymbol(intervalAbove(scale[0], parseInterval('d5'))!, '7')].map(through)
  const options = shuffle([right, ...wrong], rng)
  return {
    id,
    kind: 'tritoneProgression',
    ask: { text: `In ${keyLabel(key)} major, ${through(five)} with a tritone sub becomes which progression?`, hl: through(five) },
    options,
    answer: options.indexOf(right),
    why: `The tritone sub for ${five} is ${subSymbol}, so ${through(five)} becomes ${right}. The roots slide down by half steps: ${toneName(scale[1])}, ${toneName(subRoot)}, ${toneName(scale[0])}.`,
    sound: [sevenths[1].tones, sub, sevenths[0].tones].flatMap(fourNotes),
    facts: [`tsub:${key}`],
  }
}

// ---------------------------------------------------------------------------
// Hearing swaps
// ---------------------------------------------------------------------------

/** Keys to hear progressions in: they sit in a comfortable range. */
const EAR_KEYS: KeyId[] = ['C', 'D', 'F', 'G', 'A']

/** Hear I – IV – V, then home to I or a deceptive cadence to vi: which? */
export function makeDeceptiveHear(id: number, rng: Rng, only?: boolean): Question {
  const chords = keyTriads(pick(EAR_KEYS, rng))
  const home = only ?? rng() < 0.5
  return {
    id,
    kind: 'deceptiveHear',
    ask: { text: 'Home, or a deceptive cadence?' },
    options: ['Home', 'Deceptive cadence'],
    answer: home ? 0 : 1,
    why: home
      ? 'After V it went home to I, a major chord that settles.'
      : 'After V it went to vi instead, a minor chord that leaves you hanging: the deceptive cadence.',
    listen: chordsToHear(...[0, 3, 4, home ? 0 : 5].map((d) => chords[d].tones)),
    sound: [],
    facts: ['ear:deceptive'],
  }
}

/** Hear home, then the key's minor chord or a secondary dominant on the same root, then the chord it leads to. */
export function makeSecondaryHear(id: number, rng: Rng, only?: boolean): Question {
  const key = pick(EAR_KEYS, rng)
  const swapped = only ?? rng() < 0.5
  // ii, V and vi: each one's secondary dominant sits where the key has a minor chord.
  const t = pick([1, 4, 5].filter((x) => targetsIn(key).includes(x)), rng)
  const sec = secondaryOf(key, t)
  const chords = keyTriads(key)
  const own = chords.find((c) => tonePc(c.tones[0]) === tonePc(sec.tones[0]))!
  return {
    id,
    kind: 'secondaryHear',
    ask: { text: 'In the key, or a secondary dominant?' },
    options: ['In the key', 'Secondary dominant'],
    answer: swapped ? 1 : 0,
    why: swapped
      ? 'The second chord was a bright 7th chord, with a note from outside the key pulling into the next chord: a secondary dominant.'
      : 'The second chord was minor, the key’s own chord on that root, so nothing was swapped.',
    listen: chordsToHear(chords[0].tones, swapped ? sec.tones : own.tones, chords[t].tones),
    sound: [],
    facts: ['ear:secondary'],
  }
}

/** Hear home, then IV or the borrowed minor iv, then home: which? */
export function makeMinorFourHear(id: number, rng: Rng, only?: boolean): Question {
  const key = pick(EAR_KEYS, rng)
  const minor = only ?? rng() < 0.5
  const chords = keyTriads(key)
  return {
    id,
    kind: 'minorFourHear',
    ask: { text: 'Major IV or minor iv?' },
    options: ['Major IV', 'Minor iv'],
    answer: minor ? 1 : 0,
    why: minor
      ? 'The middle chord was minor, with one note sinking a half step: the borrowed iv, bittersweet on its way home.'
      : 'The middle chord was major, open and bright: IV.',
    listen: chordsToHear(chords[0].tones, minor ? minorKeyTriads(key)[3].tones : chords[3].tones, chords[0].tones),
    sound: [],
    facts: ['ear:minor-iv'],
  }
}

/** Hear ii7, then V7 or its tritone sub, then Imaj7: which? */
export function makeTritoneHear(id: number, rng: Rng, only?: boolean): Question {
  const key = pick(EAR_KEYS, rng)
  const sub = only ?? rng() < 0.5
  const sevenths = keySevenths(key)
  const { five, sub: swapped } = tritoneIn(key)
  return {
    id,
    kind: 'tritoneHear',
    ask: { text: 'V7, or a tritone sub?' },
    options: ['V7', 'Tritone sub'],
    answer: sub ? 1 : 0,
    why: sub
      ? 'The bass slid down by half steps into home, ii, ♭II, I: the tritone sub.'
      : 'The bass leaped from root to root, ii, V, I: plain V7.',
    listen: chordsToHear(sevenths[1].tones, sub ? swapped : five, sevenths[0].tones),
    sound: [],
    facts: ['ear:tritone-sub'],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const SWAP_ORDER = [
  'swap:why',
  'swap:families',
  'swap:shared',
  'swap:stand-in',
  'swap:deceptive',
  'swap:sec-why',
  'swap:secondary',
  'swap:sec-target',
  'swap:sec-note',
  'swap:sec-songs',
  'swap:bor-why',
  'swap:parallel',
  'swap:borrowed',
  'swap:bor-numerals',
  'swap:minor-iv',
  'swap:rock-flats',
  'swap:tri-why',
  'swap:tritone',
  'swap:tri-shared',
  'swap:tri-ii-v',
  'swap:ear-why',
  'swap:ear-deceptive',
  'swap:ear-secondary',
  'swap:ear-minor-iv',
  'swap:ear-tritone',
]
/** Explained on a card, not quizzed on their own. */
export const SWAP_INTRO = ['swap:why', 'swap:deceptive', 'swap:sec-why', 'swap:bor-why', 'swap:parallel', 'swap:tri-why', 'swap:ear-why']

export const isSwapItem = (item: string) => item.startsWith('swap:')
/**
 * Facts practiced on these tapes: each chord's family ("cfam:6"), what a pair shares ("cshare:IV-ii"),
 * each chord's stand-in ("cswap:4"), each secondary dominant ("secd:ii") and its outside note ("secn:vi"),
 * each borrowed chord ("borr:bVII"), the tritone sub in each key ("tsub:G"), and hearing each swap
 * ("ear:deceptive", "ear:secondary", "ear:minor-iv", "ear:tritone-sub").
 */
export const isSwapFact = (fact: string) => /^(cfam|cshare|cswap|secd|secn|borr|tsub):/.test(fact) || /^ear:(deceptive|secondary|minor-iv|tritone-sub)$/.test(fact)
/** Each hearing fact's idea, question and short name. */
const EAR: Record<string, { item: string; make: (id: number, rng: Rng, only?: boolean) => Question; name: string }> = {
  deceptive: { item: 'swap:ear-deceptive', make: makeDeceptiveHear, name: 'Hearing a deceptive cadence' },
  secondary: { item: 'swap:ear-secondary', make: makeSecondaryHear, name: 'Hearing a secondary dominant' },
  'minor-iv': { item: 'swap:ear-minor-iv', make: makeMinorFourHear, name: 'Hearing the minor iv' },
  'tritone-sub': { item: 'swap:ear-tritone', make: makeTritoneHear, name: 'Hearing a tritone sub' },
}
const earOf = (value: string) => (Object.hasOwn(EAR, value) ? EAR[value] : null)
/** Secondary dominants with one outside note leading up to their chord, in any key the tapes use. */
const LEADING = ['ii', 'V', 'vi']
/** A scale note from its fact ("6" is vi), or null. */
const degreeOf = (value: string) => (/^[1-7]$/.test(value) ? Number(value) - 1 : null)
const pairOf = (value: string) => PAIRS.findIndex((p) => pairFact(p) === value)

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function swapItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'cfam':
      return degreeOf(value) !== null ? 'swap:families' : null
    case 'cshare':
      return pairOf(value) >= 0 ? 'swap:shared' : null
    case 'cswap':
      return isOneOf(value, ['1', '2', '4', '5', '6']) ? 'swap:stand-in' : null
    case 'secd':
      return TARGETS.includes(numeralIndex(value)) ? 'swap:secondary' : null
    case 'secn':
      return LEADING.includes(value) ? 'swap:sec-note' : null
    case 'borr':
      // All four are on the first card that teaches them.
      return borrowedById(value) ? 'swap:borrowed' : null
    case 'tsub':
      return isOneOf(value, TRITONE_KEYS) ? 'swap:tritone' : null
    case 'ear':
      return earOf(value)?.item ?? null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the rock chords, and the two answers of a hearing question. */
export function swapCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const keys = l.keys ?? []
  switch (item) {
    case 'swap:families':
      return makeChordFamily(id, keys, rng)
    case 'swap:shared':
      return makeChordShared(id, keys, rng)
    case 'swap:stand-in':
      return makeChordSwap(id, keys, rng)
    case 'swap:secondary':
      return makeSecondaryChord(id, keys, rng)
    case 'swap:sec-target':
      return makeSecondaryTarget(id, keys, rng)
    case 'swap:sec-note':
      return makeSecondaryNote(id, keys, rng)
    case 'swap:sec-songs':
      return makeSecondarySpot(id, keys, rng)
    case 'swap:borrowed':
      return makeBorrowedChord(id, keys, rng)
    case 'swap:bor-numerals':
      return makeBorrowedNumeral(id, keys, rng)
    case 'swap:minor-iv':
      return makeBorrowedSpot(id, keys, rng, 'iv')
    case 'swap:rock-flats':
      return makeBorrowedSpot(id, keys, rng, turn % 2 === 0 ? 'bVII' : 'bVI')
    case 'swap:tritone':
      return makeTritoneSub(id, keys, rng)
    case 'swap:tri-shared':
      return makeTritoneShared(id, keys, rng)
    case 'swap:tri-ii-v':
      return makeTritoneProgression(id, keys, rng)
    case 'swap:ear-deceptive':
    case 'swap:ear-secondary':
    case 'swap:ear-minor-iv':
    case 'swap:ear-tritone':
      return Object.values(EAR)
        .find((e) => e.item === item)!
        .make(id, rng, turn % 2 === 0)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function swapReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  const d = degreeOf(value)
  switch (kind) {
    case 'cfam':
      return d === null ? null : makeChordFamily(id, KEYS, rng, d)
    case 'cshare':
      return pairOf(value) >= 0 ? makeChordShared(id, KEYS, rng, pairOf(value)) : null
    case 'cswap':
      return d !== null && isOneOf(value, ['1', '2', '4', '5', '6']) ? makeChordSwap(id, KEYS, rng, d) : null
    case 'secd': {
      if (!TARGETS.includes(numeralIndex(value))) return null
      const make = pick([makeSecondaryChord, makeSecondaryTarget, makeSecondarySpot], rng)
      return make(id, ['C', 'G', 'F', 'Bb'], rng, numeralIndex(value))
    }
    case 'secn':
      return LEADING.includes(value) ? makeSecondaryNote(id, KEYS, rng, numeralIndex(value)) : null
    case 'borr': {
      if (!borrowedById(value)) return null
      const make = pick([makeBorrowedChord, makeBorrowedNumeral, makeBorrowedSpot], rng)
      return make(id, ['C', 'G', 'D', 'F', 'A'], rng, value)
    }
    case 'tsub': {
      if (!isOneOf(value, TRITONE_KEYS)) return null
      // Spelling the shared notes only where the sub spells plainly.
      const makers = plainSubKeys([value]).length ? [makeTritoneSub, makeTritoneShared, makeTritoneProgression] : [makeTritoneSub, makeTritoneProgression]
      return pick(makers, rng)(id, [value], rng, value)
    }
    case 'ear':
      return earOf(value)?.make(id, rng) ?? null
    default:
      return null
  }
}

/** "The vi chord’s family", "A stand-in for V", "V7/ii’s outside note"; null if it isn't one of these facts. */
export function describeSwapFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  const d = degreeOf(value)
  switch (kind) {
    case 'cfam':
      return d === null ? null : `The ${NUMERALS[d]} chord’s family`
    case 'cshare':
      return pairOf(value) >= 0 ? `What ${value.replace('-', ' and ')} share` : null
    case 'cswap':
      return d !== null && isOneOf(value, ['1', '2', '4', '5', '6']) ? `A stand-in for ${NUMERALS[d]}` : null
    case 'secd':
      return TARGETS.includes(numeralIndex(value)) ? `The secondary dominant V7/${value}` : null
    case 'secn':
      return LEADING.includes(value) ? `V7/${value}’s outside note` : null
    case 'borr':
      return borrowedById(value) ? `The borrowed ${borrowedById(value)!.numeral} chord` : null
    case 'tsub':
      return isOneOf(value, TRITONE_KEYS) ? `The tritone sub in ${keyLabel(value)} major` : null
    case 'ear':
      return earOf(value)?.name ?? null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const SWAP_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'swap:why': () => ({
    title: 'Swapping chords',
    subtitle: 'Same job, new color',
    hook: 'Songwriters often swap a chord for another that does the same job. C – Dm – G – C works just like C – F – G – C, with a softer color in the middle. Knowing which chords can swap lets you freshen up a progression, or make sense of one you hear. Press ▶\uFE0E Hear: C, F, G, C, then C, Dm, G, C.',
    score: { measures: [chordsScore('C', [0, 1, 4, 0])], labels: ['I', 'ii', 'V', 'I'] },
    listen: { notes: [...heard('C', [0, 3, 4, 0]).notes, ...heard('C', [0, 1, 4, 0]).notes], chord: 3 },
    sound: [],
  }),
  'swap:families': () => ({
    title: 'Three chord families',
    subtitle: 'Home, away and tension',
    hook: 'The seven chords of a key fall into three families, by the job they do (tape 43). The tonic family feels like home: I, iii and vi. The subdominant family moves away: IV and ii. The dominant family builds tension that pulls home: V and vii°. In C major that’s C, Em and Am; F and Dm; G and B°.',
    score: { measures: [chordsScore('C', [0, 2, 5, 3, 1, 4, 6])], labels: ['I', 'iii', 'vi', 'IV', 'ii', 'V', 'vii°'] },
    sound: [],
  }),
  'swap:shared': () => ({
    title: 'Two notes in common',
    subtitle: 'Why chords in a family can swap',
    hook: 'Chords in a family share two of their three notes. C is C E G and Am is A C E: they share C and E. F and Dm share F and A; G and B° share B and D. With two notes the same, one chord can take the other’s place and still do its job. Press ▶\uFE0E Hear: C, then Am.',
    score: { measures: [chordsScore('C', [0, 5])], labels: ['C', 'Am'] },
    listen: heard('C', [0, 5]),
    sound: [],
  }),
  'swap:stand-in': () => ({
    title: 'Stand-ins',
    subtitle: 'Swap within the family',
    hook: 'To swap a chord, use its stand-in from the same family: vi for I, ii for IV and vii° for V, or the other way round. In C major that’s Am for C, Dm for F and B° for G, so C – F – G – C can become C – Dm – G – C, or C – F – B° – C. Press ▶\uFE0E Hear: C, F, B°, C.',
    score: { measures: [chordsScore('C', [0, 3, 6, 0])], labels: ['I', 'IV', 'vii°', 'I'] },
    listen: heard('C', [0, 3, 6, 0]),
    sound: [],
  }),
  'swap:deceptive': () => ({
    title: 'The deceptive cadence',
    subtitle: 'V to vi instead of home',
    hook: 'A swap at the very end plays a trick on the ear. After V, the ear expects home, I. Swap it for its stand-in, vi, and the song seems about to end, then carries on: G to Am instead of G to C in C major. It’s called a deceptive cadence. Press ▶\uFE0E Hear: G to C, then G to Am.',
    score: { measures: [chordsScore('C', [4, 0, 4, 5])], labels: ['V', 'I', 'V', 'vi'] },
    listen: heard('C', [4, 0, 4, 5]),
    sound: [],
  }),
  'swap:sec-why': () => ({
    title: 'Borrowing the pull home',
    subtitle: 'Why secondary dominants',
    hook: 'V pulls back home to I (tape 43), and V7 pulls even harder. Songs borrow that pull for other chords too: put a chord’s own V7 in front of it, and it lands like a little home of its own. In C major, A7 before Dm makes Dm feel like an arrival. Press ▶\uFE0E Hear: C, Dm, then C, A7, Dm.',
    score: { measures: chordMeasures(chordOf('C', 'maj'), chordOf('A', '7'), chordOf('D', 'min')), labels: ['C', 'A7', 'Dm'] },
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('D', 'min'), chordOf('C', 'maj'), chordOf('A', '7'), chordOf('D', 'min')),
    sound: [],
  }),
  'swap:secondary': () => ({
    title: 'Secondary dominants',
    subtitle: 'The V7 of another chord',
    hook: 'A secondary dominant is the V7 of a chord other than I. To find one, go up a 5th from that chord’s root and play a dominant 7th there: A is a 5th above D, so Dm’s V7 is A7. It’s written V7/ii and said “five of two”. In C major, A7 is V7/ii, B7 V7/iii, C7 V7/IV, D7 V7/V and E7 V7/vi. Press ▶\uFE0E Hear: A7, then Dm.',
    score: { measures: chordMeasures(chordOf('A', '7'), chordOf('D', 'min')), labels: ['V7/ii', 'ii'] },
    listen: chordsToHear(chordOf('A', '7'), chordOf('D', 'min')),
    sound: [],
  }),
  'swap:sec-target': () => ({
    title: 'Where it leads',
    subtitle: 'Down a 5th',
    hook: 'A secondary dominant leads to the chord a 5th below it, the one it’s the V7 of: A7 to Dm, D7 to G, E7 to Am. So when a song has a 7th chord that isn’t in its key, look a 5th down: that’s where it wants to go. Press ▶\uFE0E Hear: E7, then Am.',
    score: { measures: chordMeasures(chordOf('E', '7'), chordOf('A', 'min')), labels: ['E7', 'Am'] },
    listen: chordsToHear(chordOf('E', '7'), chordOf('A', 'min')),
    sound: [],
  }),
  'swap:sec-note': () => ({
    title: 'The outside note',
    subtitle: 'A half step below where it leads',
    hook: 'A secondary dominant brings in a note from outside the key, and that note gives it its pull. In C major, A7’s C♯ sits a half step below D, so it pulls up into Dm; D7’s F♯ pulls into G, and E7’s G♯ into A. On a chart or a staff, that new sharp is the giveaway.',
    score: { measures: chordMeasures(chordOf('A', '7'), chordOf('D', 'min')), labels: ['A7', 'Dm'] },
    sound: [],
  }),
  'swap:sec-songs': () => ({
    title: 'In real songs',
    subtitle: 'Two favorites, and a chain',
    hook: 'Two turn up everywhere. E7 to Am, V7/vi, adds a jolt before the minor chord in countless pop songs. D7 to G, V7/V, stretches the trip home: C – D7 – G7 – C. Chain them and every chord points to the next, each a 5th down: C – A7 – Dm – G7 – C. Press ▶\uFE0E Hear: C, A7, Dm, G7, C.',
    score: {
      measures: chordMeasures(chordOf('C', 'maj'), chordOf('A', '7'), chordOf('D', 'min'), chordOf('G', '7'), chordOf('C', 'maj')),
      labels: ['C', 'A7', 'Dm', 'G7', 'C'],
    },
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('A', '7'), chordOf('D', 'min'), chordOf('G', '7'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:bor-why': () => ({
    title: 'Borrowing from minor',
    subtitle: 'A darker color in a major key',
    hook: 'A song in a major key can borrow a chord from the minor key on the same home note: C minor, for C major. The borrowed chord brings a shadow of minor into the major key, a touch of sadness or grit. Rock and pop do it all the time. Press ▶\uFE0E Hear: C, F, C, then C, F, Fm, C.',
    score: { measures: chordMeasures(chordOf('C', 'maj'), chordOf('F', 'maj'), chordOf('F', 'min'), chordOf('C', 'maj')), labels: ['C', 'F', 'Fm', 'C'] },
    listen: chordsToHear(...['C', 'F', 'C', 'C', 'F'].map((r) => chordOf(r, 'maj')), chordOf('F', 'min'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:parallel': () => {
    const cMinor = minorScaleOn('C')
    return {
      title: 'The parallel minor',
      subtitle: 'Same home note, other notes',
      hook: 'The parallel minor shares a major key’s home note, not its notes: C minor is C D E♭ F G A♭ B♭. That’s different from the relative minor (tape 28), A minor, which shares all of C major’s notes. Borrowed chords come from the parallel minor, so they bring in its flats: E♭, A♭ and B♭ (in amber).',
      score: { measures: scaleScore(cMinor), labels: scaleLabels(cMinor), colors: marked(7, PAPER_HIGHLIGHT, 2, 5, 6) },
      sound: scaleSound(cMinor),
    }
  },
  'swap:borrowed': () => ({
    title: 'The borrowed chords',
    subtitle: 'iv, ♭VI, ♭VII and ♭III',
    hook: 'Four borrowed chords turn up most. In C major they’re Fm, A♭, B♭ and E♭: C minor’s chords on its 4th, 6th, 7th and 3rd notes. Each one brings in at least one of C minor’s flats. Press ▶\uFE0E Hear: Fm, A♭, B♭, E♭.',
    score: { measures: chordMeasures(chordOf('F', 'min'), chordOf('Ab', 'maj'), chordOf('Bb', 'maj'), chordOf('Eb', 'maj')), labels: ['iv', '♭VI', '♭VII', '♭III'] },
    listen: chordsToHear(chordOf('F', 'min'), chordOf('Ab', 'maj'), chordOf('Bb', 'maj'), chordOf('Eb', 'maj')),
    sound: [],
  }),
  'swap:bor-numerals': () => ({
    title: 'Flats in the numerals',
    subtitle: 'Counted from the home note',
    hook: 'A borrowed chord’s numeral counts from the home note, like any other. When its root is a half step below the major key’s note, a flat goes in front: B♭ is ♭VII, because C major’s 7th note is B. Fm needs no flat, since F is in both keys, but it’s minor, so it’s written lowercase: iv.',
    score: { measures: chordMeasures(chordOf('Bb', 'maj'), chordOf('F', 'min')), labels: ['♭VII', 'iv'] },
    sound: [],
  }),
  'swap:minor-iv': () => ({
    title: 'The minor iv',
    subtitle: 'IV, then iv',
    hook: 'The best-loved borrowing turns IV minor: F, then Fm, then home to C. Only one note changes, A dropping to A♭, and that half step down sounds bittersweet. You’ll hear it in Beatles songs and Radiohead’s “Creep”. Press ▶\uFE0E Hear: C, F, Fm, C.',
    score: { measures: chordMeasures(chordOf('C', 'maj'), chordOf('F', 'maj'), chordOf('F', 'min'), chordOf('C', 'maj')), labels: ['I', 'IV', 'iv', 'I'] },
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('F', 'maj'), chordOf('F', 'min'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:rock-flats': () => ({
    title: 'Rock’s flat chords',
    subtitle: '♭VII and ♭VI',
    hook: '♭VII and ♭VI give rock its swagger. C – B♭ – F – C leans on ♭VII, and C – A♭ – B♭ – C climbs ♭VI, ♭VII, I to a big, triumphant ending, heard in anthems and video game music. Press ▶\uFE0E Hear: C, A♭, B♭, C.',
    score: { measures: chordMeasures(chordOf('C', 'maj'), chordOf('Ab', 'maj'), chordOf('Bb', 'maj'), chordOf('C', 'maj')), labels: ['I', '♭VI', '♭VII', 'I'] },
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('Ab', 'maj'), chordOf('Bb', 'maj'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:tri-why': () => ({
    title: 'A jazz swap',
    subtitle: 'Why tritone substitution',
    hook: 'Jazz players often swap V7 for the dominant 7th a tritone away: D♭7 instead of G7, on the way home to C. It does the same job, pulling home, but the bass slides down by half steps instead of leaping: D, D♭, C. Press ▶\uFE0E Hear: Dm7, G7, Cmaj7, then Dm7, D♭7, Cmaj7.',
    listen: chordsToHear(chordOf('D', 'm7'), chordOf('G', '7'), chordOf('C', 'maj7'), chordOf('D', 'm7'), chordOf('Db', '7'), chordOf('C', 'maj7')),
    sound: [],
  }),
  'swap:tritone': () => ({
    title: 'The tritone sub',
    subtitle: 'A tritone from V7',
    hook: 'The tritone sub for V7 is the dominant 7th whose root is a tritone, 6 half steps, from V’s root: D♭7 for G7, A♭7 for D7. In the key, its root sits a half step above home, so it’s written ♭II7: D♭7 in C major. Press ▶\uFE0E Hear: D♭7, then C.',
    listen: chordsToHear(chordOf('Db', '7'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:tri-shared': () => ({
    title: 'The shared tritone',
    subtitle: 'Why the swap works',
    hook: 'G7 and D♭7 share the two notes that make a dominant 7th pull: G7’s 3rd and 7th, B and F, a tritone apart. D♭7 has them too, with F as its 3rd and B, written C♭, as its 7th. Same tension, same pull home, a new root underneath. Press ▶\uFE0E Hear: G7, then D♭7.',
    score: { measures: chordMeasures(chordOf('G', '7'), chordOf('Db', '7')), labels: ['G7', 'D♭7'] },
    listen: chordsToHear(chordOf('G', '7'), chordOf('Db', '7')),
    sound: [],
  }),
  'swap:tri-ii-v': () => ({
    title: 'In a ii–V–I',
    subtitle: 'ii7, ♭II7, Imaj7',
    hook: 'The tritone sub turns up most in ii–V–I: Dm7 – G7 – Cmaj7 becomes Dm7 – D♭7 – Cmaj7. The roots step down by half steps, D, D♭, C, a smooth slide home that sounds like jazz straight away. Press ▶\uFE0E Hear: Dm7, D♭7, Cmaj7.',
    score: { measures: chordMeasures(chordOf('D', 'm7'), chordOf('Db', '7'), chordOf('C', 'maj7')), labels: ['ii7', '♭II7', 'Imaj7'] },
    listen: chordsToHear(chordOf('D', 'm7'), chordOf('Db', '7'), chordOf('C', 'maj7')),
    sound: [],
  }),
  'swap:ear-why': () => ({
    title: 'Hearing swaps',
    subtitle: 'Listen for the change',
    hook: 'Each question plays a short progression and asks whether a chord was swapped. Listen for what changes: a minor chord where the ear expects major, a note from outside the key, or a bass line that slides instead of leaping. Press ▶\uFE0E Hear: C, Dm, G, C, then C, D7, G, C.',
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('D', 'min'), chordOf('G', 'maj'), chordOf('C', 'maj'), chordOf('C', 'maj'), chordOf('D', '7'), chordOf('G', 'maj'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:ear-deceptive': () => ({
    title: 'Home or deceptive',
    subtitle: 'Listen to the last chord',
    hook: 'After V, the ear expects home. If the last chord settles, major and at rest, it went home to I. If it turns minor and leaves you hanging, it went to vi instead: the deceptive cadence. Press ▶\uFE0E Hear: C, F, G, C, then C, F, G, Am.',
    listen: chordsToHear(...[0, 3, 4, 0, 0, 3, 4, 5].map((d) => keyTriads('C')[d].tones)),
    sound: [],
  }),
  'swap:ear-secondary': () => ({
    title: 'Hearing a secondary dominant',
    subtitle: 'Brighter, and pulling',
    hook: 'A secondary dominant swaps the key’s minor chord for a dominant 7th on the same root: E7 instead of Em, before Am. Listen for the brighter chord, with a note from outside the key that pulls hard into the next one. Press ▶\uFE0E Hear: C, Em, Am, then C, E7, Am.',
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('E', 'min'), chordOf('A', 'min'), chordOf('C', 'maj'), chordOf('E', '7'), chordOf('A', 'min')),
    sound: [],
  }),
  'swap:ear-minor-iv': () => ({
    title: 'IV or minor iv',
    subtitle: 'Listen for the sinking note',
    hook: 'Major IV sounds open and bright on its way home. The borrowed minor iv has one note that sinks a half step, A down to A♭ in C major, and it sounds bittersweet. Press ▶\uFE0E Hear: C, F, C, then C, Fm, C.',
    listen: chordsToHear(chordOf('C', 'maj'), chordOf('F', 'maj'), chordOf('C', 'maj'), chordOf('C', 'maj'), chordOf('F', 'min'), chordOf('C', 'maj')),
    sound: [],
  }),
  'swap:ear-tritone': () => ({
    title: 'V7 or the tritone sub',
    subtitle: 'Listen to the bass',
    hook: 'Both pull home, so listen to the lowest notes. Through V7, the bass leaps: D, G, C. Through the tritone sub, it slides down by half steps: D, D♭, C. Press ▶\uFE0E Hear: Dm7, G7, Cmaj7, then Dm7, D♭7, Cmaj7.',
    listen: chordsToHear(chordOf('D', 'm7'), chordOf('G', '7'), chordOf('C', 'maj7'), chordOf('D', 'm7'), chordOf('Db', '7'), chordOf('C', 'maj7')),
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function swapCard(item: string, counter: string): Card {
  return { ...SWAP_CARDS[item](), counter }
}
