// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Measure } from '../music/rhythm'
import type { ScoreMeasure } from '../music/score'
import { Notation } from './Notation'
import { Score } from './Score'

const q = (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave: number, sign?: -1 | 0 | 1): ScoreMeasure[number] => ({ letter, octave, dur: 'q', sign })

describe('melody notation', () => {
  it('draws two measures with accidentals, a key signature, a marker and names', async () => {
    const measures: ScoreMeasure[] = [
      [q('F', 4, 1), q('G', 4), q('F', 4, 0), q('E', 4)],
      [{ letter: 'C', octave: 5, dur: 'h' }, { letter: 'B', octave: 4, dur: 'h', sign: -1 }],
    ]
    const { container } = render(<Score measures={measures} keySig="G" meter="4/4" marker={2} labels={['F♯', 'G', 'F', 'E', 'C', 'B♭']} />)
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect(container.querySelector('[data-marker="2"]')).toBeTruthy()
    expect([...container.querySelectorAll('svg > text')].map((t) => t.textContent)).toEqual(['F♯', 'G', 'F', 'E', 'C', 'B♭'])
  })

  it('leaves room under each note for its label, so long words don’t run together', async () => {
    const chord = (letter: 'C' | 'E' | 'G'): ScoreMeasure => [{ letter: 'C', octave: 4, dur: 'w', with: [{ letter, octave: 4 }] }]
    const labels = ['major', 'minor', 'diminished', 'augmented']
    const { container } = render(<Score measures={[chord('E'), chord('E'), chord('G'), chord('G')]} labels={labels} />)
    await waitFor(() => expect(container.querySelector('svg > text')).toBeTruthy())
    const xs = [...container.querySelectorAll('svg > text')].map((t) => Number(t.getAttribute('x')))
    // Neighboring labels sit at least half of each word apart (about 7.5 units a letter at 10pt), plus a gap.
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(((labels[i - 1].length + labels[i].length) / 2) * 7.5 + 6)
  })

  it('draws two notes stacked on one stem, each with its own sign', async () => {
    const measures: ScoreMeasure[] = [[{ letter: 'C', octave: 4, dur: 'w', with: [{ letter: 'E', octave: 4, sign: -1 }] }]]
    const { container } = render(<Score measures={measures} labels={['C–E♭']} />)
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
    expect([...container.querySelectorAll('svg > text')].map((t) => t.textContent)).toEqual(['C–E♭'])
  })

  it('draws a key signature on its own', async () => {
    for (const keySig of ['C', 'G', 'D', 'F', 'C#', 'Cb'] as const) {
      const { container, unmount } = render(<Score measures={[[]]} keySig={keySig} />)
      await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
      unmount()
    }
  })

  it('draws cut time and 2/4', async () => {
    const measures: Measure[] = [
      { meter: '2/2', events: [{ dur: 'h', dots: 0, rest: false }, { dur: 'q', dots: 0, rest: false }, { dur: 'q', dots: 0, rest: true }] },
      { meter: '2/4', events: [{ dur: 'h', dots: 0, rest: false }] },
    ]
    for (const measure of measures) {
      const { container, unmount } = render(<Notation measure={measure} />)
      await waitFor(() => expect(container.querySelector('svg')).toBeTruthy())
      unmount()
    }
  })
})
