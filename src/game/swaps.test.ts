import { describe, expect, it } from 'vitest'
import { asPick, chosen, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import type { KeyId } from '../music/score'
import { chordSymbol, keyTriads, majorScale, NUMERALS, parseTone, tonePc } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { describeFact, tapeOf } from './review'
import { theoryReview } from './theory'
import {
  makeBorrowedChord,
  makeBorrowedNumeral,
  makeBorrowedSpot,
  makeChordFamily,
  makeChordShared,
  makeChordSwap,
  makeDeceptiveHear,
  makeMinorFourHear,
  makeSecondaryChord,
  makeSecondaryHear,
  makeSecondaryNote,
  makeSecondarySpot,
  makeSecondaryTarget,
  makeTritoneHear,
  makeTritoneProgression,
  makeTritoneShared,
  makeTritoneSub,
} from './swaps'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const KEYS: KeyId[] = ['C', 'G', 'D', 'F', 'A', 'E', 'Bb']
/** Each scale note's family, written out by hand. */
const FAMILY = ['Tonic (home)', 'Subdominant (away)', 'Tonic (home)', 'Subdominant (away)', 'Dominant (tension)', 'Tonic (home)', 'Dominant (tension)']
const pcOf = (name: string) => tonePc(parseTone(name.replace('♯', '#').replace('♭', 'b')))
/** A triad's notes from its symbol, by hand: major, minor or diminished. */
const chordPcs = (symbol: string) => {
  const [, root, suffix] = /^([A-G][♯♭]?)(.*)$/.exec(symbol)!
  return ({ '': [0, 4, 7], m: [0, 3, 7], '°': [0, 3, 6] } as Record<string, number[]>)[suffix].map((x) => (pcOf(root) + x) % 12)
}
const keyOf = (label: string) => KEYS.find((k) => k.replace('b', '♭') === label)!
/** The scale note (from 0) a chord sits on in a key. */
const degreeIn = (key: KeyId, symbol: string) => keyTriads(key).findIndex((c) => chordSymbol(c.tones[0], c.quality) === symbol)

describe('chord families', () => {
  it('puts each chord of a key in its family', () => {
    for (const rng of seeds) {
      const q = asPick(makeChordFamily(1, KEYS, rng))
      const [, key, symbol] = /^In (\S+) major, which family is (\S+) in\?$/.exec(q.ask.text)!
      expect(chosen(q)).toBe(FAMILY[degreeIn(keyOf(key), symbol)])
      expect(q.options).toEqual(['Tonic (home)', 'Subdominant (away)', 'Dominant (tension)'])
    }
  })

  it('finds the two notes a chord and its stand-in share, and offers no other pair they share', () => {
    for (const rng of seeds) {
      const q = asPick(makeChordShared(1, KEYS, rng))
      const [, a, b] = /^Which two notes do (\S+) and (\S+) share\?$/.exec(q.ask.text)!
      const inBoth = (pair: string) => pair.split(' and ').every((n) => chordPcs(a).includes(pcOf(n)) && chordPcs(b).includes(pcOf(n)))
      expect((q.options as string[]).filter(inBoth)).toEqual([chosen(q)])
    }
    const q = asPick(makeChordShared(1, ['C'], seeded(2), 2))
    expect(['Which two notes do F and Dm share?', 'Which two notes do Dm and F share?']).toContain(q.ask.text)
    expect(['F and A', 'A and F']).toContain(chosen(q))
  })

  it('offers one stand-in from the chord’s own family, and no other chord that shares two notes', () => {
    for (const rng of seeds) {
      const q = asPick(makeChordSwap(1, KEYS, rng))
      const [, label, symbol] = /^In (\S+) major, which chord can stand in for (\S+)\?$/.exec(q.ask.text)!
      const key = keyOf(label)
      const sharesTwo = (o: string) => chordPcs(o).filter((pc) => chordPcs(symbol).includes(pc)).length === 2
      expect((q.options as string[]).filter(sharesTwo)).toEqual([chosen(q)])
      expect(FAMILY[degreeIn(key, String(chosen(q)))]).toBe(FAMILY[degreeIn(key, symbol)])
    }
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['cfam:6', 'cfam:7', 'cshare:IV-ii', 'cshare:V-vii°', 'cswap:1', 'cswap:5']) {
      expect(tapeOf(fact), fact).toBe(74)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('cfam:6')).toBe(`The ${NUMERALS[5]} chord’s family`)
    expect(describeFact('cshare:IV-ii')).toBe('What IV and ii share')
    expect(describeFact('cswap:5')).toBe('A stand-in for V')
    for (const junk of ['cfam:8', 'cshare:I-IV', 'cswap:3']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains why chords get swapped before the three families', () => {
    const steps = buildRehearsal('cs1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Swapping chords', 'Three chord families', 'check', 'ready'])
  })
})

