import { describe, expect, it } from 'vitest'
import { asPick, asTap, chosen, inRegion, seeded } from '../test-helpers'
import type { KeyId } from '../music/score'
import { midiAt, pitchClass } from '../music/notes'
import { majorScale, minorScaleOn, spellOn, toneName, tonePc, type Tone } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { describeFact, tapeOf } from './review'
import { skillMeters } from './skills'
import { theoryReview } from './theory'
import {
  makeModeColor,
  makeModeDegree,
  makeModeFormula,
  makeModeHear,
  makeModeHomeChord,
  makeModeNeckName,
  makeModeNeckRoot,
  makeModeNumeral,
  makeModeOnDegree,
  makeModeParent,
  makeModeRoot,
  makeModeSpell,
  makeModeVamp,
  makeVampHear,
  MODE_NAMES,
  modeDegrees,
  MODES,
  modeScale,
  type ModeId,
} from './modes'

const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))
const KEYS: KeyId[] = ['C', 'G', 'F', 'D', 'A', 'Bb']
const names = (tones: Tone[]) => tones.map(toneName).join(' ')
/** "B♭" back to "Bb". */
const keyOf = (label: string) => label.replace('♭', 'b').replace('♯', '#') as KeyId
const ORDER = Object.values(MODE_NAMES)

describe('the seven modes', () => {
  it('plays C major from each of its notes, Ionian to Locrian', () => {
    expect(MODES.map((m) => names(modeScale('C', m)))).toEqual([
      'C D E F G A B',
      'D E F G A B C',
      'E F G A B C D',
      'F G A B C D E',
      'G A B C D E F',
      'A B C D E F G',
      'B C D E F G A',
    ])
    expect(ORDER).toEqual(['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'])
  })

  it('counts each mode’s degrees against the major scale on its own root', () => {
    expect(MODES.map((m) => modeDegrees(m).join(' '))).toEqual([
      '1 2 3 4 5 6 7',
      '1 2 ♭3 4 5 6 ♭7',
      '1 ♭2 ♭3 4 5 ♭6 ♭7',
      '1 2 3 ♯4 5 6 7',
      '1 2 3 4 5 6 ♭7',
      '1 2 ♭3 4 5 ♭6 ♭7',
      '1 ♭2 ♭3 4 ♭5 ♭6 ♭7',
    ])
  })

  it('keeps its parent’s spelling in any key, one of each letter', () => {
    expect(names(modeScale('G', 'dorian'))).toBe('A B C D E F♯ G')
    expect(names(modeScale('Bb', 'lydian'))).toBe('E♭ F G A B♭ C D')
    expect(names(modeScale('D', 'locrian'))).toBe('C♯ D E F♯ G A B')
    for (const key of KEYS) for (const m of MODES) expect(new Set(modeScale(key, m).map((t) => t.letter)).size).toBe(7)
  })
})

