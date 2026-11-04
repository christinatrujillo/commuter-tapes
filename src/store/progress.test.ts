import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mastery } from '../game/questions'
import { schedule, useProgress } from './progress'

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
