import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mastery } from '../game/questions'
import { exportData, readBackup, schedule, useProgress } from './progress'

beforeEach(() => useProgress.getState().reset())

describe('recording answers', () => {
  it('tracks speed against the target and makes a note fluent once it is fast and right', () => {
    const { recordAnswer } = useProgress.getState()
    recordAnswer(['0:5'], true, 3000, 2000) // slow
    expect(mastery(useProgress.getState().stats['0:5'])).toBe('learning')
    recordAnswer(['0:5'], true, 1500, 2000)
    recordAnswer(['0:5'], true, 1200, 2000)
    recordAnswer(['0:5'], true, 1000, 2000)
    const stat = useProgress.getState().stats['0:5']
    expect(stat.pace).toBeLessThan(1)
    expect(mastery(stat)).toBe('fluent')
  })

  it('ignores timing for wrong or untimed answers, and caps long pauses', () => {
    const { recordAnswer } = useProgress.getState()
    recordAnswer(['1:3'], true, 1000, 2000)
    const pace = useProgress.getState().stats['1:3'].pace
    recordAnswer(['1:3'], false, 900, 2000)
    recordAnswer(['1:3'], true, 800, null)
    expect(useProgress.getState().stats['1:3'].pace).toBe(pace)
    recordAnswer(['2:2'], true, 120000, 2000)
    expect(useProgress.getState().stats['2:2'].pace).toBe(3)
    expect(useProgress.getState().stats['2:2'].ms).toBe(15000)
  })

  it('keeps the best sprint score per sprint type', () => {
    const { recordBest } = useProgress.getState()
    expect(recordBest('low', 12)).toBe(true)
    expect(recordBest('low', 9)).toBe(false)
    expect(recordBest('low', 15)).toBe(true)
    expect(recordBest('neck', 4)).toBe(true)
    expect(useProgress.getState().bests).toEqual({ low: 15, neck: 4 })
  })
})

describe('spaced repetition', () => {
  const d = '2026-03-01'
  it('stretches the gap after each on-time right answer', () => {
    expect(schedule(undefined, true, true, d)).toEqual({ interval: 1, due: '2026-03-02' })
    expect(schedule({ seen: 1, correct: 1, recent: 0.8, ms: 1000, interval: 1, due: d }, true, true, d)).toEqual({ interval: 3, due: '2026-03-04' })
    expect(schedule({ seen: 2, correct: 2, recent: 0.9, ms: 1000, interval: 3, due: d }, true, true, d)).toEqual({ interval: 8, due: '2026-03-09' })
    expect(schedule({ seen: 9, correct: 9, recent: 1, ms: 900, interval: 40, due: d }, true, true, d).interval).toBe(60)
  })

  it('stretches it less when the answer was slow', () => {
    expect(schedule({ seen: 2, correct: 2, recent: 0.9, ms: 4000, interval: 3, due: d }, true, false, d).interval).toBe(5)
  })

  it('ignores extra right answers before the review date, and brings misses back tomorrow', () => {
    const early = { seen: 3, correct: 3, recent: 1, ms: 1000, interval: 8, due: '2026-03-05' }
    expect(schedule(early, true, true, d)).toEqual({ interval: 8, due: '2026-03-05' })
    expect(schedule(early, false, true, d)).toEqual({ interval: 1, due: '2026-03-02' })
  })

  it('schedules facts as you answer them', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 2, 1, 9))
      useProgress.getState().recordAnswer(['0:3'], true, 1200, 2000)
      expect(useProgress.getState().stats['0:3'].due).toBe('2026-03-02')
      vi.setSystemTime(new Date(2026, 2, 2, 9))
      useProgress.getState().recordAnswer(['0:3'], true, 1200, 2000)
      expect(useProgress.getState().stats['0:3']).toMatchObject({ interval: 3, due: '2026-03-05' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('restoring a backup', () => {
  it('restores everything a backup holds', () => {
    const { recordAnswer, completeSession, recordBest, markRehearsed, updateSettings } = useProgress.getState()
    recordAnswer(['0:5'], true, 1500, 2000)
    completeSession({ lessonId: 'r1-1', nailed: 8, mistakes: 1 })
    recordBest('low', 12)
    markRehearsed('r1-1')
    updateSettings({ dailyGoal: 50, metronome: 'vibrate' })
    const before = useProgress.getState()
    const backup = JSON.parse(exportData())
    useProgress.getState().reset()
    expect(useProgress.getState().importData(backup)).toBe(true)
    const after = useProgress.getState()
    for (const key of ['nailed', 'bests', 'rehearsed', 'lessons', 'stats', 'streak', 'daily', 'settings'] as const) expect(after[key]).toEqual(before[key])
  })

  it('turns down files that aren’t backups', () => {
    for (const data of [null, 'text', 42, [], { stats: {} }, { lessons: {} }, { stats: [], lessons: {} }]) expect(readBackup(data)).toBeNull()
  })

  it('drops anything of the wrong shape and keeps the rest', () => {
    const backup = readBackup({
      nailed: 'lots',
      bests: { low: 12, neck: 'high' },
      rehearsed: { 'r1-1': true, 'r1-2': 'yes' },
      lessons: { 'r1-1': { stars: 2, completions: 3 }, 'r1-2': { stars: 99, completions: 1 }, 'r1-3': 'done' },
      stats: { '0:5': { seen: 3, correct: 2, recent: 0.7, ms: 1800, due: '2026-11-06', pace: 'fast' }, '0:6': { seen: -1, correct: 0, recent: 0, ms: 0 } },
      streak: { count: Infinity, lastDate: '<b>yesterday</b>' },
      daily: { date: 'today', nailed: 5 },
      settings: { sound: 'off', dailyGoal: -5, metronome: 'drum', leftHanded: true, extra: 'ignored' },
      extra: { anything: true },
    })!
    expect(backup.nailed).toBe(0)
    expect(backup.bests).toEqual({ low: 12 })
    expect(backup.rehearsed).toEqual({ 'r1-1': true })
    expect(backup.lessons).toEqual({ 'r1-1': { stars: 2, completions: 3 } })
    expect(backup.stats).toEqual({ '0:5': { seen: 3, correct: 2, recent: 0.7, ms: 1800, due: '2026-11-06' } })
    expect(backup.streak).toEqual({ count: 0, lastDate: null })
    expect(backup.daily.nailed).toBe(0)
    expect(backup.settings).toEqual({ ...useProgress.getState().settings, leftHanded: true })
    expect(backup).not.toHaveProperty('extra')
  })

  it('can’t change how objects behave through a crafted key', () => {
    const backup = readBackup(JSON.parse('{"stats": {}, "lessons": {"__proto__": {"stars": 3, "completions": 1}}, "bests": {"__proto__": 5}}'))!
    expect(Object.getPrototypeOf(backup.lessons)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).stars).toBeUndefined()
  })
})
