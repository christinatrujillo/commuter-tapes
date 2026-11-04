import { describe, expect, it } from 'vitest'
import { asPick, asTap, chosen, inRegion, seeded } from '../test-helpers'
import { findLesson } from '../music/curriculum'
import { FULL_NECK, midiAt, pitchClass, spelledMidi } from '../music/notes'
import { KEY_ORDER, KEYS, resolveNotes } from '../music/score'
import { majorKeyOfMinor, majorScale, naturalMinorScale, relativeMinor, toneId, toneName } from '../music/theory'
import { buildRehearsal } from './rehearsal'
import { buildReview, tapeOf } from './review'
import {
  makeDegreeFind,
  makeDegreeName,
  makeKeySignature,
  makeMinorNote,
  makeRelativeFind,
  makeRelativeKey,
  makeScaleNote,
  makeScaleStep,
  makeStepFind,
  makeStepNote,
  makeStepRead,
  makeStepSize,
  theoryReview,
} from './theory'

const names = (key: Parameters<typeof majorScale>[0]) => majorScale(key).map(toneName).join(' ')
const seeds = Array.from({ length: 40 }, (_, i) => seeded(i + 1))

describe('scales and keys', () => {
  it('spells major scales with one of each letter', () => {
    expect(names('C')).toBe('C D E F G A B')
    expect(names('F')).toBe('F G A B♭ C D E')
    expect(names('E')).toBe('E F♯ G♯ A B C♯ D♯')
    expect(names('C#')).toBe('C♯ D♯ E♯ F♯ G♯ A♯ B♯')
    expect(names('Cb')).toBe('C♭ D♭ E♭ F♭ G♭ A♭ B♭')
  })

  it('has key signatures that match each major scale', () => {
    for (const key of KEY_ORDER) {
      const altered = Object.fromEntries(majorScale(key).filter((t) => t.acc !== 0).map((t) => [t.letter, t.acc]))
      expect(KEYS[key].altered).toEqual(altered)
    }
    expect(KEYS.Eb.signature).toBe('three flats: B♭, E♭ and A♭')
    expect(KEYS.A.count).toBe(3)
    expect(KEYS.Gb.count).toBe(-6)
  })

  it('finds relative minors and their scales', () => {
    expect(['C', 'G', 'F', 'Bb', 'F#', 'Cb'].map((k) => toneName(relativeMinor(k as never)))).toEqual(['A', 'E', 'D', 'G', 'D♯', 'A♭'])
    expect(naturalMinorScale('C').map(toneName).join(' ')).toBe('A B C D E F G')
    expect(naturalMinorScale('G').map(toneName).join(' ')).toBe('E F♯ G A B C D')
    expect(majorKeyOfMinor('E')).toBe('G')
    expect(majorKeyOfMinor(toneId(relativeMinor('Bb')))).toBe('Bb')
  })
})

