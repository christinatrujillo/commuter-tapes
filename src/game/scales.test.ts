import { describe, expect, it } from 'vitest'
import { asPick, chosen, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import { melodicMinorScale, minorScaleOn, parseTone, spelled, toneName, tonePc } from '../music/theory'
import { resolveNotes } from '../music/score'
import { buildRehearsal } from './rehearsal'
import { describeFact, tapeOf } from './review'
import { theoryCard, theoryReview } from './theory'
import {
  makeHarmonicHear,
  makeMelodicHear,
  makeMelodicNote,
  makeMelodicSpell,
  makeMinorKind,
  makeMinorScaleHear,
  makeSymmetricChords,
  makeSymmetricHear,
  makeSymmetricSame,
  makeSymmetricShape,
} from './scales'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const KEYS_USED = ['A', 'E', 'D', 'B', 'G', 'C', 'F']
/** "F♯" → 6 */
const pcOf = (name: string) => tonePc(parseTone(name.replace('♯', '#').replace('♭', 'b')))
/** Each symmetric scale's notes, as pitch classes above its root, written out by hand. */
const SCALE_PCS: Record<string, number[]> = {
  'whole-tone': [0, 2, 4, 6, 8, 10],
  'whole-half diminished': [0, 2, 3, 5, 6, 8, 9, 11],
  'half-whole diminished': [0, 1, 3, 4, 6, 7, 9, 10],
}
const notesOf = (root: string, name: string) => SCALE_PCS[name].map((x) => (pcOf(root) + x) % 12).sort((a, b) => a - b)
const titles = (id: string) => buildRehearsal(id, seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))

describe('melodic minor', () => {
  it('raises natural minor’s 6th and 7th, with plain sharps and flats in every key the tapes use', () => {
    expect(spelled(melodicMinorScale('A'))).toBe('A B C D E F♯ G♯')
    expect(spelled(melodicMinorScale('C'))).toBe('C D E♭ F G A B')
    expect(spelled(melodicMinorScale('B'))).toBe('B C♯ D E F♯ G♯ A♯')
    for (const tonic of KEYS_USED) expect(spelled(melodicMinorScale(tonic))).not.toMatch(/E♯|B♯|C♭|F♭/)
  })

  it('asks for a raised note, with the note before it was raised among the near misses', () => {
    for (const rng of seeds) {
      const q = asPick(makeMelodicNote(1, KEYS_USED, rng))
      const [, nth, tonic] = /^What’s the (6th|7th) note of (\S+) melodic minor\?$/.exec(q.ask.text)!
      const d = nth === '6th' ? 5 : 6
      expect(chosen(q)).toBe(toneName(melodicMinorScale(tonic)[d]))
      expect(q.options).toContain(toneName(minorScaleOn(tonic)[d]))
      expect(q.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.facts).toEqual([`mmin:${tonic}`])
    }
  })

  it('spells it against the other minor scales and the major scale on the same root', () => {
    const q = asPick(makeMelodicSpell(1, ['D'], seeded(1)))
    expect(q.ask.text).toBe('Which notes make D melodic minor?')
    expect(chosen(q)).toBe('D E F G A B C♯')
    expect([...q.options].sort()).toEqual(['D E F G A B C♯', 'D E F G A B♭ C', 'D E F G A B♭ C♯', 'D E F♯ G A B C♯'].sort())
    expect(q.why).toBe('Start from D major: D E F♯ G A B C♯. Lower its 3rd, F♯ to F, and you have D melodic minor: D E F G A B C♯.')
    for (const rng of seeds) expect(new Set(asPick(makeMelodicSpell(1, KEYS_USED, rng)).options).size).toBe(4)
  })

  it('tells the three minor scales apart by their 6th and 7th', () => {
    const kinds = ['natural', 'harmonic', 'melodic'] as const
    const prompts = ['A B C D E F G: which minor scale?', 'A B C D E F G♯: which minor scale?', 'A B C D E F♯ G♯: which minor scale?']
    kinds.forEach((kind, i) => {
      const q = asPick(makeMinorKind(1, ['A'], seeded(1), kind))
      expect(q.ask.text).toBe(prompts[i])
      expect(q.options).toEqual(['Natural minor', 'Harmonic minor', 'Melodic minor'])
      expect(q.answer).toBe(i)
      expect(q.facts).toEqual([`mkind:${kind}`])
    })
    expect(asPick(makeMinorKind(1, ['A'], seeded(1), 'harmonic')).why).toBe('Only its 7th is raised, to G♯, and the 6th stays F: that’s harmonic minor.')
  })
})

describe('every melodic minor fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['mmin:A', 'mmin:F', 'mmsp:E', 'mkind:natural', 'mkind:harmonic', 'mkind:melodic']) {
      expect(tapeOf(fact), fact).toBe(70)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('mmin:E')).toBe('E melodic minor')
    expect(describeFact('mmsp:B')).toBe('Spelling B melodic minor')
    expect(describeFact('mkind:harmonic')).toBe('Spotting harmonic minor')
    for (const junk of ['mmin:F#', 'mmsp:H', 'mkind:dorian']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains harmonic minor’s gap before teaching the scale, and the way back down before the three minors', () => {
    expect(titles('sc1-1')).toEqual(['Smoothing the climb', 'Melodic minor', 'check', 'ready'])
    expect(titles('sc1-3')).toEqual(['Coming back down', 'Three minor scales', 'check', 'ready'])
  })
})

