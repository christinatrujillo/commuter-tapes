import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import { LETTERS, midiAt, pitchClass, positionsForPc, type Region } from '../music/notes'
import { KEYS, type KeyId, type ScoreMeasure } from '../music/score'
import {
  degreeName,
  KEY_ON_PC,
  keyTriads,
  majorName,
  majorScale,
  NUMERALS,
  scaleScore,
  toneName,
  TRIAD_NAMES,
  type Tone,
  type TriadQuality,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { PAPER_HIGHLIGHT } from '../lib/color'
import { capitalize } from '../lib/text'
import type { Question } from './questions'
import { triadScore, triadSound } from './triads'
import { on } from './intervals'

/**
 * Chords in a key: the triad on each note of the major scale, Roman numerals, the three main
 * chords, common progressions, and hearing where a progression goes.
 */

type Chord = { tones: Tone[]; quality: TriadQuality }
const chordName = (c: Chord) => `${toneName(c.tones[0])} ${TRIAD_NAMES[c.quality]}`
const spelled = (c: Chord) => c.tones.map(toneName).join(' ')
const KINDS: TriadQuality[] = ['maj', 'min', 'dim']
/** "A, B and C" */
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0])

/** The written octave of a chord's root, so the chords of a key climb the staff from its home note. */
function rootOctave(key: KeyId, d: number): number {
  const scale = majorScale(key)
  return 4 + (LETTERS.indexOf(scale[d].letter) < LETTERS.indexOf(scale[0].letter) ? 1 : 0)
}
/** The chord on note `d` (from 0) of a key, stacked on the staff. `sig` is the key signature it's read with. */
const chordScore = (key: KeyId, d: number, sig: KeyId = key): ScoreMeasure => triadScore(keyTriads(key)[d].tones, true, sig, rootOctave(key, d))
const chordSound = (key: KeyId, d: number) => triadSound(keyTriads(key)[d].tones, rootOctave(key, d))
/** Chords of a key, one after another on one staff. */
const chordsScore = (key: KeyId, degrees: number[], sig: KeyId = key): ScoreMeasure => degrees.flatMap((d) => chordScore(key, d, sig))
const ALL_DEGREES = [0, 1, 2, 3, 4, 5, 6]

/** How a numeral's case gives the chord's kind. */
const CASE: Record<TriadQuality, string> = {
  maj: 'Capitals mean major',
  min: 'Lowercase means minor',
  dim: 'Lowercase with ° means diminished',
  aug: '',
}

/** Near-miss chord names for the chord on note `d`: the same root as another kind, then its neighbors in the key. */
function nearChords(key: KeyId, d: number): string[] {
  const chords = keyTriads(key)
  const root = chords[d].tones[0]
  const kinds = KINDS.filter((q) => q !== chords[d].quality).map((q) => `${toneName(root)} ${TRIAD_NAMES[q]}`)
  return [...new Set([kinds[0], chordName(chords[(d + 1) % 7]), chordName(chords[(d + 6) % 7]), kinds[1]])]
}

/** Near-miss numerals: the neighbors, and the right one in the wrong case. In scale order. */
function nearNumerals(d: number): string[] {
  const wrongCase = NUMERALS[d] === NUMERALS[d].toUpperCase() ? NUMERALS[d].toLowerCase() : NUMERALS[d].replace('°', '').toUpperCase()
  const options = [NUMERALS[d], NUMERALS[(d + 1) % 7], NUMERALS[(d + 6) % 7], wrongCase]
  const degreeOf = (n: string) => NUMERALS.findIndex((x) => x.replace('°', '').toLowerCase() === n.replace('°', '').toLowerCase())
  return [...new Set(options)].sort((a, b) => degreeOf(a) - degreeOf(b) || (a === NUMERALS[degreeOf(a)] ? -1 : 1))
}

// ---------------------------------------------------------------------------
// The chords in a key
// ---------------------------------------------------------------------------

/**
 * "What's the chord on the 2nd note of C major?" With `help`, the scale is on the staff to count
 * along; without it, just the key signature. The chord is written out once it's answered.
 */
export function makeChordOnDegree(id: number, keys: KeyId[], rng: Rng, help = false, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? between(1, 6, rng)
  const chord = keyTriads(key)[d]
  const scale = majorScale(key)
  const right = chordName(chord)
  const options = shuffle([right, ...nearChords(key, d).filter((n) => n !== right).slice(0, 3)], rng)
  const where = `${degreeName(d + 1)} note of ${majorName(key)}`
  const names = [...scale, scale[0]].map(toneName)
  return {
    id,
    kind: 'chordOnDegree',
    ask: { text: `What’s the chord on the ${where}?`, hl: where },
    options,
    answer: options.indexOf(right),
    why: `Count up ${majorName(key)}: ${scale.slice(0, d + 1).map(toneName).join(' ')}. The chord on the ${degreeName(d + 1)} note is always ${TRIAD_NAMES[chord.quality]}, so it’s ${right} (${spelled(chord)}).`,
    score: help
      ? { measures: scaleScore(scale), labels: names, marker: d, afterMeasures: [chordScore(key, d, 'C')], after: [spelled(chord)] }
      : { measures: [[]], keySig: key, afterMeasures: [chordScore(key, d)], after: [spelled(chord)] },
    sound: chordSound(key, d),
    facts: [`hd:${d + 1}`],
  }
}

