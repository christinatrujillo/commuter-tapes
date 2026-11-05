import { describe, expect, it } from 'vitest'
import { skillMeters } from './skills'

const solid = { seen: 6, correct: 6, recent: 1, ms: 1200, pace: 0.6 }
const shaky = { seen: 3, correct: 1, recent: 0.3, ms: 5000 }

describe('skill meters', () => {
  it('counts fluent facts per area out of the ones practiced, and leaves untouched areas empty', () => {
    const meters = skillMeters({ '0:3': solid, '1:5': shaky, 'staff:64': solid, 'sym:half': shaky, 'scale:G': solid, 'ivn:M3': shaky, 'tri:D': solid, 'hd:6': shaky, 'skill:phrase': solid })
    expect(meters.map((m) => [m.label, m.fluent, m.practiced])).toEqual([
      ['Fretboard', 1, 2],
      ['Reading', 1, 1],
      ['Rhythm', 0, 1],
      ['Scales & keys', 1, 1],
      ['Intervals', 0, 1],
      ['Triads', 1, 1],
      ['Chords', 0, 1],
      ['Ear', 0, 0],
    ])
  })
})