describe('symmetric scales', () => {
  it('offers exactly one scale with the same notes', () => {
    for (const rng of seeds) {
      const q = asPick(makeSymmetricSame(1, [], rng))
      const [, root, name] = /^(\S+) (.+) has the same notes as which \2 scale\?$/.exec(q.ask.text)!
      const options = q.options as string[]
      const sharing = options.filter((o) => notesOf(o.slice(0, -name.length - 1), name).join() === notesOf(root, name).join())
      expect(sharing).toEqual([chosen(q)])
      expect(options.every((o) => o.endsWith(` ${name}`))).toBe(true)
    }
  })

  it('reads a scale from its frets up one string', () => {
    for (const rng of seeds) {
      const q = asPick(makeSymmetricShape(1, [], rng))
      const frets = q.board!.markers.map((m) => m.pos.fret)
      const steps = frets.slice(1).map((f, i) => f - frets[i])
      expect(chosen(q)).toBe(steps.every((s) => s === 2) ? 'Whole-tone' : steps[0] === 2 ? 'Whole-half diminished' : 'Half-whole diminished')
      expect([frets[0], frets[frets.length - 1]]).toEqual([0, 12])
    }
  })

  it('finds the two chords that make each scale', () => {
    const chordPcs = (symbol: string) => {
      const aug = symbol.endsWith('+')
      return (aug ? [0, 4, 8] : [0, 3, 6, 9]).map((x) => (pcOf(symbol.replace(/\+|°7/, '')) + x) % 12)
    }
    for (const rng of seeds) {
      const q = asPick(makeSymmetricChords(1, [], rng))
      const [, root, name] = /^Which two chords make (\S+) (.+)\?$/.exec(q.ask.text)!
      const [a, b] = String(chosen(q)).split(' and ')
      expect([...new Set([...chordPcs(a), ...chordPcs(b)])].sort((x, y) => x - y)).toEqual(notesOf(root, name))
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['symsame:whole-tone', 'symsame:whole-half', 'symsame:half-whole', 'symneck:whole-tone', 'symchord:half-whole']) {
      expect(tapeOf(fact), fact).toBe(71)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('symsame:whole-half')).toBe('How whole-half diminished repeats')
    expect(describeFact('symneck:whole-tone')).toBe('Whole-tone on one string')
    expect(describeFact('symchord:half-whole')).toBe('Half-whole diminished’s two chords')
    for (const junk of ['symsame:chromatic', 'symneck:dorian', 'symchord:']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('writes the six- and eight-note scales so they read back right, a natural where A♭ is followed by A', () => {
    const read = (item: string) => {
      const score = theoryCard(item, '').score!
      return { notes: resolveNotes(score.measures).map((n) => `${n.letter}${n.acc === 1 ? '♯' : n.acc === -1 ? '♭' : ''}`).join(' '), beats: score.measures.map((m) => m.map((n) => n.dur).join(' ')) }
    }
    expect(read('scales:whole-tone')).toEqual({ notes: 'C D E F♯ G♯ A♯ C', beats: ['q q q q', 'q q h'] })
    expect(read('scales:diminished')).toEqual({ notes: 'C D E♭ F G♭ A♭ A B C', beats: ['q q q q', 'q q q q', 'w'] })
    expect(read('scales:half-whole').notes).toBe('C D♭ E♭ E F♯ G A B♭ C')
  })

  it('explains what makes a scale symmetric before the whole-tone scale', () => {
    expect(titles('sc2-1')).toEqual(['Scales with no home', 'The whole-tone scale', 'check', 'ready'])
  })
})

describe('hearing scales', () => {
  /** Each minor scale's 6th and 7th, in half steps above home, written out by hand. */
  const TOP: Record<string, number[]> = { 'Natural minor': [8, 10], 'Harmonic minor': [8, 11], 'Melodic minor': [9, 11] }

  it('plays the home chord, then the minor scale the answer names, up to the octave', () => {
    for (const rng of seeds) {
      for (const q of [makeMelodicHear(1, rng), makeHarmonicHear(1, rng), makeMinorScaleHear(1, rng)].map(asPick)) {
        const notes = q.listen!.notes
        expect(q.listen!.home).toEqual([notes[0], notes[0] + 3, notes[0] + 7])
        expect([notes[5] - notes[0], notes[6] - notes[0]]).toEqual(TOP[String(chosen(q))])
        expect(notes[notes.length - 1] - notes[0]).toBe(12)
      }
    }
    expect(asPick(makeMelodicHear(1, seeded(1))).ask.text).toBe('Melodic minor or natural minor?')
    expect(asPick(makeHarmonicHear(1, seeded(1))).options).toEqual(['Harmonic minor', 'Melodic minor'])
    expect(asPick(makeMinorScaleHear(1, seeded(1))).options).toEqual(['Natural minor', 'Harmonic minor', 'Melodic minor'])
  })

  it('tells whole-tone from diminished by its steps, with no home chord', () => {
    for (const rng of seeds) {
      const q = asPick(makeSymmetricHear(1, rng))
      const notes = q.listen!.notes
      const steps = new Set(notes.slice(1).map((n, i) => n - notes[i]))
      expect(chosen(q)).toBe(steps.size === 1 ? 'Whole-tone' : 'Diminished')
      expect(q.listen!.home).toBeUndefined()
    }
  })

  it('is a listening tape, and its facts come back in review', () => {
    expect(findLesson('sc4-1')!.unit.lessons.every(isListening)).toBe(true)
    for (const fact of ['ear:melodic-minor', 'ear:harmonic-minor', 'ear:minor-scales', 'ear:symmetric']) {
      expect(tapeOf(fact), fact).toBe(73)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('ear:symmetric')).toBe('Hearing whole-tone or diminished')
    expect(describeFact('ear:minor-scales')).toBe('Hearing the three minor scales')
    expect(theoryReview('ear:jazz-minor', 1, seeded(1))).toBeNull()
  })

  it('explains what to listen for before the first question', () => {
    expect(titles('sc4-1')).toEqual(['Hearing scales', 'Melodic or natural minor', 'check', 'ready'])
  })
})
