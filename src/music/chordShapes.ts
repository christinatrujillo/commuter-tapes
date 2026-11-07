import { midiAt, pitchClass } from './notes'
import { parseTone, tonePc, type ChordKind, type Tone } from './theory'

/** A chord shape on the neck, low E string first: a fret per string (0 open, −1 not played), and the finger on each. */
export interface ChordShape {
  frets: number[]
  fingers: (number | null)[]
}

/** What a chord diagram shows: the shape, and what to print in or under its dots. */
export interface DiagramSpec {
  shape: ChordShape
  /** Text in each string's dot instead of the finger number (R, 3, 5, or "?"). */
  dots?: (string | null)[]
  /** Text under each string: the note it plays. */
  names?: (string | null)[]
  /** Strings whose dots are the chord's root, drawn in amber. */
  roots?: number[]
  /** A string whose dot is ringed: the one a question asks about. */
  mark?: number | null
}

/** The open chords most guitarists learn first, and the chord each one is. */
export const OPEN_CHORDS: Record<string, { shape: ChordShape; root: Tone; kind: ChordKind }> = {
  C: { shape: { frets: [-1, 3, 2, 0, 1, 0], fingers: [null, 3, 2, null, 1, null] }, root: parseTone('C'), kind: 'maj' },
  A: { shape: { frets: [-1, 0, 2, 2, 2, 0], fingers: [null, null, 1, 2, 3, null] }, root: parseTone('A'), kind: 'maj' },
  G: { shape: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, null, null, null, 3] }, root: parseTone('G'), kind: 'maj' },
  E: { shape: { frets: [0, 2, 2, 1, 0, 0], fingers: [null, 2, 3, 1, null, null] }, root: parseTone('E'), kind: 'maj' },
  D: { shape: { frets: [-1, -1, 0, 2, 3, 2], fingers: [null, null, null, 1, 3, 2] }, root: parseTone('D'), kind: 'maj' },
  Am: { shape: { frets: [-1, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null] }, root: parseTone('A'), kind: 'min' },
  Em: { shape: { frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null] }, root: parseTone('E'), kind: 'min' },
  Dm: { shape: { frets: [-1, -1, 0, 2, 3, 1], fingers: [null, null, null, 2, 3, 1] }, root: parseTone('D'), kind: 'min' },
}

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D'

/** The CAGED shapes in the order they come up the neck. */
export const CAGED_ORDER: CagedShape[] = ['C', 'A', 'G', 'E', 'D']
/** The shapes as answer buttons: "C shape", "A shape"… */
export const SHAPE_NAMES = CAGED_ORDER.map((s) => `${s} shape`)

/** Each shape moved up the neck: the open strings become a barre under the first finger. */
const BARRE_FINGERS: Record<CagedShape, (number | null)[]> = {
  C: [null, 4, 3, 1, 2, 1],
  A: [null, 1, 2, 3, 4, 1],
  G: [3, 2, 1, 1, 1, 4],
  E: [1, 3, 4, 2, 1, 1],
  D: [null, null, 1, 2, 4, 3],
}

/** A CAGED shape slid `shift` frets up from its open position. */
export function movedShape(name: CagedShape, shift: number): ChordShape {
  const open = OPEN_CHORDS[name].shape
  return {
    frets: open.frets.map((f) => (f < 0 ? f : f + shift)),
    fingers: shift ? BARRE_FINGERS[name] : open.fingers,
  }
}

/** How far a shape slides up to play a major chord on `root`. */
export const shiftFor = (name: CagedShape, root: Tone) => pitchClass(tonePc(root) - tonePc(OPEN_CHORDS[name].root))

/** The sounding notes of a shape, low string first, with null for strings it doesn't play. */
export const shapeMidis = (shape: ChordShape): (number | null)[] => shape.frets.map((f, string) => (f < 0 ? null : midiAt({ string, fret: f })))
