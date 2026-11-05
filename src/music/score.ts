import { LETTERS, type Accidental, type Letter, type SpelledNote } from './notes'
import type { RhythmEvent } from './rhythm'

/** The major keys, by their VexFlow names ("Bb" is B♭ major). */
export type KeyId = 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#' | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb'

export interface KeyInfo {
  name: string
  /** Letters the key signature changes, everywhere they appear. */
  altered: Partial<Record<Letter, 1 | -1>>
  /** How many sharps (+) or flats (−) the signature has. */
  count: number
  /** "one sharp: F♯" */
  signature: string
}

/** Sharps are always added in this order, and flats in the reverse. */
const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: Letter[] = [...SHARP_ORDER].reverse()

/** Around the circle of fifths: C, then the sharp keys a fifth apart, then the flat keys a fifth apart going the other way. */
export const KEY_ORDER: KeyId[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
const SIGNATURE_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7]

/** "B♭" for "Bb", "F♯" for "F#". */
export const keyLabel = (key: string) => key.replace('#', '♯').replace(/^([A-G])b/, '$1♭')

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']

/** "two sharps", "one flat", "no sharps or flats". */
function signatureCount(count: number): string {
  const n = Math.abs(count)
  if (n === 0) return 'no sharps or flats'
  return `${NUMBER_WORDS[n]} ${count > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`
}

function keyInfo(key: KeyId, count: number): KeyInfo {
  const sign = count > 0 ? 1 : -1
  const letters = (count > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(count))
  const names = letters.map((l) => `${l}${sign > 0 ? '♯' : '♭'}`)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  return {
    name: `${keyLabel(key)} major`,
    altered: Object.fromEntries(letters.map((l) => [l, sign])),
    count,
    signature: count === 0 ? signatureCount(0) : `${signatureCount(count)}: ${list}`,
  }
}

export const KEYS = Object.fromEntries(KEY_ORDER.map((k, i) => [k, keyInfo(k, SIGNATURE_COUNTS[i])])) as Record<KeyId, KeyInfo>

/** A written note: where it sits on the staff, and any accidental printed in front of it. */
export interface ScoreNote {
  letter: Letter
  octave: number
  /** Printed accidental: ♯ (1), ♭ (−1), ♮ (0), or none (undefined). */
  sign?: Accidental
  dur: RhythmEvent['dur']
  dots?: 0 | 1
  /** Notes sounded with this one, on the same stem: an interval or a chord played together. */
  with?: { letter: Letter; octave: number; sign?: Accidental }[]
}

export type ScoreMeasure = ScoreNote[]

/**
 * What each written note actually is, by the rules of reading music:
 * the key signature changes its letters everywhere; a printed accidental lasts for the rest of
 * the measure on that same line or space; a natural sign cancels; a bar line resets everything
 * to the key signature.
 */
export function resolveNotes(measures: ScoreMeasure[], key: KeyId = 'C'): SpelledNote[] {
  const out: SpelledNote[] = []
  for (const measure of measures) {
    const carried = new Map<string, Accidental>()
    for (const n of measure) {
      const spot = `${n.letter}${n.octave}`
      if (n.sign !== undefined) carried.set(spot, n.sign)
      out.push({ letter: n.letter, acc: carried.get(spot) ?? KEYS[key].altered[n.letter] ?? 0, octave: n.octave })
    }
  }
  return out
}

/** Lines and spaces counted from the bottom of the musical alphabet: one step = next line or space. */
export const staffDegree = (n: { letter: Letter; octave: number }) => n.octave * 7 + LETTERS.indexOf(n.letter)

/** Landmarks the exercises keep notes between: middle C (one ledger line below) and the A on the first ledger line above. */
export const MIDDLE_C = staffDegree({ letter: 'C', octave: 4 })
export const HIGH_A = staffDegree({ letter: 'A', octave: 5 })

/** The note `steps` lines and spaces above (or below, if negative). */
export function stepFrom(n: { letter: Letter; octave: number }, steps: number): { letter: Letter; octave: number } {
  const degree = staffDegree(n) + steps
  return { letter: LETTERS[((degree % 7) + 7) % 7], octave: Math.floor(degree / 7) }
}

export const MOTION_KINDS = ['same', 'step', 'skip', 'leap'] as const
export type MotionKind = (typeof MOTION_KINDS)[number]
export type Motion = 'same' | 'stepUp' | 'stepDown' | 'skipUp' | 'skipDown' | 'leapUp' | 'leapDown'

export const MOTION_NAMES: Record<Motion, string> = {
  same: 'Same note',
  stepUp: 'Step up',
  stepDown: 'Step down',
  skipUp: 'Skip up',
  skipDown: 'Skip down',
  leapUp: 'Leap up',
  leapDown: 'Leap down',
}

/** How the melody moves from one written note to the next: by step, skip or leap, up or down. */
export function motionBetween(a: { letter: Letter; octave: number }, b: { letter: Letter; octave: number }): Motion {
  const d = staffDegree(b) - staffDegree(a)
  if (d === 0) return 'same'
  const size = Math.abs(d) === 1 ? 'step' : Math.abs(d) === 2 ? 'skip' : 'leap'
  return `${size}${d > 0 ? 'Up' : 'Down'}` as Motion
}

export const motionKind = (m: Motion): MotionKind => (m === 'same' ? 'same' : (m.replace(/Up|Down/, '') as MotionKind))

/** The answer choices for the kinds of motion a lesson covers. */
export function motionOptions(kinds: MotionKind[]): Motion[] {
  return (Object.keys(MOTION_NAMES) as Motion[]).filter((m) => kinds.includes(motionKind(m)))
}

/** VexFlow key for where the note sits (the printed accidental is drawn separately). */
export const scoreKey = (n: { letter: Letter; octave: number }) => `${n.letter.toLowerCase()}/${n.octave}`

/** The accidental symbol VexFlow draws: "#", "b" or "n". */
export const signSymbol = (sign: Accidental) => (sign === 1 ? '#' : sign === -1 ? 'b' : 'n')

/** "sharp", "flat" or "natural sign". */
export const signName = (sign: Accidental) => (sign === 1 ? 'sharp' : sign === -1 ? 'flat' : 'natural sign')

/**
 * The rules for how long an accidental lasts, each taught on its own: it carries through the
 * measure, a natural cancels it, a bar line resets it, and it only applies to its own octave.
 */
export const ACCIDENTAL_RULES = ['carry', 'natural', 'barline', 'octave'] as const
export type AccidentalRule = (typeof ACCIDENTAL_RULES)[number]
