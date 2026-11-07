import { describe, expect, it } from 'vitest'
import { asPick, chosen, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import { chordSymbol, harmonicChords, harmonicMinorScale, minorKeyTriads, MINOR_NUMERALS, toneName } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { describeFact, dueFacts, tapeOf } from './review'
import { theoryReview } from './theory'
import {
  makeHarmonicNote,
  makeHarmonicV,
  makeKeyFromChords,
  makeKeyFromHome,
  makeKeyModeHear,
  makeMinorChordOnDegree,
  makeMinorDegreeQuality,
  makeMinorDim7,
  makeMinorNumeral,
  makeMinorNumeralToChord,
  makeMinorProgressionName,
  makeMinorProgressionSpell,
  makeMinorVHear,
} from './minor'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const KEYS_USED = ['A', 'E', 'D', 'B', 'G', 'C']
const symbols = (tonic: string) => minorKeyTriads(tonic).map((c) => chordSymbol(c.tones[0], c.quality))

describe('minor keys', () => {
  it('has the same seven chords as the relative major, starting from the minor home note', () => {
    expect(symbols('A')).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'])
    expect(symbols('E')).toEqual(['Em', 'F♯°', 'G', 'Am', 'Bm', 'C', 'D'])
  })

  it('raises the 7th for harmonic minor, making V, V7 and vii°7', () => {
    expect(harmonicMinorScale('A').map(toneName).join(' ')).toBe('A B C D E F G♯')
    const d = harmonicChords('D')
    expect([d.V, d.V7, d['vii°7']].map((c) => c.tones.map(toneName).join(' '))).toEqual(['A C♯ E', 'A C♯ E G', 'C♯ E G B♭'])
    for (const tonic of KEYS_USED) expect(harmonicMinorScale(tonic).map(toneName).join(' ')).not.toMatch(/E♯|B♯|C♭|F♭|𝄪/)
  })
})

describe('minor-key questions', () => {
  it('names the chord on a note of a minor key, and its numeral both ways', () => {
    for (const rng of seeds) {
      const q = asPick(makeMinorChordOnDegree(1, KEYS_USED, rng))
      const [, n, tonic] = q.ask.text.match(/the (\d)\w+ note of (\S+) minor\?$/)!
      const c = minorKeyTriads(tonic.replace('♯', '#').replace('♭', 'b'))[Number(n) - 1]
      expect(chosen(q)).toBe(`${toneName(c.tones[0])} ${{ maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented' }[c.quality]}`)
      expect(new Set(q.options).size).toBe(4)
    }
    expect(chosen(asPick(makeMinorNumeral(1, ['D'], seeded(1), 5)))).toBe('VI')
    expect(chosen(asPick(makeMinorNumeralToChord(1, ['B'], seeded(1), 6)))).toBe('A major')
    expect(Array.from({ length: 7 }, (_, d) => chosen(asPick(makeMinorDegreeQuality(1, seeded(1), d))))).toEqual([
      'Minor',
      'Diminished',
      'Major',
      'Minor',
      'Minor',
      'Major',
      'Major',
    ])
  })

  it('asks about the raised 7th, the major V, V7 and the diminished 7th', () => {
    expect(chosen(asPick(makeHarmonicNote(1, [], seeded(1), 'E')))).toBe('D♯')
    expect(chosen(asPick(makeHarmonicV(1, ['D'], seeded(1), 'V7')))).toBe('A7')
    expect(chosen(asPick(makeHarmonicV(1, ['A'], seeded(1), 'V')))).toBe('E')
    expect(chosen(asPick(makeMinorDim7(1, ['G'], seeded(1))))).toBe('F♯°7')
    for (const rng of seeds) expect(new Set(asPick(makeHarmonicNote(1, KEYS_USED, rng)).options).size).toBeGreaterThanOrEqual(3)
  })

  it('spells and names minor progressions, with V7 taking the raised 7th', () => {
    expect(chosen(asPick(makeMinorProgressionSpell(1, ['A'], ['i-iv-V7-i'], seeded(1))))).toBe('Am – Dm – E7 – Am')
    expect(chosen(asPick(makeMinorProgressionSpell(1, ['A'], ['iidim-V7-i'], seeded(1))))).toBe('B° – E7 – Am')
    const named = asPick(makeMinorProgressionName(1, ['E'], ['i-VI-VII-i'], seeded(1)))
    expect(named.ask.text).toBe('In E minor, which progression is Em – C – D – Em?')
    expect(chosen(named)).toBe('i–VI–VII–i')
  })

  it('finds the key from home, and from a progression’s chords', () => {
    for (const rng of seeds) {
      const home = asPick(makeKeyFromHome(1, rng))
      const [, chord] = home.ask.text.match(/starts and ends on (\S+)\./)!
      expect(chosen(home)).toBe(`${chord.replace(/m$/, '')} ${chord.endsWith('m') ? 'minor' : 'major'}`)
      const from = asPick(makeKeyFromChords(1, rng))
      const first = from.ask.text.match(/^Which key is (\S+)/)![1]
      expect(chosen(from)).toBe(`${first.replace(/m$/, '')} ${first.endsWith('m') ? 'minor' : 'major'}`)
      expect(new Set(from.options).size).toBe(4)
    }
    expect(asPick(makeKeyFromHome(1, seeded(3))).ask.text).toMatch(/^With (no sharps or flats|\w+ (sharp|flat)s? \(.+\)), a song/)
  })
})

describe('hearing minor keys', () => {
  it('plays a progression that comes home to a major or a minor chord', () => {
    for (const rng of seeds) {
      const q = asPick(makeKeyModeHear(1, rng))
      const n = q.listen!.notes
      expect(chosen(q)).toBe(n[n.length - 2] - n[n.length - 3] === 3 ? 'Minor' : 'Major')
      const v = asPick(makeMinorVHear(1, rng))
      expect(chosen(v)).toBe(v.listen!.notes[4] - v.listen!.notes[3] === 3 ? 'Minor v' : 'Major V')
    }
  })

  it('is a listening tape, and its review waits while listening is off', () => {
    expect(findLesson('mk5-1')!.unit.lessons.every(isListening)).toBe(true)
    const due = { seen: 3, correct: 3, recent: 0.9, ms: 2000, interval: 2, due: '2026-01-01' }
    expect(dueFacts({ 'ear:keymode': due, 'mh:4': due }, '2026-01-05', false)).toEqual(['mh:4'])
  })
})

describe('every minor-key fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    const tapes: Record<string, number> = {
      'mh:4': 52,
      'mrn:6': 52,
      'hmin:A': 53,
      'hmv:V7': 53,
      'hmv:vii°7': 53,
      'mprog:i-VI-VII-i': 54,
      'mprog:iidim-V7-i': 54,
      'kfind:home': 55,
      'kfind:chords': 55,
      'ear:keymode': 56,
      'ear:minorv': 56,
    }
    for (const [fact, tape] of Object.entries(tapes)) {
      expect(tapeOf(fact), fact).toBe(tape)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
      expect(describeFact(fact), fact).not.toMatch(/undefined|NaN|mh:|mrn:/)
    }
    expect(describeFact('mprog:iidim-V7-i')).toBe('The ii°–V7–i progression')
    expect(describeFact('mrn:6')).toBe(`The ${MINOR_NUMERALS[5]} chord in a minor key`)
    for (const junk of ['mh:8', 'mrn:0', 'hmin:F', 'hmv:IV', 'mprog:i-ii-i', 'kfind:mode', 'ear:minor']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('explains why minor keys matter before the first chords', () => {
    const steps = buildRehearsal('mk1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Why minor keys', 'Chords in a minor key', 'check', 'ready'])
  })
})
