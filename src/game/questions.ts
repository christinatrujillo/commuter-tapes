import type { ExerciseType, LessonSpec } from '../music/curriculum'
import {
  eventBeats,
  NAMEABLE,
  onsets,
  playedIndexes,
  randomMeasure,
  SYMBOLS,
  symbolOf,
  type Measure,
  type Meter,
  type SymbolId,
} from '../music/rhythm'
import {
  FULL_NECK,
  allPositions,
  isNatural,
  midiAt,
  parsePosKey,
  pcName,
  pitchClass,
  posKey,
  positionsForMidi,
  positionsForPc,
  spellMidi,
  WRITTEN_OCTAVE_SHIFT,
  type Position,
  type Region,
  type SpelledNote,
  type Spelling,
} from '../music/notes'

export interface FactStat {
  seen: number
  correct: number
  /** Recent accuracy, 0–1 (exponential moving average). */
  recent: number
  /** Recent response time in ms (exponential moving average). */
  ms: number
  /** Recent speed against the fluency target (moving average of time ÷ target): 1 = right on target, lower is faster. */
  pace?: number
}

export type Stats = Record<string, FactStat>

interface Base {
  id: number
  /** Stat keys this question practices: "string:fret" positions, "staff:<midi>", "iv:<semitones>". */
  facts: string[]
}

export type Question = Base &
  (
    | { kind: 'name'; target: Position; choices: 'naturals' | 'all'; region: Region }
    | { kind: 'find'; pc: number; label: string; string: number; targets: Position[]; region: Region }
    | { kind: 'findAll'; pc: number; label: string; targets: Position[]; region: Region }
    | { kind: 'staffName'; note: SpelledNote; choices: 'naturals' | 'all' }
    | { kind: 'staffFind'; note: SpelledNote; targets: Position[]; region: Region }
    | { kind: 'interval'; root: Position; semitones: number; targets: Position[]; region: Region }
    | { kind: 'intervalName'; root: Position; other: Position; semitones: number; options: number[]; region: Region }
    | { kind: 'symbolName'; symbol: SymbolId; options: SymbolId[] }
    | { kind: 'beats'; symbol: SymbolId; options: number[] }
    | { kind: 'measureFill'; measure: Measure; missing: number; options: SymbolId[] }
    | { kind: 'countBeat'; measure: Measure; beat: number; target: number }
    | { kind: 'tapRhythm'; measure: Measure; bpm: number }
  )

export type Rng = () => number

let nextId = 1
export const newQuestionId = () => nextId++

/**
 * How fast a correct answer has to be to count as fluent, by question type. Knowing a note
 * is only useful while playing if it's instant. "Find every copy" isn't timed (it's several taps).
 */
export const FLUENT_MS: Partial<Record<Question['kind'], number>> = {
  name: 2000,
  find: 2500,
  staffName: 2000,
  staffFind: 3000,
  interval: 3000,
  intervalName: 2500,
  symbolName: 2000,
  beats: 2500,
  measureFill: 4000,
  countBeat: 4000,
}

/** Facts never answered quickly count as slow. */
const paceOf = (stat: FactStat) => stat.pace ?? 2

export type Mastery = 'new' | 'learning' | 'accurate' | 'fluent'

/** learning = still getting it wrong; accurate = right but slow; fluent = right and fast, consistently. */
export function mastery(stat: FactStat | undefined): Mastery {
  if (!stat || stat.seen === 0) return 'new'
  if (stat.correct < 2 || stat.recent < 0.75) return 'learning'
  if (stat.correct >= 3 && paceOf(stat) <= 1) return 'fluent'
  return 'accurate'
}

/** How much a fact needs practice: 0 = solid, 1+ = shaky. Being slow counts, not just being wrong. */
export function weakness(stat: FactStat | undefined): number {
  if (!stat || stat.seen === 0) return 0.6
  return 1 - stat.recent + Math.min(0.5, Math.max(0, paceOf(stat) - 1) * 0.5)
}

const weightOf = (stats: Stats, keys: string[]) =>
  0.4 + 2 * Math.max(...keys.map((k) => weakness(stats[k])))

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

function weightedPick<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const weights = items.map(weight)
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

