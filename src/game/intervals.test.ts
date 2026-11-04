import { describe, expect, it } from 'vitest'
import { asPick, asTap, chosen, inRegion, seeded } from '../test-helpers'
import { ALL_LESSONS, findLesson, isListening } from '../music/curriculum'
import { midiAt } from '../music/notes'
import { intervalAbove, intervalName, intervalSize, invertInterval, parseInterval, toneName, type Interval } from '../music/theory'
import { currentLessonId, isUnlocked, listeningOff, LISTENING_PAUSE_MS } from '../store/progress'
import { makeIvBelow, makeIvHear, makeIvHearFind, makeIvInvert, makeIvName, makeIvReadName } from './intervals'
import { buildReview, dueFacts, tapeOf } from './review'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const iv = (short: string) => parseInterval(short)
const capitalized = (i: Interval) => intervalName(i).charAt(0).toUpperCase() + intervalName(i).slice(1)
const ALL = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'A5', 'm6', 'M6', 'm7', 'M7', 'P8']

describe('interval rules', () => {
  it('sizes and names intervals', () => {
    expect(ALL.map((s) => intervalSize(iv(s)))).toEqual([1, 2, 3, 4, 5, 6, 6, 7, 8, 8, 9, 10, 11, 12])
    expect(intervalSize(iv('P3'))).toBeNull()
    expect(intervalSize(iv('M5'))).toBeNull()
    expect(['M3', 'P8', 'A4', 'd5'].map((s) => intervalName(iv(s)))).toEqual(['major 3rd', 'octave', 'augmented 4th', 'diminished 5th'])
  })

  it('spells the note an interval above, one letter per step', () => {
    expect(toneName(intervalAbove({ letter: 'C', acc: 0 }, iv('A4'))!)).toBe('F♯')
    expect(toneName(intervalAbove({ letter: 'C', acc: 0 }, iv('d5'))!)).toBe('G♭')
    expect(toneName(intervalAbove({ letter: 'E', acc: -1 }, iv('M3'))!)).toBe('G')
    expect(toneName(intervalAbove({ letter: 'F', acc: 1 }, iv('m7'))!)).toBe('E')
  })

  it('turns intervals upside down', () => {
    expect(['M3', 'm2', 'P4', 'A4', 'd5', 'M7'].map((s) => intervalName(invertInterval(iv(s))))).toEqual([
      'minor 6th',
      'major 7th',
      'perfect 5th',
      'diminished 5th',
      'augmented 4th',
      'minor 2nd',
    ])
  })
})

