import { describe, expect, it } from 'vitest'
import {
  FULL_NECK,
  describePosition,
  midiAt,
  pcName,
  pitchClass,
  positionsForMidi,
  spellMidi,
  spelledMidi,
  spelledName,
  staffPlace,
  vexKey,
} from './notes'

const nameAt = (string: number, fret: number) => pcName(pitchClass(midiAt({ string, fret })))

describe('fretboard notes', () => {
  it('knows the open strings', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => nameAt(s, 0))).toEqual(['E', 'A', 'D', 'G', 'B', 'E'])
  })

  it('knows the landmark frets', () => {
    expect(nameAt(0, 5)).toBe('A')
    expect(nameAt(0, 8)).toBe('C')
    expect(nameAt(1, 3)).toBe('C')
    expect(nameAt(2, 10)).toBe('C')
    expect(nameAt(3, 5)).toBe('C')
    expect(nameAt(4, 1)).toBe('C')
    expect(nameAt(4, 8)).toBe('G')
    expect(nameAt(5, 12)).toBe('E')
    expect(nameAt(0, 6)).toBe('A♯/B♭')
  })

  it('places written middle C on the A string, 3rd fret', () => {
    const writtenC4 = spelledMidi({ letter: 'C', acc: 0, octave: 4 })
    const spots = positionsForMidi(writtenC4 - 12, FULL_NECK)
    expect(spots).toContainEqual({ string: 1, fret: 3 })
    expect(spots).toContainEqual({ string: 0, fret: 8 })
    expect(spots).toHaveLength(2)
  })

  it('finds every place a pitch can be played', () => {
    // Sounding E4: open high E, B string 5th fret, G string 9th fret.
    expect(positionsForMidi(64, FULL_NECK)).toEqual([
      { string: 3, fret: 9 },
      { string: 4, fret: 5 },
      { string: 5, fret: 0 },
    ])
  })
})

describe('spelling', () => {
  it('spells black keys as sharps or flats', () => {
    expect(spelledName(spellMidi(61, 'sharp'), true)).toBe('C♯4')
    expect(spelledName(spellMidi(61, 'flat'), true)).toBe('D♭4')
    expect(vexKey(spellMidi(70, 'flat'))).toBe('bb/4')
    expect(vexKey(spellMidi(66, 'sharp'))).toBe('f#/4')
  })

  it('round-trips every note on the neck', () => {
    for (let midi = 40; midi <= 100; midi++) {
      expect(spelledMidi(spellMidi(midi, 'sharp'))).toBe(midi)
      expect(spelledMidi(spellMidi(midi, 'flat'))).toBe(midi)
    }
  })

  it('describes positions in words', () => {
    expect(describePosition({ string: 0, fret: 0 })).toBe('low E string, open')
    expect(describePosition({ string: 1, fret: 3 })).toBe('A string, 3rd fret')
    expect(describePosition({ string: 5, fret: 12 })).toBe('high E string, 12th fret')
  })
})

describe('staff places', () => {
  it('names lines, spaces and ledger lines', () => {
    expect(staffPlace({ letter: 'E', acc: 0, octave: 4 })).toBe('bottom line')
    expect(staffPlace({ letter: 'F', acc: 1, octave: 4 })).toBe('1st space')
    expect(staffPlace({ letter: 'B', acc: 0, octave: 4 })).toBe('middle line')
    expect(staffPlace({ letter: 'F', acc: 0, octave: 5 })).toBe('top line')
    expect(staffPlace({ letter: 'D', acc: 0, octave: 4 })).toBe('just below the staff')
    expect(staffPlace({ letter: 'C', acc: 0, octave: 4 })).toBe('1 ledger line below')
    expect(staffPlace({ letter: 'B', acc: 0, octave: 3 })).toBe('under 1 ledger line')
    expect(staffPlace({ letter: 'E', acc: 0, octave: 3 })).toBe('under 3 ledger lines')
    expect(staffPlace({ letter: 'G', acc: 0, octave: 5 })).toBe('just above the staff')
    expect(staffPlace({ letter: 'A', acc: 0, octave: 5 })).toBe('1 ledger line above')
    expect(staffPlace({ letter: 'E', acc: 0, octave: 6 })).toBe('3 ledger lines above')
  })
})