const randomSpelling = (rng: Rng): Spelling => (rng() < 0.5 ? 'sharp' : 'flat')
const written = (midi: number) => midi + WRITTEN_OCTAVE_SHIFT

/** Builds a lesson's questions. Weak notes (from past answers) come up more often. */
export function buildSession(spec: LessonSpec, stats: Stats, rng: Rng = Math.random): Question[] {
  const count = spec.count ?? 10
  const region = spec.region
  const pool = allPositions(region).filter((p) => spec.accidentals || isNatural(midiAt(p)))
  const choices = spec.accidentals ? 'all' : 'naturals'

  // Distinct pitches for staff exercises, limited to the lesson's written range.
  const staffMidis = [...new Set(pool.map(midiAt))].filter((m) => {
    if (!spec.writtenRange) return true
    const w = written(m)
    return w >= spec.writtenRange[0] && w <= spec.writtenRange[1]
  })

  const rootStrings = spec.rootStrings ?? region.strings
  const roots = pool.filter((p) => rootStrings.includes(p.string))
  const intervals = spec.intervals ?? [12]
  const findAllLimit = spec.exercises.every((e) => e === 'findAll') ? count : Math.ceil(count / 4)
  let findAllUsed = 0
  const symbols = spec.symbols ?? []
  const meters = spec.meters ?? ['4/4']
  const nameable = NAMEABLE.filter((s) => symbols.includes(s))
  const pickSymbol = () => weightedPick(nameable, (s) => weightOf(stats, [`sym:${s}`]), rng)

  const make = (kind: ExerciseType): Question | null => {
    const id = newQuestionId()
    switch (kind) {
      case 'name': {
        const target = weightedPick(pool, (p) => weightOf(stats, [posKey(p)]), rng)
        return { id, kind, target, choices, region, facts: [posKey(target)] }
      }
      case 'find': {
        const p = weightedPick(pool, (q) => weightOf(stats, [posKey(q)]), rng)
        const pc = pitchClass(midiAt(p))
        const targets = positionsForPc(pc, { ...region, strings: [p.string] })
        const label = pcName(pc, randomSpelling(rng))
        return { id, kind, pc, label, string: p.string, targets, region, facts: targets.map(posKey) }
      }
      case 'findAll': {
        if (findAllUsed >= findAllLimit) return null
        const pcs = [...new Set(pool.map((p) => pitchClass(midiAt(p))))]
        const pc = weightedPick(pcs, (c) => weightOf(stats, positionsForPc(c, region).map(posKey)), rng)
        const targets = positionsForPc(pc, region)
        if (targets.length < 2) return null
        return { id, kind, pc, label: pcName(pc, randomSpelling(rng)), targets, region, facts: targets.map(posKey) }
      }
      case 'staffName': {
        if (staffMidis.length === 0) return null
        const midi = weightedPick(staffMidis, (m) => weightOf(stats, [`staff:${written(m)}`]), rng)
        const note = spellMidi(written(midi), randomSpelling(rng))
        return { id, kind, note, choices, facts: [`staff:${written(midi)}`] }
      }
      case 'staffFind': {
        if (staffMidis.length === 0) return null
        const midi = weightedPick(
          staffMidis,
          (m) => weightOf(stats, [`staff:${written(m)}`, ...positionsForMidi(m, region).map(posKey)]),
          rng,
        )
        const note = spellMidi(written(midi), randomSpelling(rng))
        const targets = positionsForMidi(midi, region)
        return { id, kind, note, targets, region, facts: [`staff:${written(midi)}`, ...targets.map(posKey)] }
      }
      case 'interval': {
        const semitones = pick(intervals, rng)
        const root = pick(roots, rng)
        const targets = positionsForMidi(midiAt(root) + semitones, region)
        if (targets.length === 0) return null
        return { id, kind, root, semitones, targets, region, facts: [`iv:${semitones}`] }
      }
      case 'intervalName': {
        const semitones = pick(intervals, rng)
        const root = pick(roots, rng)
        const all = positionsForMidi(midiAt(root) + semitones, region)
        // Prefer the compact shape players actually use: a higher string, within a few frets.
        const near = all.filter((p) => p.string > root.string && Math.abs(p.fret - root.fret) <= 3)
        if (all.length === 0) return null
        const other = pick(near.length ? near : all, rng)
        return { id, kind, root, other, semitones, options: [...intervals].sort((a, b) => a - b), region, facts: [`iv:${semitones}`] }
      }
      case 'symbolName': {
        if (nameable.length < 2) return null
        const symbol = pickSymbol()
        const others = shuffle(nameable.filter((s) => s !== symbol), rng).slice(0, 5)
        const options = NAMEABLE.filter((s) => s === symbol || others.includes(s))
        return { id, kind, symbol, options, facts: [`sym:${symbol}`] }
      }
      case 'beats': {
        if (nameable.length === 0) return null
        const symbol = pickSymbol()
        const options = [...new Set([1, 2, 4, ...nameable.map((s) => SYMBOLS[s].beats)])].sort((a, b) => a - b)
        return { id, kind, symbol, options, facts: [`sym:${symbol}`] }
      }
      case 'measureFill':
        return makeMeasureFill(id, pick(meters, rng), symbols, rng)
      case 'countBeat':
        return makeCountBeat(id, pick(meters, rng), symbols, rng)
      case 'tapRhythm':
        return makeTapRhythm(id, pick(meters, rng), symbols, spec.bpm ?? 60, rng)
    }
  }

  const questions: Question[] = []
  let last = ''
  while (questions.length < count) {
    let added = false
    for (let attempt = 0; attempt < 30 && !added; attempt++) {
      const q = make(pick(spec.exercises, rng))
      if (!q) continue
      const sig = signature(q)
      if (sig === last) continue
      questions.push(q)
      if (q.kind === 'findAll') findAllUsed++
      last = sig
      added = true
    }
    // A tiny pool can make every pick a repeat; accept it rather than loop forever.
    if (!added) {
      const q = make(spec.exercises.find((e) => e !== 'findAll') ?? spec.exercises[0])
      if (!q) break
      questions.push(q)
      if (q.kind === 'findAll') findAllUsed++
    }
  }
  return questions
}

