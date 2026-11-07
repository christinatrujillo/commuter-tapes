import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import { LETTERS, midiAt, pitchClass, type Region } from '../music/notes'
import { KEYS, type KeyId, type ScoreMeasure } from '../music/score'
import {
  chordSymbol,
  degreeName,
  harmonicChords,
  harmonicMinorScale,
  majorKeyOfMinor,
  MINOR_NUMERALS,
  minorKeyName as keyName,
  minorKeyTriads,
  minorScaleOn,
  parseTone,
  scaleScore,
  scaleSound,
  spelled,
  toneId,
  toneName,
  tonePc,
  TRIAD_NAMES,
  type Tone,
  type TriadQuality,
} from '../music/theory'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import { PAPER_HIGHLIGHT, PAPER_RUST } from '../lib/color'
import { capitalize } from '../lib/text'
import type { Question } from './questions'
import { chordMeasures, triadScore, triadSound } from './triads'

/**
 * Minor keys: the chords of the natural minor scale, the harmonic minor's raised 7th and the
 * chords it makes, minor progressions, telling a major key from its relative minor, and hearing it.
 */

/** The minor keys these tapes use, by their home notes. */
const MINOR_KEYS = ['A', 'E', 'D', 'B', 'G', 'C']
const KINDS: TriadQuality[] = ['maj', 'min', 'dim']
const sigOf = (tonic: string): KeyId => majorKeyOfMinor(tonic)!
const known = (tonics: string[]) => {
  const own = tonics.filter((t) => isOneOf(t, MINOR_KEYS))
  return own.length ? own : MINOR_KEYS.slice(0, 3)
}
const chordName = (c: { tones: Tone[]; quality: TriadQuality }) => `${toneName(c.tones[0])} ${TRIAD_NAMES[c.quality]}`

/** The written octave of a chord's root, so a key's chords climb the staff from its home note. */
function rootOctave(tonic: string, root: Tone): number {
  return 4 + (LETTERS.indexOf(root.letter) < LETTERS.indexOf(parseTone(tonic).letter) ? 1 : 0)
}
const chordStaff = (tonic: string, tones: Tone[]): ScoreMeasure => triadScore(tones, true, sigOf(tonic), rootOctave(tonic, tones[0]))
const chordSound = (tonic: string, tones: Tone[]) => triadSound(tones, rootOctave(tonic, tones[0]))

/** Near-miss names for the chord on note `d`: the same root as another kind, then its neighbors. */
function nearChords(tonic: string, d: number): string[] {
  const chords = minorKeyTriads(tonic)
  const root = chords[d].tones[0]
  const kinds = KINDS.filter((q) => q !== chords[d].quality).map((q) => `${toneName(root)} ${TRIAD_NAMES[q]}`)
  return [...new Set([kinds[0], chordName(chords[(d + 1) % 7]), chordName(chords[(d + 6) % 7]), kinds[1]])]
}

// ---------------------------------------------------------------------------
// Chords in minor keys
// ---------------------------------------------------------------------------

/** "What's the chord on the 4th note of A minor?" With `help`, the minor scale is on the staff to count along. */
export function makeMinorChordOnDegree(id: number, tonics: string[], rng: Rng, help = false, only?: number): Question {
  const tonic = pick(known(tonics), rng)
  const d = only ?? between(1, 6, rng)
  const chord = minorKeyTriads(tonic)[d]
  const right = chordName(chord)
  const options = shuffle([right, ...nearChords(tonic, d).filter((n) => n !== right).slice(0, 3)], rng)
  const scale = minorScaleOn(tonic)
  const where = `${degreeName(d + 1)} note of ${keyName(tonic)}`
  return {
    id,
    kind: 'minorChordOnDegree',
    ask: { text: `What’s the chord on the ${where}?`, hl: where },
    options,
    answer: options.indexOf(right),
    why: `Count up ${keyName(tonic)}: ${scale.slice(0, d + 1).map(toneName).join(' ')}. The chord on the ${degreeName(d + 1)} note of a minor key is always ${TRIAD_NAMES[chord.quality]}, so it’s ${right} (${spelled(chord.tones)}).`,
    score: help
      ? { measures: scaleScore(scale), labels: [...scale, scale[0]].map(toneName), marker: d, afterMeasures: [triadScore(chord.tones, true)], after: [spelled(chord.tones)] }
      : { measures: [[]], keySig: sigOf(tonic), afterMeasures: [chordStaff(tonic, chord.tones)], after: [spelled(chord.tones)] },
    sound: chordSound(tonic, chord.tones),
    facts: [`mh:${d + 1}`],
  }
}

/** "In any minor key, what kind of chord is on the 3rd note?" A minor on the staff as the example. */
export function makeMinorDegreeQuality(id: number, rng: Rng, only?: number): Question {
  const d = only ?? between(0, 6, rng)
  const chord = minorKeyTriads('A')[d]
  const options = KINDS.map((q) => capitalize(TRIAD_NAMES[q]))
  const scale = minorScaleOn('A')
  const where = `${degreeName(d + 1)} note`
  return {
    id,
    kind: 'minorDegreeQuality',
    ask: { text: `In any minor key, what kind of chord is on the ${where}?`, hl: where },
    options,
    answer: KINDS.indexOf(chord.quality),
    why: `Minor, diminished, major, minor, minor, major, major: the ${degreeName(d + 1)} is ${TRIAD_NAMES[chord.quality]}. In A minor, that’s ${chordName(chord)}.`,
    score: { measures: scaleScore(scale), labels: [...scale, scale[0]].map(toneName), marker: d, afterMeasures: [triadScore(chord.tones, true)], after: [chordName(chord)] },
    sound: chordSound('A', chord.tones),
    facts: [`mh:${d + 1}`],
  }
}

