import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../music/curriculum'
import { midiAt, pitchClass, spelledMidi, type Position, type Region } from '../music/notes'
import { buildRehearsal, type Card, type Rehearsal } from './rehearsal'

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inRegion = (p: Position, r: Region) => r.strings.includes(p.string) && p.fret >= r.minFret && p.fret <= r.maxFret
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
  it('starts the shelf with note values, two at a time', () => {
    const plan = buildRehearsal('r1-1', seeded(1))!
    expect(plan.mode).toBe('learn')
    expect(cards(plan).map((x) => x.title)).toEqual(['Whole note', 'Half note', 'Quarter note', '4/4 time'])
    expect(plan.steps.map((s) => s.kind)).toEqual(['card', 'card', 'check', 'card', 'card', 'check', 'check', 'ready'])
    // Each rhythm card shows a measure with its counts written underneath, and plays it.
    const half = cards(plan)[1]
    expect(half.notation?.labels).toEqual(['1 2', '3 4'])
    expect(half.rhythm).toBeTruthy()
  })

  it('teaches counting before full measures, and how tapping works', () => {
    expect(cards(buildRehearsal('r1-2', seeded(1))!).map((x) => x.title)).toEqual(['Counting', 'Full measures'])
    expect(cards(buildRehearsal('r1-3', seeded(1))!).map((x) => x.title)).toEqual(['Tapping rhythms'])
  })

  it('reads the 1st string in first position, with finger numbers', () => {
    const c = cards(buildRehearsal('r2-1', seeded(1))!)
    expect(c.map((x) => x.title)).toEqual(['E', 'F', 'G'])
    expect(c[0].hook).toContain('Spaces, bottom to top')
    expect(c[1].hook).toContain('Play it on the high E string, 1st fret. Use your 1st finger.')
    expect(c[2].subtitle).toBe('Just above the staff')
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
    for (const id of ['r2-2', 'r7-2', 'u1-3', 'u3-1', 'u8-5', 'u14-4']) {
      expect(buildRehearsal(id, seeded(1))!.mode).toBe('warmup')
    }
  })

  it('groups bigger sets of notes', () => {
    // Four of these spots were already learned by reading sharps and flats in first position.
    const sharps = buildRehearsal('u9-1', seeded(1))!
    expect(sharps.newCount).toBe(6)
    expect(cards(sharps)).toHaveLength(2)
    expect(cards(buildRehearsal('u11-1', seeded(1))!).map((x) => x.title)).toContain('Sharps & flats')
  })

  it('teaches interval shapes, including the bend at the B string', () => {
    expect(cards(buildRehearsal('u13-1', seeded(1))!).map((x) => x.hook)).toEqual(['2 strings over, 2 frets up.'])
    expect(cards(buildRehearsal('u13-2', seeded(1))!)[0].hook).toContain('3 frets up')
    expect(cards(buildRehearsal('u14-3', seeded(1))!)).toHaveLength(4)
  })
})