describe('mode questions', () => {
  it('names the mode a major scale makes from each of its notes', () => {
    for (const rng of seeds) {
      const q = asPick(makeModeOnDegree(1, KEYS, rng))
      const [, key, root] = q.ask.text.match(/^(\S+) major’s notes, played from (\S+) to \2: which mode\?$/)!
      expect(chosen(q)).toBe(ORDER[majorScale(keyOf(key)).map(toneName).indexOf(root)])
      expect(new Set(q.options).size).toBe(4)
      expect(q.facts).toEqual([`mode:${MODES[ORDER.indexOf(chosen(q) as string)]}`])
    }
  })

  it('shows the major scale with the start note marked while you learn, then writes the mode out', () => {
    const q = asPick(makeModeOnDegree(1, ['C'], seeded(3), true, 'dorian'))
    expect(q.ask.text).toBe('C major’s notes, played from D to D: which mode?')
    expect(chosen(q)).toBe('Dorian')
    expect(q.score!.labels).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'])
    expect(q.score!.colors!.findIndex(Boolean)).toBe(1)
    expect(q.score!.after).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'])
    expect(q.why).toContain('D is the 2nd note of C major')
    expect(asPick(makeModeOnDegree(1, ['C'], seeded(3), false, 'aeolian')).why).toContain('natural minor')
  })

  it('knows where each mode starts in the major scale, both ways round', () => {
    const asked = new Set<number>()
    for (const m of MODES) {
      const n = MODES.indexOf(m) + 1
      for (const rng of seeds.slice(0, 8)) {
        const q = asPick(makeModeDegree(1, rng, m))
        asked.add(q.options.length)
        if (q.options.length === 7) {
          expect(q.ask.text).toBe(`Which degree of the major scale does ${MODE_NAMES[m]} start on?`)
          expect(chosen(q)).toBe(String(n))
        } else {
          expect(q.ask.text).toMatch(new RegExp(`^Which mode starts on the ${n}(st|nd|rd|th) degree of the major scale\\?$`))
          expect(chosen(q)).toBe(MODE_NAMES[m])
          expect(new Set(q.options).size).toBe(4)
        }
        expect(q.facts).toEqual([`mode:${m}`])
      }
    }
    expect([...asked].sort()).toEqual([4, 7])
  })

  it('finds the major scale a mode borrows from, with the scale on its own first note as a near miss', () => {
    const q = asPick(makeModeParent(1, ['G'], seeded(1), 'dorian'))
    expect(q.ask.text).toBe('A Dorian has the same notes as which major scale?')
    expect(chosen(q)).toBe('G major')
    expect(q.options).toContain('A major')
    expect(q.score!.after).toEqual(['A', 'B', 'C', 'D', 'E', 'F♯', 'G', 'A'])
    for (const rng of seeds) {
      const p = asPick(makeModeParent(1, KEYS, rng))
      const [, root, mode] = p.ask.text.match(/^(\S+) (\w+) has the same notes as which major scale\?$/)!
      expect(mode).not.toBe('Ionian')
      expect(toneName(majorScale(keyOf((chosen(p) as string).replace(' major', '')))[ORDER.indexOf(mode)])).toBe(root)
      expect(new Set(p.options).size).toBe(4)
    }
  })

  it('counts up a key to the note a mode starts on', () => {
    const q = asPick(makeModeRoot(1, ['F'], seeded(1), 'mixolydian'))
    expect(q.ask.text).toBe('In F major, which note does Mixolydian start on?')
    expect(chosen(q)).toBe('C')
    expect(q.score!.keySig).toBe('F')
    expect(q.why).toContain('F G A B♭ C')
    for (const rng of seeds) {
      const r = asPick(makeModeRoot(1, KEYS, rng))
      const [, key, mode] = r.ask.text.match(/^In (\S+) major, which note does (\w+) start on\?$/)!
      expect(chosen(r)).toBe(toneName(majorScale(keyOf(key))[ORDER.indexOf(mode)]))
      expect(new Set(r.options).size).toBe(4)
    }
  })
})

const MAJOR_ROOTS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb']
const MINOR_ROOTS = ['A', 'E', 'B', 'D', 'G', 'C', 'F']
// Worked out independently: each color mode against major or natural minor, as [degree, half steps moved].
const COLOR: Record<string, { minor: boolean; moves: [number, number][]; formula: string; label: string }> = {
  Lydian: { minor: false, moves: [[4, 1]], formula: 'major with a raised 4th', label: 'Raised 4th' },
  Mixolydian: { minor: false, moves: [[7, -1]], formula: 'major with a lowered 7th', label: 'Lowered 7th' },
  Dorian: { minor: true, moves: [[6, 1]], formula: 'minor with a raised 6th', label: 'Raised 6th' },
  Phrygian: { minor: true, moves: [[2, -1]], formula: 'minor with a lowered 2nd', label: 'Lowered 2nd' },
  Locrian: { minor: true, moves: [[2, -1], [5, -1]], formula: 'minor with a lowered 2nd and 5th', label: 'Lowered 2nd and 5th' },
}
/** The plain scale on a root ("B♭"): major, or natural minor. */
const plain = (root: string, minor: boolean) => (minor ? minorScaleOn(keyOf(root)) : majorScale(keyOf(root)))
/** A color mode on a root: the plain scale with its color notes moved, each keeping its letter. */
function colorMode(root: string, mode: string): Tone[] {
  const out = [...plain(root, COLOR[mode].minor)]
  for (const [d, by] of COLOR[mode].moves) out[d - 1] = spellOn(out[d - 1].letter, pitchClass(tonePc(out[d - 1]) + by))!
  return out
}

