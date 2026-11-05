import { describe, expect, it } from 'vitest'
import { GLOSSARY, glossarySegments } from './glossary'

const picked = (text: string, skip?: string[], limit?: number) =>
  glossarySegments(text, skip, limit)
    .filter((s) => s.entry)
    .map((s) => s.text)

describe('the glossary', () => {
  it('picks out each word once, with longer phrases winning', () => {
    expect(picked('A key signature names the key. The key is home.')).toEqual(['key signature', 'key'])
    expect(picked('Two scales, then a scale again.')).toEqual(['scales'])
  })

  it('leaves the card’s own topic plain, and ordinary words alone', () => {
    expect(picked('A key is a piece of music’s home base.', ['What a key is'])).toEqual([])
    expect(picked('Hold it for the rest of the measure.')).toEqual(['measure'])
  })

  it('picks out no more than three words, so text stays easy to read', () => {
    expect(picked('A scale, a chord, an interval and an octave.')).toHaveLength(3)
  })

  it('keeps the text itself unchanged', () => {
    const text = 'Count up the G major scale to its 6th note, a half step at a time.'
    expect(glossarySegments(text).map((s) => s.text).join('')).toBe(text)
  })

  it('has a short definition for every word', () => {
    for (const e of GLOSSARY) {
      expect(e.definition.length).toBeGreaterThan(20)
      expect(e.definition.length).toBeLessThan(130)
    }
  })
})