describe('interval questions', () => {
  it('names intervals between spelled notes, with near misses as the other choices', () => {
    for (const rng of seeds) {
      const q = asPick(makeIvName(1, ALL, rng))
      const right = iv(q.facts[0].slice(4))
      expect(chosen(q)).toBe(capitalized(right))
      expect(q.sound[1] - q.sound[0]).toBe(intervalSize(right))
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('reads intervals on the staff in a key, written apart or stacked', () => {
    for (const rng of seeds) {
      for (const stacked of [false, true]) {
        const q = asPick(makeIvReadName(1, ['C', 'G', 'D', 'F', 'Bb'], ALL, stacked, rng))
        const measure = q.score!.measures[0]
        expect(measure).toHaveLength(stacked ? 1 : 2)
        if (stacked) expect(measure[0].with).toBeTruthy()
        expect(q.sound[1] - q.sound[0]).toBe(intervalSize(iv(q.facts[0].slice(4))))
      }
    }
  })

  it('flips qualities and numbers, offering the half-flipped answers as traps', () => {
    for (const rng of seeds) {
      const q = asPick(makeIvInvert(1, ['m3', 'M3', 'P4', 'M6'], rng))
      const from = iv(q.facts[0].slice(4))
      expect(chosen(q)).toBe(capitalized(invertInterval(from)))
      if (from.quality === 'M') expect(q.options).toContain(capitalized({ quality: 'M', number: 9 - from.number }))
    }
  })

  it('finds the note an interval below, anywhere nearby on the neck', () => {
    for (const rng of seeds) {
      const q = asTap(makeIvBelow(1, ['m3', 'M3', 'P4', 'P5', 'm6', 'M6'], rng))
      const size = intervalSize(iv(q.facts[0].slice(4)))!
      expect(q.targets.length).toBeGreaterThan(0)
      for (const t of q.targets) {
        expect(midiAt(q.from) - midiAt(t)).toBe(size)
        expect(inRegion(t, q.region)).toBe(true)
      }
    }
  })

  it('plays ear questions rising, falling or together, and asks for what was played', () => {
    const labels = ['', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave']
    const modes = new Set<string>()
    for (const rng of seeds) {
      const q = asPick(makeIvHear(1, ['m2', 'M3', 'A4', 'P5', 'P8'], ['up', 'down', 'together'], rng))
      const [a, b] = q.listen!.notes
      expect(chosen(q)).toBe(labels[Math.abs(b - a)])
      modes.add(q.listen!.together ? 'together' : b > a ? 'up' : 'down')
      const find = asTap(makeIvHearFind(1, ['M2', 'P4', 'P8'], rng))
      for (const t of find.targets) expect(midiAt(t)).toBe(find.listen!.notes[1])
      expect(find.listen!.notes[0]).toBe(midiAt(find.from))
    }
    expect(modes).toEqual(new Set(['up', 'down', 'together']))
    // Reviewed on its own, an interval comes with the ones nearest in size.
    const review = asPick(makeIvHear(1, [], ['up'], seeded(1), 'M3'))
    expect(review.options).toContain('Major 3rd')
    expect(review.options).toHaveLength(4)
  })
})

describe('listening and the MONITORS switch', () => {
  const settings = (earTraining: boolean) => ({ sound: false, haptics: false, autoContinue: false, leftHanded: false, highEOnTop: true, unlockAll: false, dailyGoal: 30, metronome: 'click' as const, earTraining })

  it('knows which tracks are ear training', () => {
    expect(isListening(findLesson('t9-1')!.lesson)).toBe(true)
    expect(isListening(findLesson('t8-3')!.lesson)).toBe(false)
  })

  it('pauses listening for an hour, or turns it off for good in Settings', () => {
    const now = 1_000_000
    expect(listeningOff({ settings: settings(true), listeningPausedUntil: null }, now)).toBeNull()
    expect(listeningOff({ settings: settings(true), listeningPausedUntil: now + LISTENING_PAUSE_MS }, now)).toBe('paused')
    expect(listeningOff({ settings: settings(true), listeningPausedUntil: now - 1 }, now)).toBeNull()
    expect(listeningOff({ settings: settings(false), listeningPausedUntil: null }, now)).toBe('settings')
  })

  it('lets you skip the ear-training tracks when ear training is off', () => {
    // Everything recorded except the ear-training tracks.
    const lessons = Object.fromEntries(ALL_LESSONS.filter((l) => !isListening(l)).map((l) => [l.id, { stars: 3, completions: 1 }]))
    expect(currentLessonId(lessons)).toBe('t9-1')
    expect(currentLessonId(lessons, false)).toBeNull()
    // The second ear-training track waits for the first, unless ear training is off.
    expect(isUnlocked('t9-2', lessons, false)).toBe(false)
    expect(isUnlocked('t9-2', lessons, false, false)).toBe(true)
  })

  it('leaves listening review out while listening is off, and tags it with its tape when on', () => {
    const due = { seen: 3, correct: 3, recent: 1, ms: 2000, interval: 3, due: '2026-01-01' }
    const stats = { 'ear:P5': due, 'ivn:M3': due }
    expect(buildReview(stats, '2026-02-01', 10, seeded(1)).map((q) => q.facts[0]).sort()).toEqual(['ear:P5', 'ivn:M3'])
    expect(buildReview(stats, '2026-02-01', 10, seeded(1), undefined, false).map((q) => q.facts[0])).toEqual(['ivn:M3'])
    // The Jam room's "due" count agrees with what Review will actually ask.
    expect(dueFacts(stats, '2026-02-01')).toHaveLength(2)
    expect(dueFacts(stats, '2026-02-01', false)).toEqual(['ivn:M3'])
    expect(['ivnum:5', 'ivn:M3', 'invnum:3', 'inv:M3', 'ear:P5', 'ear:M3'].map(tapeOf)).toEqual([29, 29, 31, 31, 32, 32])
  })
})
