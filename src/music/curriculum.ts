import { ALL_STRINGS, FULL_NECK, stringName, type Region } from './notes'
import type { Meter, SymbolId } from './rhythm'
import { KEY_ORDER, type AccidentalRule, type KeyId, type MotionKind } from './score'

export type ExerciseType =
  | 'name' // a dot on the fretboard: pick its note name
  | 'find' // "tap G on the A string"
  | 'findAll' // "find every G"
  | 'staffName' // a note on the staff: pick its name
  | 'staffFind' // a note on the staff: tap where it's played
  | 'interval' // a root dot: tap the note an interval above it
  | 'intervalName' // two dots: name the interval between them
  | 'symbolName' // a note value or rest: name it
  | 'beats' // a note value or rest: how many beats?
  | 'measureFill' // a measure with a gap: which value completes it?
  | 'countBeat' // a measure: tap the note on a given count
  | 'tapRhythm' // a measure: tap it in time after a count-in
  | 'accidentalRule' // a measure with accidentals: what is the marked note?
  | 'keyName' // a key signature: which key?
  | 'keyNote' // a note after a key signature: name it or find it
  | 'motion' // two notes: same, step, skip or leap, up or down?
  | 'phrase' // a short melody: tap it in order on the fretboard
  | 'stepSize' // two notes on one string: half step or whole step?
  | 'stepRead' // two neighboring notes on the staff: half step or whole step?
  | 'stepFind' // tap a half or whole step above or below a note
  | 'stepNote' // "what's a whole step above E?"
  | 'scaleStep' // in a major scale, half or whole step between two of its notes?
  | 'scaleNote' // "what's the 5th note of G major?"
  | 'degreeName' // a note in a scale pattern: which degree is it?
  | 'degreeFind' // tap a degree in a scale pattern
  | 'keySignature' // how many sharps or flats a key has
  | 'relativeKey' // the relative minor of a major key, or the other way round
  | 'relativeFind' // tap a major key's relative minor on the same string
  | 'minorNote' // "what's the 3rd note of E minor?"
  | 'ivNumber' // "what number interval is C up to G?"
  | 'ivName' // "what's the interval from C up to E♭?"
  | 'ivReadNumber' // two notes on the staff: what number interval?
  | 'ivReadName' // two notes on the staff, maybe stacked, in a key: name the interval
  | 'ivFlip' // "turn a 3rd upside down: what number is it now?"
  | 'ivInvert' // "turn a major 3rd upside down: what is it now?"
  | 'ivBelow' // tap the note an interval below a root
  | 'ivHear' // hear two notes: name the interval
  | 'ivHearFind' // hear two notes: tap the second one on the neck

export interface LessonSpec {
  id: string
  title: string
  exercises: ExerciseType[]
  region: Region
  /** Include sharps and flats (otherwise natural notes only). */
  accidentals?: boolean
  /** Limits staff exercises to written pitches in this MIDI range (inclusive). */
  writtenRange?: [number, number]
  /** Semitone sizes for interval exercises. */
  intervals?: number[]
  /** Strings the interval root can be on (defaults to the region's strings). */
  rootStrings?: number[]
  /** Note values, rests and markings that rhythm exercises may use. */
  symbols?: SymbolId[]
  /** Time signatures for rhythm exercises (default 4/4). */
  meters?: Meter[]
  /** Tempo for tapping rhythms (default 60). */
  bpm?: number
  /** Which accidental rules the measure-rule questions test. */
  rules?: AccidentalRule[]
  /** Key signatures used (key questions and phrases; phrases default to C, no signature). */
  keys?: KeyId[]
  /** Kinds of melodic motion for step/skip questions. */
  motions?: MotionKind[]
  /** Theory ideas the track teaches, each with its own rehearsal card. */
  topics?: string[]
  /** Intervals interval-naming and ear questions use, by short name ("M3", "P5"). */
  ivNames?: string[]
  /** How ear questions play their two notes: rising, falling or together. */
  ear?: ('up' | 'down' | 'together')[]
  /** Staff intervals are written stacked, sounding together. */
  stacked?: boolean
  count?: number
}

export interface Unit {
  id: string
  title: string
  description: string
  color: string
  tips: string[]
  /** Fretboard shown on the tips page with every note labeled. */
  tipRegion?: Region
  tipAccidentals?: boolean
  /** Notes shown on a staff on the tips page (VexFlow keys, written pitch). */
  tipStaff?: { keys: string[]; labels: string[] }
  lessons: LessonSpec[]
}

/** A tape that's planned but not recorded yet: it shows on the shelf as "Coming soon". */
export interface PlannedTape {
  planned: true
  title: string
}

/** A chapter-sized run of tapes on the shelf. */
export interface Volume {
  /** "Vol. 1", or "Bonus Vol." */
  label: string
  title: string
  tapes: (Unit | PlannedTape)[]
}

export const isPlanned = (tape: Unit | PlannedTape): tape is PlannedTape => 'planned' in tape

/** Label-stripe colors, like old cassette labels. */
const COLORS = ['#d9a441', '#d9693b', '#3f8f8b', '#5b7fa6', '#b5473a', '#8a8f3c', '#8a5a83']

const region = (strings: number[], minFret: number, maxFret: number): Region => ({ strings, minFret, maxFret })
/** First position: frets 0–3, one finger per fret. */
const firstPosition = (strings: number[]) => region(strings, 0, 3)

// Rhythm vocabulary grows tape by tape, in the order method books introduce it.
const BASICS: SymbolId[] = ['whole', 'half', 'quarter']
const WITH_RESTS: SymbolId[] = [...BASICS, 'wholeRest', 'halfRest', 'quarterRest']
const WITH_DOTTED_HALF: SymbolId[] = [...WITH_RESTS, 'dottedHalf']
const WITH_EIGHTHS: SymbolId[] = [...WITH_DOTTED_HALF, 'eighth']
const WITH_TIES: SymbolId[] = [...WITH_EIGHTHS, 'tie', 'dottedQuarter']

