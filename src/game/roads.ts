import type { Card } from './rehearsal'
import type { LessonSpec } from '../music/curriculum'
import { spelledMidi, WRITTEN_OCTAVE_SHIFT, type Letter } from '../music/notes'
import type { RoadSigns, ScoreMeasure } from '../music/score'
import { between, pick, shuffle, type Rng } from '../lib/random'
import { isOneOf } from '../lib/guards'
import type { Question } from './questions'

/**
 * Road signs: repeat signs, 1st and 2nd endings, D.C. and D.S., Fine and the coda. Each question
 * shows a short score with every measure numbered and asks the route through it: the order its
 * measures are played in, or where to go after one of them.
 */

type RoadKind = 'repeat' | 'repeat-pair' | 'endings' | 'dc-fine' | 'ds-fine' | 'dc-coda' | 'ds-coda'
const ROAD_KINDS: RoadKind[] = ['repeat', 'repeat-pair', 'endings', 'dc-fine', 'ds-fine', 'dc-coda', 'ds-coda']
const knownRoads = (kinds: string[]) => {
  const own = kinds.filter((k): k is RoadKind => isOneOf(k, ROAD_KINDS))
  return own.length ? own : ROAD_KINDS.slice(0, 1)
}

/** from, from + 1, … to */
const run = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
/** The signs over each of `n` measures, numbered from 1. */
const signsOf = (n: number, at: Record<number, RoadSigns>) => Array.from({ length: n }, (_, i) => at[i + 1])

/** A route through a short score: the signs over each measure, the order they're played in, the usual misreadings, and why. */
interface Road {
  signs: (RoadSigns | undefined)[]
  order: number[]
  wrong: number[][]
  why: string
}

function roadFor(kind: RoadKind, rng: Rng): Road {
  switch (kind) {
    case 'repeat': {
      const n = between(3, 4, rng)
      const k = between(2, n - 1, rng)
      const order = [...run(1, k), ...run(1, k), ...run(k + 1, n)]
      return {
        signs: signsOf(n, { [k]: { repeatEnd: true }, [n]: { final: true } }),
        order,
        // Misreadings: no repeat, repeating only the measure with the sign, repeating it all, repeating twice.
        wrong: [run(1, n), [...run(1, k), k, ...run(k + 1, n)], [...run(1, n), ...run(1, n)], [...run(1, k), ...run(1, k), ...run(1, k), ...run(k + 1, n)]],
        why: `The repeat sign at the end of measure ${k} sends you back to the start, once: ${order.join(' ')}.`,
      }
    }
    case 'repeat-pair': {
      const n = between(4, 5, rng)
      const s = between(2, n - 2, rng)
      const e = between(s + 1, n - 1, rng)
      const order = [...run(1, e), ...run(s, e), ...run(e + 1, n)]
      return {
        signs: signsOf(n, { [s]: { repeatStart: true }, [e]: { repeatEnd: true }, [n]: { final: true } }),
        order,
        // Misreadings: back to the start instead of the facing sign, no repeat, repeating twice.
        wrong: [[...run(1, e), ...run(1, e), ...run(e + 1, n)], run(1, n), [...run(1, e), ...run(s, e), ...run(s, e), ...run(e + 1, n)]],
        why: `The repeat sign at the end of measure ${e} sends you back to the facing sign in measure ${s}, not the start: ${order.join(' ')}.`,
      }
    }
    case 'endings': {
      const m = between(2, 3, rng)
      const n = m + 2
      const order = [...run(1, m), m + 1, ...run(1, m), n]
      return {
        signs: signsOf(n, { [m + 1]: { ending: 1, repeatEnd: true }, [n]: { ending: 2, final: true } }),
        order,
        // Misreadings: both endings the second time, skipping the 1st ending, straight through, the 1st ending twice.
        wrong: [[...run(1, m), m + 1, ...run(1, m), m + 1, n], [...run(1, m), n], run(1, n), [...run(1, m), m + 1, ...run(1, m), m + 1]],
        why: `Play the 1st ending, measure ${m + 1}, and go back. The second time, skip it and play the 2nd ending, measure ${n}: ${order.join(' ')}.`,
      }
    }
    case 'dc-fine': {
      const n = between(4, 5, rng)
      const f = between(2, n - 1, rng)
      const order = [...run(1, n), ...run(1, f)]
      return {
        signs: signsOf(n, { [f]: { mark: 'fine' }, [n]: { mark: 'dc-al-fine', final: true } }),
        order,
        // Misreadings: stopping at Fine the first time, ignoring Fine, ignoring the D.C.
        wrong: [run(1, f), [...run(1, n), ...run(1, n)], run(1, n)],
        why: `Fine only counts after the D.C.: play to the end, go back to the start, then stop at Fine in measure ${f}: ${order.join(' ')}.`,
      }
    }
    case 'ds-fine': {
      const s = between(2, 3, rng)
      const f = between(s + 1, 4, rng)
      const order = [...run(1, 5), ...run(s, f)]
      return {
        signs: signsOf(5, { [s]: { mark: 'segno' }, [f]: { mark: 'fine' }, 5: { mark: 'ds-al-fine', final: true } }),
        order,
        // Misreadings: back to the start instead of the sign, ignoring Fine, stopping at Fine the first time.
        wrong: [[...run(1, 5), ...run(1, f)], [...run(1, 5), ...run(s, 5)], run(1, f)],
        why: `D.S. al Fine sends you back to the sign in measure ${s}, not the start, then you stop at Fine in measure ${f}: ${order.join(' ')}.`,
      }
    }
    case 'dc-coda': {
      const t = between(2, 3, rng)
      const order = [...run(1, 4), ...run(1, t), 5]
      return {
        signs: signsOf(5, { [t]: { mark: 'to-coda' }, 4: { mark: 'dc-al-coda' }, 5: { mark: 'coda', final: true } }),
        order,
        // Misreadings: no jump at To Coda, jumping the first time, ignoring the D.C.
        wrong: [[...run(1, 4), ...run(1, 4), 5], [...run(1, t), 5], run(1, 5)],
        why: `D.C. al Coda sends you back to the start. To Coda only counts after that: at measure ${t}, jump to the coda, measure 5: ${order.join(' ')}.`,
      }
    }
    case 'ds-coda': {
      const [s, t] = pick([
        [1, 2],
        [1, 3],
        [2, 3],
      ], rng)
      const order = [...run(1, 4), ...run(s, t), 5]
      return {
        signs: signsOf(5, { [s]: { mark: 'segno' }, [t]: { mark: 'to-coda' }, 4: { mark: 'ds-al-coda' }, 5: { mark: 'coda', final: true } }),
        order,
        // Misreadings: back to the start instead of the sign, no jump at To Coda, jumping the first time, ignoring the D.S.
        wrong: [[...run(1, 4), ...run(1, t), 5], [...run(1, 4), ...run(s, 4), 5], [...run(1, t), 5], run(1, 5)],
        why: `D.S. al Coda sends you back to the sign in measure ${s}. To Coda only counts after that: at measure ${t}, jump to the coda, measure 5: ${order.join(' ')}.`,
      }
    }
  }
}