/** "In any major key, what kind of chord is on the 6th note?" C major on the staff as the example. */
export function makeDegreeQuality(id: number, rng: Rng, only?: number): Question {
  const d = only ?? between(0, 6, rng)
  const chord = keyTriads('C')[d]
  const options = KINDS.map((q) => capitalize(TRIAD_NAMES[q]))
  const scale = majorScale('C')
  const where = `${degreeName(d + 1)} note`
  return {
    id,
    kind: 'degreeQuality',
    ask: { text: `In any major key, what kind of chord is on the ${where}?`, hl: where },
    options,
    answer: KINDS.indexOf(chord.quality),
    why: `Major, minor, minor, major, major, minor, diminished: the ${degreeName(d + 1)} is ${TRIAD_NAMES[chord.quality]}. In C major, that’s ${chordName(chord)}.`,
    score: { measures: scaleScore(scale), labels: [...scale, scale[0]].map(toneName), marker: d, afterMeasures: [chordScore('C', d)], after: [chordName(chord)] },
    sound: chordSound('C', d),
    facts: [`hd:${d + 1}`],
  }
}

// ---------------------------------------------------------------------------
// Roman numerals
// ---------------------------------------------------------------------------

/** "In D major, what's the ii chord?" */
export function makeNumeralToChord(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? between(1, 6, rng)
  const chord = keyTriads(key)[d]
  const right = chordName(chord)
  const options = shuffle([right, ...nearChords(key, d).filter((n) => n !== right).slice(0, 3)], rng)
  const scale = majorScale(key)
  return {
    id,
    kind: 'numeralToChord',
    ask: { text: `In ${majorName(key)}, what’s the ${NUMERALS[d]} chord?`, hl: `${NUMERALS[d]} chord` },
    options,
    answer: options.indexOf(right),
    why: `${NUMERALS[d]} is the chord on the ${degreeName(d + 1)} note: count ${scale.slice(0, d + 1).map(toneName).join(' ')}. ${CASE[chord.quality]}, so it’s ${right}.`,
    score: { measures: [[]], keySig: key, afterMeasures: [chordScore(key, d)], after: [spelled(chord)] },
    sound: chordSound(key, d),
    facts: [`hrn:${d + 1}`],
  }
}

/** "In C major, which numeral is A minor?" */
export function makeChordToNumeral(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? between(1, 6, rng)
  const chord = keyTriads(key)[d]
  const options = nearNumerals(d)
  const scale = majorScale(key)
  return {
    id,
    kind: 'chordToNumeral',
    ask: { text: `In ${majorName(key)}, which numeral is ${chordName(chord)}?`, hl: chordName(chord) },
    options,
    answer: options.indexOf(NUMERALS[d]),
    why: `${toneName(chord.tones[0])} is the ${degreeName(d + 1)} note of ${majorName(key)} (${scale.slice(0, d + 1).map(toneName).join(' ')}), and the chord is ${TRIAD_NAMES[chord.quality]}, so it’s ${NUMERALS[d]}.`,
    score: { measures: [chordScore(key, d)], keySig: key, after: [spelled(chord)] },
    sound: chordSound(key, d),
    facts: [`hrn:${d + 1}`],
  }
}

/** A chord on the staff in a key: which numeral is it? */
export function makeNumeralRead(id: number, keys: KeyId[], rng: Rng, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? between(0, 6, rng)
  const chord = keyTriads(key)[d]
  const options = nearNumerals(d)
  const notes = key === 'C' ? `The notes are ${spelled(chord)}` : `In ${majorName(key)} (${KEYS[key].signature}), the notes are ${spelled(chord)}`
  return {
    id,
    kind: 'numeralRead',
    ask: { text: `Which numeral is this chord in ${majorName(key)}?`, hl: majorName(key) },
    options,
    answer: options.indexOf(NUMERALS[d]),
    why: `${notes}: ${chordName(chord)}, on the key’s ${degreeName(d + 1)} note. So it’s ${NUMERALS[d]}.`,
    score: { measures: [chordScore(key, d)], keySig: key, after: [spelled(chord)] },
    sound: chordSound(key, d),
    facts: [`hrn:${d + 1}`],
  }
}

// ---------------------------------------------------------------------------
// I, IV and V
// ---------------------------------------------------------------------------

