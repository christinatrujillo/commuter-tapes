// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChordChart } from './ChordChart'

describe('chord charts', () => {
  it('writes four bars to a line, the chord over each bar, with a ? in the bar a question asks about', () => {
    const bars = ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'A7']
    const { container } = render(<ChordChart bars={bars.map((b, i) => (i === 4 ? null : b))} mark={4} />)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toContain('?')
    expect(texts.filter((t) => t === 'D7')).toHaveLength(2)
    // Bar numbers 1 to 12.
    expect(texts).toEqual(expect.arrayContaining(['1', '5', '12']))
    // Five staff lines on each of the three lines of the chart.
    const staffLines = [...container.querySelectorAll('line')].filter((l) => l.getAttribute('x1') !== l.getAttribute('x2'))
    expect(staffLines).toHaveLength(15)
    expect(container.querySelector('rect')).toBeTruthy()
  })

  it('prints the numerals under the bars once answered', () => {
    const { container } = render(<ChordChart bars={['A7', 'D7', 'A7', 'A7']} numerals={['I7', 'IV7', 'I7', 'I7']} />)
    expect(container.querySelector('svg')!.dataset.numerals).toBe('I7,IV7,I7,I7')
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toContain('IV7')
  })
})