/** The notes the measures hold, one whole note each, all on the staff: E4 up to F5. */
const STAFF_NOTES: [Letter, number][] = [
  ['E', 4],
  ['F', 4],
  ['G', 4],
  ['A', 4],
  ['B', 4],
  ['C', 5],
  ['D', 5],
  ['E', 5],
  ['F', 5],
]
/** A whole note in each of `n` measures, never the same note twice in a row. */
function melody(n: number, rng: Rng): ScoreMeasure[] {
  let last = -1
  return Array.from({ length: n }, () => {
    last = pick(
      STAFF_NOTES.map((_, i) => i).filter((i) => i !== last),
      rng,
    )
    const [letter, octave] = STAFF_NOTES[last]
    return [{ letter, octave, dur: 'w' as const }]
  })
}
/** The route played quickly, a note per measure, so you can hear the trip. */
const routeSound = (measures: ScoreMeasure[], order: number[]) =>
  order.map((m) => {
    const n = measures[m - 1][0]
    return spelledMidi({ letter: n.letter, acc: 0, octave: n.octave }) - WRITTEN_OCTAVE_SHIFT
  })

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** "In what order are these measures played?" */
export function makeRoadOrder(id: number, kinds: string[], rng: Rng, only?: RoadKind): Question {
  const kind = only ?? pick(knownRoads(kinds), rng)
  const road = roadFor(kind, rng)
  const right = road.order.join(' ')
  const wrong = [...new Set(road.wrong.map((o) => o.join(' ')))].filter((o) => o !== right)
  const options = shuffle([right, ...shuffle(wrong, rng).slice(0, 3)], rng)
  const measures = melody(road.signs.length, rng)
  return {
    id,
    kind: 'roadOrder',
    ask: { text: 'In what order are these measures played?' },
    options,
    answer: options.indexOf(right),
    why: road.why,
    score: { measures, signs: road.signs },
    sound: routeSound(measures, road.order),
    facts: [`road:${kind}`],
  }
}

