import type { Marker } from '../components/Fretboard'
import { ALL_LESSONS, findLesson, type ExerciseType, type LessonSpec } from '../music/curriculum'
import {
  allPositions,
  describePosition,
  intervalInfo,
  isNatural,
  LETTERS,
  midiAt,
  ordinal,
  pcName,
  pitchClass,
  posKey,
  positionsForMidi,
  positionsForPc,
  spellMidi,
  spelledName,
  staffPlace,
  stringName,
  TUNING,
  vexKey,
  WRITTEN_OCTAVE_SHIFT,
  type Position,
  type Region,
} from '../music/notes'
import { beatsText, countAt, eventBeats, NAMEABLE, onsets, SYMBOLS, type Measure, type Meter, type RhythmEvent, type SymbolId } from '../music/rhythm'
import { buildSession, makeCountBeat, makeMeasureFill, makeTapRhythm, newQuestionId, type Question, type Rng } from './questions'

/**
 * A rehearsal teaches a track's new material before the take tests it: a card for each new
 * note, shape or rhythm idea (two at a time), each pair followed by a quick check, then a
 * mixed check of everything new. Small chunks, anchors first, and immediate recall are what
 * make new facts stick.
 */

export interface Card {
  /** Printed on label tape: the note, group, interval or rhythm idea being taught. */
  title: string
  subtitle: string
  /** A memory hook: how this relates to things you already know. */
  hook: string
  /** "New note 2 of 4" */
  counter: string
  board?: { region: Region; markers: Marker[] }
  staff?: { keys: string[]; labels: string[] }
  /** An example measure, with the counts written underneath. */
  notation?: { measure: Measure; labels?: string[]; blankBeats?: number; clef?: boolean; timeSig?: boolean }
  /** Notes (sounding MIDI) to play when the card appears. */
  sound: number[]
  /** A rhythm to play (clicks and notes) when the card appears. */
  rhythm?: { measure: Measure; bpm: number }
}

export type RehearsalStep = { kind: 'card'; card: Card } | { kind: 'check'; questions: Question[] } | { kind: 'ready' }

export interface Rehearsal {
  lesson: LessonSpec
  /** 'learn' teaches new material; 'warmup' is a quick run-through for tracks with nothing new. */
  mode: 'learn' | 'warmup'
  newCount: number
  /** "note", "shape" or "idea", for wording. */
  noun: string
  steps: RehearsalStep[]
}

type Family = 'position' | 'staff' | 'interval' | 'rhythm'

const familyOf = (item: string): Family =>
  /^\d:\d+$/.test(item) ? 'position' : item.startsWith('staff:') ? 'staff' : item.startsWith('iv:') ? 'interval' : 'rhythm'

const BOARD: ExerciseType[] = ['name', 'find', 'findAll']
const STAFF: ExerciseType[] = ['staffName', 'staffFind']
const INTERVAL: ExerciseType[] = ['interval', 'intervalName']
const RHYTHM: ExerciseType[] = ['symbolName', 'beats', 'measureFill', 'countBeat', 'tapRhythm']
const RHYTHM_SKILLS: ExerciseType[] = ['countBeat', 'measureFill', 'tapRhythm']
const uses = (l: LessonSpec, types: ExerciseType[]) => l.exercises.some((e) => types.includes(e))

const written = (midi: number) => midi + WRITTEN_OCTAVE_SHIFT
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const noteName = (p: Position) => pcName(pitchClass(midiAt(p)))
const lessonPositions = (l: LessonSpec) => allPositions(l.region).filter((p) => l.accidentals || isNatural(midiAt(p)))
const metersOf = (l: LessonSpec): Meter[] => l.meters ?? ['4/4']

/** Written pitches a staff lesson uses, low to high. */
function staffNotes(l: LessonSpec): number[] {
  return [...new Set(lessonPositions(l).map((p) => written(midiAt(p))))]
    .filter((w) => !l.writtenRange || (w >= l.writtenRange[0] && w <= l.writtenRange[1]))
    .sort((a, b) => a - b)
}

