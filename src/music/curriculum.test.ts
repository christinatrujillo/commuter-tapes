import { describe, expect, it } from 'vitest'
import { ALL_LESSONS, findLesson, isPlanned, tapeBefore, tapeNumber, UNITS, VOLUMES } from './curriculum'

describe('the shelf', () => {
  it('puts every recorded tape on one volume, in order', () => {
    const ids = UNITS.map((u) => u.id)
    expect(new Set(ids).size).toBe(ids.length)
    const numbers = UNITS.map(tapeNumber)
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
  })

  // Cards and tips name tapes by number ("tape 27"). A tape added or moved before the end shifts
  // those numbers, so this fails until the references in src/game and the tips are updated to match.
  it('keeps the tape numbers the cards refer to', () => {
    expect(UNITS.map((u) => u.id).join(' ')).toBe(
      'r1 r2 r3 r4 u7 r5 r6 r7 u1 u2 u3 r8 u4 u5 u6 u8 u9 r10 r11 u12 u13 t1 t2 t3 r9 t4 t5 u14 t6 t7 t8 t9 tr1 tr2 tr3 tr4 tr5 tr6 tr7 hk1 hk2 hk3 hk4 hk5 cb1 cb2 cb3 cb4 cb5 cb6 cb7 mk1 mk2 mk3 mk4 mk5 bp1 bp2 bp3 bp4 bp5 bp6 md1 md2 md3 md4 md5',
    )
  })

  it('numbers planned tapes too, and opens each tape after the recorded one before it', () => {
    const keys = findLesson('r9-1')!.unit
    const triads = findLesson('tr1-1')!.unit
    const planned = VOLUMES[10].tapes.find(isPlanned)!
    expect(tapeNumber(UNITS[0])).toBe(1)
    expect(tapeNumber(findLesson('t1-1')!.unit)).toBe(22)
    expect(tapeNumber(keys)).toBe(25)
    expect(tapeBefore(keys)).toBe(24)
    expect(tapeNumber(triads)).toBe(33)
    expect(tapeBefore(triads)).toBe(32)
    expect(tapeNumber(findLesson('hk1-1')!.unit)).toBe(40)
    expect(tapeNumber(findLesson('cb1-1')!.unit)).toBe(45)
    expect(tapeNumber(findLesson('mk1-1')!.unit)).toBe(52)
    expect(tapeNumber(findLesson('bp1-1')!.unit)).toBe(57)
    expect(tapeNumber(findLesson('bp6-1')!.unit)).toBe(62)
    expect(tapeNumber(findLesson('md1-1')!.unit)).toBe(63)
    expect(tapeNumber(findLesson('md5-1')!.unit)).toBe(67)
    expect(tapeNumber(planned)).toBe(68)
  })

  it('teaches a key signature before any track reads music in it', () => {
    const taught = new Set(['C'])
    for (const l of ALL_LESSONS) {
      if (['keyNote', 'keyName', 'keySignature'].some((e) => l.exercises.includes(e as (typeof l.exercises)[number]))) l.keys?.forEach((k) => taught.add(k))
      else if (l.exercises.includes('phrase')) for (const k of l.keys ?? []) expect(taught.has(k), `${l.id} reads in ${k}`).toBe(true)
    }
  })
})