describe('theory questions', () => {
  it('measures half and whole steps on the neck', () => {
    for (const rng of seeds) {
      const size = asPick(makeStepSize(1, FULL_NECK, rng))
      const [a, b] = size.board!.markers.map((m) => m.pos)
      expect(a.string).toBe(b.string)
      expect(chosen(size)).toBe(Math.abs(a.fret - b.fret) === 1 ? 'Half step' : 'Whole step')
      for (const m of size.board!.markers) expect(inRegion(m.pos, size.board!.region)).toBe(true)

      const find = asTap(makeStepFind(1, FULL_NECK, rng))
      const up = find.ask.text.includes('above') ? 1 : -1
      const semis = find.ask.text.includes('half') ? 1 : 2
      expect(find.targets).toEqual([{ string: find.from.string, fret: find.from.fret + up * semis }])
      expect(inRegion(find.targets[0], find.region)).toBe(true)
    }
  })

  it('reads steps on the staff, where only E–F and B–C are half steps', () => {
    for (const rng of seeds) {
      const q = asPick(makeStepRead(1, rng))
      const [x, y] = resolveNotes(q.score!.measures)
      expect(chosen(q)).toBe(Math.abs(spelledMidi(x) - spelledMidi(y)) === 1 ? 'Half step' : 'Whole step')
    }
  })

  it('names the note a step away', () => {
    expect(asPick(makeStepNote(1, () => 0.99, 2)).ask.text).toBe('What’s a whole step below C♯?')
    for (const rng of seeds) {
      const q = asPick(makeStepNote(1, rng))
      const [from, to] = q.sound
      expect(q.answer).toBe(pitchClass(to))
      expect(Math.abs(to - from)).toBe(q.ask.text.includes('half') ? 1 : 2)
    }
  })

  it('knows the steps of the major scale', () => {
    const steps = [2, 2, 1, 2, 2, 2, 1]
    for (let d = 1; d <= 7; d++) {
      const q = asPick(makeScaleStep(1, seeded(d), d))
      expect(chosen(q)).toBe(steps[d - 1] === 1 ? 'Half step' : 'Whole step')
      expect(q.sound[1] - q.sound[0]).toBe(steps[d - 1])
    }
  })

  it('spells scale notes, with the other spelling as a wrong choice', () => {
    for (const rng of seeds) {
      for (const key of ['F', 'Bb', 'E', 'Db'] as const) {
        const q = asPick(makeScaleNote(1, [key], rng))
        const d = Number(q.ask.text.match(/(\d)/)![1])
        expect(chosen(q)).toBe(toneName(majorScale(key)[d - 1]))
        expect(new Set(q.options).size).toBe(4)
        const minor = asPick(makeMinorNote(1, [key], rng))
        const md = Number(minor.ask.text.match(/(\d)/)![1])
        expect(chosen(minor)).toBe(toneName(naturalMinorScale(key)[md - 1]))
      }
    }
    // F major's 4th: B♭, with A♯ offered as the classic mistake.
    for (const rng of seeds) {
      const q = asPick(makeScaleNote(1, ['F'], rng))
      if (q.ask.text.includes('4th')) {
        expect(q.options).toContain('A♯')
        expect(q.why).toContain('not A♯')
      }
    }
  })

  it('finds scale degrees in the patterns on the neck', () => {
    for (const rng of seeds) {
      for (const strings of [[0], [1]]) {
        const name = asPick(makeDegreeName(1, strings, rng))
        const root = name.board!.markers.find((m) => m.tone === 'root')!.pos
        const target = name.board!.markers.find((m) => m.tone === 'target')!.pos
        expect(root.string).toBe(strings[0])
        const semis = pitchClass(midiAt(target) - midiAt(root))
        expect([0, 2, 4, 5, 7, 9, 11][name.answer]).toBe(semis)
        for (const m of name.board!.markers) expect(inRegion(m.pos, name.board!.region)).toBe(true)

        const find = asTap(makeDegreeFind(1, strings, rng))
        const d = Number(find.label)
        expect(find.targets.length).toBeGreaterThan(0)
        for (const t of find.targets) {
          expect(pitchClass(midiAt(t) - midiAt(find.from))).toBe([0, 2, 4, 5, 7, 9, 11][d - 1])
          expect(inRegion(t, find.region)).toBe(true)
        }
      }
    }
  })

  it('counts sharps and flats, and finds relative keys', () => {
    for (const rng of seeds) {
      const sig = asPick(makeKeySignature(1, KEY_ORDER, rng))
      const key = KEY_ORDER.find((k) => sig.facts[0] === `key:${k}`)!
      const n = Math.abs(KEYS[key].count)
      expect(chosen(sig)).toBe(n === 0 ? 'No sharps or flats' : `${n} ${KEYS[key].count > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`)
      expect(new Set(sig.options).size).toBe(sig.options.length)

      const rel = asPick(makeRelativeKey(1, ['C', 'G', 'D', 'F', 'Bb', 'Eb'], rng))
      const k = rel.facts[0].slice(4) as 'C'
      expect(chosen(rel)).toBe(rel.ask.text.includes('relative minor') ? `${toneName(relativeMinor(k))} minor` : KEYS[k].name)
      expect(new Set(rel.options).size).toBe(4)

      const find = asTap(makeRelativeFind(1, FULL_NECK, rng))
      expect(find.targets).toEqual([{ string: find.from.string, fret: find.from.fret - 3 }])
    }
  })
})

describe('teaching and reviewing theory', () => {
  it('teaches each new idea on a card before checking it', () => {
    const steps = buildRehearsal('t1-1', seeded(1))!
    expect(steps.mode).toBe('learn')
    expect(steps.steps.filter((s) => s.kind === 'card').map((s) => s.kind === 'card' && s.card.title)).toEqual(['Half step', 'Whole step'])
    const sharps = buildRehearsal('t4-1', seeded(1))!
    const cards = sharps.steps.flatMap((s) => (s.kind === 'card' ? [s.card] : []))
    expect(cards.map((c) => c.title)).toEqual(['Sharp keys'])
    expect(cards[0].circle?.majors).toContain('C#')
    // Review tracks and the all-keys track have nothing new.
    for (const id of ['t1-4', 't2-4', 't3-3', 't4-3', 't5-4']) expect(buildRehearsal(id, seeded(1))!.mode).toBe('warmup')
  })

  it('checks each idea with questions about it', () => {
    for (const id of ['t1-2', 't2-3', 't3-2', 't5-2']) {
      const plan = buildRehearsal(id, seeded(3))!
      const checks = plan.steps.flatMap((s) => (s.kind === 'check' ? s.questions : []))
      expect(checks.length).toBeGreaterThan(0)
      const lesson = findLesson(id)!.lesson
      for (const q of checks) expect(lesson.exercises).toContain(q.kind)
    }
  })

  it('brings theory facts back for review, tagged with their tape', () => {
    const facts = ['step:half', 'scale:formula', 'scale:G', 'degree:5', 'key:A', 'rel:G', 'minor:E']
    expect(facts.map(tapeOf)).toEqual([22, 23, 23, 24, 26, 27, 27])
    for (const fact of facts) {
      const q = theoryReview(fact, 1, seeded(2))
      expect(q, fact).not.toBeNull()
      expect(q!.facts).toEqual([fact])
    }
    const stats = Object.fromEntries(facts.map((f) => [f, { seen: 3, correct: 3, recent: 1, ms: 2000, interval: 3, due: '2026-01-01' }]))
    const review = buildReview(stats, '2026-02-01', 10, seeded(4))
    expect(review).toHaveLength(facts.length)
    for (const q of review) expect(q.review?.tape).toBeGreaterThan(21)
  })

  it('leaves the reading keys to their own review questions', () => {
    expect(theoryReview('key:G', 1, seeded(1))).toBeNull()
  })
})