/** Interval shapes change when they cross from the G string to the B string. */
function crossesB(semitones: number, rootString: number): boolean {
  return semitones === 12 ? rootString === 2 || rootString === 3 : rootString === 3
}
const stringsAcross = (semitones: number) => (semitones === 12 ? 2 : 1)

/**
 * Everything a lesson teaches, as keys: "string:fret", "staff:<written midi>",
 * "iv:<semitones>:<n|b>", "sym:<symbol>", "meter:<time signature>", "skill:<exercise>".
 */
function itemsFor(l: LessonSpec): string[] {
  const items: string[] = []
  if (uses(l, BOARD)) items.push(...lessonPositions(l).map(posKey))
  if (uses(l, STAFF)) items.push(...staffNotes(l).map((w) => `staff:${w}`))
  if (uses(l, INTERVAL)) {
    for (const semi of l.intervals ?? [12]) {
      const roots = (l.rootStrings ?? l.region.strings).filter((s) => s + stringsAcross(semi) <= 5)
      for (const cross of [false, true]) {
        if (roots.some((s) => crossesB(semi, s) === cross)) items.push(`iv:${semi}:${cross ? 'b' : 'n'}`)
      }
    }
  }
  if (uses(l, RHYTHM)) {
    items.push(...(l.symbols ?? []).map((s) => `sym:${s}`), ...metersOf(l).map((m) => `meter:${m}`))
    items.push(...RHYTHM_SKILLS.filter((t) => l.exercises.includes(t)).map((t) => `skill:${t}`))
  }
  return items
}

/** What a lesson leaves you knowing. Reading a note in first position also teaches where it's played. */
function coveredBy(l: LessonSpec): string[] {
  return l.exercises.includes('staffFind') ? [...itemsFor(l), ...lessonPositions(l).map(posKey)] : itemsFor(l)
}

/** Items taught by every track before this one on the shelf. */
function introducedBefore(lessonId: string): Set<string> {
  const known = new Set<string>()
  for (const l of ALL_LESSONS) {
    if (l.id === lessonId) break
    for (const item of coveredBy(l)) known.add(item)
  }
  return known
}

const parsePos = (key: string): Position => {
  const [s, f] = key.split(':').map(Number)
  return { string: s, fret: f }
}

// ---------------------------------------------------------------------------
// Memory hooks
// ---------------------------------------------------------------------------

/** Landmarks first: open string, 12th fret, "next string's open note", the dots, then the rest. */
function anchorRank(p: Position): number {
  if (p.fret === 0) return 0
  if (p.fret === 12) return 1
  if (p.string < 5 && midiAt(p) === TUNING[p.string + 1]) return 2
  const dots = [5, 7, 3, 9]
  if (dots.includes(p.fret)) return 3 + dots.indexOf(p.fret) / 10
  return 4 + p.fret / 100
}

function fretHook(p: Position, known: Position[]): string {
  const pc = pitchClass(midiAt(p))
  if (!isNatural(pc)) {
    return `One fret above ${pcName(pc - 1)}, so it’s ${pcName(pc, 'sharp')}. It’s also one fret below ${pcName(pc + 1)}, so it’s ${pcName(pc, 'flat')} too.`
  }
  const parts: string[] = []
  if (p.fret === 0) {
    parts.push(p.string === 5 ? 'The open high E: the same note as the low E, two octaves up.' : 'The open string. It’s named after the string itself.')
  } else if (p.fret === 12) {
    parts.push('The 12th fret (the double dot) is the open note again, one octave higher.')
  } else {
    if (p.string < 5 && midiAt(p) === TUNING[p.string + 1]) {
      parts.push(`Same note as the open ${stringName(p.string + 1)} string.`)
    } else {
      const anchor = known
        .filter((k) => k.string === p.string && k.fret !== p.fret)
        .sort((a, b) => Math.abs(a.fret - p.fret) - Math.abs(b.fret - p.fret) || a.fret - b.fret)[0]
      if (anchor) {
        const d = p.fret - anchor.fret
        const n = Math.abs(d)
        parts.push(`${n === 1 ? 'One fret' : `${n} frets`} ${d > 0 ? 'above' : 'below'} ${noteName(anchor)}${n === 1 ? ', with no note in between' : ''}.`)
      }
    }
    if ([3, 5, 7, 9].includes(p.fret)) parts.push(`Look for the dot at the ${ordinal(p.fret)} fret.`)
  }
  // The two E strings mirror each other; point it out once the other one is known.
  const mirror = p.string === 5 ? 0 : p.string === 0 ? 5 : -1
  if (p.fret !== 0 && mirror !== -1 && known.some((k) => k.string === mirror && k.fret === p.fret)) {
    parts.push(`Same fret as on the ${stringName(mirror)} string.`)
  }
  return parts.join(' ')
}

