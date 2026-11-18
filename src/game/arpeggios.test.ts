import { describe, expect, it } from 'vitest'
import { asPick, asTap, chosen, inRegion, seeded } from '../test-helpers'
import { allPositions, midiAt, pitchClass, STRING_LABELS } from '../music/notes'
import { buildRehearsal } from './rehearsal'
import { describeFact, tapeOf } from './review'
import { theoryCard, theoryReview } from './theory'
import { makeArpMissing, makeArpName, makeArpSeventh } from './arpeggios'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
/** Each chord's half steps above its root, written out by hand. */
const STEPS: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], 'm7♭5': [0, 3, 6, 10] }
const above = (root: number, midi: number) => pitchClass(midi - root)
/** "string:fret=label" for each dot, low E string first. */
const dotsOf = (item: string) => theoryCard(item, '').board!.markers.map((m) => `${STRING_LABELS[m.pos.string]}${m.pos.fret}=${m.label}`)

describe('arpeggio shapes', () => {
  it('picks the classic shapes out of the major scale pattern’s position', () => {
    // G from the low E string's 3rd fret, and C from the A string's: two notes on some strings, one on others.
    expect(dotsOf('arp:major')).toEqual(['E3=1', 'A2=3', 'A5=5', 'D5=1', 'G4=3', 'B3=5', 'e3=1'])
    expect(dotsOf('arp:minor')).toEqual(['E3=1', 'E6=♭3', 'A5=5', 'D5=1', 'G3=♭3', 'B3=5', 'e3=1', 'e6=♭3'])
    expect(dotsOf('arp:a-string')).toEqual(['E3=5', 'A3=1', 'D2=3', 'D5=5', 'G5=1', 'B5=3', 'e3=5'])
    expect(dotsOf('arp:sevenths')).toEqual(['E3=1', 'A2=3', 'A5=5', 'D3=♭7', 'D5=1', 'G4=3', 'B3=5', 'B6=♭7', 'e3=1'])
  })

  it('hides one note of a shape, on the string the question names', () => {
    for (const rng of seeds) {
      const q = asTap(makeArpMissing(1, ['maj', 'min', 'm7'], [0, 1], rng))
      const [, name, string] = /^Tap the missing note of this (\S+)(?: major)? arpeggio, on the (.+) string$/.exec(q.ask.text)!
      const root = midiAt(q.from)
      const steps = STEPS[name.replace(/^[A-G][♯♭]?/, '')]
      const chordNotes = allPositions(q.region).filter((p) => steps.includes(above(root, midiAt(p))))
      expect(q.targets).toHaveLength(1)
      expect(STRING_LABELS[q.targets[0].string]).toBe({ 'low E': 'E', 'high E': 'e' }[string] ?? string)
      expect([...q.markers.map((m) => m.pos), ...q.targets].map((p) => `${p.string}:${p.fret}`).sort()).toEqual(chordNotes.map((p) => `${p.string}:${p.fret}`).sort())
    }
  })

  it('names a shape from its notes, among its family on the same root', () => {
    for (const rng of seeds) {
      const q = asPick(makeArpName(1, ['maj', 'min', 'maj7', '7', 'm7', 'm7b5'], [0, 1], rng))
      const root = q.board!.markers.find((m) => m.tone === 'root')!
      const heard = [...new Set(q.board!.markers.map((m) => above(midiAt(root.pos), midiAt(m.pos))))].sort((a, b) => a - b)
      expect(STEPS[String(chosen(q)).replace(/^[A-G][♯♭]?/, '')]).toEqual(heard)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('adds the 7th: a half step below a root for maj7, a whole step for the rest', () => {
    for (const rng of seeds) {
      const q = asTap(makeArpSeventh(1, ['maj7', '7', 'm7', 'm7b5'], [0, 1], rng))
      const seventh = /into \S+maj7$/.test(q.ask.text) ? 11 : 10
      expect(q.targets.length).toBeGreaterThan(0)
      for (const p of q.targets) {
        expect(above(midiAt(q.from), midiAt(p))).toBe(seventh)
        expect(inRegion(p, q.region)).toBe(true)
      }
      // The board is the triad: three notes, none of them the 7th.
      expect(new Set(q.markers.map((m) => above(midiAt(q.from), midiAt(m.pos)))).size).toBe(3)
    }
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['arpshape:maj', 'arpshape:min', 'arpshape:m7', 'arpname:7', 'arp7:maj7', 'arp7:m7b5']) {
      expect(tapeOf(fact), fact).toBe(72)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('arpshape:min')).toBe('The minor arpeggio shape')
    expect(describeFact('arpname:7')).toBe('Spotting a dominant 7th arpeggio')
    expect(describeFact('arp7:m7b5')).toBe('Half-diminished from its triad')
    for (const junk of ['arpshape:sus4', 'arpname:', 'arp7:maj']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains what an arpeggio is before the first shape', () => {
    const steps = buildRehearsal('sc3-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Chords, one note at a time', 'The major arpeggio', 'check', 'ready'])
  })
})
