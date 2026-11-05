import { describe, expect, it } from 'vitest'
import { asPick, chosen, inRegion, seeded } from '../test-helpers'
import { findLesson, isListening } from '../music/curriculum'
import { midiAt, pitchClass, stringName } from '../music/notes'
import { KEYS, resolveNotes, type ScoreMeasure } from '../music/score'
import { majorScale, parseTone, toneName, tonePc, triadGap, triadTones, intervalName, type TriadQuality } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { buildReview, describeFact, dueFacts, tapeOf } from './review'
import { theoryCard, theoryReview } from './theory'
import {
  makeTriadHear,
  makeTriadInversion,
  makeTriadLetters,
  makeTriadQuality,
  makeTriadRead,
  makeTriadShapeFind,
  makeTriadShapeName,
  makeTriadSpell,
  makeTriadThird,
} from './triads'

const spell = (root: string, quality: TriadQuality) => triadTones(parseTone(root), quality)?.map(toneName).join(' ') ?? null
const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const TAPE_KEYS = findLesson('tr1-4')!.lesson.keys!

describe('spelling triads', () => {
  it('stacks a 3rd and a 5th on the root, one letter each', () => {
    expect(spell('C', 'maj')).toBe('C E G')
    expect(spell('D', 'maj')).toBe('D F♯ A')
    expect(spell('Bb', 'maj')).toBe('B♭ D F')
    expect(spell('E', 'min')).toBe('E G B')
    expect(spell('B', 'dim')).toBe('B D F')
    expect(spell('C', 'aug')).toBe('C E G♯')
    // G♯ augmented would need a double sharp.
    expect(spell('G#', 'aug')).toBeNull()
  })

  it('knows the 3rds each kind is built from', () => {
    const gap = (q: TriadQuality, from: 0 | 1, to: 1 | 2) => intervalName(triadGap(q, from, to))
    expect([gap('maj', 0, 1), gap('maj', 1, 2), gap('maj', 0, 2)]).toEqual(['major 3rd', 'minor 3rd', 'perfect 5th'])
    expect([gap('min', 0, 1), gap('min', 1, 2)]).toEqual(['minor 3rd', 'major 3rd'])
    expect([gap('dim', 1, 2), gap('dim', 0, 2)]).toEqual(['minor 3rd', 'diminished 5th'])
    expect([gap('aug', 1, 2), gap('aug', 0, 2)]).toEqual(['major 3rd', 'augmented 5th'])
  })

  it('is the 1st, 3rd and 5th of the major scale', () => {
    for (const key of TAPE_KEYS) {
      const scale = majorScale(key).map(toneName)
      expect(spell(key, 'maj')).toBe([scale[0], scale[2], scale[4]].join(' '))
    }
  })
})

describe('triad questions', () => {
  it('asks for the letters, skipping one each time', () => {
    for (const rng of seeds) {
      const q = asPick(makeTriadLetters(1, rng))
      const root = q.ask.text.match(/on ([A-G])\?$/)![1]
      const letters = 'CDEFGABCDEFGAB'
      const i = letters.indexOf(root)
      expect(chosen(q)).toBe([letters[i], letters[i + 2], letters[i + 4]].join(' '))
      expect(new Set(q.options).size).toBe(4)
      expect(q.facts).toEqual(['triad:letters'])
      // The finished triad is written out once it's answered.
      expect(q.score!.afterMeasures![0][0].with).toHaveLength(2)
    }
  })

  it('spells major triads, with near misses that are really wrong and never a rare spelling', () => {
    for (const rng of seeds) {
      const q = asPick(makeTriadSpell(1, TAPE_KEYS, 'maj', rng))
      const root = q.facts[0].slice(4)
      expect(chosen(q)).toBe(spell(root, 'maj'))
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      for (const o of q.options) expect(o).not.toMatch(/E♯|B♯|C♭|F♭/)
      expect(q.ask.text).toMatch(/^What notes make (a [BCDG]|an [AEF])[♯♭]? major triad\?$/)
    }
  })

  it('counts up the scale when it’s on the staff, and stacks 3rds when it isn’t', () => {
    const counting = asPick(makeTriadSpell(1, ['D'], 'maj', seeded(1), true))
    expect(counting.why).toBe('Count up the D major scale: D E F♯ G A. The 1st, 3rd and 5th are D F♯ A.')
    expect(counting.score!.measures.flat()).toHaveLength(8)
    const stacking = asPick(makeTriadSpell(1, ['D'], 'maj', seeded(1)))
    expect(stacking.why).toMatch(/^D up a major 3rd is F♯, then up a minor 3rd is A\./)
  })

  it('lights the triad on the neck around the root once it’s answered', () => {
    const q = asPick(makeTriadSpell(1, ['G'], 'maj', seeded(3)))
    const { region, markers, after } = q.board!
    expect(markers).toHaveLength(1)
    expect(pitchClass(midiAt(markers[0].pos))).toBe(tonePc(parseTone('G')))
    const pcs = new Set(after!.map((m) => pitchClass(midiAt(m.pos))))
    expect(pcs).toEqual(new Set(['G', 'B', 'D'].map((n) => tonePc(parseTone(n)))))
    for (const m of after!) expect(inRegion(m.pos, region)).toBe(true)
  })

  it('names the interval between two notes of a triad', () => {
    for (const rng of seeds) {
      const q = asPick(makeTriadThird(1, TAPE_KEYS, 'maj', rng))
      const [, a, b] = q.ask.text.match(/from (\S+) up to (\S+)\?$/)!
      const semis = (tonePc(parseTone(b.replace('♯', '#').replace('♭', 'b'))) - tonePc(parseTone(a.replace('♯', '#').replace('♭', 'b'))) + 12) % 12
      expect(chosen(q)).toBe({ 3: 'Minor 3rd', 4: 'Major 3rd', 7: 'Perfect 5th' }[semis])
      expect(q.options).toEqual(['Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Perfect 5th'])
      expect(q.facts).toEqual(['tq:maj'])
    }
  })
})

