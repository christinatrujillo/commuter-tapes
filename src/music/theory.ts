import { LETTERS, pitchClass, spelledMidi, type Accidental, type Letter, type SpelledNote } from './notes'
import { KEY_ORDER, keyLabel, type KeyId, type ScoreMeasure, type ScoreNote } from './score'

/** A note name without an octave: a letter and its sharp or flat. */
export type Tone = Omit<SpelledNote, 'octave'>

/** Whole (2) and half (1) steps from each scale note to the next. */
export const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1]
const MINOR_STEPS = [2, 1, 2, 2, 1, 2, 2]

export const tonePc = (t: Tone) => pitchClass(spelledMidi({ ...t, octave: 4 }))
export const toneName = (t: Tone) => `${t.letter}${t.acc === 1 ? '♯' : t.acc === -1 ? '♭' : ''}`
/** "F#" / "Bb" / "C": the same spelling key ids use. */
export const toneId = (t: Tone) => `${t.letter}${t.acc === 1 ? '#' : t.acc === -1 ? 'b' : ''}`

export function parseTone(id: string): Tone {
  return { letter: id[0] as Letter, acc: id[1] === '#' ? 1 : id[1] === 'b' ? -1 : 0 }
}

/** `pc` spelled on `letter` with a sharp, a flat or neither, or null if it would take more than one. */
export function spellOn(letter: Letter, pc: number): Tone | null {
  const diff = ((pc - tonePc({ letter, acc: 0 }) + 18) % 12) - 6
  return Math.abs(diff) <= 1 ? { letter, acc: diff as Accidental } : null
}

/**
 * The seven notes of a scale, one per letter: each letter follows the last, and gets whatever
 * sharp or flat makes the step the right size.
 */
function scaleOf(tonic: Tone, steps: number[]): Tone[] {
  const out: Tone[] = [tonic]
  let pc = tonePc(tonic)
  for (let i = 1; i < 7; i++) {
    pc += steps[i - 1]
    // Every major and minor scale in the 15 keys fits in one sharp or flat per note.
    out.push(spellOn(LETTERS[(LETTERS.indexOf(tonic.letter) + i) % 7], pitchClass(pc))!)
  }
  return out
}

export const majorScale = (key: KeyId) => scaleOf(parseTone(key), MAJOR_STEPS)

/** The relative minor starts on the major scale's 6th note. */
export const relativeMinor = (key: KeyId): Tone => majorScale(key)[5]
export const naturalMinorScale = (key: KeyId) => scaleOf(relativeMinor(key), MINOR_STEPS)

/** The major key whose relative minor starts on this note, if there is one. */
export const majorKeyOfMinor = (tonic: string): KeyId | undefined => KEY_ORDER.find((k) => toneId(relativeMinor(k)) === tonic)

export const minorName = (key: KeyId) => `${toneName(relativeMinor(key))} minor`
export const majorName = (key: KeyId) => `${keyLabel(key)} major`

/** A scale written out on the staff, one octave up from the tonic, in two measures of four. */
export function scaleScore(tones: Tone[]): ScoreMeasure[] {
  const start = LETTERS.indexOf(tones[0].letter)
  const notes = [...tones, tones[0]].map(
    (t, i): ScoreNote => ({
      letter: t.letter,
      octave: 4 + (i === 7 || LETTERS.indexOf(t.letter) < start ? 1 : 0),
      dur: 'q',
      ...(t.acc ? { sign: t.acc } : {}),
    }),
  )
  return [notes.slice(0, 4), notes.slice(4)]
}