/** Near-miss numerals: the neighbors, and the right one in the wrong case. In scale order. */
function nearNumerals(d: number): string[] {
  const n = MINOR_NUMERALS[d]
  const bare = n.replace('°', '')
  const wrongCase = bare === bare.toUpperCase() ? bare.toLowerCase() : bare.toUpperCase()
  const options = [MINOR_NUMERALS[(d + 6) % 7], n, wrongCase, MINOR_NUMERALS[(d + 1) % 7]]
  return [...new Set(options)]
}

/** "In E minor, which numeral is C major?" */
export function makeMinorNumeral(id: number, tonics: string[], rng: Rng, only?: number): Question {
  const tonic = pick(known(tonics), rng)
  const d = only ?? between(1, 6, rng)
  const chord = minorKeyTriads(tonic)[d]
  const options = nearNumerals(d)
  const scale = minorScaleOn(tonic)
  return {
    id,
    kind: 'minorNumeral',
    ask: { text: `In ${keyName(tonic)}, which numeral is ${chordName(chord)}?`, hl: chordName(chord) },
    options,
    answer: options.indexOf(MINOR_NUMERALS[d]),
    why: `${toneName(chord.tones[0])} is the ${degreeName(d + 1)} note of ${keyName(tonic)} (${scale.slice(0, d + 1).map(toneName).join(' ')}), and the chord is ${TRIAD_NAMES[chord.quality]}, so it’s ${MINOR_NUMERALS[d]}.`,
    score: { measures: [chordStaff(tonic, chord.tones)], keySig: sigOf(tonic), after: [spelled(chord.tones)] },
    sound: chordSound(tonic, chord.tones),
    facts: [`mrn:${d + 1}`],
  }
}

/** "In D minor, what's the VII chord?" */
export function makeMinorNumeralToChord(id: number, tonics: string[], rng: Rng, only?: number): Question {
  const tonic = pick(known(tonics), rng)
  const d = only ?? between(1, 6, rng)
  const chord = minorKeyTriads(tonic)[d]
  const right = chordName(chord)
  const options = shuffle([right, ...nearChords(tonic, d).filter((n) => n !== right).slice(0, 3)], rng)
  const scale = minorScaleOn(tonic)
  return {
    id,
    kind: 'minorNumeralToChord',
    ask: { text: `In ${keyName(tonic)}, what’s the ${MINOR_NUMERALS[d]} chord?`, hl: `${MINOR_NUMERALS[d]} chord` },
    options,
    answer: options.indexOf(right),
    why: `${MINOR_NUMERALS[d]} is the chord on the ${degreeName(d + 1)} note: count ${scale.slice(0, d + 1).map(toneName).join(' ')}. ${
      chord.quality === 'maj' ? 'Capitals mean major' : chord.quality === 'min' ? 'Lowercase means minor' : 'Lowercase with ° means diminished'
    }, so it’s ${right}.`,
    score: { measures: [[]], keySig: sigOf(tonic), afterMeasures: [chordStaff(tonic, chord.tones)], after: [spelled(chord.tones)] },
    sound: chordSound(tonic, chord.tones),
    facts: [`mrn:${d + 1}`],
  }
}

// ---------------------------------------------------------------------------
// Harmonic minor
// ---------------------------------------------------------------------------

/** "What's the 7th note of E harmonic minor?" */
export function makeHarmonicNote(id: number, tonics: string[], rng: Rng, only?: string): Question {
  const tonic = only ?? pick(known(tonics), rng)
  const natural = minorScaleOn(tonic)
  const scale = harmonicMinorScale(tonic)
  const right = toneName(scale[6])
  // Near misses: the natural 7th, the raised note's other spelling, and the 6th.
  const other = scale[6].acc === 1 ? toneName({ letter: LETTERS[(LETTERS.indexOf(scale[6].letter) + 1) % 7], acc: -1 }) : null
  const options = shuffle([...new Set([right, toneName(natural[6]), ...(other ? [other] : []), toneName(natural[5])])].slice(0, 4), rng)
  return {
    id,
    kind: 'harmonicNote',
    ask: { text: `What’s the 7th note of ${toneName(parseTone(tonic))} harmonic minor?`, hl: 'harmonic minor' },
    options,
    answer: options.indexOf(right),
    why: `${keyName(tonic)}’s 7th note is ${toneName(natural[6])}. Harmonic minor raises it a half step, to ${right}: ${scale.map(toneName).join(' ')}.`,
    score: { measures: scaleScore(natural), labels: [...natural, natural[0]].map(toneName), marker: 6, afterMeasures: scaleScore(scale), after: [...scale, scale[0]].map(toneName) },
    // The 6th, the raised 7th, and home an octave up: the gap, then the pull.
    sound: scaleSound(scale).slice(5),
    facts: [`hmin:${toneId(parseTone(tonic))}`],
  }
}