/** "After measure 4, where do you go?" (with "the first time" or "the second time" when it's played twice) */
export function makeRoadNext(id: number, kinds: string[], rng: Rng, only?: RoadKind): Question {
  const kind = only ?? pick(knownRoads(kinds), rng)
  const road = roadFor(kind, rng)
  const { order, signs } = road
  const n = signs.length
  // The measures where the route turns somewhere: back, ahead, or to a stop before the last measure.
  const turning = new Set(order.filter((m, i) => (i + 1 < order.length ? order[i + 1] !== m + 1 : m !== n)))
  const asks = order.map((_, i) => i).filter((i) => turning.has(order[i]) && !(i === order.length - 1 && order[i] === n))
  const i = pick(asks, rng)
  const at = order[i]
  const times = order.filter((m) => m === at).length
  const time = order.slice(0, i + 1).filter((m) => m === at).length
  const label = (m: number | null) => (m === null ? 'The end' : `Measure ${m}`)
  const right = label(i + 1 < order.length ? order[i + 1] : null)
  const marked = (mark: RoadSigns['mark']) => signs.findIndex((s) => s?.mark === mark) + 1 || null
  // Near misses: straight on, the start, the sign, the coda, the end, then any other measure.
  const near = [at < n ? at + 1 : null, 1, marked('segno'), marked('coda'), null, ...run(1, n)].map(label)
  const options = shuffle([right, ...[...new Set(near)].filter((o) => o !== right).slice(0, 3)], rng)
  const measures = melody(n, rng)
  return {
    id,
    kind: 'roadNext',
    ask: { text: `After measure ${at}${times > 1 ? `, the ${time === 1 ? 'first' : 'second'} time` : ''}, where do you go?` },
    options,
    answer: options.indexOf(right),
    why: road.why,
    score: { measures, signs },
    sound: routeSound(measures, order),
    facts: [`road:${kind}`],
  }
}

// ---------------------------------------------------------------------------
// Teaching, checks and review
// ---------------------------------------------------------------------------

/** Ideas in the order they're taught. */
export const ROAD_ORDER = ['signs:why', 'signs:repeat', 'signs:endings', 'signs:dc-fine', 'signs:ds-coda', 'signs:mix']
/** Explained on a card, not quizzed on their own. */
export const ROAD_INTRO = ['signs:why']

export const isRoadItem = (item: string) => item.startsWith('signs:')
/** Facts practiced on this tape: reading each kind of road map ("road:endings"). */
export const isRoadFact = (fact: string) => /^road:/.test(fact)

/** Each kind's idea, and its short name. */
const ROADS: Record<RoadKind, { item: string; name: string }> = {
  repeat: { item: 'signs:repeat', name: 'Repeat signs' },
  'repeat-pair': { item: 'signs:repeat', name: 'Repeat signs with |:' },
  endings: { item: 'signs:endings', name: '1st and 2nd endings' },
  'dc-fine': { item: 'signs:dc-fine', name: 'D.C. al Fine' },
  'ds-fine': { item: 'signs:mix', name: 'D.S. al Fine' },
  'dc-coda': { item: 'signs:mix', name: 'D.C. al Coda' },
  'ds-coda': { item: 'signs:ds-coda', name: 'D.S. al Coda' },
}
const kindOf = (fact: string) => {
  const [prefix, value] = fact.split(':')
  return prefix === 'road' && isOneOf(value, ROAD_KINDS) ? value : null
}

/** The idea a practiced fact belongs to, or null if it isn't one of these. */
export function roadItemFor(fact: string): string | null {
  const kind = kindOf(fact)
  return kind ? ROADS[kind].item : null
}

/** One question on a taught idea. `turn` alternates the order question with the where-next one. */
export function roadCheck(item: string, l: LessonSpec, turn: number, rng: Rng, id: number): Question | null {
  const make = turn % 2 === 0 ? makeRoadOrder : makeRoadNext
  switch (item) {
    case 'signs:repeat':
      // The very first track asks only for the order.
      return makeRoadOrder(id, l.roadSigns ?? ['repeat', 'repeat-pair'], rng)
    case 'signs:endings':
      return make(id, [], rng, 'endings')
    case 'signs:dc-fine':
      return make(id, [], rng, 'dc-fine')
    case 'signs:ds-coda':
      return make(id, [], rng, 'ds-coda')
    case 'signs:mix':
      return make(id, [], rng, pick<RoadKind>(['ds-fine', 'dc-coda'], rng))
    default:
      return null
  }
}

