import { describe, expect, it } from 'vitest'
import { inRegion, seeded } from '../test-helpers'
import { ALL_LESSONS } from '../music/curriculum'
import { midiAt, pitchClass, spelledMidi } from '../music/notes'
import { buildRehearsal, type Card, type Rehearsal } from './rehearsal'

const cards = (r: Rehearsal): Card[] => r.steps.flatMap((s) => (s.kind === 'card' ? [s.card] : []))

describe('every track has a rehearsal', () => {
  for (const lesson of ALL_LESSONS) {
    it(`${lesson.id} (${lesson.title})`, () => {
      for (let seed = 1; seed <= 10; seed++) {
        const plan = buildRehearsal(lesson.id, seeded(seed))!
        expect(plan.steps[plan.steps.length - 1].kind).toBe('ready')
        expect(cards(plan).length).toBeGreaterThan(0)
        for (const card of cards(plan)) {
          expect(card.title).toBeTruthy()
          expect(card.hook).toBeTruthy()
        }
        for (const step of plan.steps) {
          if (step.kind !== 'check') continue
          expect(step.questions.length).toBeGreaterThan(0)
          for (const q of step.questions) {
            switch (q.kind) {
              case 'name':
                expect(inRegion(q.target, lesson.region)).toBe(true)
                break
              case 'find':
              case 'findAll':
                expect(q.targets.length).toBeGreaterThan(0)
                for (const t of q.targets) expect(pitchClass(midiAt(t))).toBe(q.pc)
                break
              case 'staffFind':
                expect(q.targets.length).toBeGreaterThan(0)
                for (const t of q.targets) expect(midiAt(t)).toBe(spelledMidi(q.note) - 12)
                break
              case 'interval':
                for (const t of q.targets) expect(midiAt(t) - midiAt(q.root)).toBe(q.semitones)
                break
              default:
                break
            }
          }
        }
      }
    })
  }
})