function stringUnit(n: number, string: number, description: string, tips: string[], extra: LessonSpec[] = []): Unit {
  const id = `u${n}`
  const s = [string]
  const name = stringName(string)
  return {
    id,
    title: `The ${name} string`,
    description,
    color: COLORS[(n - 1) % COLORS.length],
    tips,
    tipRegion: region(s, 0, 12),
    lessons: [
      { id: `${id}-1`, title: 'Frets 0–5', exercises: ['name', 'find'], region: region(s, 0, 5) },
      { id: `${id}-2`, title: 'Frets 5–12', exercises: ['name', 'find'], region: region(s, 5, 12) },
      { id: `${id}-3`, title: 'The whole string', exercises: ['name', 'find'], region: region(s, 0, 12), count: 12 },
      ...extra,
    ],
  }
}

/** Every recorded tape, in shelf order. VOLUMES below decides where each one goes. */
const TAPES: Unit[] = [
  {
    id: 'r1',
    title: 'Reading basics',
    description: 'The staff, note values and counting',
    color: COLORS[0],
    tips: [
      'Music is written on a staff: five lines and four spaces. The higher a note sits, the higher it sounds.',
      'The treble clef curls around the second line, the note G. The little 8 under a guitar clef means the guitar sounds an octave lower than written.',
      'A note’s shape tells you how long to hold it: a whole note is 4 beats, a half note 2, a quarter note 1.',
      '4/4 time means four beats in every measure. Count 1 2 3 4, one number per beat.',
    ],
    lessons: [
      { id: 'r1-1', title: 'Note values', exercises: ['symbolName', 'beats'], region: FULL_NECK, symbols: BASICS, meters: ['4/4'] },
      { id: 'r1-2', title: 'Counting in 4/4', exercises: ['countBeat', 'measureFill'], region: FULL_NECK, symbols: BASICS, meters: ['4/4'] },
      { id: 'r1-3', title: 'Tap the rhythm', exercises: ['tapRhythm'], region: FULL_NECK, symbols: BASICS, meters: ['4/4'], count: 6 },
    ],
  },
  {
    id: 'r2',
    title: 'The 1st string',
    description: 'E, F and G on the high E string',
    color: COLORS[1],
    tips: [
      'The 1st string is the thinnest one: high E.',
      'E (open) sits in the top space of the staff. F (1st fret) is on the top line. G (3rd fret) sits just above the staff.',
      'In first position the finger matches the fret: 1st finger for the 1st fret, 3rd finger for the 3rd fret.',
    ],
    tipStaff: { keys: ['e/5', 'f/5', 'g/5'], labels: ['E', 'F', 'G'] },
    tipRegion: firstPosition([5]),
    lessons: [
      { id: 'r2-1', title: 'E, F and G', exercises: ['staffName', 'staffFind'], region: firstPosition([5]) },
      {
        id: 'r2-2',
        title: 'Read and count',
        exercises: ['staffFind', 'staffName', 'countBeat', 'tapRhythm'],
        region: firstPosition([5]),
        symbols: BASICS,
        meters: ['4/4'],
      },
    ],
  },
  {
    id: 'r3',
    title: 'The 2nd string',
    description: 'B, C and D, plus rests',
    color: COLORS[2],
    tips: [
      'The 2nd string is B. Open B sits on the middle line of the staff.',
      'C (1st fret) is in the third space. D (3rd fret) is on the fourth line.',
      'Rests are beats of silence. The whole rest hangs down from the fourth line (4 beats), the half rest sits on the middle line (2 beats), and the quarter rest is the squiggle (1 beat).',
    ],
    tipStaff: { keys: ['b/4', 'c/5', 'd/5'], labels: ['B', 'C', 'D'] },
    tipRegion: firstPosition([4]),
    lessons: [
      { id: 'r3-1', title: 'B, C and D', exercises: ['staffName', 'staffFind'], region: firstPosition([4]) },
      { id: 'r3-2', title: 'Rests', exercises: ['symbolName', 'beats', 'measureFill'], region: FULL_NECK, symbols: WITH_RESTS, meters: ['4/4'] },
      {
        id: 'r3-3',
        title: 'Strings 1 and 2',
        exercises: ['staffName', 'staffFind', 'tapRhythm'],
        region: firstPosition([4, 5]),
        symbols: WITH_RESTS,
        meters: ['4/4'],
        count: 12,
      },
    ],
  },
  {
    id: 'r4',
    title: 'The 3rd string',
    description: 'G and A, plus 3/4 time',
    color: COLORS[3],
    tips: [
      'The 3rd string is G. Open G is on the second line; A (2nd fret) is in the second space.',
      '3/4 time has three beats per measure. Count 1 2 3, leaning on the 1, like a waltz.',
      'A dot adds half the note’s value. A dotted half note is 2 + 1 = 3 beats: a full measure of 3/4.',
    ],
    tipStaff: { keys: ['g/4', 'a/4'], labels: ['G', 'A'] },
    tipRegion: firstPosition([3]),
    lessons: [
      { id: 'r4-1', title: 'G and A', exercises: ['staffName', 'staffFind'], region: firstPosition([3]) },
      {
        id: 'r4-2',
        title: '3/4 and dotted halves',
        exercises: ['symbolName', 'beats', 'measureFill', 'countBeat'],
        region: FULL_NECK,
        symbols: WITH_DOTTED_HALF,
        meters: ['3/4', '4/4'],
      },
      {
        id: 'r4-3',
        title: 'Strings 1 to 3',
        exercises: ['staffName', 'staffFind', 'tapRhythm'],
        region: firstPosition([3, 4, 5]),
        symbols: WITH_DOTTED_HALF,
        meters: ['3/4', '4/4'],
        count: 12,
      },
    ],
  },
  stringUnit(7, 5, 'The 1st string, all the way up', [
    'You’ve read E, F and G on this string. Now learn the rest of it.',
    'Landmarks: 5th fret = A, 7th = B, 8th = C, 10th = D, 12th = E again.',
    'The low E string has the same notes on the same frets, so this one counts twice.',
  ]),
  {
    id: 'r5',
    title: 'The 4th string',
    description: 'D, E and F, plus eighth notes',
    color: COLORS[4],
    tips: [
      'The 4th string is D. Open D sits just below the staff.',
      'E (2nd fret) is on the bottom line. F (3rd fret) is in the first space.',
      'Eighth notes get half a beat each, so two fit in one beat. They’re joined by a beam. Count them 1 & 2 & 3 & 4 &.',
    ],
    tipStaff: { keys: ['d/4', 'e/4', 'f/4'], labels: ['D', 'E', 'F'] },
    tipRegion: firstPosition([2]),
    lessons: [
      { id: 'r5-1', title: 'D, E and F', exercises: ['staffName', 'staffFind'], region: firstPosition([2]) },
      {
        id: 'r5-2',
        title: 'Eighth notes',
        exercises: ['symbolName', 'beats', 'countBeat', 'tapRhythm'],
        region: FULL_NECK,
        symbols: WITH_EIGHTHS,
        meters: ['4/4', '3/4'],
      },
      {
        id: 'r5-3',
        title: 'Strings 1 to 4',
        exercises: ['staffName', 'staffFind', 'countBeat', 'tapRhythm'],
        region: firstPosition([2, 3, 4, 5]),
        symbols: WITH_EIGHTHS,
        meters: ['4/4', '3/4'],
        count: 12,
      },
    ],
  },
  {
    id: 'r6',
    title: 'The 5th string',
    description: 'A, B and C, plus ties and dotted quarters',
    color: COLORS[5],
    tips: [
      'The 5th string is A. Open A sits on the second ledger line below the staff.',
      'B (2nd fret) hangs just under the first ledger line. C (3rd fret) is on it: that’s middle C.',
      'A tie joins two notes of the same pitch: play the first and hold through the second.',
      'A dotted quarter note is 1 + ½ = 1½ beats, usually followed by an eighth.',
    ],
    tipStaff: { keys: ['a/3', 'b/3', 'c/4'], labels: ['A', 'B', 'C'] },
    tipRegion: firstPosition([1]),
    lessons: [
      { id: 'r6-1', title: 'A, B and C', exercises: ['staffName', 'staffFind'], region: firstPosition([1]) },
      {
        id: 'r6-2',
        title: 'Ties and dotted quarters',
        exercises: ['symbolName', 'beats', 'countBeat', 'tapRhythm'],
        region: FULL_NECK,
        symbols: WITH_TIES,
        meters: ['4/4', '3/4'],
      },
      {
        id: 'r6-3',
        title: 'Strings 1 to 5',
        exercises: ['staffName', 'staffFind', 'tapRhythm'],
        region: firstPosition([1, 2, 3, 4, 5]),
        symbols: WITH_TIES,
        meters: ['4/4', '3/4'],
        count: 12,
      },
    ],
  },
  {
    id: 'r7',
    title: 'The 6th string',
    description: 'E, F and G, down on the ledger lines',
    color: COLORS[6],
    tips: [
      'The 6th string is low E, the thickest. Its notes sit well below the staff, on ledger lines.',
      'E (open) hangs under the third ledger line. F (1st fret) is on the third ledger line. G (3rd fret) hangs under the second.',
      'Ledger lines are short extra lines. Count them from the staff down: the first one is middle C.',
    ],
    tipStaff: { keys: ['e/3', 'f/3', 'g/3'], labels: ['E', 'F', 'G'] },
    tipRegion: firstPosition([0]),
    lessons: [
      { id: 'r7-1', title: 'E, F and G', exercises: ['staffName', 'staffFind'], region: firstPosition([0]) },
      { id: 'r7-2', title: 'All six strings', exercises: ['staffName', 'staffFind'], region: firstPosition(ALL_STRINGS), count: 12 },
      {
        id: 'r7-3',
        title: 'Reading review',
        exercises: ['staffFind', 'staffName', 'countBeat', 'measureFill', 'tapRhythm'],
        region: firstPosition(ALL_STRINGS),
        symbols: WITH_TIES,
        meters: ['4/4', '3/4'],
        count: 15,
      },
    ],
  },
  stringUnit(
    1,
    0,
    'The 6th string, all the way up',
    [
      'You’ve read E, F and G here in first position. Now the whole string: E F G A B C D E.',
      'Most neighbors are 2 frets apart. The exceptions are E→F and B→C, which are just 1 fret apart.',
      'Landmarks: 3rd fret = G, 5th = A, 7th = B, 8th = C, 12th = E again.',
      'Same notes, same frets as the high E string.',
    ],
    [{ id: 'u1-4', title: 'Both E strings', exercises: ['name', 'find', 'findAll'], region: region([0, 5], 0, 12), count: 12 }],
  ),
  stringUnit(2, 1, 'The 5th string, all the way up', [
    'A B C D E F G A going up the A string.',
    'Landmarks: 3rd fret = C, 5th = D, 7th = E, 12th = A.',
    'The 1-fret steps are B→C (frets 2→3) and E→F (frets 7→8).',
  ]),
  {
    id: 'u3',
    title: 'Low E & A together',
    description: 'The root notes of most chords',
    color: COLORS[2],
    tips: [
      'These two strings hold the root of almost every barre chord and power chord.',
      'The 5th fret of the low E string is A: the same note as the open A string.',
      'The same fret on the A string is always a 4th higher: G (3rd fret, low E) sits right under C (3rd fret, A).',
    ],
    tipRegion: region([0, 1], 0, 12),
    lessons: [
      { id: 'u3-1', title: 'Frets 0–7', exercises: ['name', 'find', 'findAll'], region: region([0, 1], 0, 7) },
      { id: 'u3-2', title: 'Frets 5–12', exercises: ['name', 'find', 'findAll'], region: region([0, 1], 5, 12) },
      { id: 'u3-3', title: 'Speed round', exercises: ['name', 'find', 'findAll'], region: region([0, 1], 0, 12), count: 15 },
    ],
  },
  {
    id: 'r8',
    title: 'Sharps, flats & naturals',
    description: 'Accidentals and how long they last',
    color: COLORS[4],
    tips: [
      'A sharp (♯) raises a note one fret. A flat (♭) lowers it one fret. They’re written just before the note.',
      'An accidental lasts until the next bar line, for every note on that same line or space.',
      'A natural sign (♮) cancels a sharp or flat: the note goes back to plain.',
      'A bar line wipes the slate clean. In the next measure, notes go back to normal.',
    ],
    tipStaff: { keys: ['f#/5', 'c#/5', 'bb/4', 'f/5'], labels: ['F♯', 'C♯', 'B♭', 'F♮'] },
    lessons: [
      { id: 'r8-1', title: 'Strings 1 to 3', exercises: ['staffName', 'staffFind'], region: region([3, 4, 5], 0, 4), accidentals: true },
      { id: 'r8-2', title: 'Strings 4 to 6', exercises: ['staffName', 'staffFind'], region: region([0, 1, 2], 0, 4), accidentals: true },
      {
        id: 'r8-3',
        title: 'The measure rule',
        exercises: ['accidentalRule'],
        region: firstPosition(ALL_STRINGS),
        rules: ['carry', 'natural', 'barline'],
      },
      {
        id: 'r8-4',
        title: 'Accidentals review',
        exercises: ['staffName', 'staffFind', 'accidentalRule'],
        region: region(ALL_STRINGS, 0, 4),
        accidentals: true,
        rules: ['carry', 'natural', 'barline', 'octave'],
        count: 12,
      },
    ],
  },
  stringUnit(4, 2, 'The 4th string, all the way up', [
    'D E F G A B C D going up the D string.',
    'Landmarks: 2nd fret = E, 5th = G, 7th = A, 10th = C, 12th = D.',
    'Octave shortcut: a note on the low E string repeats 2 strings over and 2 frets up, on the D string.',
  ]),
  stringUnit(5, 3, 'The 3rd string, all the way up', [
    'G A B C D E F G going up the G string.',
    'Landmarks: 2nd fret = A, 5th = C, 7th = D, 12th = G.',
    'Octave shortcut: a note on the A string repeats 2 strings over and 2 frets up, on the G string.',
  ]),
  stringUnit(6, 4, 'The 2nd string, all the way up', [
    'B C D E F G A B going up the B string.',
    'It starts with a 1-fret step: B (open) → C (1st fret).',
    'Landmarks: 1st fret = C, 5th = E, 8th = G, 10th = A, 12th = B.',
    'The B string is tuned differently from the rest, so shapes that cross it shift up one fret.',
  ]),
  {
    id: 'u8',
    title: 'The whole neck',
    description: 'Every string, every natural note',
    color: COLORS[0],
    tips: [
      'Each string’s 5th fret is the next string’s open note, except the G string, where it’s the 4th fret.',
      'Looking for every C? Jump between them with octave shapes instead of counting frets.',
    ],
    tipRegion: FULL_NECK,
    lessons: [
      { id: 'u8-1', title: 'Frets 0–4', exercises: ['name', 'find', 'findAll'], region: region(ALL_STRINGS, 0, 4) },
      { id: 'u8-2', title: 'Frets 5–8', exercises: ['name', 'find', 'findAll'], region: region(ALL_STRINGS, 5, 8) },
      { id: 'u8-3', title: 'Frets 8–12', exercises: ['name', 'find', 'findAll'], region: region(ALL_STRINGS, 8, 12) },
      { id: 'u8-4', title: 'Find them all', exercises: ['findAll'], region: FULL_NECK, count: 8 },
      { id: 'u8-5', title: 'Everything', exercises: ['name', 'find', 'findAll'], region: FULL_NECK, count: 15 },
    ],
  },
  {
    id: 'u9',
    title: 'Sharps & flats',
    description: 'The notes in between',
    color: COLORS[1],
    tips: [
      '♯ (sharp) means one fret higher. ♭ (flat) means one fret lower.',
      'C♯ and D♭ are the same fret: two names for one note.',
      'There’s nothing between E and F or B and C. They’re already 1 fret apart.',
      'Use the natural notes you know as anchors: F♯ is one fret above F.',
    ],
    tipRegion: FULL_NECK,
    tipAccidentals: true,
    lessons: [
      { id: 'u9-1', title: 'Low E & A strings', exercises: ['name', 'find'], region: region([0, 1], 0, 12), accidentals: true },
      { id: 'u9-2', title: 'D & G strings', exercises: ['name', 'find'], region: region([2, 3], 0, 12), accidentals: true },
      { id: 'u9-3', title: 'B & high E strings', exercises: ['name', 'find'], region: region([4, 5], 0, 12), accidentals: true },
      { id: 'u9-4', title: 'Whole neck', exercises: ['name', 'find', 'findAll'], region: FULL_NECK, accidentals: true, count: 15 },
    ],
  },
  {
    id: 'r10',
    title: 'Reading phrases',
    description: 'Steps, skips and short melodies',
    color: COLORS[6],
    tips: [
      'Good readers don’t name every note. They see the shape: does the next note step, skip or leap?',
      'A step goes to the very next line or space. A skip goes from a line to the next line, or a space to the next space.',
      'Before you play a phrase, look over all of it: where it starts, which way it moves, and the key signature.',
    ],
    lessons: [
      { id: 'r10-1', title: 'Steps and skips', exercises: ['motion'], region: firstPosition(ALL_STRINGS), motions: ['same', 'step', 'skip'] },
      { id: 'r10-2', title: 'Leaps', exercises: ['motion'], region: firstPosition(ALL_STRINGS), motions: ['step', 'skip', 'leap'] },
      { id: 'r10-3', title: 'Short phrases', exercises: ['phrase'], region: firstPosition(ALL_STRINGS), count: 8 },
    ],
  },
  {
    id: 'r11',
    title: '2/4 and cut time',
    description: 'Two beats to the measure',
    color: COLORS[0],
    tips: [
      '2/4 time has two quarter-note beats per measure. Count 1 2.',
      'Cut time, written ¢, is 2/2: two beats per measure, and the half note gets the beat. Count 1 2, with quarter notes on the &.',
      'Cut time looks a lot like 4/4 on the page, but you count (and feel) half as many beats.',
    ],
    lessons: [
      { id: 'r11-1', title: '2/4 time', exercises: ['countBeat', 'measureFill', 'tapRhythm'], region: FULL_NECK, symbols: WITH_TIES, meters: ['2/4'] },
      {
        id: 'r11-2',
        title: 'Cut time',
        exercises: ['countBeat', 'measureFill', 'tapRhythm'],
        region: FULL_NECK,
        symbols: ['whole', 'half', 'quarter', 'dottedHalf', 'wholeRest', 'halfRest', 'quarterRest'],
        meters: ['2/2'],
      },
      {
        id: 'r11-3',
        title: 'Mixed meters',
        exercises: ['countBeat', 'measureFill', 'tapRhythm'],
        region: FULL_NECK,
        symbols: WITH_TIES,
        meters: ['4/4', '3/4', '2/4', '2/2'],
        count: 12,
      },
    ],
  },
  {
    id: 'u12',
    title: 'Reading up the neck',
    description: 'Same note, different places',
    color: COLORS[5],
    tips: [
      'The same written note can be played in several places. Any of them counts. After you answer, you’ll see the others.',
      '“5th position” means your first finger sits at the 5th fret, covering frets 5–8.',
    ],
    lessons: [
      { id: 'u12-1', title: '5th position', exercises: ['staffFind'], region: region(ALL_STRINGS, 5, 8) },
      { id: 'u12-2', title: '7th position', exercises: ['staffFind'], region: region(ALL_STRINGS, 7, 10) },
      { id: 'u12-3', title: 'Anywhere', exercises: ['staffFind'], region: FULL_NECK, count: 12 },
      { id: 'u12-4', title: 'Anywhere, with ♯ and ♭', exercises: ['staffFind'], region: FULL_NECK, accidentals: true, count: 12 },
    ],
  },
  {
    id: 'u13',
    title: 'Octaves',
    description: 'Jump around the neck',
    color: COLORS[6],
    tips: [
      'From the low E or A string: 2 strings over, 2 frets up.',
      'From the D or G string: 2 strings over, 3 frets up (crossing the B string adds a fret).',
      'Low E and high E: same fret, two octaves apart.',
      'Every note’s octave is also 12 frets up the same string.',
    ],
    lessons: [
      { id: 'u13-1', title: 'From the low strings', exercises: ['interval'], region: FULL_NECK, intervals: [12], rootStrings: [0, 1] },
      { id: 'u13-2', title: 'Over the B string', exercises: ['interval'], region: FULL_NECK, intervals: [12], rootStrings: [2, 3] },
      { id: 'u13-3', title: 'Anywhere', exercises: ['interval'], region: FULL_NECK, intervals: [12], rootStrings: [0, 1, 2, 3] },
    ],
  },
  {
    id: 't1',
    title: 'Whole & half steps',
    description: 'The building blocks of scales',
    color: COLORS[1],
    tips: [
      'A half step is one fret, the smallest step in music. A whole step is two frets.',
      'Neighboring letters are a whole step apart, except E–F and B–C, which are half steps.',
      'A sharp raises a note a half step and a flat lowers it a half step, so C♯ and D♭ are the same fret.',
    ],
    tipStaff: { keys: ['e/4', 'f/4', 'b/4', 'c/5'], labels: ['E', 'F', 'B', 'C'] },
    lessons: [
      { id: 't1-1', title: 'Half and whole steps', exercises: ['stepSize', 'stepFind'], region: FULL_NECK, topics: ['step:half', 'step:whole'] },
      { id: 't1-2', title: 'E–F and B–C', exercises: ['stepRead'], region: FULL_NECK, topics: ['step:letters'] },
      { id: 't1-3', title: 'Sharps and flats', exercises: ['stepNote'], region: FULL_NECK, topics: ['step:accidentals'] },
      { id: 't1-4', title: 'Steps review', exercises: ['stepSize', 'stepRead', 'stepFind', 'stepNote'], region: FULL_NECK, count: 12 },
    ],
  },
  {
    id: 't2',
    title: 'The major scale',
    description: 'Whole, whole, half, whole, whole, whole, half',
    color: COLORS[2],
    tips: [
      'Every major scale takes the same steps: whole, whole, half, whole, whole, whole, half.',
      'Number the notes up from the root: the root is 1, and the 8th note is the root again, an octave higher.',
      'Each letter appears once, in order. That’s why F major has B♭ and not A♯.',
      'C major is the only major scale with no sharps or flats: its half steps land on E–F and B–C.',
    ],
    tipStaff: { keys: ['c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5'], labels: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] },
    lessons: [
      { id: 't2-1', title: 'The formula', exercises: ['scaleStep'], region: FULL_NECK, topics: ['scale:formula'] },
      { id: 't2-2', title: 'Scale degrees', exercises: ['scaleNote'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F'], topics: ['scale:degrees'] },
      { id: 't2-3', title: 'One of each letter', exercises: ['scaleNote'], region: FULL_NECK, keys: ['A', 'E', 'Bb', 'Eb'], topics: ['scale:letters'] },
      {
        id: 't2-4',
        title: 'Any major scale',
        exercises: ['scaleNote', 'scaleStep'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db'],
        count: 12,
      },
    ],
  },
  {
    id: 't3',
    title: 'Major scale patterns',
    description: 'The scale as a shape on the neck',
    color: COLORS[3],
    tips: [
      'With the root on the 6th or 5th string, a major scale fits in five frets: from one fret below the root to three above.',
      'Learn where each degree sits around the root. The shape stays the same wherever you move it, so moving it changes the key.',
      'Root on the 6th string at the 3rd fret is G major, and at the 5th fret it’s A major. Root on the 5th string at the 3rd fret is C major, shown below.',
    ],
    // C major with its root on the 5th string: every natural note from the 2nd fret to the 6th.
    tipRegion: region(ALL_STRINGS, 2, 6),
    lessons: [
      { id: 't3-1', title: 'Root on the 6th string', exercises: ['degreeName', 'degreeFind'], region: FULL_NECK, rootStrings: [0], topics: ['pattern:6'] },
      { id: 't3-2', title: 'Root on the 5th string', exercises: ['degreeName', 'degreeFind'], region: FULL_NECK, rootStrings: [1], topics: ['pattern:5'] },
      { id: 't3-3', title: 'Both patterns', exercises: ['degreeName', 'degreeFind'], region: FULL_NECK, rootStrings: [0, 1], count: 12 },
    ],
  },
  {
    id: 'r9',
    title: 'Key signatures',
    description: 'Sharps and flats for the whole piece',
    color: COLORS[5],
    tips: [
      'The sharps or flats right after the clef are the key signature. They apply to every note with that letter, on every line and space, for the whole piece.',
      'G major has one sharp, F♯. D major has two, F♯ and C♯. F major has one flat, B♭. C major has none.',
      'They’re the sharps or flats of the key’s major scale, written once at the start instead of on every note.',
      'To name a sharp key, go one fret above the last sharp: F♯ → G, C♯ → D. One flat means F major.',
    ],
    lessons: [
      { id: 'r9-1', title: 'Key of G', exercises: ['keyNote'], region: region(ALL_STRINGS, 0, 4), keys: ['G'] },
      { id: 'r9-2', title: 'Keys of D and F', exercises: ['keyNote'], region: region(ALL_STRINGS, 0, 4), keys: ['D', 'F'] },
      { id: 'r9-3', title: 'Name the key', exercises: ['keyName'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F'] },
      { id: 'r9-4', title: 'Reading in keys', exercises: ['keyNote', 'keyName'], region: region(ALL_STRINGS, 0, 4), keys: ['C', 'G', 'D', 'F'], count: 12 },
      // Keeps its id from when it closed Reading phrases, so saved progress carries over.
      { id: 'r10-4', title: 'Phrases in G', exercises: ['phrase'], region: region(ALL_STRINGS, 0, 4), keys: ['G'], count: 8 },
    ],
  },
  {
    id: 't4',
    title: 'The circle of fifths',
    description: 'Every key, in order',
    color: COLORS[6],
    tips: [
      'Going clockwise, each key is a fifth higher and adds a sharp: C G D A E B F♯ C♯.',
      'Going counterclockwise, each key is a fifth lower and adds a flat: C F B♭ E♭ A♭ D♭ G♭ C♭.',
      'Sharps are always added in the order F C G D A E B, and flats in the reverse order: B E A D G C F.',
      'A sharp key is a half step above its last sharp. A flat key is its second-to-last flat, and one flat is F major.',
    ],
    lessons: [
      {
        id: 't4-1',
        title: 'Sharp keys',
        exercises: ['keyName', 'keySignature'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'],
        topics: ['circle:sharps'],
      },
      {
        id: 't4-2',
        title: 'Flat keys',
        exercises: ['keyName', 'keySignature'],
        region: FULL_NECK,
        keys: ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
        topics: ['circle:flats'],
      },
      { id: 't4-3', title: 'All the way around', exercises: ['keyName', 'keySignature', 'keyNote'], region: region(ALL_STRINGS, 0, 4), keys: KEY_ORDER, count: 12 },
    ],
  },
  {
    id: 't5',
    title: 'Relative minor',
    description: 'Two keys, one key signature',
    color: COLORS[4],
    tips: [
      'Every major key shares its key signature with a minor key: its relative minor.',
      'The relative minor starts on the 6th note of the major scale. C major and A minor have no sharps or flats; G major and E minor share F♯.',
      'On the neck, the relative minor is 3 frets below the major key’s root, on the same string.',
      'The natural minor scale is the relative major’s notes starting from the 6th: whole, half, whole, whole, half, whole, whole.',
    ],
    tipStaff: { keys: ['a/4', 'b/4', 'c/5', 'd/5', 'e/5', 'f/5', 'g/5', 'a/5'], labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'] },
    lessons: [
      { id: 't5-1', title: 'Relative keys', exercises: ['relativeKey'], region: FULL_NECK, keys: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'], topics: ['rel:keys'] },
      { id: 't5-2', title: 'On the neck', exercises: ['relativeFind'], region: FULL_NECK, topics: ['rel:neck'] },
      { id: 't5-3', title: 'The natural minor scale', exercises: ['minorNote'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'Bb', 'A'], topics: ['minor:scale'] },
      {
        id: 't5-4',
        title: 'Relative minor review',
        exercises: ['relativeKey', 'relativeFind', 'minorNote'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'],
        count: 12,
      },
    ],
  },
  {
    id: 'u14',
    title: 'Intervals',
    description: 'The shapes behind chords',
    color: COLORS[0],
    tips: [
      'Perfect 5th: next string, 2 frets up. That’s the power chord shape. (To the B string: 3 frets up.)',
      'Perfect 4th: next string, same fret. (To the B string: 1 fret up.)',
      'Major 3rd: next string, 1 fret down. (To the B string: same fret.)',
      'Minor 3rd: next string, 2 frets down. (To the B string: 1 fret down.)',
    ],
    lessons: [
      { id: 'u14-1', title: 'Perfect 5ths', exercises: ['interval'], region: FULL_NECK, intervals: [7], rootStrings: [0, 1, 2, 3, 4] },
      { id: 'u14-2', title: 'Perfect 4ths', exercises: ['interval'], region: FULL_NECK, intervals: [5], rootStrings: [0, 1, 2, 3, 4] },
      { id: 'u14-3', title: 'Major & minor 3rds', exercises: ['interval'], region: FULL_NECK, intervals: [3, 4], rootStrings: [0, 1, 2, 3, 4] },
      {
        id: 'u14-4',
        title: 'Name that interval',
        exercises: ['intervalName'],
        region: FULL_NECK,
        intervals: [3, 4, 5, 7, 12],
        rootStrings: [0, 1, 2, 3],
        count: 12,
      },
    ],
  },
  {
    id: 't6',
    title: 'Naming intervals',
    description: 'Number and quality',
    color: COLORS[1],
    tips: [
      'An interval’s number counts the letters, both ends included: C up to G is C D E F G, a 5th.',
      'Up from the root of a major scale, 2nds, 3rds, 6ths and 7ths are major; 4ths, 5ths and octaves are perfect.',
      'A major interval made a half step smaller is minor. A perfect or major one made a half step bigger is augmented; a perfect or minor one made smaller is diminished.',
      'The tritone is 6 half steps: an augmented 4th or a diminished 5th, depending on the letters.',
    ],
    lessons: [
      { id: 't6-1', title: 'Interval numbers', exercises: ['ivNumber'], region: FULL_NECK, topics: ['ivname:number'] },
      { id: 't6-2', title: 'Major and perfect', exercises: ['ivName'], region: FULL_NECK, ivNames: ['M2', 'M3', 'P4', 'P5', 'M6', 'M7', 'P8'], topics: ['ivname:major'] },
      { id: 't6-3', title: 'Minor intervals', exercises: ['ivName'], region: FULL_NECK, ivNames: ['m2', 'M2', 'm3', 'M3', 'm6', 'M6', 'm7', 'M7'], topics: ['ivname:minor'] },
      { id: 't6-4', title: 'The tritone', exercises: ['ivName'], region: FULL_NECK, ivNames: ['P4', 'A4', 'd5', 'P5', 'A5', 'm6'], topics: ['ivname:altered'] },
      {
        id: 't6-5',
        title: 'Naming review',
        exercises: ['ivName', 'ivNumber'],
        region: FULL_NECK,
        ivNames: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'A5', 'm6', 'M6', 'm7', 'M7', 'P8'],
        count: 12,
      },
    ],
  },
  {
    id: 't7',
    title: 'Intervals on the staff',
    description: 'Reading intervals in a key',
    color: COLORS[2],
    tips: [
      'Line to line, or space to space, is an odd number: 3rd, 5th, 7th. A line and a space make an even number: 2nd, 4th, 6th.',
      'Read the key signature first: in D major, F up to A is F♯ up to A, a minor 3rd.',
      'Notes stacked on one stem are played together. Read them from the bottom up.',
    ],
    lessons: [
      { id: 't7-1', title: 'Seeing the number', exercises: ['ivReadNumber'], region: FULL_NECK, topics: ['ivstaff:number'] },
      {
        id: 't7-2',
        title: 'Names in a key',
        exercises: ['ivReadName'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'F', 'Bb'],
        ivNames: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
        topics: ['ivstaff:name'],
      },
      {
        id: 't7-3',
        title: 'Stacked notes',
        exercises: ['ivReadName'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'F', 'Bb'],
        ivNames: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
        stacked: true,
        topics: ['ivstaff:stacked'],
      },
    ],
  },
  {
    id: 't8',
    title: 'Inversions',
    description: 'Turning intervals upside down',
    color: COLORS[3],
    tips: [
      'Move the bottom note up an octave and the interval turns upside down. The two numbers always add up to 9.',
      'Major turns into minor and minor into major; augmented turns into diminished; perfect stays perfect.',
      'A 4th up and a 5th down land on the same letter. So do a 3rd up and a 6th down.',
    ],
    lessons: [
      { id: 't8-1', title: 'Flip it', exercises: ['ivFlip'], region: FULL_NECK, topics: ['invert:numbers'] },
      { id: 't8-2', title: 'Qualities flip', exercises: ['ivInvert'], region: FULL_NECK, ivNames: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'], topics: ['invert:qualities'] },
      { id: 't8-3', title: 'On the neck', exercises: ['ivBelow'], region: FULL_NECK, ivNames: ['m3', 'M3', 'P4', 'P5', 'm6', 'M6'], topics: ['invert:neck'] },
      {
        id: 't8-4',
        title: 'Inversions review',
        exercises: ['ivFlip', 'ivInvert', 'ivBelow'],
        region: FULL_NECK,
        ivNames: ['m3', 'M3', 'P4', 'P5', 'm6', 'M6'],
        count: 12,
      },
    ],
  },
  {
    id: 't9',
    title: 'Hearing intervals',
    description: 'Ear training: headphones on',
    color: COLORS[6],
    tips: [
      'This tape needs sound, so put headphones on. No sound right now? “Can’t listen now” pauses listening questions for 15 minutes.',
      'Start with the sounds that are most different, then the ones that sound alike. Listen to the whole interval before you answer, and replay it as often as you like.',
      'Octaves sound like the same note; 5ths sound open and strong; major 3rds bright and minor 3rds darker; 2nds are next-door neighbors.',
    ],
    lessons: [
      { id: 't9-1', title: 'Octaves and 5ths', exercises: ['ivHear'], region: FULL_NECK, ivNames: ['P5', 'P8'], ear: ['up'], topics: ['ear:octave-fifth'] },
      { id: 't9-2', title: 'Add 4ths', exercises: ['ivHear'], region: FULL_NECK, ivNames: ['P4', 'P5', 'P8'], ear: ['up', 'down'], topics: ['ear:fourth'] },
      { id: 't9-3', title: 'Major and minor 3rds', exercises: ['ivHear'], region: FULL_NECK, ivNames: ['m3', 'M3', 'P4', 'P5'], ear: ['up', 'down'], topics: ['ear:thirds'] },
      { id: 't9-4', title: '2nds', exercises: ['ivHear'], region: FULL_NECK, ivNames: ['m2', 'M2', 'm3', 'M3'], ear: ['up', 'down', 'together'], topics: ['ear:seconds'] },
      {
        id: 't9-5',
        title: '6ths, 7ths and the tritone',
        exercises: ['ivHear'],
        region: FULL_NECK,
        ivNames: ['A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
        ear: ['up', 'down', 'together'],
        topics: ['ear:wide'],
      },
      { id: 't9-6', title: 'By ear on the neck', exercises: ['ivHearFind'], region: FULL_NECK, ivNames: ['M2', 'm3', 'M3', 'P4', 'P5', 'P8'], topics: ['ear:neck'] },
    ],
  },
]

const tape = (id: string): Unit => TAPES.find((u) => u.id === id)!
const soon = (title: string): PlannedTape => ({ planned: true, title })

/**
 * One shelf, one path, a volume per chapter. Volume 1 follows the method-book reading order
 * (first position, high E string first, a new rhythm idea with each string), with fretboard
 * tapes taking each string up the neck once it's been read. From Volume 3 on, the volumes
 * follow the order a guitar theory course takes: scales and keys, intervals, triads, chords.
 */
export const VOLUMES: Volume[] = [
  { label: 'Vol. 1', title: 'Reading & the Neck', tapes: ['r1', 'r2', 'r3', 'r4', 'u7', 'r5', 'r6', 'r7', 'u1', 'u2', 'u3'].map(tape) },
  { label: 'Vol. 2', title: 'The Whole Neck', tapes: ['r8', 'u4', 'u5', 'u6', 'u8', 'u9', 'r10', 'r11', 'u12', 'u13'].map(tape) },
  { label: 'Vol. 3', title: 'Scales & Keys', tapes: ['t1', 't2', 't3', 'r9', 't4', 't5'].map(tape) },
  { label: 'Vol. 4', title: 'Intervals', tapes: ['u14', 't6', 't7', 't8', 't9'].map(tape) },
  { label: 'Vol. 5', title: 'Triads', tapes: [soon('Building triads'), soon('Triads on the neck'), soon('Triad inversions')] },
  { label: 'Vol. 6', title: 'Chords in a Key', tapes: [soon('The chords in a key'), soon('Roman numerals')] },
  { label: 'Vol. 7', title: 'Building Chords', tapes: [soon('7th chords'), soon('Sus, add & 6 chords'), soon('Chord symbols & diagrams')] },
  { label: 'Vol. 8', title: 'Minor Keys', tapes: [soon('Chords in minor keys'), soon('Finding the key')] },
  { label: 'Vol. 9', title: 'Blues & Pentatonics', tapes: [soon('Pentatonic patterns'), soon('The 12-bar blues')] },
  { label: 'Vol. 10', title: 'Modes', tapes: [soon('The modes'), soon('Modal sounds')] },
  { label: 'Vol. 11', title: 'More Scales & Arpeggios', tapes: [soon('Harmonic & melodic minor'), soon('Arpeggio shapes')] },
  { label: 'Vol. 12', title: 'Chord Swaps', tapes: [soon('Substitutions'), soon('Reharmonizing')] },
  { label: 'Bonus Vol.', title: 'Reading Extras', tapes: [soon('Road signs'), soon('6/8 & triplets'), soon('Reading TAB')] },
]

/** The recorded tapes, in the order you work through them. */
export const UNITS: Unit[] = VOLUMES.flatMap((v) => v.tapes.filter((t): t is Unit => !isPlanned(t)))

export const ALL_LESSONS: LessonSpec[] = UNITS.flatMap((u) => u.lessons)

/** Tracks you can only do with sound: ear training. */
export const isListening = (l: LessonSpec) => l.exercises.some((e) => e === 'ivHear' || e === 'ivHearFind')

// Planned tapes get numbers too, so a tape's number never changes when the ones before it are recorded.
const NUMBERS = new Map(VOLUMES.flatMap((v) => v.tapes).map((t, i) => [t, i + 1]))

/** A tape's number on the shelf. */
export const tapeNumber = (t: Unit | PlannedTape): number => NUMBERS.get(t)!

/** The number of the tape to finish before this one opens: the recorded tape just before it. */
export const tapeBefore = (unit: Unit): number => tapeNumber(UNITS[UNITS.indexOf(unit) - 1])

export function findLesson(id: string): { unit: Unit; lesson: LessonSpec } | null {
  for (const unit of UNITS) {
    const lesson = unit.lessons.find((l) => l.id === id)
    if (lesson) return { unit, lesson }
  }
  return null
}