/** Staff position counted in steps: 0 = E4 (bottom line), 8 = F5 (top line). */
function staffStep(w: number): number {
  const n = spellMidi(w, 'sharp')
  return n.octave * 7 + LETTERS.indexOf(n.letter) - (4 * 7 + 2)
}

function staffHook(w: number, l: LessonSpec): string {
  const note = spellMidi(w, 'sharp')
  const parts: string[] = []
  if (note.acc !== 0) {
    const flat = spellMidi(w, 'flat')
    parts.push(`Same note, two spellings: ${spelledName(note)} and ${spelledName(flat)}.`)
  } else {
    const step = staffStep(w)
    if (step >= 0 && step <= 8) {
      parts.push(step % 2 === 0 ? 'Lines, bottom to top: E G B D F (Every Good Boy Does Fine).' : 'Spaces, bottom to top: F A C E.')
    } else {
      parts.push(`${capitalize(staffPlace(note))}.`)
    }
  }
  if (w === 60) parts.push('This is middle C.')
  const spot = positionsForMidi(w - WRITTEN_OCTAVE_SHIFT, l.region).sort((a, b) => a.fret - b.fret)[0]
  if (spot) {
    parts.push(`Play it on the ${describePosition(spot)}.`)
    // First position: one finger per fret.
    if (l.region.maxFret <= 4 && spot.fret > 0) parts.push(`Use your ${ordinal(spot.fret)} finger.`)
  }
  return parts.join(' ')
}

const SHAPES: Record<number, { normal: string; cross: string }> = {
  12: { normal: '2 strings over, 2 frets up.', cross: 'Crossing the B string: 2 strings over, 3 frets up.' },
  7: { normal: 'Next string, 2 frets up. That’s the power chord shape.', cross: 'Onto the B string: 3 frets up.' },
  5: { normal: 'Next string, same fret.', cross: 'Onto the B string: 1 fret up.' },
  4: { normal: 'Next string, 1 fret down.', cross: 'Onto the B string: same fret.' },
  3: { normal: 'Next string, 2 frets down.', cross: 'Onto the B string: 1 fret down.' },
}

// ---------------------------------------------------------------------------
// Rhythm teaching material
// ---------------------------------------------------------------------------

const n = (dur: RhythmEvent['dur'], dots: 0 | 1 = 0, tie = false): RhythmEvent => ({ dur, dots, rest: false, ...(tie ? { tie } : {}) })
const r = (dur: RhythmEvent['dur']): RhythmEvent => ({ dur, dots: 0, rest: true })
const m4 = (...events: RhythmEvent[]): Measure => ({ meter: '4/4', events })
const m3 = (...events: RhythmEvent[]): Measure => ({ meter: '3/4', events })

const SYMBOL_TEACHING: Record<SymbolId, { hook: string; example: Measure }> = {
  whole: { hook: 'An open note head with no stem. Hold it through all four counts.', example: m4(n('w')) },
  half: { hook: 'An open note head with a stem. Hold it for two counts.', example: m4(n('h'), n('h')) },
  quarter: { hook: 'A filled note head with a stem. One count each.', example: m4(n('q'), n('q'), n('q'), n('q')) },
  eighth: {
    hook: 'A filled head with a flag, or a beam when there are two. Two fit in one beat: count “1 &”.',
    example: m4(n('q'), n('8'), n('8'), n('q'), n('8'), n('8')),
  },
  dottedHalf: { hook: 'A dot adds half the note’s value: 2 + 1 = 3 beats. It fills a whole measure of 3/4.', example: m3(n('h', 1)) },
  dottedQuarter: {
    hook: 'A dot adds half: 1 + ½ = 1½ beats. It’s usually followed by an eighth to finish the beat.',
    example: m4(n('q', 1), n('8'), n('h')),
  },
  wholeRest: { hook: 'A block hanging down from the fourth line: a whole measure of silence.', example: m4(r('w')) },
  halfRest: { hook: 'A block sitting on the middle line, like a hat: 2 beats of silence.', example: m4(n('h'), r('h')) },
  quarterRest: { hook: 'The squiggle: 1 beat of silence.', example: m4(n('q'), r('q'), n('q'), r('q')) },
  tie: {
    hook: 'A curve joining two notes of the same pitch. Play the first and hold through the second: their beats add up.',
    example: m4(n('q'), n('q', 0, true), n('q'), n('q')),
  },
}