const PRIMARY = [0, 3, 4]
/** What each main chord does, for the questions and feedback. */
const JOB: Record<number, { ask: string; name: string }> = {
  0: { ask: 'is home', name: 'is home: it’s the tonic' },
  3: { ask: 'moves away from home', name: 'moves away from home: it’s the subdominant' },
  4: { ask: 'pulls back home to I', name: 'pulls back home: it’s the dominant' },
}

/** "What's the V chord in A major?", or by what it does: "In G major, which chord pulls back home to I?" */
export function makePrimaryChord(id: number, keys: KeyId[], byJob: boolean, rng: Rng, only?: number): Question {
  const key = pick(keys, rng)
  const d = only ?? (byJob ? pick(PRIMARY, rng) : pick([3, 4], rng))
  const chords = keyTriads(key)
  const right = chordName(chords[d])
  // By what it does, the choices are the three main chords and vi; by numeral, the usual near misses.
  const wrong = byJob ? [0, 3, 4, 5].filter((x) => x !== d).map((x) => chordName(chords[x])) : nearChords(key, d).filter((n) => n !== right)
  const options = shuffle([right, ...wrong.slice(0, 3)], rng)
  const scale = majorScale(key)
  return {
    id,
    kind: 'primaryChord',
    ask: byJob
      ? { text: `In ${majorName(key)}, which chord ${JOB[d].ask}?`, hl: JOB[d].ask }
      : { text: `In ${majorName(key)}, what’s the ${NUMERALS[d]} chord?`, hl: `${NUMERALS[d]} chord` },
    options,
    answer: options.indexOf(right),
    why: byJob
      ? `${NUMERALS[d]} ${JOB[d].name}. In ${majorName(key)}, that’s ${right}.`
      : `Count up ${majorName(key)} to the ${degreeName(d + 1)} note: ${scale.slice(0, d + 1).map(toneName).join(' ')}. ${NUMERALS[d]} is major, so it’s ${right}.`,
    score: { measures: [[]], keySig: key, afterMeasures: [chordScore(key, d)], after: [spelled(chords[d])] },
    // V and IV are heard going home to I.
    sound: [...chordSound(key, d), ...(d ? chordSound(key, 0) : [])],
    facts: [`hprim:${NUMERALS[d]}`],
  }
}

/** The I chord's root on the 6th or 5th string: tap the root of IV (next string, same fret) or V (two frets further). */
export function makeBoxFind(id: number, rng: Rng, only?: 3 | 4): Question {
  const string = pick([0, 1], rng)
  const pos = { string, fret: between(1, 8, rng) }
  const key = KEY_ON_PC[pitchClass(midiAt(pos))]
  const d = only ?? pick<3 | 4>([3, 4], rng)
  const scale = majorScale(key)
  const target = { string: string + 1, fret: pos.fret + (d === 4 ? 2 : 0) }
  const region: Region = { strings: [string, string + 1], minFret: Math.max(0, pos.fret - 1), maxFret: Math.min(12, pos.fret + 4) }
  const how = d === 3 ? 'a perfect 4th above it: the next string over, same fret' : 'a perfect 5th above it: the next string over, 2 frets up'
  return {
    id,
    kind: 'boxFind',
    ask: { text: `Tap the root of the ${NUMERALS[d]} chord in ${majorName(key)}`, hl: `${NUMERALS[d]} chord` },
    region,
    markers: [{ pos, tone: 'root', label: toneName(scale[0]) }],
    from: pos,
    targets: positionsForPc(midiAt(target), region),
    label: toneName(scale[d]),
    why: `From ${toneName(scale[0])}, ${NUMERALS[d]}’s root is ${how}. That’s ${toneName(scale[d])}, so ${NUMERALS[d]} is ${toneName(scale[d])} major.`,
    facts: [`hbox:${NUMERALS[d]}`],
  }
}

// ---------------------------------------------------------------------------
// Progressions
// ---------------------------------------------------------------------------

/** The progressions the tapes teach, as scale notes from 0. */
const PROGRESSIONS: Record<string, number[]> = {
  'I-IV-V-I': [0, 3, 4, 0],
  'I-V-vi-IV': [0, 4, 5, 3],
  'I-vi-IV-V': [0, 5, 3, 4],
  'ii-V-I': [1, 4, 0],
}
const PROGRESSION_IDS = Object.keys(PROGRESSIONS)
/** "I–V–vi–IV" */
const progLabel = (id: string) => PROGRESSIONS[id].map((d) => NUMERALS[d]).join('–')
const knownProgs = (progs: string[]) => progs.filter((p) => isOneOf(p, PROGRESSION_IDS))