/** "In A minor, with the raised 7th, what's the V chord?" (or V7) */
export function makeHarmonicV(id: number, tonics: string[], rng: Rng, only?: 'V' | 'V7'): Question {
  const tonic = pick(known(tonics), rng)
  const which = only ?? pick<'V' | 'V7'>(['V', 'V7'], rng)
  const chords = harmonicChords(tonic)
  const chord = chords[which]
  const root = chord.tones[0]
  const right = chordSymbol(root, chord.kind)
  const natural = minorKeyTriads(tonic)[4]
  // Near misses: the natural minor v, the other of V and V7, and the minor 7th on the same root.
  const wrong = [chordSymbol(root, 'min'), chordSymbol(root, which === 'V' ? '7' : 'maj'), chordSymbol(root, 'm7'), chordSymbol(root, 'maj7')]
  const options = shuffle([right, ...[...new Set(wrong)].filter((w) => w !== right).slice(0, 3)], rng)
  return {
    id,
    kind: 'harmonicV',
    ask: { text: `In ${keyName(tonic)}, with the raised 7th, what’s the ${which} chord?`, hl: `${which} chord` },
    options,
    answer: options.indexOf(right),
    why: `In natural minor the 5th-note chord is ${chordName(natural)} (${spelled(natural.tones)}). Raising the 7th, ${toneName(natural.tones[1])} to ${toneName(chord.tones[1])}, makes it major: ${spelled(chords.V.tones)}${which === 'V7' ? `, and adding the 7th, ${toneName(chord.tones[3])}, makes it ${right}` : ''}.`,
    score: { measures: [[]], keySig: sigOf(tonic), afterMeasures: [chordStaff(tonic, chord.tones)], after: [right] },
    sound: [...chordSound(tonic, chord.tones), ...chordSound(tonic, minorKeyTriads(tonic)[0].tones)],
    facts: [`hmv:${which}`],
  }
}

/** "In A minor, what's the vii°7 chord?" */
export function makeMinorDim7(id: number, tonics: string[], rng: Rng): Question {
  const tonic = pick(known(tonics), rng)
  const chord = harmonicChords(tonic)['vii°7']
  const root = chord.tones[0]
  const right = chordSymbol(root, 'dim7')
  const natural = minorScaleOn(tonic)[6]
  // Near misses: the half-diminished on the same root, the dominant 7th, and the unraised root.
  const wrong = [chordSymbol(root, 'm7b5'), chordSymbol(root, '7'), chordSymbol(natural, 'dim7')]
  const options = shuffle([right, ...wrong], rng)
  return {
    id,
    kind: 'minorDim7',
    ask: { text: `In ${keyName(tonic)}, what’s the vii°7 chord?`, hl: 'vii°7 chord' },
    options,
    answer: options.indexOf(right),
    why: `vii°7 sits on the raised 7th, ${toneName(root)}. Stack minor 3rds from it: ${spelled(chord.tones)}. That’s a diminished 7th, ${right}.`,
    score: { measures: [[]], keySig: sigOf(tonic), afterMeasures: [chordStaff(tonic, chord.tones)], after: [right] },
    sound: chordSound(tonic, chord.tones),
    facts: ['hmv:vii°7'],
  }
}

// ---------------------------------------------------------------------------
// Minor progressions
// ---------------------------------------------------------------------------

type Step = 'i' | 'ii°' | 'iv' | 'v' | 'VI' | 'VII' | 'V7'
/** The progressions the tapes teach, as numerals. */
const MINOR_PROGRESSIONS: Record<string, Step[]> = {
  'i-iv-v-i': ['i', 'iv', 'v', 'i'],
  'i-VI-VII-i': ['i', 'VI', 'VII', 'i'],
  'i-iv-V7-i': ['i', 'iv', 'V7', 'i'],
  'iidim-V7-i': ['ii°', 'V7', 'i'],
}
const PROGRESSION_IDS = Object.keys(MINOR_PROGRESSIONS)
const progLabel = (id: string) => MINOR_PROGRESSIONS[id].join('–')

/** One step of a minor progression, as notes and a symbol. */
function stepChord(tonic: string, step: Step): { tones: Tone[]; symbol: string } {
  if (step === 'V7') {
    const c = harmonicChords(tonic).V7
    return { tones: c.tones, symbol: chordSymbol(c.tones[0], c.kind) }
  }
  const c = minorKeyTriads(tonic)[MINOR_NUMERALS.indexOf(step)]
  return { tones: c.tones, symbol: chordSymbol(c.tones[0], c.quality) }
}
const symbols = (tonic: string, steps: Step[]) => steps.map((s) => stepChord(tonic, s).symbol).join(' – ')

/** "In A minor, what are the chords of i–iv–V7–i?" */
export function makeMinorProgressionSpell(id: number, tonics: string[], progs: string[], rng: Rng, only?: string): Question {
  const tonic = pick(known(tonics), rng)
  const offered = progs.filter((p) => isOneOf(p, PROGRESSION_IDS))
  const prog = only ?? pick(offered.length ? offered : PROGRESSION_IDS.slice(0, 2), rng)
  const steps = MINOR_PROGRESSIONS[prog]
  const right = symbols(tonic, steps)
  // Near misses: the natural v where V7 belongs (or the other way round), the other progressions, and the relative major's chords on the same numerals.
  const swapped = steps.map((s): Step => (s === 'V7' ? 'v' : s === 'v' ? 'V7' : s))
  const others = PROGRESSION_IDS.filter((p) => p !== prog).map((p) => symbols(tonic, MINOR_PROGRESSIONS[p]))
  const options = shuffle([right, ...[...new Set([symbols(tonic, swapped), ...others])].filter((o) => o !== right).slice(0, 3)], rng)
  return {
    id,
    kind: 'minorProgressionSpell',
    ask: { text: `In ${keyName(tonic)}, what are the chords of ${progLabel(prog)}?`, hl: progLabel(prog) },
    options,
    answer: options.indexOf(right),
    why: `In ${keyName(tonic)}: ${[...new Set(steps)].map((s) => `${s} is ${stepChord(tonic, s).symbol}`).join(', ')}${steps.includes('V7') ? ' (V7 takes the raised 7th)' : ''}. So it’s ${right}.`,
    score: { measures: [[]], keySig: sigOf(tonic), afterMeasures: [steps.flatMap((s) => chordStaff(tonic, stepChord(tonic, s).tones))], after: steps },
    sound: steps.flatMap((s) => chordSound(tonic, stepChord(tonic, s).tones)),
    facts: [`mprog:${prog}`],
  }
}