const METER_TEACHING: Record<Meter, { hook: string; example: Measure }> = {
  '4/4': {
    hook: 'The top number is how many beats are in each measure. The bottom 4 means a quarter note gets one beat.',
    example: m4(n('q'), n('q'), n('q'), n('q')),
  },
  '3/4': { hook: 'Three quarter-note beats per measure. Count 1 2 3, with the weight on 1, like a waltz.', example: m3(n('q'), n('q'), n('q')) },
}

const SKILL_TEACHING: Record<string, { title: string; subtitle: string; hook: string; example: Measure; blankBeats?: number }> = {
  countBeat: {
    title: 'Counting',
    subtitle: 'Every note starts on a count',
    hook: 'Say the counts in your head as you read. A half note on 1 covers 1 and 2, so the next note starts on 3.',
    example: m4(n('h'), n('q'), n('q')),
  },
  measureFill: {
    title: 'Full measures',
    subtitle: 'The beats always add up',
    hook: 'The notes and rests in a measure add up to the time signature: 4 beats in 4/4. Here 3 beats are written, so 1 beat is missing.',
    example: m4(n('h'), n('q')),
    blankBeats: 1,
  },
  tapRhythm: {
    title: 'Tapping rhythms',
    subtitle: 'One tap per note, right on its count',
    hook: 'You’ll get one measure of count-in first. Then tap once at the start of each note and hold still for rests and long notes. On a laptop, Space taps too.',
    example: m4(n('q'), n('q'), n('h')),
  },
}

/** The counts each note covers, written under it: "1 2" for a half note on 1, "(3)" for a rest on 3. */
export function heldCounts(m: Measure): string[] {
  const starts = onsets(m)
  return m.events.map((e, i) => {
    const beats = eventBeats(e)
    const counts: string[] = [countAt(starts[i])]
    if (beats >= 1) for (let b = Math.floor(starts[i]) + 1; b < starts[i] + beats; b++) counts.push(countAt(b))
    const text = counts.join(' ')
    return e.rest ? `(${text})` : text
  })
}

const RHYTHM_BPM = 72

function rhythmCard(item: string, counter: string): Card {
  const [kind, value] = item.split(':')
  if (kind === 'sym') {
    const s = value as SymbolId
    const t = SYMBOL_TEACHING[s]
    return {
      title: SYMBOLS[s].name,
      subtitle: s === 'tie' ? 'Joins two notes into one' : beatsText(SYMBOLS[s].beats),
      hook: t.hook,
      counter,
      notation: { measure: t.example, labels: heldCounts(t.example) },
      sound: [],
      rhythm: { measure: t.example, bpm: RHYTHM_BPM },
    }
  }
  if (kind === 'meter') {
    const t = METER_TEACHING[value as Meter]
    return {
      title: `${value} time`,
      subtitle: `${value.split('/')[0]} beats per measure`,
      hook: t.hook,
      counter,
      notation: { measure: t.example, labels: heldCounts(t.example) },
      sound: [],
      rhythm: { measure: t.example, bpm: RHYTHM_BPM },
    }
  }
  const t = SKILL_TEACHING[value]
  return {
    title: t.title,
    subtitle: t.subtitle,
    hook: t.hook,
    counter,
    notation: { measure: t.example, labels: t.blankBeats ? undefined : heldCounts(t.example), blankBeats: t.blankBeats },
    sound: [],
    rhythm: t.blankBeats ? undefined : { measure: t.example, bpm: RHYTHM_BPM },
  }
}