describe('mode colors', () => {
  it('asks for the one note a mode changes, never its root', () => {
    for (const rng of seeds) {
      const q = asPick(makeModeColor(1, MAJOR_ROOTS, MINOR_ROOTS, [], rng))
      const [, root, mode, word] = q.ask.text.match(/^Which note of (\S+) (\w+) isn’t in \1 (major|minor)\?$/)!
      expect(word).toBe(COLOR[mode].minor ? 'minor' : 'major')
      const scale = plain(root, COLOR[mode].minor).map(toneName)
      expect(scale).not.toContain(chosen(q))
      expect(names(colorMode(root, mode))).toContain(chosen(q) as string)
      expect((q.options as string[]).filter((o) => o !== chosen(q)).every((o) => scale.includes(o) && o !== root)).toBe(true)
    }
  })

  it('names each mode from its formula, and its color note from its name', () => {
    const kinds = new Set<string>()
    for (const mode of Object.keys(COLOR)) {
      const id = MODES[ORDER.indexOf(mode)]
      for (const rng of seeds.slice(0, 8)) {
        const q = asPick(makeModeFormula(1, [], rng, id))
        if (q.ask.text.startsWith('Which mode is')) {
          kinds.add('formula')
          expect(q.ask.text).toBe(`Which mode is ${COLOR[mode].formula}?`)
          expect(chosen(q)).toBe(mode)
        } else {
          kinds.add('name')
          expect(chosen(q)).toBe(COLOR[mode].label)
        }
        expect(new Set(q.options).size).toBe(4)
        expect(q.facts).toEqual([`modec:${id}`])
      }
    }
    expect(kinds.size).toBe(2)
    expect(asPick(makeModeFormula(1, [], seeded(2), 'locrian')).why).toContain('B Locrian is B C D E F G A, where B minor is B C♯ D E F♯ G A')
  })

  it('spells every color mode on every root from the plain scale, with four different choices', () => {
    for (const mode of Object.keys(COLOR)) {
      const id = MODES[ORDER.indexOf(mode)] as ModeId
      for (const root of COLOR[mode].minor ? MINOR_ROOTS : MAJOR_ROOTS) {
        const rng = seeded(root.charCodeAt(0))
        const q = asPick(makeModeSpell(1, [root], [root], [], rng, id))
        const asked = q.ask.text.match(/^Which notes make (\S+) (\w+)\?$/)!
        // Roots that would need a rare spelling (F Locrian's C♭) fall back to another root.
        expect(chosen(q)).toBe(names(colorMode(asked[1], asked[2])))
        expect(new Set(q.options).size).toBe(4)
      }
    }
  })
})