/** "In E minor, which progression is Em – C – D – Em?" */
export function makeMinorProgressionName(id: number, tonics: string[], progs: string[], rng: Rng, only?: string): Question {
  const tonic = pick(known(tonics), rng)
  const offered = progs.filter((p) => isOneOf(p, PROGRESSION_IDS))
  const prog = only ?? pick(offered.length ? offered : PROGRESSION_IDS, rng)
  const steps = MINOR_PROGRESSIONS[prog]
  const options = PROGRESSION_IDS.map(progLabel)
  const chords = symbols(tonic, steps)
  return {
    id,
    kind: 'minorProgressionName',
    ask: { text: `In ${keyName(tonic)}, which progression is ${chords}?`, hl: chords },
    options,
    answer: options.indexOf(progLabel(prog)),
    why: `In ${keyName(tonic)}, ${[...new Set(steps)].map((s) => `${stepChord(tonic, s).symbol} is ${s}`).join(', ')}: ${progLabel(prog)}.`,
    score: { measures: [steps.flatMap((s) => chordStaff(tonic, stepChord(tonic, s).tones))], keySig: sigOf(tonic), after: steps },
    sound: steps.flatMap((s) => chordSound(tonic, stepChord(tonic, s).tones)),
    facts: [`mprog:${prog}`],
  }
}

// ---------------------------------------------------------------------------
// Finding the key
// ---------------------------------------------------------------------------

/** Major keys whose relative minors these tapes use: C (A minor), G (E minor) and so on. */
const SIGNATURE_KEYS: KeyId[] = ['C', 'G', 'D', 'F', 'Bb', 'Eb']
const majorKeyName = (key: KeyId) => KEYS[key].name
const relativeMinorOf = (key: KeyId) => MINOR_KEYS.find((t) => majorKeyOfMinor(t) === key)!
/** "two sharps (F♯ and C♯)", for reading inside a sentence. */
const signatureText = (key: KeyId) => (KEYS[key].signature.includes(':') ? `${KEYS[key].signature.replace(': ', ' (')})` : KEYS[key].signature)
/** Another key, for near misses: the next one in the list, with its own relative minor. */
const otherKey = (key: KeyId, step: number) => SIGNATURE_KEYS[(SIGNATURE_KEYS.indexOf(key) + step) % SIGNATURE_KEYS.length]

/** "With two sharps, a song starts and ends on Bm. Which key?" */
export function makeKeyFromHome(id: number, rng: Rng): Question {
  const key = pick(SIGNATURE_KEYS, rng)
  const minor = rng() < 0.5
  const tonic = relativeMinorOf(key)
  const right = minor ? keyName(tonic) : majorKeyName(key)
  const home = minor ? `${toneName(parseTone(tonic))}m` : toneName(parseTone(key))
  // The major key's home chord is the minor scale's 3rd, 5th and 7th notes (C E G for A minor).
  const s = minorScaleOn(tonic)
  const homeTones = minor ? minorKeyTriads(tonic)[0].tones : [s[2], s[4], s[6]]
  const other = otherKey(key, 1)
  const options = shuffle([majorKeyName(key), keyName(tonic), majorKeyName(other), keyName(relativeMinorOf(other))], rng)
  return {
    id,
    kind: 'keyFromHome',
    ask: { text: `With ${signatureText(key)}, a song starts and ends on ${home}. Which key is it in?`, hl: home },
    options,
    answer: options.indexOf(right),
    why: `${capitalize(signatureText(key))} means ${majorKeyName(key)} or its relative minor, ${keyName(tonic)}. Songs usually start and end at home, and here that’s ${home}, so it’s ${right}.`,
    score: { measures: [[]], keySig: key, afterMeasures: [chordStaff(tonic, homeTones)], after: [home] },
    sound: chordSound(tonic, homeTones),
    facts: ['kfind:home'],
  }
}

/** "Which key is Am – Dm – E7 – Am in?" A progression that starts and ends at home, in a major key or its relative minor. */
export function makeKeyFromChords(id: number, rng: Rng): Question {
  const key = pick(SIGNATURE_KEYS, rng)
  const tonic = relativeMinorOf(key)
  const style = pick(['major', 'harmonic', 'natural'] as const, rng)
  const s = minorScaleOn(tonic)
  // Major keys: I–IV–V–I on the relative major. Minor: i–iv–V7–i (with the raised 7th) or i–VI–VII–i.
  const majorChords = [
    [s[2], s[4], s[6]],
    [s[5], s[0], s[2]],
    [s[6], s[1], s[3]],
    [s[2], s[4], s[6]],
  ]
  const chords =
    style === 'major'
      ? majorChords.map((c) => ({ tones: c, symbol: chordSymbol(c[0], 'maj') }))
      : (style === 'harmonic' ? MINOR_PROGRESSIONS['i-iv-V7-i'] : MINOR_PROGRESSIONS['i-VI-VII-i']).map((step) => stepChord(tonic, step))
  const listed = chords.map((c) => c.symbol).join(' – ')
  const right = style === 'major' ? majorKeyName(key) : keyName(tonic)
  const other = otherKey(key, 2)
  const options = shuffle([majorKeyName(key), keyName(tonic), majorKeyName(other), keyName(relativeMinorOf(other))], rng)
  const raised = harmonicChords(tonic).V.tones[1]
  const why =
    style === 'major'
      ? `It starts and ends on ${chords[0].symbol}, with no raised 7th, so it’s ${right}.`
      : style === 'harmonic'
        ? `It starts and ends on ${chords[0].symbol}, and ${chords[2].symbol} has ${toneName(raised)}, the raised 7th of ${keyName(tonic)}: it’s ${right}.`
        : `It uses the same chords as ${majorKeyName(key)}, but it starts and ends on ${chords[0].symbol}, so home is ${keyName(tonic)}.`
  return {
    id,
    kind: 'keyFromChords',
    ask: { text: `Which key is ${listed} in?`, hl: listed },
    options,
    answer: options.indexOf(right),
    why,
    score: { measures: [chords.flatMap((c) => chordStaff(tonic, c.tones))], keySig: key, after: chords.map((c) => c.symbol) },
    sound: chords.flatMap((c) => chordSound(tonic, c.tones)),
    facts: ['kfind:chords'],
  }
}