// ---------------------------------------------------------------------------
// Note, shape and staff cards
// ---------------------------------------------------------------------------

function fretCard(p: Position, known: Position[], l: LessonSpec, counter: string): Card {
  const context = known
    .filter((k) => k.string === p.string && k.fret >= l.region.minFret && k.fret <= l.region.maxFret && k.fret !== p.fret)
    .map((k): Marker => ({ pos: k, tone: 'note', label: pcName(pitchClass(midiAt(k)), 'sharp') }))
  return {
    title: noteName(p),
    subtitle: capitalize(describePosition(p)),
    hook: fretHook(p, known),
    counter,
    board: { region: l.region, markers: [...context, { pos: p, tone: 'target', label: pcName(pitchClass(midiAt(p)), 'sharp') }] },
    sound: [midiAt(p)],
  }
}

function fretGroupCard(items: Position[], l: LessonSpec, counter: string): Card {
  const strings = [...new Set(items.map((p) => p.string))]
  const list = items.map((p) => `${pcName(pitchClass(midiAt(p)), 'sharp')} ${p.fret === 0 ? 'open' : ordinal(p.fret)}`).join(' · ')
  const intro = items.every((p) => !isNatural(midiAt(p)))
    ? 'Each one is a fret above the natural note below it (♯) and a fret below the one above it (♭).'
    : ''
  return {
    title: `${strings.map((s) => stringName(s)).join(' & ')} string${strings.length > 1 ? 's' : ''}`,
    subtitle: `Frets ${Math.min(...items.map((p) => p.fret))}–${Math.max(...items.map((p) => p.fret))}`,
    hook: [intro, list].filter(Boolean).join(' '),
    counter,
    board: { region: l.region, markers: items.map((p) => ({ pos: p, tone: 'target', label: pcName(pitchClass(midiAt(p)), 'sharp') })) },
    sound: [...items].sort((a, b) => midiAt(a) - midiAt(b)).map(midiAt),
  }
}

const hasStaffFind = (l: LessonSpec) => l.exercises.includes('staffFind')

function staffBoard(notes: number[], l: LessonSpec): Card['board'] {
  if (!hasStaffFind(l)) return undefined
  const markers: Marker[] = notes.flatMap((w) =>
    positionsForMidi(w - WRITTEN_OCTAVE_SHIFT, l.region).map((p): Marker => ({ pos: p, tone: 'target', label: pcName(pitchClass(midiAt(p)), 'sharp') })),
  )
  return { region: l.region, markers }
}

function staffCard(w: number, l: LessonSpec, counter: string): Card {
  const sharp = spellMidi(w, 'sharp')
  const flat = spellMidi(w, 'flat')
  const both = sharp.acc !== 0
  return {
    title: both ? `${spelledName(sharp)} / ${spelledName(flat)}` : spelledName(sharp),
    subtitle: capitalize(staffPlace(sharp)),
    hook: staffHook(w, l),
    counter,
    staff: both ? { keys: [vexKey(sharp), vexKey(flat)], labels: [spelledName(sharp), spelledName(flat)] } : { keys: [vexKey(sharp)], labels: [] },
    board: staffBoard([w], l),
    sound: [w - WRITTEN_OCTAVE_SHIFT],
  }
}

function staffGroupCard(notes: number[], l: LessonSpec, counter: string): Card {
  const steps = notes.map(staffStep)
  const inside = steps.every((s) => s >= 0 && s <= 8)
  let title = 'New notes'
  let hook = notes.map((w) => spelledName(spellMidi(w, 'sharp'))).join(' · ')
  if (notes.every((w) => !isNatural(w))) {
    title = 'Sharps & flats'
    hook = `A ♯ raises a note one fret, a ♭ lowers it one fret. Each of these has a flat name too. ${hook}`
  } else if (inside && steps.every((s) => s % 2 === 0)) {
    title = 'The lines'
    hook = 'Bottom to top: E G B D F. Every Good Boy Does Fine.'
  } else if (inside && steps.every((s) => s % 2 === 1)) {
    title = 'The spaces'
    hook = 'Bottom to top: F A C E. It spells FACE.'
  } else if (steps.every((s) => s < 0)) {
    title = 'Below the staff'
    hook = `Each step down alternates space, ledger line, space. ${notes.includes(60) ? 'Middle C sits on the first ledger line. ' : ''}${hook}`
  } else if (steps.every((s) => s > 8)) {
    title = 'Above the staff'
    hook = `Each step up alternates space, ledger line, space. ${hook}`
  }
  const sorted = [...notes].sort((a, b) => a - b)
  return {
    title,
    subtitle: `${notes.length} notes`,
    hook,
    counter,
    staff: { keys: sorted.map((w) => vexKey(spellMidi(w, 'sharp'))), labels: sorted.map((w) => spelledName(spellMidi(w, 'sharp'))) },
    board: staffBoard(sorted, l),
    sound: sorted.map((w) => w - WRITTEN_OCTAVE_SHIFT),
  }
}

