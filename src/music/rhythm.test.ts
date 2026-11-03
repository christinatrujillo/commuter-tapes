import { describe, expect, it } from 'vitest'
import { scoreTaps } from '../components/TapRhythm'
import { heldCounts } from '../game/rehearsal'
import { beatsText, countName, eventBeats, measureBeats, METER_BEATS, onsets, playedIndexes, randomMeasure, symbolOf, type Measure, type SymbolId } from './rhythm'

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ALL: SymbolId[] = ['whole', 'half', 'quarter', 'eighth', 'dottedHalf', 'dottedQuarter', 'wholeRest', 'halfRest', 'quarterRest', 'tie']

describe('generated rhythms', () => {
  it('always fill the measure exactly, using only allowed values', () => {
    const sets: SymbolId[][] = [['whole', 'half', 'quarter'], ['half', 'quarter', 'quarterRest', 'halfRest'], ALL]
    for (const allowed of sets) {
      for (const meter of ['4/4', '3/4'] as const) {
        for (let seed = 1; seed <= 200; seed++) {
          const m = randomMeasure(meter, allowed, seeded(seed))
          expect(measureBeats(m)).toBe(METER_BEATS[meter])
          expect(playedIndexes(m).length).toBeGreaterThan(0)
          for (const e of m.events) expect([...allowed, 'quarter']).toContain(symbolOf(e))
        }
      }
    }
  })

  it('keep beginner rhythms on the beat', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const m = randomMeasure('4/4', ALL, seeded(seed))
      const starts = onsets(m)
      m.events.forEach((e, i) => {
        // Half notes start on beat 1 or 3; eighths come in pairs within a beat.
        if (e.dur === 'h' && !e.dots) expect([0, 2]).toContain(starts[i])
        if (e.dur === '8' && Number.isInteger(starts[i]) && !(i > 0 && m.events[i - 1].dots)) {
          expect(m.events[i + 1]?.dur).toBe('8')
        }
        if (e.tie) expect(m.events[i + 1]).toBeTruthy()
      })
    }
  })

  it('include the idea being taught', () => {
    let withTie = 0
    for (let seed = 1; seed <= 50; seed++) {
      if (randomMeasure('4/4', ALL, seeded(seed), ['tie']).events.some((e) => e.tie)) withTie++
    }
    expect(withTie).toBeGreaterThan(45)
  })
})

describe('counting', () => {
  it('names counts and beats', () => {
    expect(countName(2)).toBe('beat 3')
    expect(countName(1.5)).toBe('the & of 2')
    expect(beatsText(0.5)).toBe('half a beat')
    expect(beatsText(1)).toBe('1 beat')
    expect(beatsText(1.5)).toBe('1½ beats')
    expect(beatsText(3)).toBe('3 beats')
    expect(eventBeats({ dur: 'h', dots: 1, rest: false })).toBe(3)
  })

  it('writes the counts each note covers', () => {
    const m: Measure = { meter: '4/4', events: [{ dur: 'h', dots: 0, rest: false }, { dur: 'q', dots: 0, rest: true }, { dur: '8', dots: 0, rest: false }, { dur: '8', dots: 0, rest: false }] }
    expect(heldCounts(m)).toEqual(['1 2', '(3)', '4', '&'])
  })
})

describe('scoring taps', () => {
  const m: Measure = {
    meter: '4/4',
    events: [
      { dur: 'q', dots: 0, rest: false },
      { dur: 'q', dots: 0, rest: true },
      { dur: 'h', dots: 0, rest: false },
    ],
  }
  // 60 bpm: notes at 0 ms and 2000 ms.
  it('accepts taps close to each note', () => {
    const r = scoreTaps(m, 60, [1030, 2950], 1000)
    expect(r.hits).toBe(2)
    expect(r.extra).toBe(0)
    expect(Math.round(r.meanOffset)).toBe(-10)
  })

  it('counts taps on rests or far off the beat as mistakes', () => {
    const r = scoreTaps(m, 60, [1000, 2000, 3000], 1000)
    expect(r.hits).toBe(2)
    expect(r.extra).toBe(1)
    const late = scoreTaps(m, 60, [1400, 3000], 1000)
    expect(late.hits).toBe(1)
    expect(late.offsets[0]).toBeNull()
  })
})