/** "In G major, what are the roots of I–V–vi–IV?" */
export function makeProgressionSpell(id: number, keys: KeyId[], progs: string[], rng: Rng, only?: string): Question {
  const key = pick(keys, rng)
  const prog = only ?? pick(knownProgs(progs), rng)
  const degrees = PROGRESSIONS[prog]
  const scale = majorScale(key)
  const chords = keyTriads(key)
  const roots = (ds: number[]) => ds.map((d) => toneName(scale[(d + 7) % 7])).join(' ')
  const slip = between(0, degrees.length - 1, rng)
  // Near misses: every chord counted one note too far, one chord miscounted, and another progression.
  const candidates = [
    roots(degrees.map((d) => d + 1)),
    roots(degrees.map((d, i) => (i === slip ? d + (d === 6 ? -1 : 1) : d))),
    ...PROGRESSION_IDS.filter((p) => p !== prog).map((p) => roots(PROGRESSIONS[p])),
  ]
  const right = roots(degrees)
  const options = shuffle([right, ...[...new Set(candidates)].filter((c) => c !== right).slice(0, 3)], rng)
  return {
    id,
    kind: 'progressionSpell',
    ask: { text: `In ${majorName(key)}, what are the roots of ${progLabel(prog)}?`, hl: progLabel(prog) },
    options,
    answer: options.indexOf(right),
    why: `Count up ${majorName(key)}: ${scale.map(toneName).join(' ')}. ${capitalize(list(degrees.filter((d, i) => degrees.indexOf(d) === i).map((d) => `${NUMERALS[d]} is ${chordName(chords[d])}`)))}.`,
    score: { measures: [[]], keySig: key, afterMeasures: [chordsScore(key, degrees)], after: degrees.map((d) => NUMERALS[d]) },
    sound: degrees.flatMap((d) => chordSound(key, d)),
    facts: [`hprog:${prog}`],
  }
}

/** "In C major, which progression is C major, A minor, F major, G major?" */
export function makeProgressionName(id: number, keys: KeyId[], progs: string[], rng: Rng, only?: string): Question {
  const key = pick(keys, rng)
  const prog = only ?? pick(knownProgs(progs), rng)
  const degrees = PROGRESSIONS[prog]
  const chords = keyTriads(key)
  const names = degrees.map((d) => chordName(chords[d]))
  const options = PROGRESSION_IDS.map(progLabel)
  return {
    id,
    kind: 'progressionName',
    ask: { text: `In ${majorName(key)}, which progression is ${names.join(', ')}?`, hl: names.join(', ') },
    options,
    answer: options.indexOf(progLabel(prog)),
    why: `In ${majorName(key)}, ${list(degrees.filter((d, i) => degrees.indexOf(d) === i).map((d) => `${chordName(chords[d])} is ${NUMERALS[d]}`))}: ${progLabel(prog)}.`,
    score: { measures: [chordsScore(key, degrees)], keySig: key, labels: degrees.map((d) => toneName(chords[d].tones[0])), after: degrees.map((d) => NUMERALS[d]) },
    sound: degrees.flatMap((d) => chordSound(key, d)),
    facts: [`hprog:${prog}`],
  }
}

// ---------------------------------------------------------------------------
// Hearing progressions
// ---------------------------------------------------------------------------

/** Keys to play progressions in: they sit in a comfortable range. */
const EAR_KEYS: KeyId[] = ['C', 'D', 'F', 'G', 'A']
const HOME_ENDINGS = [
  [0, 3, 4, 0],
  [0, 4, 3, 0],
  [0, 5, 4, 0],
]
const AWAY_ENDINGS = [
  [0, 3, 0, 4],
  [0, 5, 3, 4],
  [0, 4, 5, 3],
]
/** Chords to hear, one after another. */
const heard = (key: KeyId, degrees: number[]) => ({ notes: degrees.flatMap((d) => chordSound(key, d)), chord: 3 })
const numerals = (degrees: number[]) => degrees.map((d) => NUMERALS[d]).join('–')

/** Hear four chords: does the progression end at home (on I), or away? */
export function makeCadenceHear(id: number, rng: Rng, only?: boolean): Question {
  const home = only ?? rng() < 0.5
  const degrees = pick(home ? HOME_ENDINGS : AWAY_ENDINGS, rng)
  const last = NUMERALS[degrees[degrees.length - 1]]
  return {
    id,
    kind: 'cadenceHear',
    ask: { text: 'Does it end at home, or away?' },
    options: ['Home', 'Away'],
    answer: home ? 0 : 1,
    why: home ? `It ended on I, home: ${numerals(degrees)}. That’s why it sounds finished.` : `It ended on ${last}, not I: ${numerals(degrees)}. That’s why it sounds unfinished.`,
    listen: heard(pick(EAR_KEYS, rng), degrees),
    sound: [],
    facts: ['ear:home'],
  }
}

/** Hear I and then IV or V: which one? */
export function makeFourFiveHear(id: number, rng: Rng, only?: 3 | 4): Question {
  const d = only ?? pick<3 | 4>([3, 4], rng)
  return {
    id,
    kind: 'fourFiveHear',
    ask: { text: 'After I, which chord: IV or V?' },
    options: ['IV', 'V'],
    answer: d === 3 ? 0 : 1,
    why: d === 3 ? 'That was I, then IV: a step away from home, open and relaxed.' : 'That was I, then V: tension that leans back toward home.',
    listen: heard(pick(EAR_KEYS, rng), [0, d]),
    sound: [],
    facts: ['ear:four-five'],
  }
}