function intervalCard(semi: number, cross: boolean, l: LessonSpec, counter: string): Card {
  // A worked example of the shape: from C on the A string, or across the G–B gap when it bends.
  const root: Position = cross ? (semi === 12 ? { string: 2, fret: 3 } : { string: 3, fret: 5 }) : { string: 1, fret: 3 }
  const targetString = root.string + stringsAcross(semi)
  const target: Position = { string: targetString, fret: midiAt(root) + semi - TUNING[targetString] }
  const info = intervalInfo(semi)
  return {
    title: capitalize(info.name),
    subtitle: `${noteName(root)} → ${noteName(target)}`,
    hook: cross ? SHAPES[semi].cross : SHAPES[semi].normal,
    counter,
    board: {
      region: l.region,
      markers: [
        { pos: root, tone: 'root', label: noteName(root) },
        { pos: target, tone: 'target', label: noteName(target) },
      ],
    },
    sound: [midiAt(root), midiAt(target)],
  }
}

// ---------------------------------------------------------------------------
// Quick checks
// ---------------------------------------------------------------------------

const randomSpelling = (rng: Rng) => (rng() < 0.5 ? ('sharp' as const) : ('flat' as const))
const pickFrom = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

/** One question about one item. `turn` alternates the question type so both directions get practiced. */
function questionFor(item: string, turn: number, l: LessonSpec, rng: Rng): Question | null {
  const id = newQuestionId()
  const symbols = l.symbols ?? []
  const nameable = NAMEABLE.filter((s) => symbols.includes(s))
  const meter = pickFrom(metersOf(l), rng)

  switch (familyOf(item)) {
    case 'rhythm': {
      const [kind, value] = item.split(':')
      if (kind === 'sym' && value !== 'tie') {
        const s = value as SymbolId
        if (turn % 2 === 0 && nameable.length >= 2) {
          const options = NAMEABLE.filter((x) => nameable.includes(x)).slice(0, 6)
          if (!options.includes(s)) options[options.length - 1] = s
          return { id, kind: 'symbolName', symbol: s, options: NAMEABLE.filter((x) => options.includes(x)), facts: [item] }
        }
        const beats = [...new Set([1, 2, 4, ...nameable.map((x) => SYMBOLS[x].beats)])].sort((a, b) => a - b)
        return { id, kind: 'beats', symbol: s, options: beats, facts: [item] }
      }
      if (kind === 'sym') return makeCountBeat(id, meter, symbols, rng, ['tie'])
      if (kind === 'meter') {
        const m = value as Meter
        if (l.exercises.includes('measureFill')) return makeMeasureFill(id, m, symbols, rng)
        if (l.exercises.includes('countBeat')) return makeCountBeat(id, m, symbols, rng)
        return nameable.length ? { id, kind: 'beats', symbol: pickFrom(nameable, rng), options: [1, 2, 4], facts: [item] } : null
      }
      if (value === 'measureFill') return makeMeasureFill(id, meter, symbols, rng)
      if (value === 'countBeat') return makeCountBeat(id, meter, symbols, rng)
      return makeTapRhythm(id, meter, symbols, l.bpm ?? 60, rng)
    }
    case 'staff': {
      const w = Number(item.slice(6))
      const note = spellMidi(w, randomSpelling(rng))
      const targets = positionsForMidi(w - WRITTEN_OCTAVE_SHIFT, l.region)
      const canFind = hasStaffFind(l) && targets.length > 0
      const canName = l.exercises.includes('staffName')
      if (canFind && (!canName || turn % 2 === 0)) return { id, kind: 'staffFind', note, targets, region: l.region, facts: [item] }
      return { id, kind: 'staffName', note, choices: l.accidentals ? 'all' : 'naturals', facts: [item] }
    }
    case 'interval': {
      const [, s, shape] = item.split(':')
      const semi = Number(s)
      const roots = allPositions(l.region).filter(
        (p) =>
          (l.rootStrings ?? l.region.strings).includes(p.string) &&
          isNatural(midiAt(p)) &&
          p.string + stringsAcross(semi) <= 5 &&
          crossesB(semi, p.string) === (shape === 'b'),
      )
      for (let attempt = 0; attempt < 20; attempt++) {
        const root = pickFrom(roots, rng)
        if (!root) return null
        const targets = positionsForMidi(midiAt(root) + semi, l.region)
        if (targets.length) return { id, kind: 'interval', root, semitones: semi, targets, region: l.region, facts: [item] }
      }
      return null
    }
    case 'position': {
      const p = parsePos(item)
      const pc = pitchClass(midiAt(p))
      if (turn % 2 === 0) {
        const targets = positionsForPc(pc, { ...l.region, strings: [p.string] })
        return { id, kind: 'find', pc, label: pcName(pc, randomSpelling(rng)), string: p.string, targets, region: l.region, facts: [item] }
      }
      return { id, kind: 'name', target: p, choices: l.accidentals ? 'all' : 'naturals', region: l.region, facts: [item] }
    }
  }
}

