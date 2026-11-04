import type { Rng } from '../game/questions'

/** Rhythm vocabulary: the note values, rests and markings a beginner learns, in method-book order. */
export type SymbolId =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'dottedHalf'
  | 'dottedQuarter'
  | 'wholeRest'
  | 'halfRest'
  | 'quarterRest'
  | 'tie'

export type Meter = '4/4' | '3/4' | '2/4' | '2/2'

/** Length of a measure in quarter notes. */
export const METER_QUARTERS: Record<Meter, number> = { '4/4': 4, '3/4': 3, '2/4': 2, '2/2': 4 }

/**
 * The beat you count and tap: how many per measure, and how long each one lasts in quarter notes.
 * Cut time (2/2) counts half notes, so its quarter notes land on the "&".
 */
export const METER_PULSE: Record<Meter, { beats: number; quarters: number }> = {
  '4/4': { beats: 4, quarters: 1 },
  '3/4': { beats: 3, quarters: 1 },
  '2/4': { beats: 2, quarters: 1 },
  '2/2': { beats: 2, quarters: 2 },
}

/** How a time signature is named in prompts. */
export const METER_NAME: Record<Meter, string> = { '4/4': '4/4', '3/4': '3/4', '2/4': '2/4', '2/2': 'cut time' }

/** One note or rest in a measure. */
export interface RhythmEvent {
  dur: 'w' | 'h' | 'q' | '8'
  dots: 0 | 1
  rest: boolean
  /** Tied to the next note: play once, hold through both. */
  tie?: boolean
}

export interface Measure {
  meter: Meter
  events: RhythmEvent[]
}

interface SymbolInfo {
  name: string
  beats: number
  /** The event this symbol stands for (ties have none; they join two notes). */
  event?: RhythmEvent
}

export const note = (dur: RhythmEvent['dur'], dots: 0 | 1 = 0, tie = false): RhythmEvent => ({ dur, dots, rest: false, ...(tie ? { tie } : {}) })
export const rest = (dur: RhythmEvent['dur']): RhythmEvent => ({ dur, dots: 0, rest: true })

export const SYMBOLS: Record<SymbolId, SymbolInfo> = {
  whole: { name: 'Whole note', beats: 4, event: note('w') },
  half: { name: 'Half note', beats: 2, event: note('h') },
  quarter: { name: 'Quarter note', beats: 1, event: note('q') },
  eighth: { name: 'Eighth note', beats: 0.5, event: note('8') },
  dottedHalf: { name: 'Dotted half note', beats: 3, event: note('h', 1) },
  dottedQuarter: { name: 'Dotted quarter note', beats: 1.5, event: note('q', 1) },
  wholeRest: { name: 'Whole rest', beats: 4, event: rest('w') },
  halfRest: { name: 'Half rest', beats: 2, event: rest('h') },
  quarterRest: { name: 'Quarter rest', beats: 1, event: rest('q') },
  tie: { name: 'Tie', beats: 0 },
}

/** Symbols that can be shown on their own and named. */
export const NAMEABLE: SymbolId[] = ['whole', 'half', 'quarter', 'eighth', 'dottedHalf', 'dottedQuarter', 'wholeRest', 'halfRest', 'quarterRest']

const DUR_QUARTERS = { w: 4, h: 2, q: 1, '8': 0.5 }
/** How long an event lasts, in quarter notes (the same as beats in 4/4, 3/4 and 2/4). */
export const eventQuarters = (e: RhythmEvent) => DUR_QUARTERS[e.dur] * (e.dots ? 1.5 : 1)
export const measureQuarters = (m: Measure) => m.events.reduce((sum, e) => sum + eventQuarters(e), 0)

export function symbolOf(e: RhythmEvent): SymbolId {
  const id = NAMEABLE.find((s) => {
    const ev = SYMBOLS[s].event!
    return ev.dur === e.dur && ev.dots === e.dots && ev.rest === e.rest
  })
  if (!id) throw new Error(`No symbol for ${JSON.stringify(e)}`)
  return id
}

/** Where each event starts, in quarter notes from the start of the measure (0 = beat 1). */
export function onsets(m: Measure): number[] {
  let t = 0
  return m.events.map((e) => {
    const start = t
    t += eventQuarters(e)
    return start
  })
}

/** Events you'd actually play: not rests, and not the second half of a tie. */
export function playedIndexes(m: Measure): number[] {
  return m.events.flatMap((e, i) => (e.rest || (i > 0 && m.events[i - 1].tie) ? [] : [i]))
}

/** Which beat a position (in quarter notes) falls on, 0-based: 1.5 in 4/4 is halfway through beat 2. */
const beatAt = (position: number, meter: Meter) => position / METER_PULSE[meter].quarters

