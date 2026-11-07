import { describe, expect, it } from 'vitest'
import { asPick, chosen, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import { CAGED_ORDER, movedShape, OPEN_CHORDS, shapeMidis, shiftFor } from '../music/chordShapes'
import { midiAt, pitchClass } from '../music/notes'
import { CHORD_NAMES, chordSymbol, chordTones, keySevenths, parseTone, toneName, tonePc, type ChordKind } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { describeFact, dueFacts, tapeOf } from './review'
import { theoryReview } from './theory'
import {
  makeCagedChord,
  makeCagedNext,
  makeCagedShape,
  makeChordKind,
  makeChordSpell,
  makeDiagramName,
  makeDiagramRole,
  makeSeventhHear,
  makeSeventhNumeral,
  makeSeventhOnDegree,
  makeSymbolRead,
  makeSymbolWrite,
  makeTwoFiveSpell,
} from './chords'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const spell = (root: string, kind: ChordKind) => chordTones(parseTone(root), kind)!.map(toneName).join(' ')
const pcOf = (name: string) => tonePc(parseTone(name.replace('♯', '#').replace('♭', 'b')))
const SEVENTHS: ChordKind[] = ['maj7', '7', 'm7', 'm7b5']
const COLORS: ChordKind[] = ['sus2', 'sus4', 'add9', '6', 'm6']

describe('building chords', () => {
  it('spells 7th, sus, add and 6 chords from their intervals', () => {
    expect(spell('C', 'maj7')).toBe('C E G B')
    expect(spell('G', '7')).toBe('G B D F')
    expect(spell('A', 'm7')).toBe('A C E G')
    expect(spell('B', 'm7b5')).toBe('B D F A')
    expect(spell('C', 'sus4')).toBe('C F G')
    expect(spell('C', 'sus2')).toBe('C D G')
    expect(spell('C', 'add9')).toBe('C E G D')
    expect(spell('C', '6')).toBe('C E G A')
    expect(spell('C', 'm6')).toBe('C E♭ G A')
    expect(chordSymbol(parseTone('F#'), 'm7b5')).toBe('F♯m7♭5')
  })

  it('stacks the same seven 7th chords in every major key', () => {
    expect(keySevenths('C').map((c) => chordSymbol(c.tones[0], c.kind))).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5'])
    expect(keySevenths('G').map((c) => chordSymbol(c.tones[0], c.kind))).toEqual(['Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7', 'Em7', 'F♯m7♭5'])
  })
})

describe('chord questions', () => {
  it('spells every kind of chord from its symbol, with real near misses and no rare spellings', () => {
    for (const kinds of [['maj', 'min', 'dim', 'aug'], SEVENTHS, COLORS] as ChordKind[][])
      for (const rng of seeds) {
        const q = asPick(makeChordSpell(1, [], kinds, rng))
        const symbol = q.ask.text.match(/^What notes make (\S+)\?$/)![1]
        const right = chosen(q) as string
        expect(right.split(' ')[0]).toBe(symbol.match(/^[A-G][♯♭]?/)![0])
        expect(q.options.length).toBeGreaterThanOrEqual(3)
        expect(new Set(q.options).size).toBe(q.options.length)
        for (const o of q.options) expect(o).not.toMatch(/E♯|B♯|C♭|F♭/)
      }
  })

  it('names a chord from its notes, offering the kinds it’s easily confused with', () => {
    for (const rng of seeds) {
      const q = asPick(makeChordKind(1, [], SEVENTHS, rng))
      const notes = q.ask.text.replace(': which chord?', '').split(' ')
      const kind = SEVENTHS.find((k) => spell(notes[0].replace('♯', '#').replace('♭', 'b'), k) === notes.join(' '))!
      expect(chosen(q)).toBe(chordSymbol(parseTone(notes[0].replace('♯', '#').replace('♭', 'b')), kind))
      expect(q.options).toHaveLength(4)
    }
    expect(asPick(makeChordKind(1, ['C'], ['sus4'], seeded(1))).options).toEqual(['C', 'Csus2', 'Csus4'])
  })

  it('reads and writes chord symbols', () => {
    const read = asPick(makeSymbolRead(1, ['B'], ['maj', 'min', 'dim', 'aug'], seeded(1), 'dim'))
    expect(read.ask.text).toBe('What does B° mean?')
    expect(chosen(read)).toBe('B diminished')
    const write = asPick(makeSymbolWrite(1, ['C'], ['maj', 'min', 'dim', 'aug'], seeded(1), 'aug'))
    expect(chosen(write)).toBe('C+')
    expect(write.options).toEqual(['C', 'Cm', 'C°', 'C+'])
  })

  it('finds the 7th chords in a key, by note and by numeral', () => {
    expect(chosen(asPick(makeSeventhOnDegree(1, ['G'], seeded(1), 4)))).toBe('D7')
    expect(chosen(asPick(makeSeventhNumeral(1, ['F'], seeded(1), 1)))).toBe('ii7')
    expect(asPick(makeSeventhNumeral(1, ['C'], seeded(1), 6)).options).toEqual(['vi7', 'viiø7', 'VIIø7', 'Imaj7'])
    expect(chosen(asPick(makeTwoFiveSpell(1, ['D'], seeded(1))))).toBe('Em7 – A7 – Dmaj7')
  })
})

describe('chord diagrams', () => {
  it('has every open chord play exactly its chord’s notes', () => {
    for (const [name, c] of Object.entries(OPEN_CHORDS)) {
      const pcs = new Set(shapeMidis(c.shape).flatMap((m) => (m === null ? [] : [pitchClass(m)])))
      expect(pcs, name).toEqual(new Set(chordTones(c.root, c.kind)!.map(tonePc)))
    }
  })

  it('names an open chord from its diagram, and says what a ringed dot is', () => {
    for (const rng of seeds) {
      const q = asPick(makeDiagramName(1, Object.keys(OPEN_CHORDS), rng))
      expect(q.diagram!.shape).toEqual(OPEN_CHORDS[chosen(q) as string].shape)
      const role = asPick(makeDiagramRole(1, Object.keys(OPEN_CHORDS), rng))
      const name = role.ask.text.match(/this (\S+) chord/)![1]
      const string = role.diagram!.mark!
      const c = OPEN_CHORDS[name]
      const tones = chordTones(c.root, c.kind)!.map(tonePc)
      expect(role.answer).toBe(tones.indexOf(pitchClass(midiAt({ string, fret: c.shape.frets[string] }))))
    }
  })
})

describe('CAGED', () => {
  it('puts C major’s five shapes where the cards say: open, then frets 3, 5, 8 and 10', () => {
    expect(CAGED_ORDER.map((s) => shiftFor(s, parseTone('C')))).toEqual([0, 3, 5, 8, 10])
    for (const s of CAGED_ORDER) {
      const pcs = new Set(shapeMidis(movedShape(s, shiftFor(s, parseTone('C')))).flatMap((m) => (m === null ? [] : [pitchClass(m)])))
      expect(pcs).toEqual(new Set(['C', 'E', 'G'].map(pcOf)))
    }
  })

  it('names the shape and the chord of a shape up the neck', () => {
    for (const rng of seeds) {
      const shape = asPick(makeCagedShape(1, CAGED_ORDER, rng))
      const letter = (chosen(shape) as string)[0]
      const open = OPEN_CHORDS[letter].shape.frets
      const frets = shape.diagram!.shape.frets
      const shift = frets.find((f, i) => f >= 0 && open[i] >= 0)! - open[frets.findIndex((f, i) => f >= 0 && open[i] >= 0)]
      expect(frets).toEqual(open.map((f) => (f < 0 ? f : f + shift)))
      const named = asPick(makeCagedChord(1, CAGED_ORDER, rng))
      const pcs = new Set(shapeMidis(named.diagram!.shape).flatMap((m) => (m === null ? [] : [pitchClass(m)])))
      expect(pcs).toEqual(new Set(chordTones(parseTone((chosen(named) as string).replace('♭', 'b')), 'maj')!.map(tonePc)))
    }
    expect(chosen(asPick(makeCagedNext(1, seeded(1), 'G')))).toBe('E shape')
    expect(chosen(asPick(makeCagedNext(1, seeded(1), 'D')))).toBe('C shape')
  })
})

describe('hearing 7th chords', () => {
  it('plays the kind it asks about', () => {
    for (const rng of seeds) {
      const q = asPick(makeSeventhHear(1, SEVENTHS, ['up', 'together'], rng))
      const [root, ...rest] = q.listen!.notes
      const kind = ({ '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5' } as Record<string, ChordKind>)[rest.map((n) => n - root).join(',')]
      expect((chosen(q) as string).toLowerCase()).toBe(CHORD_NAMES[kind])
    }
  })

  it('is a listening tape, and its review waits while listening is off', () => {
    expect(findLesson('cb7-1')!.unit.lessons.every(isListening)).toBe(true)
    const due = { seen: 3, correct: 3, recent: 0.9, ms: 2000, interval: 2, due: '2026-01-01' }
    expect(dueFacts({ 'ear:7': due, 'chd:G7': due }, '2026-01-05', false)).toEqual(['chd:G7'])
  })
})

describe('every building-chords fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    const tapes: Record<string, number> = {
      'csym:dim': 45,
      'chd:Cmaj7': 46,
      'chd:G7': 46,
      'chd:Bm7b5': 46,
      'chq:m7': 46,
      'h7:5': 47,
      'h7:two-five': 47,
      'chd:Dsus4': 48,
      'chd:Cadd9': 48,
      'chd:Am6': 48,
      'diag:Am': 49,
      'diag:G': 49,
      'caged:A': 50,
      'caged:order': 50,
      'ear:7': 51,
      'ear:m7b5': 51,
    }
    for (const [fact, tape] of Object.entries(tapes)) {
      expect(tapeOf(fact), fact).toBe(tape)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
      expect(describeFact(fact), fact).not.toMatch(/undefined|NaN|chd:|h7:/)
    }
    expect(describeFact('chd:G7')).toBe('G7 (dominant 7th)')
    expect(describeFact('caged:order')).toBe('The CAGED order')
    for (const junk of ['chd:H7', 'chd:C9', 'chq:sus3', 'h7:8', 'diag:Bb', 'diag:constructor', 'caged:B', 'ear:9']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains chord symbols before quizzing them', () => {
    const steps = buildRehearsal('cb1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Why chord symbols', 'Letters and m', 'check', 'ready'])
  })
})