/** What gives each progression away by ear. */
const PROG_CLUE: Record<string, string> = {
  'I-IV-V-I': 'away, then tension, then home again, with no minor chord.',
  'I-V-vi-IV': 'the pull of V, then the minor vi darkens it before IV.',
  'I-vi-IV-V': 'the minor vi comes second, and it ends on V, left hanging.',
  'ii-V-I': 'only three chords, starting on the minor ii and stepping home.',
}

/** Hear a whole progression: which one? */
export function makeProgressionHear(id: number, progs: string[], rng: Rng, only?: string): Question {
  const offered = knownProgs(progs).length ? knownProgs(progs) : PROGRESSION_IDS.slice(0, 3)
  const prog = only ?? pick(offered, rng)
  const options = [...new Set([...offered, prog])].map(progLabel)
  return {
    id,
    kind: 'progressionHear',
    ask: { text: 'Which progression do you hear?' },
    options,
    answer: options.indexOf(progLabel(prog)),
    why: `${progLabel(prog)}: ${PROG_CLUE[prog]}`,
    listen: heard(pick(EAR_KEYS, rng), PROGRESSIONS[prog]),
    sound: [],
    facts: ['ear:prog'],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const HARMONY_ORDER = [
  'harm:why',
  'harm:stack',
  'harm:pattern',
  'harm:any',
  'harm:numerals',
  'harm:to-chord',
  'harm:to-numeral',
  'harm:staff',
  'harm:primary',
  'harm:function',
  'harm:neck',
  'harm:progression',
  'harm:pop',
  'harm:jazz',
  'harm:ear-why',
  'harm:ear-home',
  'harm:ear-four-five',
  'harm:ear-prog',
]
/** Explained on a card, not quizzed on their own. */
export const HARMONY_INTRO = ['harm:why', 'harm:ear-why']

export const isHarmonyItem = (item: string) => item.startsWith('harm:')
/**
 * Facts practiced on these tapes: the chord on each scale note ("hd:6"), numerals ("hrn:2"), the
 * main chords ("hprim:V") and their roots on the neck ("hbox:IV"), progressions ("hprog:ii-V-I"),
 * and hearing them ("ear:home", "ear:four-five", "ear:prog").
 */
export const isHarmonyFact = (fact: string) => /^(hd|hrn|hprim|hbox|hprog):/.test(fact) || /^ear:(home|four-five|prog)$/.test(fact)

const POP = ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V']
const REVIEW_KEYS: KeyId[] = ['C', 'G', 'D', 'F', 'A']
const degreeFact = (value: string) => (/^[1-7]$/.test(value) ? Number(value) - 1 : null)
const PRIMARY_NUMERALS = ['I', 'IV', 'V']
/** The listening facts, the idea each is taught in, and how each is named. */
const EAR_FACTS: Record<string, { item: string; name: string }> = {
  home: { item: 'harm:ear-home', name: 'Hearing home' },
  'four-five': { item: 'harm:ear-four-five', name: 'Hearing IV or V' },
  prog: { item: 'harm:ear-prog', name: 'Hearing progressions' },
}

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function harmonyItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'hd':
      return degreeFact(value) !== null ? 'harm:pattern' : null
    case 'hrn':
      return degreeFact(value) !== null ? 'harm:to-chord' : null
    case 'hprim':
      return PRIMARY_NUMERALS.includes(value) ? 'harm:primary' : null
    case 'hbox':
      return value === 'IV' || value === 'V' ? 'harm:neck' : null
    case 'hprog':
      return !isOneOf(value, PROGRESSION_IDS) ? null : value === 'I-IV-V-I' ? 'harm:progression' : value === 'ii-V-I' ? 'harm:jazz' : 'harm:pop'
    case 'ear':
      return Object.hasOwn(EAR_FACTS, value) ? EAR_FACTS[value].item : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function harmonyCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const keys = l.keys ?? ['C']
  const progs = l.progressions ?? POP
  const even = turn % 2 === 0
  switch (item) {
    case 'harm:stack':
      return makeChordOnDegree(id, keys, rng, l.showScale)
    case 'harm:pattern':
      return makeDegreeQuality(id, rng)
    case 'harm:any':
      return makeChordOnDegree(id, keys, rng)
    case 'harm:numerals':
    case 'harm:to-chord':
      return makeNumeralToChord(id, keys, rng)
    case 'harm:to-numeral':
      return makeChordToNumeral(id, keys, rng)
    case 'harm:staff':
      return makeNumeralRead(id, keys, rng)
    case 'harm:primary':
      return makePrimaryChord(id, keys, false, rng)
    case 'harm:function':
      return makePrimaryChord(id, keys, true, rng)
    case 'harm:neck':
      return makeBoxFind(id, rng)
    case 'harm:progression':
      return makeProgressionSpell(id, keys, ['I-IV-V-I'], rng)
    case 'harm:pop':
      return even ? makeProgressionSpell(id, keys, ['I-V-vi-IV', 'I-vi-IV-V'], rng) : makeProgressionName(id, keys, POP, rng)
    case 'harm:jazz':
      return even ? makeProgressionSpell(id, keys, ['ii-V-I'], rng) : makeProgressionName(id, keys, PROGRESSION_IDS, rng, 'ii-V-I')
    case 'harm:ear-home':
      return makeCadenceHear(id, rng)
    case 'harm:ear-four-five':
      return makeFourFiveHear(id, rng)
    case 'harm:ear-prog':
      return makeProgressionHear(id, progs, rng)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function harmonyReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  const d = degreeFact(value)
  switch (kind) {
    case 'hd':
      return d === null ? null : rng() < 0.5 ? makeDegreeQuality(id, rng, d) : makeChordOnDegree(id, REVIEW_KEYS, rng, false, d)
    case 'hrn':
      return d === null ? null : rng() < 0.5 ? makeNumeralToChord(id, REVIEW_KEYS, rng, d) : makeChordToNumeral(id, REVIEW_KEYS, rng, d)
    case 'hprim':
      return PRIMARY_NUMERALS.includes(value) ? makePrimaryChord(id, REVIEW_KEYS, rng() < 0.5, rng, PRIMARY[PRIMARY_NUMERALS.indexOf(value)]) : null
    case 'hbox':
      return value === 'IV' || value === 'V' ? makeBoxFind(id, rng, value === 'IV' ? 3 : 4) : null
    case 'hprog':
      if (!isOneOf(value, PROGRESSION_IDS)) return null
      return rng() < 0.5 ? makeProgressionSpell(id, REVIEW_KEYS, [value], rng) : makeProgressionName(id, REVIEW_KEYS, [value], rng)
    case 'ear':
      if (value === 'home') return makeCadenceHear(id, rng)
      if (value === 'four-five') return makeFourFiveHear(id, rng)
      return value === 'prog' ? makeProgressionHear(id, POP, rng) : null
    default:
      return null
  }
}

/** "The chord on the 6th note", "The V chord, the dominant"; null if it isn't one of these facts. */
export function describeHarmonyFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  const d = degreeFact(value)
  switch (kind) {
    case 'hd':
      return d === null ? null : `The chord on the ${degreeName(d + 1)} note`
    case 'hrn':
      return d === null ? null : `The ${NUMERALS[d]} chord, by numeral`
    case 'hprim':
      return PRIMARY_NUMERALS.includes(value) ? `The ${value} chord, the ${['tonic', 'subdominant', 'dominant'][PRIMARY_NUMERALS.indexOf(value)]}` : null
    case 'hbox':
      return value === 'IV' || value === 'V' ? `Finding ${value} on the neck` : null
    case 'hprog':
      return isOneOf(value, PROGRESSION_IDS) ? `The ${progLabel(value)} progression` : null
    case 'ear':
      return Object.hasOwn(EAR_FACTS, value) ? EAR_FACTS[value].name : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const RUST = '#b5473a'
/** The chords of a key, colored by kind: minor in amber, diminished in rust. */
const kindColors = (key: KeyId) => keyTriads(key).map((c) => (c.quality === 'min' ? PAPER_HIGHLIGHT : c.quality === 'dim' ? RUST : undefined))
const rootNames = (key: KeyId, degrees = ALL_DEGREES) => degrees.map((d) => toneName(keyTriads(key)[d].tones[0]))
/** The I, IV and V roots on the neck, from G at the 3rd fret of the 6th string. */
const G_BOX: Card['board'] = { region: { strings: [0, 1], minFret: 1, maxFret: 6 }, markers: [on(0, 3, 'root'), on(1, 3), on(1, 5)] }

const HARMONY_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'harm:why': () => ({
    title: 'Why chords in a key',
    subtitle: 'The chords a song uses',
    hook: 'A song in a key mostly uses chords built from that key’s own notes. Learn which chords those are and you can guess most of a song’s chords before you hear them. This tape builds them from the major scale.',
    onGuitar: 'That’s how players jam on songs they’ve never heard: know the key, and the likely chords follow.',
    score: { measures: [chordsScore('C', ALL_DEGREES)], labels: rootNames('C') },
    listen: heard('C', ALL_DEGREES),
    sound: [],
  }),
  'harm:stack': () => ({
    title: 'Stacking on every note',
    subtitle: 'Seven notes, seven chords',
    hook: 'Build a triad on each note of the C major scale, using only the scale’s own notes: C E G on C, D F A on D, E G B on E, and so on up to B D F on B. That gives seven chords, one on each note: C major, D minor, E minor, F major, G major, A minor and B diminished.',
    onGuitar: 'These are the chords you’ll meet most in a song in C: C, F and G, with D minor, E minor and A minor for color.',
    score: { measures: [chordsScore('C', ALL_DEGREES)], labels: rootNames('C') },
    listen: heard('C', ALL_DEGREES),
    sound: [],
  }),
  'harm:pattern': () => ({
    title: 'The pattern',
    subtitle: 'Major, minor, minor, major, major, minor, diminished',
    hook: 'Every major key has the same pattern of chords on its seven notes: major, minor, minor, major, major, minor, diminished. The 1st, 4th and 5th are major; the 2nd, 3rd and 6th are minor; the 7th is diminished. Learn it once and you know the chords of every major key. Here the minor ones are in amber and the diminished one in red.',
    score: { measures: [chordsScore('C', ALL_DEGREES)], labels: ALL_DEGREES.map((d) => String(d + 1)), colors: kindColors('C') },
    listen: heard('C', ALL_DEGREES),
    sound: [],
  }),
  'harm:any': () => ({
    title: 'Chords in any key',
    subtitle: 'Count up, then use the pattern',
    hook: 'To find the chord on any note of a key, count up the scale to that note, then use the pattern for its kind. The 6th note of G major is E, and the chord on the 6th note is minor, so it’s E minor. In D major the 6th note is B: B minor.',
    onGuitar: 'That’s why songs in G so often use E minor, and songs in D use B minor.',
    score: { measures: [chordsScore('G', ALL_DEGREES)], keySig: 'G', labels: rootNames('G'), colors: kindColors('G') },
    listen: heard('G', ALL_DEGREES),
    sound: [],
  }),
  'harm:numerals': () => ({
    title: 'Roman numerals',
    subtitle: 'Naming chords by number',
    hook: 'Chords in a key are named by the number of the note they’re built on, written in Roman numerals: I, II, III, IV, V, VI, VII. Capitals mean a major chord, lowercase means minor, and a small circle (°) means diminished. So a major key’s chords are I, ii, iii, IV, V, vi and vii°.',
    onGuitar: 'Numerals work in every key at once: “it’s a I–IV–V song” tells you the chords in whatever key you play it.',
    score: { measures: [chordsScore('C', ALL_DEGREES)], labels: NUMERALS, colors: kindColors('C') },
    listen: heard('C', ALL_DEGREES),
    sound: [],
  }),
  'harm:to-chord': () => ({
    title: 'From numeral to chord',
    subtitle: 'Count, then read the case',
    hook: 'To turn a numeral into a chord, count up the key’s scale to that number, then read the case for its kind. ii in D major: count D, E. Lowercase means minor, so ii is E minor. V in D major: count D E F♯ G A. A capital means major: A major.',
    score: { measures: [chordsScore('D', [1, 4])], keySig: 'D', labels: ['ii', 'V'] },
    listen: heard('D', [1, 4]),
    sound: [],
  }),
  'harm:to-numeral': () => ({
    title: 'From chord to numeral',
    subtitle: 'Find its note in the scale',
    hook: 'To go the other way, find the chord’s root in the key’s scale and count from the home note. In C major, A is the 6th note and A minor is minor, so it’s vi. F major sits on the 4th note: IV.',
    score: { measures: [chordsScore('C', [5, 3])], labels: ['vi', 'IV'] },
    listen: heard('C', [5, 3]),
    sound: [],
  }),
  'harm:staff': () => ({
    title: 'Numerals on the staff',
    subtitle: 'Name the chord, then count',
    hook: 'On the staff, name the chord first: read its notes with the key signature and find its root, as on tape 36. Then count up from the key’s home note. In G major, the snowman A C E is A minor, on the 2nd note: ii.',
    score: { measures: [chordScore('G', 1)], keySig: 'G', labels: ['ii'] },
    listen: heard('G', [1]),
    sound: [],
  }),
  'harm:primary': () => ({
    title: 'I, IV and V',
    subtitle: 'The three major chords',
    hook: 'The three major chords in a key, I, IV and V, are the backbone of countless songs in rock, blues, folk and country. In G major they’re G, C and D. Some songs use nothing else.',
    onGuitar: 'Learn I, IV and V in a few keys and you can already play along with a huge number of songs.',
    score: { measures: [chordsScore('G', PRIMARY)], keySig: 'G', labels: ['I', 'IV', 'V'] },
    board: G_BOX,
    listen: heard('G', PRIMARY),
    sound: [],
  }),
  'harm:function': () => ({
    title: 'Home, away and back',
    subtitle: 'What each one does',
    hook: 'Each of the three has a job. I is home, also called the tonic: songs usually end there. IV moves away from home; it’s called the subdominant. V builds tension that pulls back home; it’s called the dominant. Press ▶ Hear: I, IV, V, then home to I.',
    score: { measures: [chordsScore('G', [0, 3, 4, 0])], keySig: 'G', labels: ['I', 'IV', 'V', 'I'] },
    listen: heard('G', [0, 3, 4, 0]),
    sound: [],
  }),
  'harm:neck': () => ({
    title: 'I, IV and V on the neck',
    subtitle: 'One shape, any key',
    hook: 'Put the I chord’s root on the 6th string. IV’s root is right next to it on the 5th string, same fret: a perfect 4th up, the shape from tape 28. V’s root is two frets further along: a perfect 5th up. With G at the 3rd fret, C is at the 3rd fret of the 5th string and D at the 5th.',
    onGuitar: 'Move the shape to any fret and it gives you I, IV and V in a new key. Rock and blues players think this way all the time.',
    board: G_BOX,
    sound: [43, 48, 50],
  }),
  'harm:progression': () => ({
    title: 'Progressions',
    subtitle: 'Chords in order',
    hook: 'A chord progression is the order a song’s chords come in, usually a few chords repeated. Written in numerals, a progression works in any key: I–IV–V–I is C, F, G, C in C major, and G, C, D, G in G major.',
    onGuitar: 'Learn a song as numerals and you can play it in any key, to suit any singer.',
    score: { measures: [chordsScore('C', [0, 3, 4, 0])], labels: ['I', 'IV', 'V', 'I'] },
    listen: heard('C', [0, 3, 4, 0]),
    sound: [],
  }),
  'harm:pop': () => ({
    title: 'The pop progressions',
    subtitle: 'I–V–vi–IV and I–vi–IV–V',
    hook: 'I–V–vi–IV is behind a huge number of pop songs: C, G, A minor, F in C major. Its older cousin, I–vi–IV–V, the doo-wop progression, uses the same four chords in another order: C, A minor, F, G.',
    score: { measures: [chordsScore('C', [0, 4, 5, 3])], labels: ['I', 'V', 'vi', 'IV'] },
    listen: heard('C', [0, 4, 5, 3]),
    sound: [],
  }),
  'harm:jazz': () => ({
    title: 'ii–V–I',
    subtitle: 'Stepping home',
    hook: 'ii–V–I moves toward home in 5ths: D minor, G, C in C major. Each root is a 5th above the next one, so every step feels like it’s heading home. It’s the most common move in jazz, and it turns up in pop too.',
    score: { measures: [chordsScore('C', [1, 4, 0])], labels: ['ii', 'V', 'I'] },
    listen: heard('C', [1, 4, 0]),
    sound: [],
  }),
  'harm:ear-why': () => ({
    title: 'Why hear progressions',
    subtitle: 'Following the chords',
    hook: 'Most songs repeat a few chords. Hearing where a progression goes, toward home or away from it, is how players follow along and learn songs by ear. Press ▶ Hear: I–IV–V–I.',
    score: { measures: [chordsScore('C', [0, 3, 4, 0])], labels: ['I', 'IV', 'V', 'I'] },
    listen: heard('C', [0, 3, 4, 0]),
    sound: [],
  }),
  'harm:ear-home': () => ({
    title: 'Home or away',
    subtitle: 'Does it end on I?',
    hook: 'A progression that ends on I sounds finished, like the end of a sentence. One that ends anywhere else, especially on V, is left hanging, like a question. Here: I–IV–V–I, then I–IV–I–V.',
    score: { measures: [chordsScore('C', [0, 3, 4, 0]), chordsScore('C', [0, 3, 0, 4])], labels: ['I', 'IV', 'V', 'I', 'I', 'IV', 'I', 'V'] },
    listen: heard('C', [0, 3, 4, 0, 0, 3, 0, 4]),
    sound: [],
  }),
  'harm:ear-four-five': () => ({
    title: 'IV or V',
    subtitle: 'Away, or pulling back',
    hook: 'After I, IV sounds like a step away: open and relaxed. V sounds like tension, leaning to come home. Listen to the second chord. Here: I then IV, then I then V.',
    score: { measures: [chordsScore('C', [0, 3]), chordsScore('C', [0, 4])], labels: ['I', 'IV', 'I', 'V'] },
    listen: heard('C', [0, 3, 0, 4]),
    sound: [],
  }),
  'harm:ear-prog': () => ({
    title: 'Which progression',
    subtitle: 'Listen for home and the minor chord',
    hook: 'For whole progressions, listen for two things: where home (I) comes back, and where the minor vi darkens things. I–IV–V–I has no minor chord. I–V–vi–IV puts vi third; I–vi–IV–V puts it second and ends on V, left hanging.',
    score: { measures: [chordsScore('C', [0, 4, 5, 3])], labels: ['I', 'V', 'vi', 'IV'] },
    listen: heard('C', [0, 4, 5, 3]),
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function harmonyCard(item: string, counter: string): Card {
  return { ...HARMONY_CARDS[item](), counter }
}