/** "1", "&", "2"…: what you'd say at a position (in quarter notes from the start of the measure). */
export function countAt(position: number, meter: Meter = '4/4'): string {
  const beat = beatAt(position, meter)
  return Number.isInteger(beat) ? String(beat + 1) : '&'
}

/** "beat 3" / "the & of 2". */
export function countName(position: number, meter: Meter = '4/4'): string {
  const beat = beatAt(position, meter)
  return Number.isInteger(beat) ? `beat ${beat + 1}` : `the & of ${Math.floor(beat) + 1}`
}

export function beatsText(beats: number): string {
  if (beats === 0.5) return 'half a beat'
  const whole = Math.floor(beats)
  const text = beats % 1 ? `${whole}½` : String(whole)
  return `${text} beat${beats === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// Generating measures
// ---------------------------------------------------------------------------

/** A building block of a measure, with the beats it may start on (beginner rhythms avoid syncopation). */
interface Unit {
  events: RhythmEvent[]
  needs: SymbolId[]
  starts: Record<Meter, number[]>
}

const ANY4 = [0, 1, 2, 3]
const ANY3 = [0, 1, 2]
const ANY2 = [0, 1]

// Start positions are in quarter notes. Cut time leaves out eighths (they'd be quarter-beats there).
const UNITS: Unit[] = [
  { events: [note('w')], needs: ['whole'], starts: { '4/4': [0], '3/4': [], '2/4': [], '2/2': [0] } },
  { events: [rest('w')], needs: ['wholeRest'], starts: { '4/4': [0], '3/4': [], '2/4': [], '2/2': [0] } },
  { events: [note('h', 1)], needs: ['dottedHalf'], starts: { '4/4': [0, 1], '3/4': [0], '2/4': [], '2/2': [0] } },
  { events: [note('h')], needs: ['half'], starts: { '4/4': [0, 2], '3/4': [0, 1], '2/4': [0], '2/2': [0, 2] } },
  { events: [rest('h')], needs: ['halfRest'], starts: { '4/4': [0, 2], '3/4': [0, 1], '2/4': [0], '2/2': [0, 2] } },
  { events: [note('q')], needs: ['quarter'], starts: { '4/4': ANY4, '3/4': ANY3, '2/4': ANY2, '2/2': ANY4 } },
  { events: [rest('q')], needs: ['quarterRest'], starts: { '4/4': ANY4, '3/4': ANY3, '2/4': ANY2, '2/2': ANY4 } },
  { events: [note('8'), note('8')], needs: ['eighth'], starts: { '4/4': ANY4, '3/4': ANY3, '2/4': ANY2, '2/2': [] } },
  {
    events: [note('q', 1), note('8')],
    needs: ['dottedQuarter', 'eighth'],
    starts: { '4/4': [0, 1, 2], '3/4': [0, 1], '2/4': [0], '2/2': [] },
  },
  // A quarter tied across the middle of the bar, the classic place beginners meet ties.
  { events: [{ ...note('q'), tie: true }, note('q')], needs: ['tie', 'quarter'], starts: { '4/4': [1], '3/4': [1], '2/4': [], '2/2': [1] } },
]

/**
 * A random one-measure rhythm using only `allowed` symbols. Symbols in `focus` are favored,
 * and at least one of them appears when possible.
 */
export function randomMeasure(meter: Meter, allowed: SymbolId[], rng: Rng, focus: SymbolId[] = []): Measure {
  const total = METER_QUARTERS[meter]
  const usable = UNITS.filter((u) => u.needs.every((s) => allowed.includes(s)))
  let best: Measure | null = null
  for (let attempt = 0; attempt < 40; attempt++) {
    const events: RhythmEvent[] = []
    const used = new Set<SymbolId>()
    let pos = 0
    while (pos < total) {
      const fits = usable.filter((u) => u.starts[meter].includes(pos) && u.events.reduce((s, e) => s + eventQuarters(e), 0) <= total - pos)
      if (fits.length === 0) {
        events.push(note('q'))
        pos += 1
        continue
      }
      const weights = fits.map((u) => (u.needs.some((s) => focus.includes(s)) ? 3 : 1))
      let r = rng() * weights.reduce((a, b) => a + b, 0)
      let unit = fits[fits.length - 1]
      for (let i = 0; i < fits.length; i++) {
        r -= weights[i]
        if (r <= 0) {
          unit = fits[i]
          break
        }
      }
      events.push(...unit.events.map((e) => ({ ...e })))
      unit.needs.forEach((s) => used.add(s))
      pos += unit.events.reduce((s, e) => s + eventQuarters(e), 0)
    }
    const m: Measure = { meter, events }
    // Something to play, and (ideally) the new idea in it.
    if (playedIndexes(m).length === 0) continue
    best = m
    if (focus.length === 0 || focus.some((s) => used.has(s))) return m
  }
  return best ?? { meter, events: Array.from({ length: total }, () => note('q')) }
}