describe('modes and chords', () => {
  const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
  const HOME: Record<string, string> = { Ionian: 'maj7', Dorian: 'm7', Phrygian: 'm7', Lydian: 'maj7', Mixolydian: '7', Aeolian: 'm7', Locrian: 'm7♭5' }

  it('puts a mode on every chord of a key, both ways round', () => {
    for (const rng of seeds) {
      const q = asPick(makeModeNumeral(1, rng))
      const byNumeral = q.ask.text.match(/^In a major key, which mode starts on the root of the (\S+) chord\?$/)
      const byMode = q.ask.text.match(/^In a major key, (\w+) starts on the root of which chord\?$/)
      if (byNumeral) expect(chosen(q)).toBe(ORDER[NUMERALS.indexOf(byNumeral[1])])
      else expect(chosen(q)).toBe(NUMERALS[ORDER.indexOf(byMode![1])])
      expect(new Set(q.options).size).toBe(4)
    }
    expect(asPick(makeModeNumeral(1, seeded(1), 'dorian')).why).toContain('In C major, that’s Dm and D Dorian')
  })

  it('stacks each mode’s home chord from its own notes, and names the mode from a chord only it has', () => {
    for (const rng of seeds) {
      const q = asPick(makeModeHomeChord(1, ['C', 'G', 'F', 'D', 'A', 'Bb'], rng))
      const forward = q.ask.text.match(/^What’s the home chord of (\S+) (\w+)\?$/)
      if (forward) expect(chosen(q)).toBe(forward[1] + HOME[forward[2]])
      else {
        const [, root, suffix] = q.ask.text.match(/^Which mode has ([A-G][♯♭]?)(7|m7♭5) as its home chord\?$/)!
        expect(chosen(q)).toBe(`${root} ${suffix === '7' ? 'Mixolydian' : 'Locrian'}`)
      }
      expect(new Set(q.options).size).toBe(4)
    }
    expect(asPick(makeModeHomeChord(1, ['G'], seeded(1), 'dorian')).why).toContain('A C E G, Am7, a minor 7th')
  })

  it('names the mode a two-chord vamp points to, from the color note in its second chord', () => {
    const vamps: Record<string, string> = { 'Am – D': 'A Dorian', 'G – F': 'G Mixolydian', 'C – D': 'C Lydian', 'Em – F': 'E Phrygian' }
    const seen = new Set<string>()
    for (const [mode, root, minor] of [['dorian', 'A', true], ['mixolydian', 'G', false], ['lydian', 'C', false], ['phrygian', 'E', true]] as const) {
      const q = asPick(makeModeVamp(1, minor ? [] : [root], minor ? [root] : [], [], seeded(3), mode))
      const pair = q.ask.text.match(/^(.+), over and over: which mode\?$/)![1]
      expect(chosen(q)).toBe(vamps[pair])
      seen.add(pair)
    }
    expect(seen.size).toBe(4)
  })
})

describe('modes on the neck', () => {
  it('finds a mode’s home in its parent’s pattern', () => {
    for (const rng of seeds) {
      const q = asTap(makeModeNeckRoot(1, [0, 1], rng))
      const [, root, mode, parent] = q.ask.text.match(/^Tap a root of (\S+) (\w+) in this (\S+) major pattern$/)!
      expect(toneName(majorScale(keyOf(parent))[ORDER.indexOf(mode)])).toBe(root)
      expect(q.targets.length).toBeGreaterThan(0)
      for (const p of q.targets) {
        expect(toneName(majorScale(keyOf(parent))[majorScale(keyOf(parent)).map(tonePc).indexOf(pitchClass(midiAt(p)))])).toBe(root)
        expect(inRegion(p, q.region)).toBe(true)
      }
      expect(q.markers.find((mk) => mk.tone === 'root')!.label).toBe(parent)
    }
  })

  it('names the mode from the note lit as home', () => {
    for (const rng of seeds) {
      const q = asPick(makeModeNeckName(1, [0, 1], rng))
      const parent = q.ask.text.match(/^In this (\S+) major pattern, the lit notes are home\. Which mode is it\?$/)![1]
      const home = pitchClass(midiAt(q.board!.markers.find((mk) => mk.tone === 'root')!.pos))
      expect(chosen(q)).toBe(ORDER[majorScale(keyOf(parent)).map(tonePc).indexOf(home)])
      expect(q.board!.markers.find((mk) => mk.label)!.label).toBe(parent)
    }
  })
})