describe('secondary dominants', () => {
  /** A dominant 7th's notes from its symbol, by hand. */
  const seventhPcs = (symbol: string) => [0, 4, 7, 10].map((x) => (pcOf(/^([A-G][♯♭]?)7$/.exec(symbol)![1]) + x) % 12)
  const notesOf = (symbol: string) => (symbol.endsWith('7') ? seventhPcs(symbol) : chordPcs(symbol))
  const inKey = (key: KeyId) => majorScale(key).map(tonePc)
  const NUMS = ['I', 'ii', 'iii', 'IV', 'V', 'vi']

  it('builds V7/x as a dominant 7th a 5th above x’s root', () => {
    for (const rng of seeds) {
      const q = asPick(makeSecondaryChord(1, ['C', 'G', 'F', 'Bb', 'D'], rng))
      const [, label, num] = /^In (\S+) major, what’s V7\/(\S+)\?$/.exec(q.ask.text)!
      const targetRoot = tonePc(majorScale(keyOf(label))[NUMS.indexOf(num)])
      expect(seventhPcs(String(chosen(q)))[0]).toBe((targetRoot + 7) % 12)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('leads down a 5th, to a chord of the key', () => {
    for (const rng of seeds) {
      const q = asPick(makeSecondaryTarget(1, ['C', 'G', 'F'], rng))
      const [, label, symbol] = /^In (\S+) major, (\S+) leads to which chord\?$/.exec(q.ask.text)!
      const answer = chordPcs(String(chosen(q)))
      expect(answer[0]).toBe((seventhPcs(symbol)[0] + 5) % 12)
      expect(answer.every((pc) => inKey(keyOf(label)).includes(pc))).toBe(true)
    }
  })

  it('finds the one note outside the key', () => {
    for (const rng of seeds) {
      const q = asPick(makeSecondaryNote(1, ['C', 'G', 'F', 'Bb', 'D'], rng))
      const [, label] = /^In (\S+) major, which note of \S+ isn’t in the key\?$/.exec(q.ask.text)!
      expect((q.options as string[]).filter((n) => !inKey(keyOf(label)).includes(pcOf(n)))).toEqual([chosen(q)])
    }
  })

  it('spots the one chord of a progression with a note outside the key', () => {
    for (const rng of seeds) {
      const q = asPick(makeSecondarySpot(1, ['C', 'G', 'F', 'D'], rng))
      const [, label] = /^In (\S+) major, which chord of .+ is a secondary dominant\?$/.exec(q.ask.text)!
      expect((q.options as string[]).filter((c) => notesOf(c).some((pc) => !inKey(keyOf(label)).includes(pc)))).toEqual([chosen(q)])
    }
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['secd:ii', 'secd:IV', 'secd:V', 'secd:vi', 'secn:vi']) {
      expect(tapeOf(fact), fact).toBe(75)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('secd:V')).toBe('The secondary dominant V7/V')
    expect(describeFact('secn:ii')).toBe('V7/ii’s outside note')
    for (const junk of ['secd:I', 'secd:vii°', 'secn:IV']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains the borrowed pull before the first secondary dominant', () => {
    const steps = buildRehearsal('cs2-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Borrowing the pull home', 'Secondary dominants', 'check', 'ready'])
  })
})

describe('borrowed chords', () => {
  /** Each borrowed chord's root, in half steps above home, and its kind, written out by hand. */
  const BORROWED: Record<string, [number, string]> = { iv: [5, 'm'], '♭VI': [8, ''], '♭VII': [10, ''], '♭III': [3, ''] }
  const KEYS_USED: KeyId[] = ['C', 'G', 'D', 'F', 'A', 'E']
  const inKey = (key: KeyId) => majorScale(key).map(tonePc)

  it('builds each one from the parallel minor', () => {
    for (const rng of seeds) {
      const q = asPick(makeBorrowedChord(1, KEYS_USED, rng))
      const [, label, numeral] = /^In (\S+) major, what’s (\S+)\?$/.exec(q.ask.text)!
      const [steps, suffix] = BORROWED[numeral]
      const answer = String(chosen(q))
      expect(chordPcs(answer)[0]).toBe((pcOf(label) + steps) % 12)
      expect(answer.replace(/^[A-G][♯♭]?/, '')).toBe(suffix)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('names each one with its numeral, a flat where its root is lowered', () => {
    for (const rng of seeds) {
      const q = asPick(makeBorrowedNumeral(1, KEYS_USED, rng))
      const [, label, symbol] = /^In (\S+) major, which numeral is the borrowed (\S+)\?$/.exec(q.ask.text)!
      const [steps] = BORROWED[String(chosen(q))]
      expect(chordPcs(symbol)[0]).toBe((pcOf(label) + steps) % 12)
    }
  })

  it('spots the one chord of a progression that isn’t in the major key', () => {
    for (const rng of seeds) {
      const q = asPick(makeBorrowedSpot(1, KEYS_USED, rng))
      const [, label] = /^In (\S+) major, which chord of .+ is borrowed from \1 minor\?$/.exec(q.ask.text)!
      expect((q.options as string[]).filter((c) => chordPcs(c).some((pc) => !inKey(keyOf(label)).includes(pc)))).toEqual([chosen(q)])
    }
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['borr:iv', 'borr:bVI', 'borr:bVII', 'borr:bIII']) {
      expect(tapeOf(fact), fact).toBe(76)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('borr:bVII')).toBe('The borrowed ♭VII chord')
    for (const junk of ['borr:V', 'borr:']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains borrowing and the parallel minor before the borrowed chords', () => {
    const steps = buildRehearsal('cs3-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps.filter((s) => s !== 'check' && s !== 'ready')).toEqual(['Borrowing from minor', 'The parallel minor', 'The borrowed chords'])
    expect(steps[steps.length - 1]).toBe('ready')
  })
})

describe('tritone substitution', () => {
  const KEYS_USED: KeyId[] = ['C', 'G', 'D', 'A', 'F', 'E']
  const rootPc = (symbol: string) => pcOf(/^([A-G][♯♭]?)/.exec(symbol)![1])
  /** A dominant 7th's notes from its symbol, by hand. */
  const dom7 = (symbol: string) => [0, 4, 7, 10].map((x) => (rootPc(symbol) + x) % 12)

  it('swaps V7 for the dominant 7th a tritone away, a half step above home', () => {
    for (const rng of seeds) {
      const q = asPick(makeTritoneSub(1, KEYS_USED, rng))
      const [, label, five] = /^In (\S+) major, what’s the tritone sub for (\S+)\?$/.exec(q.ask.text)!
      const answer = String(chosen(q))
      expect(answer).toMatch(/^[A-G][♯♭]?7$/)
      expect((rootPc(answer) - rootPc(five) + 12) % 12).toBe(6)
      expect(rootPc(answer)).toBe((pcOf(label) + 1) % 12)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('finds the 3rd and 7th the two chords share, in keys where both spell plainly', () => {
    for (const rng of seeds) {
      const q = asPick(makeTritoneShared(1, KEYS_USED, rng))
      const [, a, b] = /^Which two notes do (\S+) and (\S+) share\?$/.exec(q.ask.text)!
      const inBoth = (pair: string) => pair.split(' and ').every((n) => dom7(a).includes(pcOf(n)) && dom7(b).includes(pcOf(n)))
      expect((q.options as string[]).filter(inBoth)).toEqual([chosen(q)])
      expect(q.why).not.toMatch(/C♭|F♭|E♯|B♯/)
    }
  })

  it('slides a ii–V–I’s roots down by half steps', () => {
    for (const rng of seeds) {
      const q = asPick(makeTritoneProgression(1, KEYS_USED, rng))
      const chords = String(chosen(q)).split(' – ')
      const roots = chords.map(rootPc)
      expect([(roots[0] - roots[1] + 12) % 12, (roots[1] - roots[2] + 12) % 12]).toEqual([1, 1])
      expect(chords[1]).toMatch(/^[A-G][♯♭]?7$/)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('comes back in review, with a label and the tape that taught it', () => {
    for (const fact of ['tsub:C', 'tsub:G', 'tsub:F', 'tsub:E']) {
      expect(tapeOf(fact), fact).toBe(77)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('tsub:G')).toBe('The tritone sub in G major')
    expect(theoryReview('tsub:Bb', 1, seeded(1))).toBeNull()
  })

  it('explains the jazz swap before the tritone sub', () => {
    const steps = buildRehearsal('cs4-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['A jazz swap', 'The tritone sub', 'check', 'ready'])
  })
})

describe('hearing swaps', () => {
  /** The chords played, four notes each from the root up: [root, 3rd, ...]. */
  const chordsHeard = (notes: number[]) => Array.from({ length: notes.length / 4 }, (_, i) => notes.slice(i * 4, i * 4 + 4))
  const third = (chord: number[]) => chord[1] - chord[0]

  it('ends at home or on vi, a major 6th up from home', () => {
    for (const rng of seeds) {
      const q = asPick(makeDeceptiveHear(1, rng))
      const chords = chordsHeard(q.listen!.notes)
      // vi can sit below home in the voicing, so compare the roots' note names, not their heights.
      expect((chords[3][0] - chords[0][0] + 12) % 12).toBe(chosen(q) === 'Home' ? 0 : 9)
    }
  })

  it('plays the key’s minor chord or a dominant 7th on the same root, then where it leads', () => {
    for (const rng of seeds) {
      const q = asPick(makeSecondaryHear(1, rng))
      const [, middle, next] = chordsHeard(q.listen!.notes)
      expect(chosen(q)).toBe(third(middle) === 4 ? 'Secondary dominant' : 'In the key')
      if (chosen(q) === 'Secondary dominant') expect([middle[3] - middle[0], (next[0] - middle[0] + 12) % 12]).toEqual([10, 5])
    }
  })

  it('plays IV or the minor iv between two home chords', () => {
    for (const rng of seeds) {
      const q = asPick(makeMinorFourHear(1, rng))
      const [home, middle] = chordsHeard(q.listen!.notes)
      expect((middle[0] - home[0] + 12) % 12).toBe(5)
      expect(chosen(q)).toBe(third(middle) === 4 ? 'Major IV' : 'Minor iv')
    }
  })

  it('plays V7 or the tritone sub between ii7 and Imaj7', () => {
    for (const rng of seeds) {
      const q = asPick(makeTritoneHear(1, rng))
      const [, middle, home] = chordsHeard(q.listen!.notes)
      expect((middle[0] - home[0] + 12) % 12).toBe(chosen(q) === 'Tritone sub' ? 1 : 7)
      expect(middle[3] - middle[0]).toBe(10)
    }
  })

  it('is a listening tape, and its facts come back in review', () => {
    expect(findLesson('cs5-1')!.unit.lessons.every(isListening)).toBe(true)
    for (const fact of ['ear:deceptive', 'ear:secondary', 'ear:minor-iv', 'ear:tritone-sub']) {
      expect(tapeOf(fact), fact).toBe(78)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
    }
    expect(describeFact('ear:tritone-sub')).toBe('Hearing a tritone sub')
    expect(theoryReview('ear:borrowed', 1, seeded(1))).toBeNull()
  })

  it('explains what to listen for before the first question', () => {
    const steps = buildRehearsal('cs5-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Hearing swaps', 'Home or deceptive', 'check', 'ready'])
  })
})