/** The usual name for a major key on each of the 12 notes (D♭ rather than C♯, F♯ rather than G♭). */
export const KEY_ON_PC: KeyId[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

/** Spellings so rare the tapes steer around them. */
export const RARE_SPELLINGS = new Set(['E♯', 'B♯', 'C♭', 'F♭'])

/** "1st", "2nd", ... for scale degrees. */
export const degreeName = (d: number) => `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}`

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

/** Perfect, major, minor, augmented or diminished. */
export type Quality = 'P' | 'M' | 'm' | 'A' | 'd'

/** An interval by its number (counting letters, 1–8) and quality: "M3" is a major 3rd. */
export interface Interval {
  quality: Quality
  number: number
}

const PERFECT_SIZE: Record<number, number> = { 1: 0, 4: 5, 5: 7, 8: 12 }
const MAJOR_SIZE: Record<number, number> = { 2: 2, 3: 4, 6: 9, 7: 11 }
const QUALITY_NAMES: Record<Quality, string> = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished' }

export const parseInterval = (short: string): Interval => ({ quality: short[0] as Quality, number: Number(short.slice(1)) })
export const intervalShort = (iv: Interval) => `${iv.quality}${iv.number}`

/**
 * Half steps in an interval, or null for one that doesn't exist (a "perfect 3rd"). 4ths, 5ths and
 * octaves are perfect; 2nds, 3rds, 6ths and 7ths are major or minor. Either kind can be augmented
 * (a half step bigger) or diminished (a half step smaller than perfect or minor).
 */
export function intervalSize({ quality, number }: Interval): number | null {
  const perfect = PERFECT_SIZE[number]
  if (perfect !== undefined) return { P: perfect, A: perfect + 1, d: perfect - 1, M: null, m: null }[quality]
  const major = MAJOR_SIZE[number]
  if (major !== undefined) return { M: major, m: major - 1, A: major + 1, d: major - 2, P: null }[quality]
  return null
}

/** "major 3rd", "perfect 5th", "octave". */
export function intervalName(iv: Interval): string {
  if (iv.quality === 'P' && iv.number === 8) return 'octave'
  return `${QUALITY_NAMES[iv.quality]} ${degreeName(iv.number)}`
}

/** The note an interval above `root`, or null if it would need a double sharp or flat. */
export function intervalAbove(root: Tone, iv: Interval): Tone | null {
  const size = intervalSize(iv)
  if (size === null) return null
  return spellOn(LETTERS[(LETTERS.indexOf(root.letter) + iv.number - 1) % 7], pitchClass(tonePc(root) + size))
}

const FLIPPED: Record<Quality, Quality> = { P: 'P', M: 'm', m: 'M', A: 'd', d: 'A' }

/** An interval turned upside down: the numbers add up to 9, major and minor swap, augmented and diminished swap. */
export const invertInterval = (iv: Interval): Interval => ({ quality: FLIPPED[iv.quality], number: 9 - iv.number })

// ---------------------------------------------------------------------------
// Triads
// ---------------------------------------------------------------------------

/** Major, minor, diminished or augmented. */
export type TriadQuality = 'maj' | 'min' | 'dim' | 'aug'

export const TRIAD_NAMES: Record<TriadQuality, string> = { maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented' }

/** The 3rd and the 5th above the root, for each kind: a major triad is a major 3rd and a perfect 5th. */
const TRIAD_INTERVALS: Record<TriadQuality, [string, string]> = { maj: ['M3', 'P5'], min: ['m3', 'P5'], dim: ['m3', 'd5'], aug: ['M3', 'A5'] }

/** A triad's notes from the root up (root, 3rd, 5th), or null if one would need a double sharp or flat. */
export function triadTones(root: Tone, quality: TriadQuality): [Tone, Tone, Tone] | null {
  const [third, fifth] = TRIAD_INTERVALS[quality].map((s) => intervalAbove(root, parseInterval(s)))
  return third && fifth ? [root, third, fifth] : null
}

/** The interval between two of a triad's notes: the 3rd up to the 5th of a major triad is a minor 3rd. */
export function triadGap(quality: TriadQuality, from: 0 | 1, to: 1 | 2): Interval {
  const [third, fifth] = TRIAD_INTERVALS[quality].map(parseInterval)
  if (from === 0) return to === 1 ? third : fifth
  // The 3rd up to the 5th: whatever's left of the 5th, always a major or minor 3rd.
  return { quality: intervalSize(fifth)! - intervalSize(third)! === 4 ? 'M' : 'm', number: 3 }
}

// ---------------------------------------------------------------------------
// Chords in a key
// ---------------------------------------------------------------------------

/** The kind of triad on each note of every major key: major, minor, minor, major, major, minor, diminished. */
const MAJOR_KEY_KINDS: TriadQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']

/** Each chord's Roman numeral: capitals for major, lowercase for minor, ° for diminished. */
export const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']

/** The triad on each note of a major key's scale (every other note, from there), in scale order. */
export function keyTriads(key: KeyId): { tones: Tone[]; quality: TriadQuality }[] {
  const scale = majorScale(key)
  return scale.map((_, d) => ({ tones: [0, 2, 4].map((s) => scale[(d + s) % 7]), quality: MAJOR_KEY_KINDS[d] }))
}