describe('triads in review', () => {
  it('brings back each fact as a question, and turns down names it doesn’t know', () => {
    expect(asPick(theoryReview('tri:Bb', 1, seeded(1))).kind).toBe('triadSpell')
    expect(chosen(asPick(theoryReview('tri:Bb', 1, seeded(1))))).toBe('B♭ D F')
    expect(['triadThird', 'triadQuality']).toContain(asPick(theoryReview('tq:maj', 1, seeded(1))).kind)
    expect(asPick(theoryReview('triad:letters', 1, seeded(1))).kind).toBe('triadLetters')
    for (const junk of ['tri:H', 'tri:Dsus', 'tri:', 'tq:sus', 'tq:constructor']) expect(theoryReview(junk, 1, seeded(1))).toBeNull()
  })

  it('labels the facts and tags them with tape 33', () => {
    expect(describeFact('tri:Bb')).toBe('B♭ major triad')
    expect(describeFact('tq:maj')).toBe('How major triads are stacked')
    expect(describeFact('triad:letters')).toBe('Triad letters')
    for (const fact of ['tri:D', 'tq:maj', 'triad:letters']) expect(tapeOf(fact)).toBe(33)
    const due = { seen: 3, correct: 3, recent: 0.9, ms: 2000, interval: 2, due: '2026-01-01' }
    const review = buildReview({ 'tri:D': due, 'tq:maj': due }, '2026-01-05', 5, seeded(2))
    expect(review.map((q) => q.kind)).toContain('triadSpell')
    expect(review).toHaveLength(2)
  })
})

describe('the first triad tape', () => {
  it('explains why and what before quizzing the letters', () => {
    const plan = buildRehearsal('tr1-1', seeded(1))!
    const steps = plan.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Why triads', 'What a triad is', 'Every other letter', 'check', 'ready'])
  })

  it('teaches major triads with the scale on the staff, then takes it away', () => {
    const withScale = buildRehearsal('tr1-2', seeded(1))!
    const check = withScale.steps.find((s) => s.kind === 'check')!
    expect(check.kind === 'check' && check.questions.every((q) => q.kind === 'triadSpell' && q.score!.measures.flat().length === 8)).toBe(true)
    const later = buildRehearsal('tr1-3', seeded(1))!
    expect(later.steps.filter((s) => s.kind === 'card').map((s) => s.kind === 'card' && s.card.title)).toEqual(['Built from 3rds'])
  })
})