/** A measure and a count ("beat 3", "the & of 2") to find in it. */
export function makeCountBeat(id: number, meter: Meter, symbols: SymbolId[], rng: Rng, focus: SymbolId[] = []): Question {
  // A measure with at least two notes to choose between (a lone whole note makes it trivial).
  let measure = randomMeasure(meter, symbols, rng, focus)
  for (let i = 0; i < 20 && playedIndexes(measure).length < 2; i++) measure = randomMeasure(meter, symbols, rng, focus)
  const starts = onsets(measure)
  const played = playedIndexes(measure)
  // Beat 1 is too easy; ask about a later note when there is one.
  const later = played.filter((i) => starts[i] > 0)
  const target = pick(later.length ? later : played, rng)
  return { id, kind: 'countBeat', measure, beat: starts[target], target, facts: [`count:${meter}`] }
}

/** A measure to tap in time. */
export function makeTapRhythm(id: number, meter: Meter, symbols: SymbolId[], bpm: number, rng: Rng, focus: SymbolId[] = []): Question {
  let measure = randomMeasure(meter, symbols, rng, focus)
  for (let i = 0; i < 10 && playedIndexes(measure).length < 2; i++) measure = randomMeasure(meter, symbols, rng, focus)
  const used = [...new Set(measure.events.map(symbolOf))]
  return { id, kind: 'tapRhythm', measure, bpm, facts: used.map((s) => `sym:${s}`) }
}

