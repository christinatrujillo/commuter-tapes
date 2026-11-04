import { findLesson, tapeNumber, type LessonSpec } from '../music/curriculum'
import { pick, randomSpelling, shuffle } from '../lib/random'
import {
  ALL_STRINGS,
  allPositions,
  FULL_NECK,
  describePosition,
  isNatural,
  midiAt,
  noteAt,
  parsePosKey,
  pcName,
  pitchClass,
  positionsForMidi,
  positionsForPc,
  spellMidi,
  type Region,
} from '../music/notes'
import { NAMEABLE, SYMBOLS, type Meter, type SymbolId } from '../music/rhythm'
import { KEYS, keyLabel, type AccidentalRule, type KeyId, type MotionKind } from '../music/score'
import { degreeName, parseInterval } from '../music/theory'
import { isDue, makeCountBeat, makeMeasureFill, newQuestionId, weakness, type Question, type Rng, type Stats } from './questions'
import { makeAccidentalRule, makeKeyNote, makeMotion } from './reading'
import { earLabel, intervalLabel } from './intervals'
import { coveredBy, firstTaughtIn } from './rehearsal'
import { theoryItemFor, theoryReview } from './theory'

/**
 * Spaced repetition, folded into normal practice: material from earlier tapes comes back
 * when it's due, mixed into takes (and the optional Review session), never as a separate chore.
 */

/** Share of a take given to review questions. */
const REVIEW_SHARE = 0.3


/** The rehearsal item a fact belongs to (they mostly share keys). */
function itemFor(fact: string): string {
  const theory = theoryItemFor(fact)
  if (theory) return theory
  if (/^iv:\d+$/.test(fact)) return `${fact}:n`
  if (/^(count|fill):/.test(fact)) return `meter:${fact.split(':')[1]}`
  return fact
}

/** Which tape (1-based) first taught a fact, for the "from tape N" tag. */
export function tapeOf(fact: string): number | null {
  const lessonId = firstTaughtIn(itemFor(fact))
  const found = lessonId ? findLesson(lessonId) : null
  return found ? tapeNumber(found.unit) : null
}

/** Facts you've met that are due today, most overdue first (then the shakiest). Listening facts wait while listening is off. */
export function dueFacts(stats: Stats, day: string, listening = true): string[] {
  return Object.keys(stats)
    .filter((fact) => isDue(stats[fact], day) && canReview(fact) && (listening || !fact.startsWith('ear:')))
    .sort((a, b) => (stats[a].due ?? '').localeCompare(stats[b].due ?? '') || weakness(stats[b], day) - weakness(stats[a], day))
}

/** Phrases and ties come back through their parts (the notes, the rhythms), so they aren't reviewed on their own. */
const canReview = (fact: string) => fact !== 'skill:phrase' && fact !== 'sym:tie' && !fact.startsWith('skill:')

/** Builds one question that practices a single fact. */
function reviewQuestion(fact: string, stats: Stats, rng: Rng): Question | null {
  const id = newQuestionId()
  const facts = [fact]
  const known = (prefix: string) => Object.keys(stats).filter((k) => k.startsWith(prefix) && stats[k].seen > 0).map((k) => k.slice(prefix.length))
  const symbols = [...new Set<SymbolId>(['whole', 'half', 'quarter', ...(known('sym:') as SymbolId[])])]

  const theory = theoryReview(fact, id, rng)
  if (theory) return theory

  const pos = parsePosKey(fact)
  if (pos) {
    // A small stretch of the string around the spot, so the board stays readable.
    const region: Region = { strings: [pos.string], minFret: 0, maxFret: Math.min(12, Math.max(5, pos.fret + 2)) }
    const pc = pitchClass(midiAt(pos))
    if (rng() < 0.5) return { id, kind: 'name', target: pos, choices: isNatural(pc) ? 'naturals' : 'all', region, facts }
    const targets = positionsForPc(pc, region)
    return { id, kind: 'find', pc, label: pcName(pc, randomSpelling(rng)), string: pos.string, targets, region, facts }
  }

  const [kind, value] = fact.split(':')
  switch (kind) {
    case 'staff': {
      const w = Number(value)
      return { id, kind: 'staffName', note: spellMidi(w, isNatural(w) ? 'sharp' : randomSpelling(rng)), choices: isNatural(w) ? 'naturals' : 'all', facts }
    }
    case 'iv': {
      const semitones = Number(value)
      const roots = allPositions({ strings: [0, 1, 2, 3], minFret: 0, maxFret: 7 }).filter((p) => isNatural(midiAt(p)))
      for (let attempt = 0; attempt < 20; attempt++) {
        const root = pick(roots, rng)
        const targets = positionsForMidi(midiAt(root) + semitones, FULL_NECK)
        if (targets.length) return { id, kind: 'interval', root, semitones, targets, region: FULL_NECK, facts }
      }
      return null
    }
    case 'sym': {
      const symbol = value as SymbolId
      const nameable = NAMEABLE.filter((s) => symbols.includes(s))
      if (nameable.length >= 2 && rng() < 0.5) {
        const others = nameable.filter((s) => s !== symbol).slice(0, 5)
        return { id, kind: 'symbolName', symbol, options: NAMEABLE.filter((s) => s === symbol || others.includes(s)), facts }
      }
      const options = [...new Set([1, 2, 4, ...nameable.map((s) => SYMBOLS[s].beats)])].sort((a, b) => a - b)
      return { id, kind: 'beats', symbol, options, facts }
    }
    case 'count':
      return { ...makeCountBeat(id, value as Meter, symbols, rng), facts }
    case 'fill': {
      const q = makeMeasureFill(id, value as Meter, symbols, rng)
      return q && { ...q, facts }
    }
    case 'rule':
      return makeAccidentalRule(id, value as AccidentalRule, rng)
    case 'key':
      return makeKeyNote(id, value as KeyId, 'name', { strings: ALL_STRINGS, minFret: 0, maxFret: 4 }, rng)
    case 'motion': {
      const kinds = [...new Set<MotionKind>(['step', 'skip', ...(known('motion:') as MotionKind[])])]
      return makeMotion(id, kinds, rng, value as MotionKind)
    }
    default:
      return null
  }
}