/** A review question on one fact, or null if it isn't one of these. */
export function roadReview(fact: string, id: number, rng: Rng): Question | null {
  const kind = kindOf(fact)
  return kind ? pick([makeRoadOrder, makeRoadNext], rng)(id, [], rng, kind) : null
}

/** "1st and 2nd endings", "D.S. al Coda"; null if it isn't one of these facts. */
export function describeRoadFact(fact: string): string | null {
  const kind = kindOf(fact)
  return kind ? ROADS[kind].name : null
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** The cards' scores: a whole note to a measure, climbing so each one is easy to tell apart. */
const cardMeasures = (n: number): ScoreMeasure[] => STAFF_NOTES.slice(2, 2 + n).map(([letter, octave]) => [{ letter, octave, dur: 'w' }])
const cardScore = (signs: (RoadSigns | undefined)[]) => ({ measures: cardMeasures(signs.length), signs })

const ROAD_CARDS: Record<string, () => Omit<Card, 'counter'>> = {
  'signs:why': () => ({
    title: 'Road signs',
    subtitle: 'The route through a song',
    hook: 'Songs repeat whole sections: a verse comes back, a chorus plays twice. Instead of writing them out again, sheet music uses road signs that send you back or ahead. On this tape every measure is numbered underneath, so you can follow the route: here it’s 1 2 1 2 3.',
    score: cardScore(signsOf(3, { 2: { repeatEnd: true }, 3: { final: true } })),
    sound: [],
  }),
  'signs:repeat': () => ({
    title: 'Repeat signs',
    subtitle: 'Back once, then on',
    hook: 'A repeat sign, two dots before a thick bar line, means go back and play that part again, once. Go back to the facing sign, |:, if there is one, as here: 1 2 3 2 3 4. With no facing sign, go back to the very start.',
    score: cardScore(signsOf(4, { 2: { repeatStart: true }, 3: { repeatEnd: true }, 4: { final: true } })),
    sound: [],
  }),
  'signs:endings': () => ({
    title: '1st and 2nd endings',
    subtitle: 'A different way out',
    hook: 'When a repeated part ends differently the second time, its endings are numbered. Play the 1st ending and go back. The second time through, skip the 1st ending and play the 2nd: 1 2 3 1 2 4.',
    score: cardScore(signsOf(4, { 3: { ending: 1, repeatEnd: true }, 4: { ending: 2, final: true } })),
    sound: [],
  }),
  'signs:dc-fine': () => ({
    title: 'D.C. al Fine',
    subtitle: 'Back to the start, stop at Fine',
    hook: 'D.C. is short for da capo, Italian for “from the head”: go back to the very start. D.C. al Fine means play from the start until you reach Fine, Italian for the end, and stop there. Fine only counts after the D.C.: 1 2 3 4 1 2.',
    score: cardScore(signsOf(4, { 2: { mark: 'fine' }, 4: { mark: 'dc-al-fine', final: true } })),
    sound: [],
  }),
  'signs:ds-coda': () => ({
    title: 'D.S. al Coda',
    subtitle: 'Back to the sign, then the coda',
    hook: 'D.S. is short for dal segno, “from the sign”: go back to the sign in measure 2, not the start. D.S. al Coda means play from there until To Coda, then jump ahead to the coda, the ending marked with the coda sign: 1 2 3 4 2 3 5. Like Fine, To Coda only counts after the jump back.',
    score: cardScore(signsOf(5, { 2: { mark: 'segno' }, 3: { mark: 'to-coda' }, 4: { mark: 'ds-al-coda' }, 5: { mark: 'coda', final: true } })),
    sound: [],
  }),
  'signs:mix': () => ({
    title: 'Mix and match',
    subtitle: 'D.S. al Fine and D.C. al Coda',
    hook: 'The words combine the same way. D.S. al Fine: back to the sign, then stop at Fine, as here: 1 2 3 4 5 2 3. D.C. al Coda: back to the start, then jump to the coda at To Coda. The first part says where to go back to; the second, how to finish.',
    score: cardScore(signsOf(5, { 2: { mark: 'segno' }, 3: { mark: 'fine' }, 5: { mark: 'ds-al-fine', final: true } })),
    sound: [],
  }),
}

/** The card that teaches an idea from this tape. */
export function roadCard(item: string, counter: string): Card {
  return { ...ROAD_CARDS[item](), counter }
}
