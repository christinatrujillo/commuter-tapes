export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = -1 | 0 | 1
export type Spelling = 'sharp' | 'flat'

/** A note as it's written on the staff, e.g. F♯4. */
export interface SpelledNote {
  letter: Letter
  acc: Accidental
  octave: number
}

/** A spot on the fretboard. String 0 is the low E (6th) string, string 5 the high E. */
export interface Position {
  string: number
  fret: number
}

/** The part of the neck an exercise uses. */
export interface Region {
  strings: number[]
  minFret: number
  maxFret: number
}

export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const NUM_STRINGS = 6
export const MAX_FRET = 12
export const ALL_STRINGS = [0, 1, 2, 3, 4, 5]
export const FULL_NECK: Region = { strings: ALL_STRINGS, minFret: 0, maxFret: MAX_FRET }

/** Standard tuning as MIDI note numbers, low E (E2) to high E (E4). */
export const TUNING = [40, 45, 50, 55, 59, 64]

/** Guitar music is written an octave higher than it sounds. */
export const WRITTEN_OCTAVE_SHIFT = 12
export const written = (midi: number) => midi + WRITTEN_OCTAVE_SHIFT

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11])

export const pitchClass = (midi: number) => ((midi % 12) + 12) % 12
export const isNatural = (pc: number) => NATURAL_PCS.has(pitchClass(pc))
export const midiAt = (p: Position) => TUNING[p.string] + p.fret
export const posKey = (p: Position) => `${p.string}:${p.fret}`
export const samePos = (a: Position, b: Position) => a.string === b.string && a.fret === b.fret

/** A spot's key ("0:5") back into the spot, or null if it isn't one on the neck. */
export function parsePosKey(key: string): Position | null {
  const m = /^(\d):(\d+)$/.exec(key)
  const pos = m && { string: Number(m[1]), fret: Number(m[2]) }
  return pos && pos.string < NUM_STRINGS && pos.fret <= MAX_FRET ? pos : null
}

/** "C♯/D♭" for black keys, or one spelling when asked. */
export function pcName(pc: number, spelling?: Spelling): string {
  const i = pitchClass(pc)
  if (isNatural(i)) return SHARP_NAMES[i]
  if (spelling === 'sharp') return SHARP_NAMES[i]
  if (spelling === 'flat') return FLAT_NAMES[i]
  return `${SHARP_NAMES[i]}/${FLAT_NAMES[i]}`
}

/** The note at a spot on the neck, with sharp names for black keys ("F♯"). */
export const noteAt = (p: Position) => pcName(pitchClass(midiAt(p)), 'sharp')

export function spelledMidi(n: SpelledNote): number {
  return (n.octave + 1) * 12 + LETTER_PC[n.letter] + n.acc
}

export function spellMidi(midi: number, spelling: Spelling): SpelledNote {
  const pc = pitchClass(midi)
  const octave = Math.floor(midi / 12) - 1
  if (isNatural(pc)) return { letter: letterOf(pc), acc: 0, octave }
  // Black keys never sit next to an octave boundary, so the octave doesn't change.
  return spelling === 'sharp'
    ? { letter: letterOf(pc - 1), acc: 1, octave }
    : { letter: letterOf(pc + 1), acc: -1, octave }
}

function letterOf(pc: number): Letter {
  return LETTERS.find((l) => LETTER_PC[l] === pc)!
}

export function spelledName(n: SpelledNote, withOctave = false): string {
  const acc = n.acc === 1 ? '♯' : n.acc === -1 ? '♭' : ''
  return `${n.letter}${acc}${withOctave ? n.octave : ''}`
}

/** VexFlow key string, e.g. "f#/4". */
export function vexKey(n: SpelledNote): string {
  const acc = n.acc === 1 ? '#' : n.acc === -1 ? 'b' : ''
  return `${n.letter.toLowerCase()}${acc}/${n.octave}`
}

export function allPositions(region: Region): Position[] {
  const out: Position[] = []
  for (const string of region.strings) {
    for (let fret = region.minFret; fret <= region.maxFret; fret++) out.push({ string, fret })
  }
  return out
}

export function positionsForMidi(midi: number, region: Region): Position[] {
  return allPositions(region).filter((p) => midiAt(p) === midi)
}

export function positionsForPc(pc: number, region: Region): Position[] {
  return allPositions(region).filter((p) => pitchClass(midiAt(p)) === pitchClass(pc))
}

/** "low E", "A", ... "high E". */
export function stringName(string: number): string {
  if (string === 0) return 'low E'
  if (string === 5) return 'high E'
  return ['E', 'A', 'D', 'G', 'B', 'E'][string]
}

/** Short label used on the fretboard itself (tab style: low E is "E", high E is "e"). */
export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e']

export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** "A string, 5th fret" / "low E string, open". */
export function describePosition(p: Position): string {
  return `${stringName(p.string)} string, ${p.fret === 0 ? 'open' : `${ordinal(p.fret)} fret`}`
}

export interface IntervalInfo {
  semitones: number
  short: string
  name: string
}

export const INTERVALS: IntervalInfo[] = [
  { semitones: 1, short: 'm2', name: 'minor 2nd' },
  { semitones: 2, short: 'M2', name: 'major 2nd' },
  { semitones: 3, short: 'm3', name: 'minor 3rd' },
  { semitones: 4, short: 'M3', name: 'major 3rd' },
  { semitones: 5, short: 'P4', name: 'perfect 4th' },
  { semitones: 6, short: 'TT', name: 'tritone' },
  { semitones: 7, short: 'P5', name: 'perfect 5th' },
  { semitones: 8, short: 'm6', name: 'minor 6th' },
  { semitones: 9, short: 'M6', name: 'major 6th' },
  { semitones: 10, short: 'm7', name: 'minor 7th' },
  { semitones: 11, short: 'M7', name: 'major 7th' },
  { semitones: 12, short: '8va', name: 'octave' },
]

export const intervalInfo = (semitones: number) => INTERVALS.find((i) => i.semitones === semitones)!

const LINE_NAMES = ['bottom line', '2nd line', 'middle line', '4th line', 'top line']
const SPACE_NAMES = ['1st space', '2nd space', '3rd space', '4th space']

/** Where a written note sits on the treble staff: "bottom line", "1 ledger line below", ... */
export function staffPlace(n: SpelledNote): string {
  const step = n.octave * 7 + LETTERS.indexOf(n.letter) - (4 * 7 + 2) // 0 = E4, the bottom line
  if (step >= 0 && step <= 8) return step % 2 === 0 ? LINE_NAMES[step / 2] : SPACE_NAMES[(step - 1) / 2]
  const below = step < 0
  const away = below ? -step : step - 8
  if (away === 1) return below ? 'just below the staff' : 'just above the staff'
  const lines = Math.floor(away / 2)
  const plural = lines === 1 ? 'line' : 'lines'
  return away % 2 === 0
    ? `${lines} ledger ${plural} ${below ? 'below' : 'above'}`
    : `${below ? 'under' : 'over'} ${lines} ledger ${plural}`
}