/**
 * Up to `count` review questions from what's due, skipping anything `lesson` itself teaches, and
 * anything you'd have to hear while listening is off.
 */
export function buildReview(stats: Stats, day: string, count: number, rng: Rng = Math.random, lesson?: LessonSpec, listening = true): Question[] {
  const own = new Set(lesson ? coveredBy(lesson) : [])
  const out: Question[] = []
  for (const fact of dueFacts(stats, day, listening)) {
    if (out.length >= count) break
    if (own.has(itemFor(fact))) continue
    const q = reviewQuestion(fact, stats, rng)
    const tape = tapeOf(fact)
    if (q && tape) out.push({ ...q, review: { tape } })
  }
  return out
}

/**
 * Swaps some of a lesson's take for due review from earlier material, spread through the take
 * (never first), keeping its length the same. With nothing due, the take is unchanged.
 */
export function mixInReview(questions: Question[], lesson: LessonSpec, stats: Stats, day: string, rng: Rng = Math.random, listening = true): Question[] {
  const slots = Math.round(questions.length * REVIEW_SHARE)
  const reviews = buildReview(stats, day, slots, rng, lesson, listening)
  if (!reviews.length) return questions
  const out = questions.slice(0, questions.length - reviews.length)
  reviews.forEach((q, i) => {
    const at = Math.round(((i + 1) * (out.length + 1)) / (reviews.length + 1))
    out.splice(Math.max(1, at), 0, q)
  })
  return out
}

// ---------------------------------------------------------------------------
// Trouble spots
// ---------------------------------------------------------------------------

/** Facts Trouble spots works on: spots on the neck, and scales, keys and intervals once you've met them. */
const TROUBLE = /^(\d:\d+$|step:|scale:|minor:|degree:|key:|rel:|ivnum:|ivn:|invnum:|inv:|ear:)/

/** The facts you've practiced that need the most work, worst first (listening ones only while listening is on). */
export function weakestFacts(stats: Stats, limit: number, listening = true): string[] {
  return Object.keys(stats)
    .filter((fact) => stats[fact].seen > 0 && TROUBLE.test(fact) && (listening || !fact.startsWith('ear:')))
    .sort((a, b) => weakness(stats[b]) - weakness(stats[a]))
    .slice(0, limit)
}

/** Twelve quick questions on your weakest facts, or null if there isn't enough history yet. */
export function buildTroubleSpots(stats: Stats, rng: Rng = Math.random, listening = true): Question[] | null {
  const weak = weakestFacts(stats, 8, listening)
  if (weak.length < 3) return null
  const out: Question[] = []
  for (let i = 0; out.length < 12 && i < 36; i++) {
    const q = reviewQuestion(weak[i % weak.length], stats, rng)
    if (q) out.push(q)
  }
  // Shuffled, so the same spot doesn't come round in a predictable rhythm.
  return shuffle(out, rng)
}

/** A short name for a practiced fact: "F♯ · A string, 9th fret", "E♭ major scale", "Minor 3rd by ear". */
export function describeFact(fact: string): string {
  const pos = parsePosKey(fact)
  if (pos) return `${noteAt(pos)} · ${describePosition(pos)}`
  const [kind, value] = fact.split(':')
  const interval = () => intervalLabel(parseInterval(value))
  switch (kind) {
    case 'step':
      return value === 'half' ? 'Half steps' : 'Whole steps'
    case 'scale':
      return value === 'formula' ? 'Major scale steps' : `${keyLabel(value)} major scale`
    case 'minor':
      return `${keyLabel(value)} minor scale`
    case 'degree':
      return `${degreeName(Number(value))} in scale patterns`
    case 'key':
      return `${KEYS[value as KeyId]?.name ?? value} key signature`
    case 'rel':
      return `${KEYS[value as KeyId]?.name ?? value}’s relative minor`
    case 'ivnum':
      return Number(value) === 8 ? 'Counting octaves' : `Counting ${degreeName(Number(value))}s`
    case 'ivn':
      return interval()
    case 'invnum':
      return `Turning ${degreeName(Number(value))}s over`
    case 'inv':
      return `${interval()} upside down`
    case 'ear':
      return `${earLabel(value)} by ear`
    default:
      return fact
  }
}
