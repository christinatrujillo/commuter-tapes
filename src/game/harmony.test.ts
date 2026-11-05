import { describe, expect, it } from 'vitest'
import { asPick, asTap, chosen, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import { midiAt, pitchClass } from '../music/notes'
import { KEY_ORDER, KEYS } from '../music/score'
import { keyTriads, majorScale, NUMERALS, parseTone, toneName, tonePc, TRIAD_NAMES } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { describeFact, dueFacts, tapeOf } from './review'
import { theoryReview } from './theory'
import {
  makeBoxFind,
  makeCadenceHear,
  makeChordOnDegree,
  makeChordToNumeral,
  makeDegreeQuality,
  makeFourFiveHear,
  makeNumeralRead,
  makeNumeralToChord,
  makePrimaryChord,
  makeProgressionHear,
  makeProgressionName,
  makeProgressionSpell,
} from './harmony'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const KEYS_USED = findLesson('hk1-4')!.lesson.keys!
const name = (key: Parameters<typeof keyTriads>[0], d: number) => `${toneName(keyTriads(key)[d].tones[0])} ${TRIAD_NAMES[keyTriads(key)[d].quality]}`
const pc = (n: string) => tonePc(parseTone(n.replace('♯', '#').replace('♭', 'b')))

describe('the chords in a key', () => {
  it('stacks a triad on every note of the scale, in the same pattern in every key', () => {
    expect(keyTriads('C').map((c) => c.tones.map(toneName).join(' '))).toEqual(['C E G', 'D F A', 'E G B', 'F A C', 'G B D', 'A C E', 'B D F'])
    for (const key of KEY_ORDER) {
      for (const [d, chord] of keyTriads(key).entries()) {
        // Every note comes from the key's scale, and the half steps match the pattern.
        for (const t of chord.tones) expect(majorScale(key).map(toneName)).toContain(toneName(t))
        const [r, third, fifth] = chord.tones.map(tonePc)
        const gaps = `${(third - r + 12) % 12},${(fifth - r + 12) % 12}`
        expect(gaps, `${key} ${d + 1}`).toBe({ maj: '4,7', min: '3,7', dim: '3,6', aug: '4,8' }[chord.quality])
      }
    }
    expect(name('G', 5)).toBe('E minor')
  })

  it('asks for the chord on a note of a key, with four real choices', () => {
    for (const rng of seeds) {
      const q = asPick(makeChordOnDegree(1, KEYS_USED, rng))
      const [, n, key] = q.ask.text.match(/the (\d)\w+ note of (\S+) major\?$/)!
      const id = KEY_ORDER.find((k) => KEYS[k].name === `${key} major`)!
      expect(chosen(q)).toBe(name(id, Number(n) - 1))
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('shows the scale to count along until the help is taken away', () => {
    expect(asPick(makeChordOnDegree(1, ['C'], seeded(1), true)).score!.measures.flat()).toHaveLength(8)
    const plain = asPick(makeChordOnDegree(1, ['G'], seeded(1)))
    expect(plain.score!.measures).toEqual([[]])
    expect(plain.score!.keySig).toBe('G')
    expect(plain.score!.afterMeasures![0][0].with).toHaveLength(2)
  })

  it('knows the kind of chord on every note', () => {
    const kinds = Array.from({ length: 7 }, (_, d) => chosen(asPick(makeDegreeQuality(1, seeded(1), d))))
    expect(kinds).toEqual(['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished'])
  })
})

describe('Roman numerals', () => {
  it('turns numerals into chords and back', () => {
    for (const rng of seeds) {
      const q = asPick(makeNumeralToChord(1, ['C', 'G', 'D', 'F'], rng))
      const [, key, numeral] = q.ask.text.match(/^In (\S+) major, what’s the (\S+) chord\?$/)!
      const id = KEY_ORDER.find((k) => KEYS[k].name === `${key} major`)!
      expect(chosen(q)).toBe(name(id, NUMERALS.indexOf(numeral)))
      const back = asPick(makeChordToNumeral(1, ['C', 'G', 'D', 'F'], rng))
      const [, key2, root, kind] = back.ask.text.match(/^In (\S+) major, which numeral is (\S+) (\w+)\?$/)!
      const d = majorScale(KEY_ORDER.find((k) => KEYS[k].name === `${key2} major`)!).map(toneName).indexOf(root)
      expect(chosen(back)).toBe(kind === 'major' ? NUMERALS[d] : kind === 'minor' ? NUMERALS[d].toLowerCase() : `${NUMERALS[d].replace('°', '')}°`)
    }
    expect(chosen(asPick(makeChordToNumeral(1, ['C'], seeded(1), 5)))).toBe('vi')
  })

  it('offers neighbors and the right numeral in the wrong case, in scale order', () => {
    expect(asPick(makeChordToNumeral(1, ['C'], seeded(1), 5)).options).toEqual(['V', 'vi', 'VI', 'vii°'])
    expect(asPick(makeChordToNumeral(1, ['C'], seeded(1), 6)).options).toEqual(['I', 'vi', 'vii°', 'VII'])
  })

  it('reads a chord on the staff with the key signature and names its numeral', () => {
    for (const rng of seeds) {
      const q = asPick(makeNumeralRead(1, ['C', 'G', 'D', 'F', 'Bb'], rng))
      const key = q.score!.keySig!
      const [[chord]] = q.score!.measures
      const root = toneName({ letter: chord.letter, acc: chord.sign ?? KEYS[key].altered[chord.letter] ?? 0 })
      const d = majorScale(key).map(toneName).indexOf(root)
      expect(chosen(q)).toBe(NUMERALS[d])
    }
  })
})

describe('I, IV and V', () => {
  it('names the main chords by numeral and by what they do', () => {
    expect(asPick(makePrimaryChord(1, ['G'], true, seeded(1), 4)).ask.text).toBe('In G major, which chord pulls back home to I?')
    expect(chosen(asPick(makePrimaryChord(1, ['G'], true, seeded(1), 4)))).toBe('D major')
    expect(chosen(asPick(makePrimaryChord(1, ['A'], false, seeded(1), 3)))).toBe('D major')
    for (const rng of seeds) expect(new Set(asPick(makePrimaryChord(1, KEYS_USED, rng() < 0.5, rng)).options).size).toBe(4)
  })

  it('finds IV on the next string at the same fret, and V two frets further', () => {
    for (const rng of seeds) {
      const q = asTap(makeBoxFind(1, rng))
      const root = q.markers[0].pos
      const four = q.ask.text.includes(' IV ')
      expect(q.targets).toEqual([{ string: root.string + 1, fret: root.fret + (four ? 0 : 2) }])
      expect(pitchClass(midiAt(q.targets[0]) - midiAt(root))).toBe(four ? 5 : 7)
    }
  })
})

describe('progressions', () => {
  it('spells a progression’s roots in a key, and names one from its chords', () => {
    expect(chosen(asPick(makeProgressionSpell(1, ['G'], ['I-V-vi-IV'], seeded(1))))).toBe('G D E C')
    expect(chosen(asPick(makeProgressionSpell(1, ['C'], ['ii-V-I'], seeded(1))))).toBe('D G C')
    const named = asPick(makeProgressionName(1, ['C'], ['I-vi-IV-V'], seeded(1)))
    expect(named.ask.text).toBe('In C major, which progression is C major, A minor, F major, G major?')
    expect(chosen(named)).toBe('I–vi–IV–V')
    expect(named.options).toEqual(['I–IV–V–I', 'I–V–vi–IV', 'I–vi–IV–V', 'ii–V–I'])
    for (const rng of seeds) expect(new Set(asPick(makeProgressionSpell(1, KEYS_USED, ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V', 'ii-V-I'], rng)).options).size).toBe(4)
  })
})

describe('hearing progressions', () => {
  const chordsHeard = (notes: number[]) => Array.from({ length: notes.length / 3 }, (_, i) => notes[i * 3])

  it('plays chords one after another, ending at home or away', () => {
    for (const rng of seeds) {
      const q = asPick(makeCadenceHear(1, rng))
      expect(q.listen!.chord).toBe(3)
      const roots = chordsHeard(q.listen!.notes)
      expect(chosen(q)).toBe(roots[roots.length - 1] === roots[0] ? 'Home' : 'Away')
    }
  })

  it('plays I and then IV or V', () => {
    for (const rng of seeds) {
      const q = asPick(makeFourFiveHear(1, rng))
      const [i, next] = chordsHeard(q.listen!.notes)
      expect(chosen(q)).toBe(next - i === 5 ? 'IV' : 'V')
    }
  })

  it('offers the progressions the track teaches', () => {
    const q = asPick(makeProgressionHear(1, ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V'], seeded(4)))
    expect(q.options).toEqual(['I–IV–V–I', 'I–V–vi–IV', 'I–vi–IV–V'])
    expect(q.listen!.notes).toHaveLength(12)
  })

  it('is a listening tape, and its review waits while listening is off', () => {
    expect(findLesson('hk5-1')!.unit.lessons.every(isListening)).toBe(true)
    expect(findLesson('hk4-1')!.unit.lessons.some(isListening)).toBe(false)
    const due = { seen: 3, correct: 3, recent: 0.9, ms: 2000, interval: 2, due: '2026-01-01' }
    expect(dueFacts({ 'ear:home': due, 'hd:6': due }, '2026-01-05', false)).toEqual(['hd:6'])
  })
})

describe('every chords-in-a-key fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    const tapes: Record<string, number> = {
      'hd:6': 40,
      'hrn:2': 41,
      'hprim:V': 42,
      'hbox:IV': 42,
      'hprog:I-IV-V-I': 43,
      'hprog:I-V-vi-IV': 43,
      'hprog:ii-V-I': 43,
      'ear:home': 44,
      'ear:four-five': 44,
      'ear:prog': 44,
    }
    for (const [fact, tape] of Object.entries(tapes)) {
      expect(tapeOf(fact), fact).toBe(tape)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
      expect(describeFact(fact), fact).not.toMatch(/undefined|NaN|hd:|hrn:/)
    }
    expect(describeFact('hprim:V')).toBe('The V chord, the dominant')
    expect(describeFact('hprog:ii-V-I')).toBe('The ii–V–I progression')
    for (const junk of ['hd:8', 'hd:0', 'hrn:x', 'hprim:ii', 'hbox:I', 'hprog:I-II', 'ear:constructor', 'ear:away']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('teaches why before the first chords, and checks each idea after its card', () => {
    const steps = buildRehearsal('hk1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Why chords in a key', 'Stacking on every note', 'check', 'ready'])
  })

  it('names the root of each chord the neck card shows', () => {
    // G at the 3rd fret of the 6th string, C at the 3rd fret of the 5th, D at the 5th: I, IV and V of G major.
    expect([{ string: 0, fret: 3 }, { string: 1, fret: 3 }, { string: 1, fret: 5 }].map((p) => pitchClass(midiAt(p)))).toEqual(['G', 'C', 'D'].map(pc))
  })
})