/** Every item in `focus` once, then extra picks from `pool` (focus items twice as likely), never the same twice in a row. */
function check(focus: string[], pool: string[], count: number, l: LessonSpec, rng: Rng): Question[] {
  const order = [...focus].sort(() => rng() - 0.5)
  while (order.length < count) {
    const weighted = pool.flatMap((item) => (focus.includes(item) ? [item, item] : [item]))
    const item = weighted[Math.floor(rng() * weighted.length)]
    if (item !== order[order.length - 1] || pool.length === 1) order.push(item)
  }
  return order.flatMap((item, turn) => {
    const q = questionFor(item, turn, l, rng)
    return q ? [q] : []
  })
}

// ---------------------------------------------------------------------------

const SYMBOL_ORDER: SymbolId[] = [...NAMEABLE, 'tie']

/** Puts new items in teaching order: landmarks first on the neck, lines before spaces on the staff, rhythm in method order. */
function teachingOrder(items: string[]): string[] {
  const families: Family[] = ['position', 'staff', 'interval', 'rhythm']
  return families.flatMap((family) => {
    const group = items.filter((i) => familyOf(i) === family)
    if (family === 'position') return group.map(parsePos).sort((a, b) => a.string - b.string || anchorRank(a) - anchorRank(b)).map(posKey)
    if (family === 'staff') {
      const ws = group.map((k) => Number(k.slice(6)))
      const inside = ws.every((w) => staffStep(w) >= 0 && staffStep(w) <= 8 && isNatural(w))
      const order = inside
        ? [...ws].sort((a, b) => (staffStep(a) % 2) - (staffStep(b) % 2) || a - b)
        : [...ws].sort((a, b) => Math.abs(staffStep(a) - 4) - Math.abs(staffStep(b) - 4) || a - b)
      return order.map((w) => `staff:${w}`)
    }
    if (family === 'rhythm') {
      const rank = (i: string) => {
        const [kind, value] = i.split(':')
        return kind === 'sym' ? SYMBOL_ORDER.indexOf(value as SymbolId) : kind === 'meter' ? 50 : 100
      }
      return [...group].sort((a, b) => rank(a) - rank(b))
    }
    return group
  })
}

