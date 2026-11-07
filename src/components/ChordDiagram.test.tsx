// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { movedShape, OPEN_CHORDS } from '../music/chordShapes'
import { ChordDiagram } from './ChordDiagram'

describe('chord diagrams', () => {
  it('draws an open chord with its nut, open and muted strings, and finger numbers', () => {
    const { container } = render(<ChordDiagram shape={OPEN_CHORDS.C.shape} />)
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts.filter((t) => t === '×')).toHaveLength(1)
    expect(texts.filter((t) => t === '○')).toHaveLength(2)
    expect(texts).toEqual(expect.arrayContaining(['1', '2', '3']))
    expect(texts.some((t) => t?.endsWith('fr'))).toBe(false)
    // The nut is the one thick line.
    expect(container.querySelectorAll('line[stroke-width="4"]')).toHaveLength(1)
  })

  it('draws a shape up the neck with its starting fret and its barre', () => {
    const { container } = render(<ChordDiagram shape={movedShape('E', 5)} />)
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toContain('5fr')
    expect(container.querySelectorAll('line[stroke-width="4"]')).toHaveLength(0)
    expect(container.querySelector('rect')).toBeTruthy()
  })

  it('rings the dot a question asks about, and labels the strings', () => {
    const { container } = render(<ChordDiagram shape={OPEN_CHORDS.A.shape} mark={3} dots={[null, null, null, '?', null, null]} names={[null, 'A', 'E', 'A', 'C♯', 'E']} />)
    const svg = container.querySelector('svg')!
    expect(svg.dataset.mark).toBe('3')
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual(expect.arrayContaining(['?', 'C♯']))
  })
})