// ---------------------------------------------------------------------------
// Hearing minor keys
// ---------------------------------------------------------------------------

const EAR_TONICS = ['A', 'E', 'D', 'G', 'C']
const heard = (tonic: string, chords: Tone[][]) => ({ notes: chords.flatMap((c) => chordSound(tonic, c)), chord: 3 })

/** Hear a progression: major key or minor key? */
export function makeKeyModeHear(id: number, rng: Rng, only?: 'Major' | 'Minor'): Question {
  const mode = only ?? pick<'Major' | 'Minor'>(['Major', 'Minor'], rng)
  const tonic = pick(EAR_TONICS, rng)
  const s = minorScaleOn(tonic)
  const t = minorKeyTriads(tonic)
  const chords =
    mode === 'Major'
      ? [t[2], t[5], t[6], t[2]].map((c) => c.tones)
      : pick([[t[0], t[3], t[4], t[0]], [t[0], t[5], t[6], t[0]]], rng).map((c) => c.tones)
  const home = mode === 'Major' ? `${toneName(s[2])} major` : `${toneName(s[0])} minor`
  return {
    id,
    kind: 'keyModeHear',
    ask: { text: 'Major key or minor key?' },
    options: ['Major', 'Minor'],
    answer: mode === 'Major' ? 0 : 1,
    why: `${mode}: it comes home to ${home}, ${mode === 'Major' ? 'bright and settled' : 'darker, with a minor chord as home'}.`,
    listen: heard(tonic, chords),
    sound: [],
    facts: ['ear:keymode'],
  }
}

