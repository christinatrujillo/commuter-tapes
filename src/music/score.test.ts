import { describe, expect, it } from 'vitest'
import { spelledName } from './notes'
import { motionBetween, motionKind, motionOptions, resolveNotes, stepFrom, type ScoreNote } from './score'

const q = (letter: ScoreNote['letter'], octave: number, sign?: ScoreNote['sign']): ScoreNote => ({ letter, octave, sign, dur: 'q' })
const names = (notes: ReturnType<typeof resolveNotes>) => notes.map((n) => spelledName(n, true))

describe('reading accidentals', () => {
  it('carries an accidental to later notes on the same line or space', () => {
    expect(names(resolveNotes([[q('F', 4, 1), q('G', 4), q('F', 4), q('E', 4)]]))).toEqual(['F♯4', 'G4', 'F♯4', 'E4'])
  })

  it('lets a natural sign cancel it', () => {
    expect(names(resolveNotes([[q('B', 4, -1), q('B', 4, 0), q('B', 4)]]))).toEqual(['B♭4', 'B4', 'B4'])
  })

  it('resets at the bar line', () => {
    expect(names(resolveNotes([[q('C', 5, 1), q('D', 5)], [q('C', 5)]]))).toEqual(['C♯5', 'D5', 'C5'])
  })

  it('only affects its own octave', () => {
    expect(names(resolveNotes([[q('F', 4, 1), q('F', 5)]]))).toEqual(['F♯4', 'F5'])
  })
})

describe('key signatures', () => {
  it('change their letters in every octave and every measure', () => {
    expect(names(resolveNotes([[q('F', 4), q('F', 5)], [q('F', 3)]], 'G'))).toEqual(['F♯4', 'F♯5', 'F♯3'])
    expect(names(resolveNotes([[q('C', 5), q('F', 4), q('G', 4)]], 'D'))).toEqual(['C♯5', 'F♯4', 'G4'])
    expect(names(resolveNotes([[q('B', 4), q('E', 4)]], 'F'))).toEqual(['B♭4', 'E4'])
  })

  it('can be overridden by a natural sign until the bar line', () => {
    expect(names(resolveNotes([[q('F', 4, 0), q('F', 4)], [q('F', 4)]], 'G'))).toEqual(['F4', 'F4', 'F♯4'])
  })
})

describe('steps, skips and leaps', () => {
  it('measures motion in lines and spaces', () => {
    expect(motionBetween({ letter: 'E', octave: 4 }, { letter: 'F', octave: 4 })).toBe('stepUp')
    expect(motionBetween({ letter: 'C', octave: 5 }, { letter: 'B', octave: 4 })).toBe('stepDown')
    expect(motionBetween({ letter: 'E', octave: 4 }, { letter: 'G', octave: 4 })).toBe('skipUp')
    expect(motionBetween({ letter: 'G', octave: 4 }, { letter: 'C', octave: 5 })).toBe('leapUp')
    expect(motionBetween({ letter: 'D', octave: 5 }, { letter: 'D', octave: 5 })).toBe('same')
    expect(motionKind('skipDown')).toBe('skip')
  })

  it('walks the alphabet across octaves', () => {
    expect(stepFrom({ letter: 'B', octave: 4 }, 1)).toEqual({ letter: 'C', octave: 5 })
    expect(stepFrom({ letter: 'C', octave: 4 }, -2)).toEqual({ letter: 'A', octave: 3 })
  })

  it('offers only the kinds of motion being taught', () => {
    expect(motionOptions(['same', 'step', 'skip'])).toEqual(['same', 'stepUp', 'stepDown', 'skipUp', 'skipDown'])
  })
})
