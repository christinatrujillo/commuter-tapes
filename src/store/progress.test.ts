import { beforeEach, describe, expect, it } from 'vitest'
import { mastery } from '../game/questions'
import { useProgress } from './progress'

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