const KINDS: TriadQuality[] = ['maj', 'min', 'dim', 'aug']
const NAMES: Record<TriadQuality, string> = { maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented' }
/** The kind of triad three spelled notes make, root first, from their half steps alone. */
const kindOf = (names: string[]) => {
  const pcs = names.map((n) => tonePc(parseTone(n.replace('♯', '#').replace('♭', 'b'))))
  const gaps = `${(pcs[1] - pcs[0] + 12) % 12},${(pcs[2] - pcs[0] + 12) % 12}`
  return ({ '4,7': 'maj', '3,7': 'min', '3,6': 'dim', '4,8': 'aug' } as Record<string, TriadQuality>)[gaps]
}
/** The written notes of a stacked chord, spelled with the key signature, bottom up. */
function chordOf(measures: ScoreMeasure[], key: Parameters<typeof resolveNotes>[1] = 'C'): string[] {
  const [[n]] = measures
  return [n, ...n.with!]
    .sort((a, b) => a.octave * 7 + 'CDEFGAB'.indexOf(a.letter) - (b.octave * 7 + 'CDEFGAB'.indexOf(b.letter)))
    .map((x) => toneName({ letter: x.letter, acc: x.sign ?? KEYS[key].altered[x.letter] ?? 0 }))
}
/** Restacked in 3rds: the note with the other two letters 2 and 4 above it comes first. */
function restacked(names: string[]): string[] {
  const gap = (a: string, b: string) => ('CDEFGAB'.indexOf(b[0]) - 'CDEFGAB'.indexOf(a[0]) + 7) % 7
  const root = names.find((n) => names.some((x) => gap(n, x) === 2) && names.some((x) => gap(n, x) === 4))!
  return [root, names.find((x) => gap(root, x) === 2)!, names.find((x) => gap(root, x) === 4)!]
}

describe('the other kinds of triad', () => {
  it('spells minor, diminished and augmented triads on every root the tapes use, with four real choices', () => {
    for (const kind of ['min', 'dim', 'aug'] as const) {
      const roots = findLesson(kind === 'min' ? 'tr2-3' : kind === 'dim' ? 'tr3-1' : 'tr3-2')!.lesson.keys!
      for (const rng of seeds) {
        const q = asPick(makeTriadSpell(1, roots, kind, rng))
        expect(kindOf((chosen(q) as string).split(' '))).toBe(kind)
        expect(new Set(q.options).size).toBe(4)
        for (const o of q.options) expect(o).not.toMatch(/E♯|B♯|C♭|F♭/)
      }
    }
  })

  it('starts minor from the major triad, diminished from minor and augmented from major, until the help is taken away', () => {
    const minor = asPick(makeTriadSpell(1, ['D'], 'min', seeded(1), true))
    expect(minor.score!.labels).toEqual(['D major'])
    expect(minor.why).toBe('D major is D F♯ A; lower its 3rd a half step, F♯ to F, and it’s D F A.')
    expect(asPick(makeTriadSpell(1, ['B'], 'dim', seeded(1), true)).score!.labels).toEqual(['B minor'])
    expect(asPick(makeTriadSpell(1, ['C'], 'aug', seeded(1), true)).why).toMatch(/raise its 5th a half step, G to G♯/)
    expect(asPick(makeTriadSpell(1, ['D'], 'min', seeded(1))).why).toMatch(/^D up a minor 3rd is F, then up a major 3rd is A\. Or: D major/)
  })

  it('tells the kinds apart by their 3rds, offering only the kinds learned so far', () => {
    for (const rng of seeds) {
      const two = asPick(makeTriadQuality(1, [], ['maj', 'min'], rng))
      expect(two.options).toEqual(['Major', 'Minor'])
      const all = asPick(makeTriadQuality(1, [], KINDS, rng))
      expect(all.options).toEqual(['Major', 'Minor', 'Diminished', 'Augmented'])
      const notes = all.ask.text.replace(': which kind of triad?', '').split(' ')
      expect(chosen(all)).toBe(NAMES[kindOf(notes)].replace(/^./, (c) => c.toUpperCase()))
    }
  })

  it('offers each kind’s own 5th when asking about the gaps in it', () => {
    expect(asPick(makeTriadThird(1, [], 'dim', seeded(1))).options).toEqual(['Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Diminished 5th', 'Perfect 5th'])
    expect(asPick(makeTriadThird(1, [], 'maj', seeded(1), KINDS)).options).toHaveLength(6)
  })
})

describe('triads on the staff and inverted', () => {
  it('names triads from a key, read with the key signature and restacked in 3rds', () => {
    for (const inverted of [false, true])
      for (const rng of seeds) {
        const q = asPick(makeTriadRead(1, ['C', 'G', 'D', 'F', 'Bb', 'A', 'Eb'], inverted, rng))
        const notes = restacked(chordOf(q.score!.measures, q.score!.keySig))
        expect(chosen(q)).toBe(`${notes[0]} ${NAMES[kindOf(notes)]}`)
        expect(new Set(q.options).size).toBe(4)
        if (!inverted) expect(chordOf(q.score!.measures, q.score!.keySig)).toEqual(notes)
      }
  })

  it('knows which note is on the bottom', () => {
    for (const rng of seeds) {
      const q = asPick(makeTriadInversion(1, ['C', 'G', 'F'], rng))
      const bottom = chordOf(q.score!.measures, q.score!.keySig)[0]
      const root = q.ask.text.match(/^This (\S+) /)![1]
      const gap = ('CDEFGAB'.indexOf(bottom[0]) - 'CDEFGAB'.indexOf(root[0]) + 7) % 7
      expect(q.answer).toBe(gap / 2)
    }
  })
})

describe('triads on the neck', () => {
  const frets = (item: string) => {
    const board = theoryCard(item, '').board!
    return [...new Set(board.markers.map((m) => m.pos.fret))].sort((a, b) => a - b)
  }

  it('shows the shapes the cards describe', () => {
    // C major on G B E: 0-1-0, 5-5-3, 9-8-8. A minor: 2-1-0, 5-5-5, 9-10-8. C major on D G B: 2-0-1, 5-5-5, 10-9-8.
    expect(frets('triad:neck-top')).toEqual([0, 1, 3, 5, 8, 9])
    expect(frets('triad:neck-minor')).toEqual([0, 1, 2, 5, 8, 9, 10])
    expect(frets('triad:neck-middle')).toEqual([0, 1, 2, 5, 8, 9, 10])
  })

  it('names a shape from its labeled notes, one note per string within four frets', () => {
    for (const rng of seeds) {
      const q = asPick(makeTriadShapeName(1, [], ['maj', 'min'], [2, 3, 4, 5], rng))
      const { markers } = q.board!
      expect(new Set(markers.map((m) => m.pos.string)).size).toBe(3)
      const span = markers.map((m) => m.pos.fret)
      expect(Math.max(...span) - Math.min(...span)).toBeLessThanOrEqual(3)
      const notes = restacked(markers.map((m) => m.label!))
      expect(chosen(q)).toBe(`${notes[0]} ${NAMES[kindOf(notes)]}`)
    }
  })

  it('asks for the missing note on the string that’s missing it', () => {
    for (const rng of seeds) {
      const q = makeTriadShapeFind(1, [], ['maj', 'min'], [3, 4, 5], rng)!
      if (q.kind !== 'triadShapeFind') throw new Error('expected a shape question')
      const [, root, kind, string] = q.ask.text.match(/this (\S+) (\w+) triad, on the (.+) string$/)!
      const triad = triadTones(parseTone(root.replace('♯', '#').replace('♭', 'b')), KINDS.find((k) => NAMES[k] === kind)!)!
      const shown = q.markers.map((m) => pitchClass(midiAt(m.pos)))
      const missing = triad.map(tonePc).find((pc) => !shown.includes(pc))
      expect(q.targets.length).toBeGreaterThan(0)
      for (const p of q.targets) {
        expect(pitchClass(midiAt(p))).toBe(missing)
        expect(stringName(p.string)).toBe(string)
        expect(inRegion(p, q.region)).toBe(true)
      }
      expect(q.sound).toHaveLength(3)
    }
  })
})

describe('hearing triads', () => {
  it('plays the kind it asks about, one note at a time or together', () => {
    for (const rng of seeds) {
      const q = asPick(makeTriadHear(1, KINDS, ['up', 'together'], rng))
      const [root, third, fifth] = q.listen!.notes
      const kind = ({ '4,7': 'maj', '3,7': 'min', '3,6': 'dim', '4,8': 'aug' } as Record<string, TriadQuality>)[`${third - root},${fifth - root}`]
      expect(chosen(q)).toBe(NAMES[kind].replace(/^./, (c) => c.toUpperCase()))
      expect(q.facts).toEqual([`ear:${kind}`])
    }
  })

  it('is a listening tape, and its review waits while listening is off', () => {
    expect(findLesson('tr7-1')!.unit.lessons.every(isListening)).toBe(true)
    const due = { seen: 3, correct: 3, recent: 0.9, ms: 2000, interval: 2, due: '2026-01-01' }
    expect(dueFacts({ 'ear:min': due, 'tri:Dm': due }, '2026-01-05', false)).toEqual(['tri:Dm'])
  })
})

describe('every triad fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    const tapes: Record<string, number> = {
      'tri:Dm': 34,
      'tq:min': 34,
      'tri:Bdim': 35,
      'tq:aug': 35,
      'tinv:1': 37,
      'tneck:top-maj': 38,
      'tneck:top-min': 38,
      'tneck:middle-min': 38,
      'ear:maj': 39,
      'ear:aug': 39,
    }
    for (const [fact, tape] of Object.entries(tapes)) {
      expect(tapeOf(fact), fact).toBe(tape)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
      expect(describeFact(fact), fact).not.toMatch(/undefined|NaN|:/)
    }
    expect(describeFact('tneck:top-min')).toBe('Minor shapes, top strings')
    expect(describeFact('tinv:2')).toBe('Triads in 2nd inversion')
    expect(describeFact('ear:dim')).toBe('Diminished triads by ear')
    for (const junk of ['tinv:3', 'tneck:low-maj', 'tneck:top-sus', 'ear:sus']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })
})
