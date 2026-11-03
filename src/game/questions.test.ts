import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../music/curriculum'
import { isNatural, midiAt, pitchClass, spelledMidi, type Position, type Region } from '../music/notes'
import { measureBeats, METER_BEATS, onsets, playedIndexes, SYMBOLS, symbolOf } from '../music/rhythm'
import { buildFromPositions, buildSession, buildWeakSpotSession, mastery, weakness, type Stats } from './questions'

/** Deterministic random numbers so failures are reproducible. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inRegion = (p: Position, r: Region) => r.strings.includes(p.string) && p.fret >= r.minFret && p.fret <= r.maxFret

describe('every lesson', () => {
  for (const lesson of ALL_LESSONS) {
    it(`${lesson.id} (${lesson.title}) builds valid questions`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const questions = buildSession(lesson, {}, seeded(seed))
        expect(questions).toHaveLength(lesson.count ?? 10)
        for (const q of questions) {
          expect(lesson.exercises).toContain(q.kind)
          expect(q.facts.length).toBeGreaterThan(0)
          switch (q.kind) {
            case 'name':
              expect(inRegion(q.target, lesson.region)).toBe(true)
              if (!lesson.accidentals) expect(isNatural(midiAt(q.target))).toBe(true)
              break
            case 'find':
            case 'findAll':
              expect(q.targets.length).toBeGreaterThan(q.kind === 'findAll' ? 1 : 0)
              for (const t of q.targets) {
                expect(inRegion(t, lesson.region)).toBe(true)
                expect(pitchClass(midiAt(t))).toBe(q.pc)
              }
              if (q.kind === 'find') expect(q.targets.every((t) => t.string === q.string)).toBe(true)
              break
            case 'staffName':
            case 'staffFind': {
              const sounding = spelledMidi(q.note) - 12
              if (lesson.writtenRange) {
                expect(spelledMidi(q.note)).toBeGreaterThanOrEqual(lesson.writtenRange[0])
                expect(spelledMidi(q.note)).toBeLessThanOrEqual(lesson.writtenRange[1])
              }
              if (!lesson.accidentals) expect(q.note.acc).toBe(0)
              if (q.kind === 'staffFind') {
                expect(q.targets.length).toBeGreaterThan(0)
                for (const t of q.targets) {
                  expect(inRegion(t, lesson.region)).toBe(true)
                  expect(midiAt(t)).toBe(sounding)
                }
              }
              break
            }
            case 'interval':
              expect(lesson.intervals).toContain(q.semitones)
              expect(q.targets.length).toBeGreaterThan(0)
              for (const t of q.targets) expect(midiAt(t) - midiAt(q.root)).toBe(q.semitones)
              break
            case 'intervalName':
              expect(midiAt(q.other) - midiAt(q.root)).toBe(q.semitones)
              expect(q.options).toContain(q.semitones)
              break
            case 'symbolName':
              expect(q.options).toContain(q.symbol)
              expect(lesson.symbols).toContain(q.symbol)
              break
            case 'beats':
              expect(q.options).toContain(SYMBOLS[q.symbol].beats)
              break
            case 'measureFill': {
              expect(measureBeats(q.measure) + q.missing).toBe(METER_BEATS[q.measure.meter])
              const fits = q.options.filter((o) => SYMBOLS[o].beats === q.missing)
              expect(fits).toHaveLength(1)
              break
            }
            case 'countBeat':
              expect(measureBeats(q.measure)).toBe(METER_BEATS[q.measure.meter])
              expect(playedIndexes(q.measure).length).toBeGreaterThanOrEqual(2)
              expect(playedIndexes(q.measure)).toContain(q.target)
              expect(onsets(q.measure)[q.target]).toBe(q.beat)
              break
            case 'tapRhythm':
              expect(measureBeats(q.measure)).toBe(METER_BEATS[q.measure.meter])
              expect(playedIndexes(q.measure).length).toBeGreaterThanOrEqual(2)
              for (const e of q.measure.events) expect([...(lesson.symbols ?? []), 'quarter']).toContain(symbolOf(e))
              break
          }
        }
      }
    })
  }
})

describe('weak spots', () => {
  it('asks about notes you miss more often', () => {
    const lesson = ALL_LESSONS.find((l) => l.id === 'u1-3')!
    const stats: Stats = { '0:3': { seen: 10, correct: 2, recent: 0.1, ms: 6000 } }
    for (let f = 0; f <= 12; f++) {
      if (f !== 3) stats[`0:${f}`] = { seen: 10, correct: 10, recent: 1, ms: 1500, pace: 0.7 }
    }
    let weakHits = 0
    let total = 0
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of buildSession({ ...lesson, exercises: ['name'] }, stats, seeded(seed))) {
        if (q.kind !== 'name') continue
        total++
        if (q.target.fret === 3) weakHits++
      }
    }
    // 8 natural spots on the string, so uniform picks would hit it ~12% of the time.
    // (It can't be asked twice in a row, which caps it near 50%.)
    expect(weakHits / total).toBeGreaterThan(0.25)
  })

  it('needs some history before building a practice round', () => {
    expect(buildWeakSpotSession({})).toBeNull()
    const stats: Stats = {
      '0:1': { seen: 3, correct: 1, recent: 0.3, ms: 4000 },
      '1:2': { seen: 3, correct: 2, recent: 0.6, ms: 3000 },
      '2:3': { seen: 3, correct: 0, recent: 0.1, ms: 7000 },
    }
    const round = buildWeakSpotSession(stats, seeded(7))!
    expect(round).toHaveLength(12)
    const spots = new Set(round.flatMap((q) => q.facts))
    expect(spots.has('2:3')).toBe(true)
  })
})

describe('speed-based mastery', () => {
  it('needs accuracy and speed to call a note fluent', () => {
    expect(mastery(undefined)).toBe('new')
    expect(mastery({ seen: 3, correct: 1, recent: 0.4, ms: 4000 })).toBe('learning')
    expect(mastery({ seen: 5, correct: 5, recent: 0.95, ms: 4000, pace: 1.8 })).toBe('accurate')
    expect(mastery({ seen: 5, correct: 5, recent: 0.95, ms: 1500, pace: 0.8 })).toBe('fluent')
    // Fast but only answered twice: not proven yet.
    expect(mastery({ seen: 2, correct: 2, recent: 0.88, ms: 1200, pace: 0.6 })).toBe('accurate')
  })

  it('treats slow-but-right notes as needing practice', () => {
    const fast = { seen: 6, correct: 6, recent: 1, ms: 1200, pace: 0.6 }
    const slow = { seen: 6, correct: 6, recent: 1, ms: 5000, pace: 2.2 }
    expect(weakness(slow)).toBeGreaterThan(weakness(fast) + 0.4)
  })

  it('builds sprint questions only from the given spots', () => {
    const spots = [
      { string: 0, fret: 3 },
      { string: 1, fret: 5 },
      { string: 2, fret: 7 },
    ]
    const qs = buildFromPositions(spots, {}, 60, seeded(3))
    expect(qs).toHaveLength(60)
    for (const q of qs) {
      if (q.kind === 'name') expect(spots).toContainEqual(q.target)
      else if (q.kind === 'find') expect(spots.map((p) => p.string)).toContain(q.string)
      else throw new Error(`unexpected ${q.kind}`)
    }
  })
})
