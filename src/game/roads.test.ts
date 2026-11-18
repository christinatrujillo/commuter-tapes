import { describe, expect, it } from 'vitest'
import { asPick, chosen, roadRoute, seeded } from '../test-helpers'
import type { PickQuestion } from './questions'
import { buildRehearsal } from './rehearsal'
import { describeFact, tapeOf } from './review'
import { theoryCard, theoryReview } from './theory'
import { makeRoadNext, makeRoadOrder } from './roads'

const seeds = Array.from({ length: 12 }, (_, i) => seeded(i + 1))
const KINDS = ['repeat', 'repeat-pair', 'endings', 'dc-fine', 'ds-fine', 'dc-coda', 'ds-coda'] as const
const routeOf = (q: PickQuestion) => roadRoute(q.score!.signs!.map((s) => s ?? null))

describe('road signs', () => {
  it('asks the route through each kind of score, with the usual misreadings as the other choices', () => {
    for (const kind of KINDS)
      for (const rng of seeds) {
        const q = asPick(makeRoadOrder(1, [], rng, kind))
        expect(chosen(q), kind).toBe(routeOf(q).join(' '))
        expect(q.options.length, kind).toBeGreaterThanOrEqual(4)
        expect(new Set(q.options).size, kind).toBe(q.options.length)
        expect(q.score!.measures).toHaveLength(q.score!.signs!.length)
      }
  })

  it('asks where to go after a measure where the route turns, saying which time through when it’s played twice', () => {
    for (const kind of KINDS)
      for (const rng of seeds) {
        const q = asPick(makeRoadNext(1, [], rng, kind))
        const route = routeOf(q)
        const [, at, nth] = /^After measure (\d+)(?:, the (first|second) time)?, where do you go\?$/.exec(q.ask.text)!
        const plays = route.flatMap((m, i) => (m === Number(at) ? [i] : []))
        expect(!!nth, q.ask.text).toBe(plays.length > 1)
        const i = plays[nth === 'second' ? 1 : 0]
        expect(chosen(q), q.ask.text).toBe(i + 1 < route.length ? `Measure ${route[i + 1]}` : 'The end')
      }
  })

  it('shows each card’s route the way its words say', () => {
    const route = (item: string) => roadRoute(theoryCard(item, '').score!.signs!.map((s) => s ?? null)).join(' ')
    expect(route('signs:why')).toBe('1 2 1 2 3')
    expect(route('signs:repeat')).toBe('1 2 3 2 3 4')
    expect(route('signs:endings')).toBe('1 2 3 1 2 4')
    expect(route('signs:dc-fine')).toBe('1 2 3 4 1 2')
    expect(route('signs:ds-coda')).toBe('1 2 3 4 2 3 5')
    expect(route('signs:mix')).toBe('1 2 3 4 5 2 3')
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const kind of KINDS) {
      expect(tapeOf(`road:${kind}`), kind).toBe(79)
      expect(theoryReview(`road:${kind}`, 1, seeded(1)), kind).not.toBeNull()
    }
    expect(describeFact('road:endings')).toBe('1st and 2nd endings')
    expect(describeFact('road:ds-coda')).toBe('D.S. al Coda')
    expect(theoryReview('road:fermata', 1, seeded(1))).toBeNull()
  })

  it('explains road signs before the first repeat', () => {
    const steps = buildRehearsal('rx1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Road signs', 'Repeat signs', 'check', 'ready'])
  })
})
