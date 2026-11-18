import { describe, expect, it } from 'vitest'
import { seeded } from '../test-helpers'
import { scoreTaps } from '../components/TapRhythm'
import { buildRehearsal, heldCounts } from '../game/rehearsal'
import { makeTapRhythm, TAP_BPM } from '../game/questions'
import { beatsText, countAt, countName, eventQuarters, measureQuarters, METER_QUARTERS, note, onsets, playedIndexes, randomMeasure, symbolOf, tripletNote, type Measure, type SymbolId } from './rhythm'

const ALL: SymbolId[] = ['whole', 'half', 'quarter', 'eighth', 'dottedHalf', 'dottedQuarter', 'wholeRest', 'halfRest', 'quarterRest', 'tie']

describe('generated rhythms', () => {
  it('always fill the measure exactly, using only allowed values', () => {
    const sets: SymbolId[][] = [['whole', 'half', 'quarter'], ['half', 'quarter', 'quarterRest', 'halfRest'], ALL]
    for (const allowed of sets) {
      for (const meter of ['4/4', '3/4', '2/4', '2/2'] as const) {
        for (let seed = 1; seed <= 200; seed++) {
          const m = randomMeasure(meter, allowed, seeded(seed))
          expect(measureQuarters(m)).toBe(METER_QUARTERS[meter])
          expect(playedIndexes(m).length).toBeGreaterThan(0)
          for (const e of m.events) expect([...allowed, 'quarter']).toContain(symbolOf(e))
        }
      }
    }
  })

  it('count sixteenths 1 e & a, and a pickup as the end of its bar', () => {
    expect([0, 0.25, 0.5, 0.75, 1].map((p) => countAt(p))).toEqual(['1', 'e', '&', 'a', '2'])
    expect(countName(1.75)).toBe('the a of 2')
    for (let seed = 1; seed <= 100; seed++) {
      const m = randomMeasure('4/4', [...ALL, 'eighthRest', 'sixteenth', 'syncopation'], seeded(seed), [], 3)
      expect(onsets(m)[0]).toBe(3)
      expect(3 + measureQuarters(m)).toBe(4)
    }
  })

  it('score sixteenths against their own notes only', () => {
    const m: Measure = { meter: '2/4', events: [{ dur: '16', dots: 0, rest: false }, { dur: '16', dots: 0, rest: false }, { dur: '16', dots: 0, rest: false }, { dur: '16', dots: 0, rest: false }, { dur: 'q', dots: 0, rest: false }] }
    // At 48 bpm sixteenths are 312 ms apart: taps on every other one match two notes, not four.
    expect(scoreTaps(m, 48, [0, 625, 1250], 0).hits).toBe(3)
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
    expect(eventQuarters({ dur: 'h', dots: 1, rest: false })).toBe(3)
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

describe('2/4 and cut time', () => {
  it('keeps eighth notes out of cut time', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(randomMeasure('2/2', ALL, seeded(seed)).events.some((e) => e.dur === '8')).toBe(false)
    }
  })

  it('counts half-note beats in cut time', () => {
    expect(countAt(2, '2/2')).toBe('2')
    expect(countAt(1, '2/2')).toBe('&')
    expect(countName(3, '2/2')).toBe('the & of 2')
    expect(countName(1, '2/4')).toBe('beat 2')
  })

  it('writes cut-time counts under the half-note beats', () => {
    const m: Measure = { meter: '2/2', events: [{ dur: 'w', dots: 0, rest: false }] }
    expect(heldCounts(m)).toEqual(['1 2'])
    const m2: Measure = { meter: '2/2', events: [{ dur: 'q', dots: 0, rest: false }, { dur: 'q', dots: 0, rest: false }, { dur: 'h', dots: 0, rest: true }] }
    expect(heldCounts(m2)).toEqual(['1', '&', '(2)'])
  })

  it('times taps against half-note beats in cut time', () => {
    // 60 bpm in cut time: a half note per second, so a quarter note lands half a second in.
    const m: Measure = { meter: '2/2', events: [{ dur: 'q', dots: 0, rest: false }, { dur: 'q', dots: 0, rest: false }, { dur: 'h', dots: 0, rest: false }] }
    const r = scoreTaps(m, 60, [1000, 1500, 2000], 1000)
    expect(r.hits).toBe(3)
    expect(r.extra).toBe(0)
  })
})

describe('silent counts', () => {
  it('bracket each counted beat of a rest on its own', () => {
    const m: Measure = { meter: '4/4', events: [{ dur: 'h', dots: 0, rest: false }, { dur: 'h', dots: 0, rest: true }] }
    expect(heldCounts(m)).toEqual(['1 2', '(3) (4)'])
    expect(heldCounts({ meter: '4/4', events: [{ dur: 'w', dots: 0, rest: true }] })).toEqual(['(1) (2) (3) (4)'])
  })
})

describe('6/8 and triplets', () => {
  const SIX_EIGHT: SymbolId[] = ['quarter', 'eighth', 'dottedQuarter', 'dottedHalf']

  it('fills 6/8 with six eighth-note beats, its eighths in threes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = randomMeasure('6/8', SIX_EIGHT, seeded(seed))
      expect(measureQuarters(m)).toBe(3)
      const starts = onsets(m)
      // Every note starts on an eighth, and the second half of the measure starts on a note (unless one note fills it all).
      expect(starts.every((s) => Number.isInteger(s * 2))).toBe(true)
      if (m.events.length > 1) expect(starts).toContain(1.5)
    }
  })

  it('counts 6/8 one to six, and a triplet 1 trip let', () => {
    expect([0, 0.5, 1, 1.5, 2, 2.5].map((p) => countAt(p, '6/8'))).toEqual(['1', '2', '3', '4', '5', '6'])
    const m: Measure = { meter: '4/4', events: [note('q'), tripletNote(), tripletNote(), tripletNote(), note('h')] }
    // Three thirds land exactly on the next beat: counted in thirds of a beat, 0, 3, 4, 5 and 6.
    expect(onsets(m).map((p) => p * 3)).toEqual([0, 3, 4, 5, 6])
    expect(onsets(m).map((p) => countAt(p))).toEqual(['1', '2', 'trip', 'let', '3'])
    expect(countName(1 + 2 / 3)).toBe('the let of 2')
    expect(measureQuarters(m)).toBe(4)
    expect(symbolOf(tripletNote())).toBe('triplet')
  })

  it('writes the counts a held note covers in 6/8', () => {
    const m: Measure = { meter: '6/8', events: [note('q', 1), note('q'), note('8')] }
    expect(heldCounts(m)).toEqual(['1 2 3', '4 5', '6'])
  })

  it('puts triplets on the beat, and keeps every note on the grid', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = randomMeasure('4/4', ['quarter', 'eighth', 'half', 'triplet'], seeded(seed), ['triplet'])
      expect(measureQuarters(m)).toBe(4)
      onsets(m).forEach((s, i) => {
        if (m.events[i].triplet && !m.events[i - 1]?.triplet) expect(Number.isInteger(s), `seed ${seed}`).toBe(true)
      })
    }
  })

  it('teaches 6/8 and the triplet on cards of their own, and taps 6/8 at an easy eighth-note pace', () => {
    const cards = (id: string) => buildRehearsal(id, seeded(1))!.steps.flatMap((s) => (s.kind === 'card' ? [`${s.card.title}: ${s.card.subtitle}`] : []))
    expect(cards('rx2-1')).toContain('6/8 time: 6 beats per measure')
    expect(cards('rx2-3')).toContain('Triplet: Three in the time of two')
    const q = makeTapRhythm(1, '6/8', SIX_EIGHT, TAP_BPM, seeded(1))
    expect(q.kind === 'tapRhythm' && q.bpm).toBe(TAP_BPM * 1.5)
  })

  it('times taps against eighth-note beats in 6/8', () => {
    // 60 bpm in 6/8: an eighth note per second, so a dotted quarter lasts three.
    const m: Measure = { meter: '6/8', events: [note('q', 1), note('8'), note('8'), note('8')] }
    const r = scoreTaps(m, 60, [1000, 4000, 5000, 6000], 1000)
    expect(r.hits).toBe(4)
    expect(r.extra).toBe(0)
    expect(eventQuarters(tripletNote()) * 3).toBe(1)
  })
})
