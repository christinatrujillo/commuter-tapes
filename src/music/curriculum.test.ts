import { describe, expect, it } from 'vitest'
import { ALL_LESSONS, findLesson, isPlanned, tapeBefore, tapeNumber, UNITS, VOLUMES } from './curriculum'

describe('the shelf', () => {
  it('puts every recorded tape on one volume, in order', () => {
    const ids = UNITS.map((u) => u.id)
    expect(new Set(ids).size).toBe(ids.length)
    const numbers = UNITS.map(tapeNumber)
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
  })

  it('numbers planned tapes too, and opens each tape after the recorded one before it', () => {
    const keys = findLesson('r9-1')!.unit
    const planned = VOLUMES[4].tapes.find(isPlanned)!
    expect(tapeNumber(UNITS[0])).toBe(1)
    expect(tapeNumber(findLesson('t1-1')!.unit)).toBe(22)
    expect(tapeNumber(keys)).toBe(25)
    expect(tapeBefore(keys)).toBe(24)
    expect(tapeNumber(planned)).toBe(33)
  })

  it('teaches a key signature before any track reads music in it', () => {
    const taught = new Set(['C'])
    for (const l of ALL_LESSONS) {
      if (['keyNote', 'keyName', 'keySignature'].some((e) => l.exercises.includes(e as (typeof l.exercises)[number]))) l.keys?.forEach((k) => taught.add(k))
      else if (l.exercises.includes('phrase')) for (const k of l.keys ?? []) expect(taught.has(k), `${l.id} reads in ${k}`).toBe(true)
    }
  })
})
