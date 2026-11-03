import { ALL_STRINGS, FULL_NECK, stringName, type Region } from './notes'
import type { Meter, SymbolId } from './rhythm'

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

/**
 * One shelf, one path. Reading tapes follow the method-book order (first position, high E
 * string first, a new rhythm idea with each string); fretboard tapes slot in to take each
 * string up the neck once it's been read.
 */
export const UNITS: Unit[] = [
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
    id: 'u11',
    title: 'Reading sharps & flats',
    description: 'Accidentals on the staff',
    color: COLORS[4],
    tips: [
      'A ♯ before a note means play it one fret higher; a ♭ means one fret lower.',
      'In real music an accidental lasts until the end of the measure. Here, every note stands alone.',
    ],
    tipStaff: { keys: ['f#/4', 'bb/4', 'c#/5', 'eb/5'], labels: ['F♯', 'B♭', 'C♯', 'E♭'] },
    lessons: [
      { id: 'u11-1', title: 'Name them', exercises: ['staffName'], region: FULL_NECK, accidentals: true, writtenRange: [57, 81] },
      { id: 'u11-2', title: 'Open position', exercises: ['staffFind'], region: region(ALL_STRINGS, 0, 4), accidentals: true },
      { id: 'u11-3', title: 'Mixed', exercises: ['staffFind', 'staffName'], region: region(ALL_STRINGS, 0, 4), accidentals: true, count: 12 },
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
]

export const ALL_LESSONS: LessonSpec[] = UNITS.flatMap((u) => u.lessons)

export function findLesson(id: string): { unit: Unit; lesson: LessonSpec } | null {
  for (const unit of UNITS) {
    const lesson = unit.lessons.find((l) => l.id === id)
    if (lesson) return { unit, lesson }
  }
  return null
}