/** Hear i, then the minor v or the harmonic major V, then i: which? */
export function makeMinorVHear(id: number, rng: Rng, only?: 'v' | 'V'): Question {
  const which = only ?? pick<'v' | 'V'>(['v', 'V'], rng)
  const tonic = pick(EAR_TONICS, rng)
  const i = minorKeyTriads(tonic)[0].tones
  const five = which === 'V' ? harmonicChords(tonic).V.tones : minorKeyTriads(tonic)[4].tones
  return {
    id,
    kind: 'minorVHear',
    ask: { text: 'Minor v or major V?' },
    options: ['Minor v', 'Major V'],
    answer: which === 'v' ? 0 : 1,
    why:
      which === 'V'
        ? `Major V: its middle note, ${toneName(five[1])}, is the raised 7th, a half step below home, so it pulls back hard.`
        : `Minor v: its middle note, ${toneName(five[1])}, sits a whole step below home, so it leads back gently.`,
    listen: heard(tonic, [i, five, i]),
    sound: [],
    facts: ['ear:minorv'],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const MINOR_ORDER = [
  'mkey:why',
  'mkey:stack',
  'mkey:pattern',
  'mkey:numerals',
  'mkey:harmonic-why',
  'mkey:harmonic-scale',
  'mkey:harmonic-v',
  'mkey:dim7',
  'mkey:progressions',
  'mkey:harmonic-progressions',
  'mkey:find-why',
  'mkey:find-home',
  'mkey:find-raised',
  'mkey:ear-why',
  'mkey:ear-mode',
  'mkey:ear-v',
]
/** Explained on a card, not quizzed on their own. */
export const MINOR_INTRO = ['mkey:why', 'mkey:harmonic-why', 'mkey:find-why', 'mkey:ear-why']

export const isMinorItem = (item: string) => item.startsWith('mkey:')
/**
 * Facts practiced on these tapes: the chord on each minor-scale note ("mh:4"), minor numerals
 * ("mrn:6"), harmonic minor ("hmin:A"), its V, V7 and vii°7 ("hmv:V7"), minor progressions
 * ("mprog:i-iv-v-i"), finding the key ("kfind:home") and hearing it ("ear:keymode", "ear:minorv").
 */
export const isMinorFact = (fact: string) => /^(mh|mrn|hmin|hmv|mprog|kfind):/.test(fact) || /^ear:(keymode|minorv)$/.test(fact)

const degreeFact = (value: string) => (/^[1-7]$/.test(value) ? Number(value) - 1 : null)
const HMV = ['V', 'V7', 'vii°7']
const NATURAL_PROGS = ['i-iv-v-i', 'i-VI-VII-i']

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function minorItemFor(fact: string): string | null {
  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'mh':
      return degreeFact(value) !== null ? 'mkey:pattern' : null
    case 'mrn':
      return degreeFact(value) !== null ? 'mkey:numerals' : null
    case 'hmin':
      return isOneOf(value, MINOR_KEYS) ? 'mkey:harmonic-scale' : null
    case 'hmv':
      return value === 'vii°7' ? 'mkey:dim7' : HMV.includes(value) ? 'mkey:harmonic-v' : null
    case 'mprog':
      return !isOneOf(value, PROGRESSION_IDS) ? null : NATURAL_PROGS.includes(value) ? 'mkey:progressions' : 'mkey:harmonic-progressions'
    case 'kfind':
      return value === 'home' ? 'mkey:find-home' : value === 'chords' ? 'mkey:find-raised' : null
    case 'ear':
      return value === 'keymode' ? 'mkey:ear-mode' : value === 'minorv' ? 'mkey:ear-v' : null
    default:
      return null
  }
}

/** One question on a taught idea. `turn` alternates the kind of question. */
export function minorCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const tonics = l.minorKeys ?? []
  const progs = l.progressions ?? NATURAL_PROGS
  const even = turn % 2 === 0
  switch (item) {
    case 'mkey:stack':
      return makeMinorChordOnDegree(id, tonics, rng, l.showScale)
    case 'mkey:pattern':
      return makeMinorDegreeQuality(id, rng)
    case 'mkey:numerals':
      return even ? makeMinorNumeral(id, tonics, rng) : makeMinorNumeralToChord(id, tonics, rng)
    case 'mkey:harmonic-scale':
      return makeHarmonicNote(id, tonics, rng)
    case 'mkey:harmonic-v':
      return makeHarmonicV(id, tonics, rng)
    case 'mkey:dim7':
      return makeMinorDim7(id, tonics, rng)
    case 'mkey:progressions':
      return makeMinorProgressionSpell(id, tonics, NATURAL_PROGS, rng)
    case 'mkey:harmonic-progressions':
      return even ? makeMinorProgressionSpell(id, tonics, ['i-iv-V7-i', 'iidim-V7-i'], rng) : makeMinorProgressionName(id, tonics, progs, rng)
    case 'mkey:find-home':
      return makeKeyFromHome(id, rng)
    case 'mkey:find-raised':
      return makeKeyFromChords(id, rng)
    case 'mkey:ear-mode':
      return makeKeyModeHear(id, rng)
    case 'mkey:ear-v':
      return makeMinorVHear(id, rng)
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function minorReview(fact: string, id: number, rng: Rng): Question | null {
  const [kind, value] = fact.split(':')
  const d = degreeFact(value)
  switch (kind) {
    case 'mh':
      return d === null ? null : rng() < 0.5 ? makeMinorDegreeQuality(id, rng, d) : makeMinorChordOnDegree(id, MINOR_KEYS, rng, false, d)
    case 'mrn':
      return d === null ? null : rng() < 0.5 ? makeMinorNumeral(id, MINOR_KEYS, rng, d) : makeMinorNumeralToChord(id, MINOR_KEYS, rng, d)
    case 'hmin':
      return isOneOf(value, MINOR_KEYS) ? makeHarmonicNote(id, MINOR_KEYS, rng, value) : null
    case 'hmv':
      if (value === 'vii°7') return makeMinorDim7(id, MINOR_KEYS, rng)
      return value === 'V' || value === 'V7' ? makeHarmonicV(id, MINOR_KEYS, rng, value) : null
    case 'mprog':
      if (!isOneOf(value, PROGRESSION_IDS)) return null
      return rng() < 0.5 ? makeMinorProgressionSpell(id, MINOR_KEYS, [value], rng, value) : makeMinorProgressionName(id, MINOR_KEYS, [value], rng, value)
    case 'kfind':
      return value === 'home' ? makeKeyFromHome(id, rng) : value === 'chords' ? makeKeyFromChords(id, rng) : null
    case 'ear':
      return value === 'keymode' ? makeKeyModeHear(id, rng) : value === 'minorv' ? makeMinorVHear(id, rng) : null
    default:
      return null
  }
}

/** "The chord on the 4th note of a minor key", "The i–iv–V7–i progression"; null if it isn't one of these facts. */
export function describeMinorFact(fact: string): string | null {
  const [kind, value] = fact.split(':')
  const d = degreeFact(value)
  switch (kind) {
    case 'mh':
      return d === null ? null : `The chord on the ${degreeName(d + 1)} note of a minor key`
    case 'mrn':
      return d === null ? null : `The ${MINOR_NUMERALS[d]} chord in a minor key`
    case 'hmin':
      return isOneOf(value, MINOR_KEYS) ? `${toneName(parseTone(value))} harmonic minor` : null
    case 'hmv':
      return HMV.includes(value) ? `The ${value} chord in a minor key` : null
    case 'mprog':
      return isOneOf(value, PROGRESSION_IDS) ? `The ${progLabel(value)} progression` : null
    case 'kfind':
      return value === 'home' ? 'Finding the key from home' : value === 'chords' ? 'Finding the key from its chords' : null
    case 'ear':
      return value === 'keymode' ? 'Hearing major or minor keys' : value === 'minorv' ? 'Hearing v or V' : null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const A_TRIADS = minorKeyTriads('A')
const A_KINDS_COLORS = A_TRIADS.map((c) => (c.quality === 'min' ? PAPER_HIGHLIGHT : c.quality === 'dim' ? PAPER_RUST : undefined))
const aChords = (...ds: number[]) => ds.map((d) => A_TRIADS[d].tones)
const H = harmonicChords('A')
/** One chord per measure, so their names have room underneath. */
const listenTo = (size: number, ...chords: Tone[][]) => ({ notes: chords.flatMap((c) => triadSound(c)), chord: size })

/** The harmonic minor scale up the A string, its raised 7th lit. */
function harmonicNeck(): Card['board'] {
  const scale = harmonicMinorScale('A')
  const pcs = scale.map(tonePc)
  const region: Region = { strings: [1], minFret: 0, maxFret: 12 }
  const markers = Array.from({ length: 13 }, (_, fret) => ({ string: 1, fret }))
    .filter((p) => pcs.includes(pitchClass(midiAt(p))))
    .map((p) => {
      const i = pcs.indexOf(pitchClass(midiAt(p)))
      return { pos: p, tone: i === 0 ? ('root' as const) : i === 6 ? ('target' as const) : ('note' as const), label: toneName(scale[i]) }
    })
  return { region, markers }
}

const MINOR_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'mkey:why': () => ({
    title: 'Why minor keys',
    subtitle: 'Same notes, a darker home',
    hook: 'Many songs are in a minor key: they feel at home on a minor chord, and sound darker or sadder for it. A minor key shares all its notes with its relative major (tape 27), so it shares its seven chords too. Only the home chord changes. Press ▶ Hear: Am, Dm, Em, Am.',
    score: { measures: chordMeasures(...aChords(0, 3, 4, 0)), labels: ['Am', 'Dm', 'Em', 'Am'] },
    listen: listenTo(3, ...aChords(0, 3, 4, 0)),
    sound: [],
  }),
  'mkey:stack': () => ({
    title: 'Chords in a minor key',
    subtitle: 'Every other note, from each one',
    hook: 'Stack a triad on each note of the A natural minor scale, using only its notes: Am, B°, C, Dm, Em, F and G. They’re C major’s chords, starting from A instead of C.',
    onGuitar: 'A song in A minor mostly lives on Am, Dm and Em, with C, F and G for color.',
    score: { measures: [aChords(0, 1, 2, 3, 4, 5, 6).flatMap((c) => triadScore(c, true))], labels: A_TRIADS.map((c) => chordSymbol(c.tones[0], c.quality)) },
    listen: listenTo(3, ...aChords(0, 1, 2, 3, 4, 5, 6)),
    sound: [],
  }),
  'mkey:pattern': () => ({
    title: 'The minor pattern',
    subtitle: 'Minor, diminished, major, minor, minor, major, major',
    hook: 'Every natural minor key has the same pattern: minor, diminished, major, minor, minor, major, major. The chords on the 1st, 4th and 5th notes are minor (amber here); the 3rd, 6th and 7th are major; the 2nd is diminished (red).',
    score: { measures: [aChords(0, 1, 2, 3, 4, 5, 6).flatMap((c) => triadScore(c, true))], labels: ['1', '2', '3', '4', '5', '6', '7'], colors: A_KINDS_COLORS },
    listen: listenTo(3, ...aChords(0, 1, 2, 3, 4, 5, 6)),
    sound: [],
  }),
  'mkey:numerals': () => ({
    title: 'Minor-key numerals',
    subtitle: 'i ii° III iv v VI VII',
    hook: 'Numerals count from the minor key’s home note: i, ii°, III, iv, v, VI, VII. Lowercase still means minor and capitals major, so in A minor, iv is Dm and VI is F.',
    score: { measures: [aChords(0, 1, 2, 3, 4, 5, 6).flatMap((c) => triadScore(c, true))], labels: MINOR_NUMERALS, colors: A_KINDS_COLORS },
    listen: listenTo(3, ...aChords(0, 1, 2, 3, 4, 5, 6)),
    sound: [],
  }),
  'mkey:harmonic-why': () => ({
    title: 'A weak pull home',
    subtitle: 'The trouble with v',
    hook: 'In natural minor, the chord on the 5th note is minor: Em in A minor. Its middle note, G, sits a whole step below home, so it doesn’t lead back to A very strongly. Press ▶ Hear: Em, then Am.',
    score: { measures: chordMeasures(...aChords(4, 0)), labels: ['v', 'i'] },
    listen: listenTo(3, ...aChords(4, 0)),
    sound: [],
  }),
  'mkey:harmonic-scale': () => {
    const scale = harmonicMinorScale('A')
    return {
      title: 'Harmonic minor',
      subtitle: 'Raise the 7th',
      hook: 'Raise the 7th note of the natural minor scale a half step and you get the harmonic minor scale: A B C D E F G♯ A. The G♯ sits just a half step below home, leaning into it. It also leaves a wide gap, a step and a half, between F and G♯, which gives the scale its exotic sound.',
      score: { measures: scaleScore(scale), labels: [...scale, scale[0]].map(toneName), colors: [undefined, undefined, undefined, undefined, undefined, undefined, PAPER_HIGHLIGHT] },
      board: harmonicNeck(),
      sound: scaleSound(scale),
    }
  },
  'mkey:harmonic-v': () => ({
    title: 'A major V',
    subtitle: 'E instead of Em',
    hook: 'With the raised 7th, the chord on the 5th note turns major: E G♯ B instead of E G B. It’s written V, capital for major. Add the 7th, D, and it’s V7: E7, the dominant 7th from tape 47. Both pull home to Am much harder than Em does. Press ▶ Hear: E7, then Am.',
    score: { measures: chordMeasures(H.V7.tones, A_TRIADS[0].tones), labels: ['V7', 'i'] },
    listen: listenTo(4, H.V7.tones, [...A_TRIADS[0].tones, parseTone('A')]),
    sound: [],
  }),
  'mkey:dim7': () => ({
    title: 'The diminished 7th',
    subtitle: 'Four notes, all minor 3rds',
    hook: 'The raised 7th makes one more chord: on G♯, G♯ B D F, a diminished 7th, written G♯°7. It’s built entirely from minor 3rds, so it sounds tense and suspenseful, and it leads strongly home too. In A minor it’s vii°7.',
    onGuitar: 'Every note of a diminished 7th is the same distance from the next, so one shape slid three frets plays the same chord again.',
    score: { measures: chordMeasures(H['vii°7'].tones), labels: ['G♯°7'] },
    listen: listenTo(4, H['vii°7'].tones, [...A_TRIADS[0].tones, parseTone('A')]),
    sound: [],
  }),
  'mkey:progressions': () => ({
    title: 'Minor progressions',
    subtitle: 'i–iv–v–i and i–VI–VII–i',
    hook: 'Two minor progressions you’ll hear everywhere: i–iv–v–i (Am, Dm, Em, Am), and i–VI–VII–i (Am, F, G, Am), a rock and pop favorite that climbs back home.',
    score: { measures: chordMeasures(...aChords(0, 5, 6, 0)), labels: ['i', 'VI', 'VII', 'i'] },
    listen: listenTo(3, ...aChords(0, 5, 6, 0)),
    sound: [],
  }),
  'mkey:harmonic-progressions': () => ({
    title: 'With V7',
    subtitle: 'i–iv–V7–i and ii°–V7–i',
    hook: 'Swap in the harmonic V7 and a minor progression gets a strong finish: i–iv–V7–i is Am, Dm, E7, Am. The minor version of ii–V–I is ii°–V7–i: B°, E7, Am.',
    score: { measures: chordMeasures(A_TRIADS[0].tones, A_TRIADS[3].tones, H.V7.tones, A_TRIADS[0].tones), labels: ['i', 'iv', 'V7', 'i'] },
    listen: listenTo(4, [...A_TRIADS[0].tones, parseTone('A')], [...A_TRIADS[3].tones, parseTone('D')], H.V7.tones, [...A_TRIADS[0].tones, parseTone('A')]),
    sound: [],
  }),
  'mkey:find-why': () => ({
    title: 'Major or minor?',
    subtitle: 'One key signature, two keys',
    hook: 'Every key signature belongs to two keys: a major key and its relative minor. No sharps or flats means C major or A minor; one sharp means G major or E minor. To tell which, look for home.',
    score: { measures: [[]], keySig: 'G' },
    sound: [],
  }),
  'mkey:find-home': () => ({
    title: 'Find home',
    subtitle: 'The first and last chord',
    hook: 'Songs usually start, and especially end, on their home chord. Two sharps and a song that ends on Bm? It’s in B minor. Two sharps ending on D? D major.',
    score: { measures: [[...triadScore(minorKeyTriads('B')[0].tones, true, 'D')]], keySig: 'D', labels: ['Bm'] },
    listen: listenTo(3, minorKeyTriads('B')[0].tones),
    sound: [],
  }),
  'mkey:find-raised': () => ({
    title: 'The raised 7th clue',
    subtitle: 'An accidental gives it away',
    hook: 'Minor keys often raise their 7th, so watch for a note that isn’t in the key signature. A G♯ with no sharps in the key, or an E7 chord, points to A minor rather than C major.',
    score: { measures: chordMeasures(A_TRIADS[0].tones, A_TRIADS[3].tones, H.V7.tones, A_TRIADS[0].tones), labels: ['Am', 'Dm', 'E7', 'Am'] },
    listen: listenTo(4, [...A_TRIADS[0].tones, parseTone('A')], [...A_TRIADS[3].tones, parseTone('D')], H.V7.tones, [...A_TRIADS[0].tones, parseTone('A')]),
    sound: [],
  }),
  'mkey:ear-why': () => ({
    title: 'Why hear the key',
    subtitle: 'A bright home or a dark one',
    hook: 'Hearing whether a song is in a major or a minor key is the first step to working out its chords by ear. Listen to how it settles at the end: on a bright chord, or a dark one.',
    listen: listenTo(3, ...aChords(2, 5, 6, 2), ...aChords(0, 3, 4, 0)),
    score: { measures: chordMeasures(...aChords(2, 0)), labels: ['C (major home)', 'Am (minor home)'] },
    sound: [],
  }),
  'mkey:ear-mode': () => ({
    title: 'Major or minor key',
    subtitle: 'Listen to home',
    hook: 'A major-key progression comes home to a major chord, bright and settled. A minor-key one comes home to a minor chord, darker. Here: C, F, G, C, then Am, Dm, Em, Am.',
    listen: listenTo(3, ...aChords(2, 5, 6, 2), ...aChords(0, 3, 4, 0)),
    score: { measures: chordMeasures(...aChords(2, 0)), labels: ['C', 'Am'] },
    sound: [],
  }),
  'mkey:ear-v': () => ({
    title: 'v or V',
    subtitle: 'A gentle pull or a strong one',
    hook: 'Listen to the chord before home. A minor v leads back gently; the harmonic V, with its raised 7th, pulls back strongly. Here: Am, Em, Am, then Am, E, Am.',
    listen: listenTo(3, ...aChords(0, 4, 0), A_TRIADS[0].tones, H.V.tones, A_TRIADS[0].tones),
    score: { measures: chordMeasures(A_TRIADS[4].tones, H.V.tones), labels: ['v (Em)', 'V (E)'] },
    sound: [],
  }),
}

/** The card that teaches an idea from these tapes. */
export function minorCard(item: string, counter: string): Card {
  return { ...MINOR_CARDS[item](), counter }
}

