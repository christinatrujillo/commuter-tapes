// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Measure, RhythmEvent } from '../music/rhythm'
import { Notation } from './Notation'

const n = (dur: RhythmEvent['dur'], dots: 0 | 1 = 0, tie = false): RhythmEvent => ({ dur, dots, rest: false, ...(tie ? { tie } : {}) })
const r = (dur: RhythmEvent['dur']): RhythmEvent => ({ dur, dots: 0, rest: true })

const MEASURES: Measure[] = [
  { meter: '4/4', events: [n('w')] },
  { meter: '4/4', events: [r('w')] },
  { meter: '4/4', events: [n('h'), r('h')] },
  { meter: '4/4', events: [n('q'), r('q'), n('8'), n('8'), n('q')] },
  { meter: '3/4', events: [n('h', 1)] },
  { meter: '4/4', events: [n('q', 1), n('8'), n('h')] },
  { meter: '4/4', events: [n('q'), n('q', 0, true), n('q'), n('q')] },
]

describe('rhythm notation', () => {
  for (const measure of MEASURES) {
    it(`draws ${measure.events.map((e) => `${e.dur}${e.dots ? '.' : ''}${e.rest ? 'r' : ''}${e.tie ? '~' : ''}`).join(' ')} in ${measure.meter}`, async () => {
      const taps: number[] = []
      const { container } = render(<Notation measure={measure} labels={measure.events.map(() => '1')} onTapNote={(i) => taps.push(i)} />)
      await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
      const hits = container.querySelectorAll<SVGRectElement>('rect.note-hit')
      expect(hits).toHaveLength(measure.events.filter((e) => !e.rest).length)
      hits[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      if (hits.length) expect(taps).toHaveLength(1)
    })
  }

  it('outlines the missing beats for “what completes the measure?”', async () => {
    const { container } = render(<Notation measure={{ meter: '4/4', events: [n('h'), n('q')] }} blankBeats={1} />)
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect(container.querySelector('rect[stroke-dasharray]')).toBeTruthy()
  })

  it('moves the playback line on request', async () => {
    const playhead: { current: ((beat: number | null) => void) | null } = { current: null }
    const { container } = render(<Notation measure={{ meter: '4/4', events: [n('q'), n('q'), n('h')] }} playhead={playhead} />)
    await waitFor(() => expect(playhead.current).toBeTruthy())
    playhead.current!(1.5)
    const line = container.querySelector('svg > line[stroke="#a8742a"]')!
    expect(line.getAttribute('visibility')).toBe('visible')
    playhead.current!(null)
    expect(line.getAttribute('visibility')).toBe('hidden')
  })
})
