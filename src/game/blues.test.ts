import { describe, expect, it } from 'vitest'
import { asPick, asTap, chosen, inRegion, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import { midiAt, pitchClass, type Position } from '../music/notes'
import { RARE_SPELLINGS, scaleScore, toneName, type Tone } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { describeFact, dueFacts, tapeOf } from './review'
import { theoryReview } from './theory'
import {
  bluesScale,
  majorPentatonic,
  makeBlueNote,
  makeBluesHear,
  makeBluesSpell,
  makeBoxDegree,
  makeBoxKey,
  makeBoxRoot,
  makeMajorPentMissing,
  makeMajorPentSpell,
  makePatternCaged,
  makePatternMissing,
  makePatternRoot,
  makePentDegree,
  makePentHear,
  makePentMissing,
  makePentRelative,
  makePentSpell,
  makeMinorBlues,
  makeQuickHear,
  makeTwelveChord,
  makeTwelveNumeral,
  makeTwelveSpell,
  makeTwelveVariation,
  minorPentatonic,
  pentPattern,
} from './blues'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const TONICS = ['A', 'E', 'D', 'G', 'C', 'B']
const names = (tones: Tone[]) => tones.map(toneName).join(' ')
/** Frets per string, low E first: "5/8 5/7 …". */
const shape = (notes: Position[]) => [0, 1, 2, 3, 4, 5].map((s) => notes.filter((p) => p.string === s).map((p) => p.fret).join('/')).join(' ')

describe('pentatonic and blues scales', () => {
  it('spells the minor and major pentatonic and the blues scale', () => {
    expect(names(minorPentatonic('A'))).toBe('A C D E G')
    expect(names(minorPentatonic('G'))).toBe('G B♭ C D F')
    expect(names(majorPentatonic('C'))).toBe('C D E G A')
    expect(names(majorPentatonic('E'))).toBe('E F♯ G♯ B C♯')
    expect(names(bluesScale('A'))).toBe('A C D E♭ E G')
    expect(names(bluesScale('B'))).toBe('B D E F F♯ A')
    for (const t of TONICS) for (const n of bluesScale(t)) expect(RARE_SPELLINGS.has(toneName(n)), `${t} blues`).toBe(false)
  })

  it('writes a short scale with its top note an octave up', () => {
    const notes = scaleScore(minorPentatonic('A')).flat()
    expect(notes.map((n) => `${n.letter}${n.octave}`)).toEqual(['A4', 'C5', 'D5', 'E5', 'G5', 'A5'])
  })
})

describe('the five patterns', () => {
  it('draws the box and its neighbors, two notes on every string', () => {
    expect(shape(pentPattern('A', 1)!)).toBe('5/8 5/7 5/7 5/7 5/8 5/8')
    expect(shape(pentPattern('A', 2)!)).toBe('8/10 7/10 7/10 7/9 8/10 8/10')
    expect(shape(pentPattern('A', 5)!)).toBe('3/5 3/5 2/5 2/5 3/5 3/5')
    // Patterns 3 and 4 of A sit past the 12th fret, so the tapes use other keys for them.
    expect(pentPattern('A', 3)).toBeNull()
  })

  it('joins each pattern to the next, using only the scale’s notes', () => {
    const one = pentPattern('A', 1)!
    const two = pentPattern('A', 2)!
    for (let s = 0; s < 6; s++) expect(two.filter((p) => p.string === s)[0].fret).toBe(one.filter((p) => p.string === s)[1].fret)
    const aMinor = [9, 0, 2, 4, 7]
    for (const n of [1, 2, 5]) expect(pentPattern('A', n)!.every((p) => aMinor.includes(pitchClass(midiAt(p))))).toBe(true)
    for (const t of ['G', 'D', 'E']) expect(pentPattern(t, 3)!.every((p) => p.fret >= 1 && p.fret <= 12)).toBe(true)
  })

  it('finds the relative major’s CAGED shape inside each pattern: G, E, D, C, A', () => {
    const want = ['', 'G shape', 'E shape', 'D shape', 'C shape', 'A shape']
    for (const rng of seeds) {
      const q = asPick(makePatternCaged(1, [1, 2, 3, 4, 5], rng))
      const n = Number(q.ask.text.match(/Pattern (\d)/)![1])
      expect(chosen(q), q.ask.text).toBe(want[n])
      expect(q.board!.markers.filter((m) => m.tone === 'correct').length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('scale questions', () => {
  it('asks which note the pentatonic leaves out, and spells it', () => {
    for (const rng of seeds) {
      const q = asPick(makePentMissing(1, TONICS, rng))
      const tonic = q.ask.text.match(/^Which note of (\S+) minor/)![1]
      expect(minorPentatonic(tonic).map(toneName)).not.toContain(chosen(q))
      expect(new Set(q.options).size).toBe(4)
    }
    expect(chosen(asPick(makePentSpell(1, [], seeded(1), 'E')))).toBe('E G A B D')
    expect(chosen(asPick(makeMajorPentSpell(1, [], seeded(1), 'F')))).toBe('F G A C D')
    expect(['B♭', 'E']).toContain(chosen(asPick(makeMajorPentMissing(1, [], seeded(2), false, 'F'))))
    expect(Array.from({ length: 4 }, (_, i) => chosen(asPick(makePentDegree(1, ['A'], seeded(1), [3, 4, 5, 7][i]))))).toEqual(['3', '4', '5', '7'])
  })

  it('links each major pentatonic to the minor pentatonic on its 6th note', () => {
    for (const rng of seeds) {
      const q = asPick(makePentRelative(1, ['C', 'G', 'D', 'A', 'E', 'F'], rng))
      const pairs: Record<string, string> = { C: 'A', G: 'E', D: 'B', A: 'F♯', E: 'C♯', F: 'D' }
      const [, from, kind] = q.ask.text.match(/^(\S+) (major|minor) pentatonic/)!
      const right = kind === 'major' ? `${pairs[from]} minor pentatonic` : `${Object.keys(pairs).find((k) => pairs[k] === from)} major pentatonic`
      expect(chosen(q)).toBe(right)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('finds the blue note, the lowered 5th, and spells the blues scale', () => {
    expect(chosen(asPick(makeBlueNote(1, [], seeded(1), 'A')))).toBe('E♭')
    expect(chosen(asPick(makeBlueNote(1, [], seeded(1), 'B')))).toBe('F')
    expect(chosen(asPick(makeBluesSpell(1, [], seeded(1), 'E')))).toBe('E G A B♭ B D')
    for (const rng of seeds) expect(new Set(asPick(makeBluesSpell(1, TONICS, rng)).options).size).toBe(4)
  })
})

describe('neck questions', () => {
  it('marks a note in the box, and finds its roots on both E strings and the D string', () => {
    for (const rng of seeds) {
      const d = asPick(makeBoxDegree(1, rng))
      const root = d.board!.markers.find((m) => m.tone === 'root')!.pos
      const target = d.board!.markers.find((m) => m.tone === 'target')!.pos
      const semis = pitchClass(midiAt(target) - midiAt(root))
      expect(chosen(d)).toBe(String({ 3: 3, 5: 4, 7: 5, 10: 7 }[semis]))
      const r = asTap(makeBoxRoot(1, rng))
      expect(r.targets.map((p) => p.string)).toEqual([0, 2, 5])
      const [low, mid, high] = r.targets
      expect([mid.fret - low.fret, high.fret - low.fret]).toEqual([2, 0])
      expect(r.targets.every((p) => inRegion(p, r.region))).toBe(true)
    }
  })

  it('names the box’s key from its root on the low E string', () => {
    for (const rng of seeds) {
      const q = asPick(makeBoxKey(1, rng))
      const low = q.board!.markers.find((m) => m.tone === 'root' && m.pos.string === 0)!.pos
      const name = { 1: 'F', 3: 'G', 5: 'A', 7: 'B', 8: 'C' }[low.fret]
      expect(chosen(q)).toBe(`${name} minor pentatonic`)
    }
  })

  it('hides one note of a pattern, and asks for its roots', () => {
    for (const rng of seeds) {
      const q = asTap(makePatternMissing(1, [1, 2, 3, 4, 5], rng))
      expect(q.targets).toHaveLength(1)
      const hidden = q.targets[0]
      expect(q.markers.some((m) => m.pos.string === hidden.string && m.pos.fret === hidden.fret)).toBe(false)
      expect(q.markers.filter((m) => m.pos.string === hidden.string)).toHaveLength(1)
      expect(q.markers).toHaveLength(11)
      const r = asTap(makePatternRoot(1, [1, 2, 3, 4, 5], rng))
      const tonic = r.ask.text.match(/of (\S+) minor/)![1]
      expect(r.label).toBe(tonic)
      expect(r.targets.length).toBeGreaterThanOrEqual(2)
      expect(new Set(r.targets.map((p) => pitchClass(midiAt(p)))).size).toBe(1)
    }
  })
})

describe('hearing the blues', () => {
  it('plays a scale or four bars and asks what it was', () => {
    for (const rng of seeds) {
      const p = asPick(makePentHear(1, rng))
      expect(chosen(p)).toBe(p.listen!.notes[1] - p.listen!.notes[0] === 2 ? 'Major pentatonic' : 'Minor pentatonic')
      const b = asPick(makeBluesHear(1, rng))
      expect(chosen(b)).toBe(b.listen!.notes.length === 7 ? 'Blues scale' : 'Minor pentatonic')
      const q = asPick(makeQuickHear(1, rng))
      expect(q.listen!.chord).toBe(4)
      expect(chosen(q)).toBe(q.listen!.notes[4] !== q.listen!.notes[0] ? 'Quick change' : 'Stays on I')
    }
  })

  it('is a listening tape, and its review waits while listening is off', () => {
    expect(findLesson('bp6-1')!.unit.lessons.every(isListening)).toBe(true)
    const due = { seen: 3, correct: 3, recent: 0.9, ms: 2000, interval: 2, due: '2026-01-01' }
    expect(dueFacts({ 'ear:quick': due, 'pmin:A': due }, '2026-01-05', false)).toEqual(['pmin:A'])
  })
})

describe('the 12-bar blues', () => {
  const FORM = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I']
  const barOf = (text: string) => Number(text.match(/bar (\d+)\?$/)![1]) - 1

  it('reads in three lines of four: I I I I, IV IV I I, V IV I I', () => {
    for (let bar = 0; bar < 12; bar++) {
      const q = asPick(makeTwelveNumeral(1, seeded(1), bar))
      expect(chosen(q)).toBe(FORM[bar])
      expect(q.chart!.mark).toBe(bar)
      expect(q.chart!.bars.filter((b) => b === null)).toHaveLength(1)
      expect(q.chart!.after!.bars).toEqual(FORM)
    }
  })

  it('plays every chord as a dominant 7th in a key, worked out from the numerals', () => {
    const chords: Record<string, Record<string, string>> = { A: { I: 'A7', IV: 'D7', V: 'E7' }, E: { I: 'E7', IV: 'A7', V: 'B7' }, G: { I: 'G7', IV: 'C7', V: 'D7' } }
    for (const rng of seeds) {
      const q = asPick(makeTwelveChord(1, ['A', 'E', 'G'], rng))
      const key = q.ask.text.match(/in (\S+), what/)![1]
      expect(chosen(q)).toBe(chords[key][FORM[barOf(q.ask.text)]])
      // Before answering, the other bars show numerals, not the key's chords.
      expect(q.chart!.bars.every((b) => b === null || /^(I|IV|V)7$/.test(b))).toBe(true)
      expect(q.chart!.after!.bars).toEqual(FORM.map((n) => chords[key][n]))
    }
    expect(chosen(asPick(makeTwelveSpell(1, [], seeded(1), 'G')))).toBe('G7 C7 D7')
    expect(chosen(asPick(makeTwelveSpell(1, [], seeded(1), 'C')))).toBe('C7 F7 G7')
  })

  it('puts IV in bar 2 for a quick change, and V in bar 12 for a turnaround', () => {
    const quick = asPick(makeTwelveVariation(1, ['E'], seeded(1), 'quick'))
    expect(quick.ask.text).toBe('This 12-bar blues in E has a quick change. What chord is in bar 2?')
    expect(chosen(quick)).toBe('A7')
    expect(quick.chart!.after!.numerals!.slice(0, 4)).toEqual(['I7', 'IV7', 'I7', 'I7'])
    const turn = asPick(makeTwelveVariation(1, ['E'], seeded(1), 'turn'))
    expect(chosen(turn)).toBe('B7')
    expect(turn.chart!.mark).toBe(11)
  })

  it('uses minor 7th chords for a minor blues', () => {
    const chords: Record<string, Record<string, string>> = { A: { I: 'Am7', IV: 'Dm7', V: 'Em7' }, E: { I: 'Em7', IV: 'Am7', V: 'Bm7' }, D: { I: 'Dm7', IV: 'Gm7', V: 'Am7' } }
    for (const rng of seeds) {
      const q = asPick(makeMinorBlues(1, ['A', 'E', 'D'], rng))
      const key = q.ask.text.match(/in (\S+) minor/)![1]
      expect(chosen(q)).toBe(chords[key][FORM[barOf(q.ask.text)]])
      expect(new Set(q.options).size).toBe(4)
    }
  })
})

describe('every blues and pentatonic fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    const tapes: Record<string, number> = {
      'pmin:A': 57,
      'pdeg:7': 57,
      'pmaj:F': 58,
      'prel:G': 58,
      'pblues:B': 59,
      'pbox:degree': 60,
      'pbox:root': 60,
      'pbox:key': 60,
      'ppat:2': 60,
      'ppat:4': 60,
      'ppat:caged': 60,
      'ear:pent': 62,
      'ear:blues': 62,
      'b12:9': 61,
      'b12key:E': 61,
      'b12var:quick': 61,
      'b12var:turn': 61,
      'bminor:D': 61,
      'ear:quick': 62,
    }
    for (const [fact, tape] of Object.entries(tapes)) {
      expect(tapeOf(fact), fact).toBe(tape)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
      expect(describeFact(fact), fact).not.toMatch(/undefined|NaN|pmin:|ppat:/)
    }
    expect(describeFact('ppat:4')).toBe('Pentatonic Pattern 4')
    expect(describeFact('pblues:B')).toBe('The B blues scale')
    for (const junk of ['pmin:F', 'pdeg:2', 'pmaj:B', 'prel:Bb', 'pblues:X', 'pbox:shape', 'ppat:6', 'ppat:0', 'b12:0', 'b12:13', 'b12key:F', 'b12var:slow', 'bminor:G', 'ear:pentatonic']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains why pentatonics matter before the first question', () => {
    const steps = buildRehearsal('bp1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Why pentatonics', 'The minor pentatonic', 'check', 'ready'])
  })
})
