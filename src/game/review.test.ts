import { describe, expect, it } from 'vitest'
import { seeded } from '../test-helpers'
import { ALL_LESSONS } from '../music/curriculum'
import { midiAt, pitchClass, spelledMidi } from '../music/notes'
import { buildSession, type FactStat, type Stats } from './questions'
import { buildReview, buildTroubleSpots, describeFact, dueFacts, mixInReview, tapeOf, weakestFacts } from './review'

const DAY = '2026-01-10'
const learned = (due: string): FactStat => ({ seen: 4, correct: 4, recent: 0.9, ms: 1500, pace: 0.9, interval: 3, due })

const STATS: Stats = {
  '5:1': learned('2026-01-08'), // F on the high E string (tape 2)
  'sym:half': learned('2026-01-02'), // tape 1
  'staff:77': learned('2026-01-09'), // F on the top line (tape 2)
  'rule:carry': learned('2026-01-05'), // tape 12
  'key:G': learned('2026-01-06'), // tape 25
  'motion:step': learned('2026-01-07'), // tape 18
  'count:2/2': learned('2026-01-04'), // tape 19
  'iv:12': learned('2026-01-03'), // tape 21
  '1:3': learned('2026-02-01'), // not due yet
}

describe('what comes back for review', () => {
  it('picks due facts, most overdue first', () => {
    expect(dueFacts(STATS, DAY)).toEqual(['sym:half', 'iv:12', 'count:2/2', 'rule:carry', 'key:G', 'motion:step', '5:1', 'staff:77'])
  })

  it('knows which tape each fact came from', () => {
    expect(['5:1', 'sym:half', 'staff:77', 'rule:carry', 'key:G', 'motion:step', 'count:2/2', 'iv:12'].map(tapeOf)).toEqual([2, 1, 2, 12, 25, 18, 19, 21])
  })

  it('turns every kind of fact into a valid question about just that fact', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildReview(STATS, DAY, 20, seeded(seed))
      expect(qs).toHaveLength(8)
      for (const q of qs) {
        expect(q.review?.tape).toBeGreaterThan(0)
        expect(q.facts).toHaveLength(1)
        if (q.kind === 'find') for (const t of q.targets) expect(pitchClass(midiAt(t))).toBe(q.pc)
        if (q.kind === 'name') expect(q.facts[0]).toBe('5:1')
        if (q.kind === 'staffName') expect(spelledMidi(q.note)).toBe(77)
        if (q.kind === 'interval') for (const t of q.targets) expect(midiAt(t) - midiAt(q.root)).toBe(12)
      }
    }
  })
})

describe('mixing review into takes', () => {
  const lesson = ALL_LESSONS.find((l) => l.id === 'r3-1')!

  it('swaps three of ten questions for review, spread out and never first', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const take = buildSession(lesson, {}, seeded(seed))
      const mixed = mixInReview(take, lesson, STATS, DAY, seeded(seed))
      expect(mixed).toHaveLength(10)
      const at = mixed.flatMap((q, i) => (q.review ? [i] : []))
      expect(at).toHaveLength(3)
      expect(at[0]).toBeGreaterThan(0)
      expect(at[1] - at[0]).toBeGreaterThan(1)
    }
  })

  it('leaves the take alone when nothing is due', () => {
    const take = buildSession(lesson, {}, seeded(1))
    expect(mixInReview(take, lesson, { '1:3': learned('2026-02-01') }, DAY)).toBe(take)
  })

  it('doesn’t review the lesson’s own material', () => {
    // C on the B string, on the staff and on the fretboard: both part of this very lesson.
    const own: Stats = { '4:1': learned('2026-01-01'), 'staff:72': learned('2026-01-01') }
    for (let seed = 1; seed <= 20; seed++) {
      const take = buildSession(lesson, {}, seeded(seed))
      expect(mixInReview(take, lesson, own, DAY).some((q) => q.review)).toBe(false)
    }
  })
})

describe('trouble spots', () => {
  const stat = (correct: number, recent: number, ms: number): FactStat => ({ seen: 3, correct, recent, ms })

  it('needs some history before building a practice round', () => {
    expect(buildTroubleSpots({})).toBeNull()
    const stats: Stats = { '0:1': stat(1, 0.3, 4000), '1:2': stat(2, 0.6, 3000), '2:3': stat(0, 0.1, 7000) }
    const round = buildTroubleSpots(stats, seeded(7))!
    expect(round).toHaveLength(12)
    expect(new Set(round.flatMap((q) => q.facts)).has('2:3')).toBe(true)
  })

  it('works on theory once you’ve practiced it, and leaves listening out while it’s off', () => {
    const stats: Stats = { '0:1': stat(3, 0.9, 2000), 'scale:Eb': stat(0, 0.1, 6000), 'ear:m3': stat(0, 0.2, 6000), 'ivn:M3': stat(1, 0.4, 5000) }
    expect(weakestFacts(stats, 5)).toEqual(['scale:Eb', 'ear:m3', 'ivn:M3', '0:1'])
    expect(weakestFacts(stats, 5, false)).not.toContain('ear:m3')
    const round = buildTroubleSpots(stats, seeded(3), false)!
    expect(round.flatMap((q) => q.facts)).toContain('scale:Eb')
    expect(round.flatMap((q) => q.facts)).not.toContain('ear:m3')
    // Rhythm and reading facts stay with Review.
    expect(weakestFacts({ 'sym:half': stat(0, 0.1, 6000) }, 5)).toEqual([])
  })

  it('names each fact plainly', () => {
    expect(['5:4', 'scale:Eb', 'minor:F#', 'key:A', 'ivn:m3', 'inv:M3', 'ear:A4', 'ivnum:5'].map(describeFact)).toEqual([
      'G♯ · high E string, 4th fret',
      'E♭ major scale',
      'F♯ minor scale',
      'A major key signature',
      'Minor 3rd',
      'Major 3rd upside down',
      'Tritone by ear',
      'Counting 5ths',
    ])
  })
})