/** A measure with its last value blanked out, and choices for what fills it. */
export function makeMeasureFill(id: number, meter: Meter, symbols: SymbolId[], rng: Rng): Question | null {
  const nameable = NAMEABLE.filter((s) => symbols.includes(s) && s !== 'eighth')
  for (let attempt = 0; attempt < 30; attempt++) {
    const full = randomMeasure(meter, symbols, rng)
    const last = full.events[full.events.length - 1]
    const before = full.events[full.events.length - 2]
    // Only blank a value that stands alone (not half of an eighth pair, a dotted pair, or a tie).
    if (last.dur === '8' || before?.tie || before?.dots) continue
    const answer = symbolOf(last)
    if (!nameable.includes(answer)) continue
    const missing = eventBeats(last)
    const distractors = shuffle(nameable.filter((s) => SYMBOLS[s].beats !== missing), rng).slice(0, 3)
    if (distractors.length === 0) continue
    const options = shuffle([answer, ...distractors], rng)
    const measure = { meter, events: full.events.slice(0, -1) }
    return { id, kind: 'measureFill', measure, missing, options, facts: [`fill:${meter}`] }
  }
  return null
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Identifies "the same question" so we don't ask it twice in a row. */
function signature(q: Question): string {
  switch (q.kind) {
    case 'name':
      return `pos:${posKey(q.target)}`
    case 'find':
    case 'findAll':
      return `pc:${q.pc}`
    case 'staffName':
    case 'staffFind':
      return `staff:${q.note.letter}${q.note.acc}${q.note.octave}`
    case 'interval':
    case 'intervalName':
      return `iv:${posKey(q.root)}:${q.semitones}`
    case 'symbolName':
    case 'beats':
      return `sym:${q.symbol}`
    case 'measureFill':
    case 'countBeat':
    case 'tapRhythm':
      return `${q.kind}:${JSON.stringify(q.measure.events)}`
  }
}

/** A long run of name/find questions on specific spots (weak ones more often), for sprints. */
export function buildFromPositions(positions: Position[], stats: Stats, count: number, rng: Rng = Math.random): Question[] {
  const choices = positions.some((p) => !isNatural(midiAt(p))) ? 'all' : 'naturals'
  const questions: Question[] = []
  let last = ''
  while (questions.length < count) {
    const p = weightedPick(positions, (q) => weightOf(stats, [posKey(q)]), rng)
    if (posKey(p) === last && positions.length > 1) continue
    last = posKey(p)
    const pc = pitchClass(midiAt(p))
    if (rng() < 0.5) {
      questions.push({ id: newQuestionId(), kind: 'name', target: p, choices, region: FULL_NECK, facts: [posKey(p)] })
    } else {
      const targets = positionsForPc(pc, { ...FULL_NECK, strings: [p.string] })
      const label = pcName(pc, randomSpelling(rng))
      questions.push({ id: newQuestionId(), kind: 'find', pc, label, string: p.string, targets, region: FULL_NECK, facts: targets.map(posKey) })
    }
  }
  return questions
}

/** Every spot on the neck you've answered at least once. */
export function practicedPositions(stats: Stats): Position[] {
  return Object.entries(stats).flatMap(([key, stat]) => {
    const pos = parsePosKey(key)
    return pos && stat.seen > 0 ? [pos] : []
  })
}

/** Positions you've practiced that need the most work, worst first. */
export function weakestPositions(stats: Stats, limit: number): Position[] {
  return Object.entries(stats)
    .map(([key, stat]) => ({ pos: parsePosKey(key), stat }))
    .filter((e): e is { pos: Position; stat: FactStat } => e.pos !== null && e.stat.seen > 0)
    .sort((a, b) => weakness(b.stat) - weakness(a.stat))
    .slice(0, limit)
    .map((e) => e.pos)
}

/** A practice round built only from your weakest spots, or null if there isn't enough history yet. */
export function buildWeakSpotSession(stats: Stats, rng: Rng = Math.random): Question[] | null {
  const weak = weakestPositions(stats, 8)
  if (weak.length < 3) return null
  const choices = weak.some((p) => !isNatural(midiAt(p))) ? 'all' : 'naturals'
  const questions: Question[] = []
  for (let i = 0; i < 12; i++) {
    const p = weak[i % weak.length]
    const pc = pitchClass(midiAt(p))
    if (i % 2 === 0) {
      questions.push({ id: newQuestionId(), kind: 'name', target: p, choices, region: FULL_NECK, facts: [posKey(p)] })
    } else {
      const targets = positionsForPc(pc, { ...FULL_NECK, strings: [p.string] })
      questions.push({
        id: newQuestionId(),
        kind: 'find',
        pc,
        label: pcName(pc, randomSpelling(rng)),
        string: p.string,
        targets,
        region: FULL_NECK,
        facts: targets.map(posKey),
      })
    }
  }
  // Shuffle so the same spot doesn't appear in a predictable rhythm.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[questions[i], questions[j]] = [questions[j], questions[i]]
  }
  return questions
}