describe('hearing modes', () => {
  it('plays the mode or the plain scale it changes, and asks which', () => {
    const tell: Record<string, (c: number[]) => boolean> = { Dorian: (c) => c[5] === 9, Mixolydian: (c) => c[6] === 10, Lydian: (c) => c[3] === 6, Phrygian: (c) => c[1] === 1 }
    for (const rng of seeds) {
      const q = asPick(makeModeHear(1, ['dorian', 'mixolydian', 'lydian', 'phrygian'], rng))
      const [, mode, other] = q.ask.text.match(/^(\w+) or (natural minor|major)\?$/)!
      expect(q.options).toEqual([mode, other === 'major' ? 'Major' : 'Natural minor'])
      // Up to the octave and back down to the root.
      const heard = q.listen!.notes.map((n) => n - q.listen!.notes[0])
      expect(heard).toHaveLength(15)
      expect(heard.slice(7)).toEqual([...heard.slice(0, 8)].reverse())
      expect(chosen(q)).toBe(tell[mode](heard) ? mode : q.options[1])
      // The home chord comes first, on the scale's root: minor for Dorian and Phrygian, major otherwise.
      const home = q.listen!.home!
      expect(home[0]).toBe(q.listen!.notes[0])
      expect([home[1] - home[0], home[2] - home[0]]).toEqual([['Dorian', 'Phrygian'].includes(mode) ? 3 : 4, 7])
    }
  })

  it('plays a vamp twice and names its mode from home and where the second chord goes', () => {
    const MINOR_STEP: Record<number, string> = { 5: 'Dorian', 1: 'Phrygian' }
    const MAJOR_STEP: Record<number, string> = { 10: 'Mixolydian', 2: 'Lydian' }
    const seen = new Set<string>()
    for (const rng of seeds) {
      const q = asPick(makeVampHear(1, ['dorian', 'mixolydian', 'lydian', 'phrygian'], rng))
      expect(q.ask.text).toBe('Which mode does this vamp sound like?')
      expect(q.options).toEqual(['Lydian', 'Mixolydian', 'Dorian', 'Phrygian'])
      const n = q.listen!.notes
      expect(q.listen!.chord).toBe(3)
      expect(n.slice(6)).toEqual(n.slice(0, 6))
      expect([n[4] - n[3], n[5] - n[3]]).toEqual([4, 7])
      const step = (n[3] - n[0] + 12) % 12
      expect(chosen(q)).toBe(n[1] - n[0] === 3 ? MINOR_STEP[step] : MAJOR_STEP[step])
      expect(q.facts).toEqual([`ear:vamp-${(chosen(q) as string).toLowerCase()}`])
      seen.add(chosen(q) as string)
    }
    expect(seen.size).toBe(4)
  })
})

describe('every mode fact', () => {
  it('comes back in review, with a label and the tape that taught it', () => {
    const tapes: Record<string, number> = {
      ...Object.fromEntries(MODES.map((m) => [`mode:${m}`, 63])),
      ...Object.fromEntries(MODES.filter((m) => m !== 'ionian').map((m) => [`modek:${m}`, 63])),
      'modec:lydian': 64,
      'modec:locrian': 64,
      'modesp:phrygian': 64,
      'moden:aeolian': 65,
      'modeh:locrian': 65,
      'modev:dorian': 65,
      'modeneck:mixolydian': 66,
      'ear:dorian': 67,
      'ear:phrygian': 67,
      'ear:vamp-dorian': 67,
      'ear:vamp-lydian': 67,
    }
    for (const [fact, tape] of Object.entries(tapes)) {
      expect(tapeOf(fact), fact).toBe(tape)
      expect(theoryReview(fact, 1, seeded(1)), fact).not.toBeNull()
      expect(describeFact(fact), fact).not.toMatch(/undefined|mode:|modek:/)
    }
    expect(describeFact('mode:lydian')).toBe('Lydian, the mode on the 4th note')
    expect(describeFact('modek:dorian')).toBe('Dorian in any key')
    expect(describeFact('modec:locrian')).toBe('Locrian’s color notes')
    expect(describeFact('ear:lydian')).toBe('Hearing Lydian')
    expect(describeFact('ear:vamp-dorian')).toBe('Hearing the Dorian vamp')
    for (const junk of ['mode:blues', 'mode:', 'modek:ionian', 'modek:x', 'modec:ionian', 'modev:locrian', 'modeneck:ionian', 'ear:ionian', 'ear:vamp-ionian', 'ear:vamp-']) expect(theoryReview(junk, 1, seeded(1)), junk).toBeNull()
  })

  it('counts toward the Scales & keys meter', () => {
    const stat = { seen: 1, correct: 1, recent: 1, ms: 1000, interval: 1 }
    const meters = skillMeters({ 'mode:dorian': stat, 'modek:lydian': stat, 'modec:dorian': stat, 'modeneck:lydian': stat, 'ear:dorian': stat })
    expect(meters.find((m) => m.label === 'Scales & keys')!.practiced).toBe(4)
    expect(meters.find((m) => m.label === 'Ear')!.practiced).toBe(1)
  })

  it('explains why modes matter, and what one is, before the first question', () => {
    const steps = buildRehearsal('md1-1', seeded(1))!.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))
    expect(steps).toEqual(['Why modes', 'What a mode is', 'Seven modes', 'check', 'ready'])
  })
})