/** Plans the rehearsal for a track, or null if the track doesn't exist. */
export function buildRehearsal(lessonId: string, rng: Rng = Math.random): Rehearsal | null {
  const found = findLesson(lessonId)
  if (!found) return null
  const l = found.lesson
  const known = introducedBefore(lessonId)
  const fresh = teachingOrder(itemsFor(l).filter((item) => !known.has(item)))
  const families = new Set(fresh.map(familyOf))
  const noun = families.size === 1 && families.has('interval') ? 'shape' : families.size === 1 && families.has('rhythm') ? 'idea' : 'note'

  if (fresh.length === 0) {
    const fretOnly = uses(l, BOARD) && !uses(l, STAFF) && !uses(l, RHYTHM)
    const overview: Card = {
      title: 'Warm-up',
      subtitle: l.title,
      hook: 'Nothing new on this track. Five quick ones to warm up, then record.',
      counter: 'Review',
      board: fretOnly
        ? { region: l.region, markers: lessonPositions(l).map((p) => ({ pos: p, tone: 'note', label: pcName(pitchClass(midiAt(p)), 'sharp') })) }
        : undefined,
      sound: [],
    }
    return { lesson: l, mode: 'warmup', newCount: 0, noun, steps: [{ kind: 'card', card: overview }, { kind: 'check', questions: buildSession({ ...l, count: 5 }, {}, rng) }, { kind: 'ready' }] }
  }

  // Chunks: up to four items of a kind get a card each, two at a time; more are taught in groups of up to four.
  const chunks: { items: string[]; oneByOne: boolean }[] = []
  for (const family of ['position', 'staff', 'interval', 'rhythm'] as Family[]) {
    const group = fresh.filter((i) => familyOf(i) === family)
    if (!group.length) continue
    const oneByOne = group.length <= 4 || family === 'rhythm' || family === 'interval'
    if (oneByOne) {
      for (let i = 0; i < group.length; i += 2) chunks.push({ items: group.slice(i, i + 2), oneByOne })
    } else if (family === 'staff' && group.every((k) => staffStep(Number(k.slice(6))) >= 0 && staffStep(Number(k.slice(6))) <= 8)) {
      const lines = group.filter((k) => staffStep(Number(k.slice(6))) % 2 === 0)
      const spaces = group.filter((k) => staffStep(Number(k.slice(6))) % 2 === 1)
      for (const c of [lines, spaces]) if (c.length) chunks.push({ items: c, oneByOne: false })
    } else {
      for (let i = 0; i < group.length; i += 4) chunks.push({ items: group.slice(i, i + 4), oneByOne: false })
    }
  }

  const knownPositions = [...known].filter((k) => familyOf(k) === 'position').map(parsePos)
  const steps: RehearsalStep[] = []
  const taught: string[] = []
  let shown = 0
  for (const chunk of chunks) {
    if (chunk.oneByOne) {
      for (const item of chunk.items) {
        shown++
        const counter = `New ${noun} ${shown} of ${fresh.length}`
        const family = familyOf(item)
        const card =
          family === 'position'
            ? fretCard(parsePos(item), [...knownPositions, ...taught.filter((t) => familyOf(t) === 'position').map(parsePos)], l, counter)
            : family === 'staff'
              ? staffCard(Number(item.slice(6)), l, counter)
              : family === 'interval'
                ? intervalCard(Number(item.split(':')[1]), item.endsWith(':b'), l, counter)
                : rhythmCard(item, counter)
        steps.push({ kind: 'card', card })
        taught.push(item)
      }
    } else {
      const counter = `New ${noun}s ${shown + 1}–${shown + chunk.items.length} of ${fresh.length}`
      shown += chunk.items.length
      const card =
        familyOf(chunk.items[0]) === 'position'
          ? fretGroupCard(chunk.items.map(parsePos), l, counter)
          : staffGroupCard(chunk.items.map((k) => Number(k.slice(6))), l, counter)
      steps.push({ kind: 'card', card })
      taught.push(...chunk.items)
    }
    steps.push({ kind: 'check', questions: check(chunk.items, [...taught], Math.max(2, Math.min(6, chunk.items.length * 2)), l, rng) })
  }
  if (chunks.length > 1) steps.push({ kind: 'check', questions: check([], fresh, Math.min(6, fresh.length + 2), l, rng) })
  steps.push({ kind: 'ready' })
  return { lesson: l, mode: 'learn', newCount: fresh.length, noun, steps }
}