describe('what gets taught', () => {
  it('starts the shelf with how music is written, then note values two at a time', () => {
    const plan = buildRehearsal('r1-1', seeded(1))!
    expect(plan.mode).toBe('learn')
    expect(cards(plan).map((x) => x.title)).toEqual(['How music is written', 'The beat', 'Measures and bar lines', 'Whole note', 'Half note', 'Quarter note', '4/4 time'])
    // The basics are explained, not quizzed; the checks come with the note values.
    expect(plan.steps.map((s) => s.kind)).toEqual(['card', 'card', 'card', 'card', 'card', 'check', 'card', 'card', 'check', 'check', 'ready'])
    // Each rhythm card shows a measure with its counts written underneath, and plays it.
    const half = cards(plan)[4]
    expect(half.notation?.labels).toEqual(['1 2', '3 4'])
    expect(half.rhythm).toBeTruthy()
  })

  it('teaches counting before full measures, and how tapping works', () => {
    expect(cards(buildRehearsal('r1-2', seeded(1))!).map((x) => x.title)).toEqual(['Counting', 'Full measures'])
    expect(cards(buildRehearsal('r1-3', seeded(1))!).map((x) => x.title)).toEqual(['Tapping rhythms'])
  })

  it('reads the 1st string in first position, with finger numbers', () => {
    const c = cards(buildRehearsal('r2-1', seeded(1))!)
    expect(c.map((x) => x.title)).toEqual(['The staff', 'The treble clef', 'E', 'F', 'G'])
    expect(c[2].hook).toContain('Spaces, bottom to top')
    expect(c[3].hook).toContain('Play it on the high E string, 1st fret. Use your 1st finger.')
    expect(c[4].subtitle).toBe('Just above the staff')
  })

  it('adds a rhythm idea with each string', () => {
    expect(cards(buildRehearsal('r3-2', seeded(1))!).map((x) => x.title)).toEqual(['Whole rest', 'Half rest', 'Quarter rest'])
    expect(cards(buildRehearsal('r4-2', seeded(1))!).map((x) => x.title)).toEqual(['Dotted half note', '3/4 time'])
    expect(cards(buildRehearsal('r5-2', seeded(1))!).map((x) => x.title)).toEqual(['Eighth note'])
    expect(cards(buildRehearsal('r6-2', seeded(1))!).map((x) => x.title)).toEqual(['Dotted quarter note', 'Tie'])
  })

  it('doesn’t re-teach notes already learned by reading them', () => {
    // E, F and G on the high E string came from reading tape 2; only A is new up the neck.
    expect(cards(buildRehearsal('u7-1', seeded(1))!).map((x) => x.title)).toEqual(['A'])
    const lowE = cards(buildRehearsal('u1-1', seeded(1))!)
    expect(lowE.map((x) => x.title)).toEqual(['A'])
    expect(lowE[0].hook).toContain('Same note as the open A string')
    expect(lowE[0].hook).toContain('Same fret as on the high E string')
  })

  it('teaches the high notes above the staff when reading up the neck', () => {
    const plan = buildRehearsal('u12-3', seeded(1))!
    expect(plan.mode).toBe('learn')
    // D above the staff comes one track earlier (7th position); E is the last new one.
    expect(cards(plan).map((x) => x.title)).toEqual(['E'])
    expect(cards(buildRehearsal('u12-2', seeded(1))!).map((x) => x.title)).toContain('D')
  })

  it('builds on earlier tracks', () => {
    const c = cards(buildRehearsal('u1-2', seeded(1))!)
    expect(c.map((x) => x.title)).toEqual(['E', 'B', 'C', 'D'])
    expect(c[1].hook).toContain('2 frets above A')
    expect(c[2].hook).toContain('One fret above B')
  })

  it('turns tracks with nothing new into a warm-up', () => {
    for (const id of ['r2-2', 'r7-2', 'u1-3', 'u3-2', 'u8-5', 'u14-4']) {
      expect(buildRehearsal(id, seeded(1))!.mode).toBe('warmup')
    }
  })

  it('opens tapes 11 and 28 by explaining what they’re for', () => {
    const low = buildRehearsal('u3-1', seeded(1))!
    expect(cards(low).map((x) => x.title)).toEqual(['Why these two strings', 'The 5th-fret link'])
    expect(low.steps.map((s) => s.kind)).toEqual(['card', 'card', 'ready'])
    const fifths = cards(buildRehearsal('u14-1', seeded(1))!)
    expect(fifths.map((x) => x.title).slice(0, 2)).toEqual(['What an interval is', 'Why shapes'])
    expect(fifths[3].hook).toContain('just as with octaves')
  })

  it('groups bigger sets of notes', () => {
    // Four of these spots were already learned by reading sharps and flats in first position.
    const sharps = buildRehearsal('u9-1', seeded(1))!
    expect(sharps.newCount).toBe(6)
    expect(cards(sharps)).toHaveLength(2)
    expect(cards(buildRehearsal('r8-1', seeded(1))!).map((x) => x.title)).toContain('Sharps & flats')
  })

  it('teaches sharps and flats in groups, then each rule for how long they last', () => {
    expect(cards(buildRehearsal('r8-1', seeded(1))!).map((x) => x.title)).toEqual(['Sharps & flats', 'Sharps & flats'])
    const rule = cards(buildRehearsal('r8-3', seeded(1))!)
    expect(rule.map((x) => x.title)).toEqual(['The measure rule', 'Natural sign', 'Bar lines reset'])
    // Worked examples point at the note that matters and name every note.
    expect(rule[0].score?.marker).toBe(2)
    expect(rule[0].score?.labels).toEqual(['F♯', 'G', 'F♯', 'E'])
    expect(rule[2].score?.labels).toEqual(['G', 'A', 'F♯', 'A', 'F', 'G'])
    expect(cards(buildRehearsal('r8-4', seeded(1))!).map((x) => x.title)).toEqual(['Same line or space only'])
  })

  it('teaches key signatures one at a time, then how to name them', () => {
    const g = cards(buildRehearsal('r9-1', seeded(1))!)
    expect(g.map((x) => x.title)).toEqual(['What a key is', 'Key of G'])
    expect(g[1].score?.labels).toEqual(['E', 'F♯', 'G', 'A'])
    expect(cards(buildRehearsal('r9-2', seeded(1))!).map((x) => x.title)).toEqual(['Key of D', 'Key of F'])
    expect(cards(buildRehearsal('r9-3', seeded(1))!).map((x) => x.title)).toEqual(['Key of C', 'Naming the key'])
    expect(buildRehearsal('r9-4', seeded(1))!.mode).toBe('warmup')
    expect(buildRehearsal('r10-4', seeded(1))!.mode).toBe('warmup')
  })

  it('teaches steps and skips before leaps, then phrases', () => {
    expect(cards(buildRehearsal('r10-1', seeded(1))!).map((x) => x.title)).toEqual(['Steps', 'Skips', 'Same note'])
    expect(cards(buildRehearsal('r10-2', seeded(1))!).map((x) => x.title)).toEqual(['Leaps'])
    expect(cards(buildRehearsal('r10-3', seeded(1))!).map((x) => x.title)).toEqual(['Reading phrases'])
  })

  it('teaches 2/4 and cut time', () => {
    expect(cards(buildRehearsal('r11-1', seeded(1))!).map((x) => x.title)).toEqual(['2/4 time'])
    const cut = cards(buildRehearsal('r11-2', seeded(1))!)
    expect(cut.map((x) => x.title)).toEqual(['Cut time (¢)'])
    expect(cut[0].notation?.labels).toEqual(['1', '2', '&'])
    expect(buildRehearsal('r11-3', seeded(1))!.mode).toBe('warmup')
  })

  it('explains octaves before their shapes, including the bend at the B string', () => {
    const first = cards(buildRehearsal('u13-1', seeded(1))!)
    expect(first.map((x) => x.title)).toEqual(['What an octave is', 'Why octaves matter', 'From the 6th and 5th strings'])
    expect(first[2].hook).toContain('2 frets up')
    expect(cards(buildRehearsal('u13-2', seeded(1))!)[0].hook).toContain('3 frets up')
    // An explanation on its own gets a card but no quiz.
    const eStrings = buildRehearsal('u13-3', seeded(1))!
    expect(eStrings.steps.map((s) => s.kind)).toEqual(['card', 'ready'])
    expect(cards(buildRehearsal('u14-3', seeded(1))!)).toHaveLength(4)
  })

  it('teaches relative minor from the why and the sound, with the scale to count on at first', () => {
    const plan = buildRehearsal('t5-1', seeded(1))!
    expect(plan.steps.map((s) => (s.kind === 'card' ? s.card.title : s.kind))).toEqual([
      'Why relative keys matter',
      'Major and minor',
      'Same notes, new home',
      'check',
      'ready',
    ])
    const checks = plan.steps.flatMap((s) => (s.kind === 'check' ? s.questions : []))
    for (const q of checks) expect(q.kind === 'relativeKey' && q.score?.labels?.length).toBe(8)
    // Later, only the key signature.
    const later = buildRehearsal('t5-5', seeded(1))!.steps.flatMap((s) => (s.kind === 'check' ? s.questions : []))
    for (const q of later) expect(q.kind === 'relativeKey' && q.score?.keySig && !q.score.labels).toBe(true)
  })
})
