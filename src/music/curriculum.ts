import { ALL_STRINGS, FULL_NECK, stringName, type Region } from './notes'
import type { Meter, SymbolId } from './rhythm'
import { KEY_ORDER, type AccidentalRule, type KeyId, type MotionKind } from './score'
import type { TriadQuality } from './theory'

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
  | 'circleNext' // count five letters up: which key comes next around the circle?
  | 'triadLetters' // "which letters make a triad on D?"
  | 'triadSpell' // "what notes make a D major triad?"
  | 'triadThird' // in a triad, the interval between two of its notes
  | 'triadQuality' // "C E♭ G: which kind of triad?"
  | 'triadRead' // a triad stacked on the staff, in a key: name it
  | 'triadInversion' // a triad on the staff: root position, 1st or 2nd inversion?
  | 'triadShapeName' // a three-string shape on the neck: which triad?
  | 'triadShapeFind' // two notes of a triad shape: tap the third
  | 'triadHear' // hear a triad: which kind?
  | 'chordOnDegree' // "what's the chord on the 2nd note of C major?"
  | 'degreeQuality' // "in any major key, what kind of chord is on the 6th note?"
  | 'numeralToChord' // "in D major, what's the ii chord?"
  | 'chordToNumeral' // "in C major, which numeral is A minor?"
  | 'numeralRead' // a chord on the staff in a key: which numeral?
  | 'primaryChord' // I, IV and V by numeral or by what they do
  | 'boxFind' // the I chord's root on the neck: tap IV's or V's
  | 'progressionSpell' // "in G major, what are the roots of I–V–vi–IV?"
  | 'progressionName' // "in C major, which progression is C, A minor, F, G?"
  | 'cadenceHear' // hear a progression: does it end at home?
  | 'fourFiveHear' // hear I and another chord: IV or V?
  | 'progressionHear' // hear a progression: which one?

export interface LessonSpec {
  id: string
  title: string
  exercises: ExerciseType[]
  region: Region
  /** Include sharps and flats (otherwise natural notes only). */
  accidentals?: boolean
  /** Semitone sizes for interval exercises. */
  intervals?: number[]
  /** Strings the interval root can be on (defaults to the region's strings). */
  rootStrings?: number[]
  /** Note values, rests and markings that rhythm exercises may use. */
  symbols?: SymbolId[]
  /** Time signatures for rhythm exercises (default 4/4). */
  meters?: Meter[]
  /** Which accidental rules the measure-rule questions test. */
  rules?: AccidentalRule[]
  /** Key signatures used (key questions and phrases; phrases default to C, no signature). On triad tracks, the roots triads are built on. */
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
  /** The kinds of triad a track's triad questions use. */
  triads?: TriadQuality[]
  /** Triads on the staff may have their 3rd or 5th on the bottom. */
  inverted?: boolean
  /** Progressions a track's questions use, by numerals ("I-V-vi-IV"). */
  progressions?: string[]
  /** Early relative-key and triad questions show the scale on the staff to count along (later tracks take that help away). */
  showScale?: boolean
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
      'Written music shows two things about each note: how high it sounds (where it sits on the staff) and how long it lasts (its shape).',
      'The beat is the steady pulse you tap your foot to. Beats are grouped into measures, separated by bar lines.',
      'A note’s shape tells you how long to hold it: a whole note is 4 beats, a half note 2, a quarter note 1.',
      'The time signature’s top number is the beats in each measure. 4/4 means four: count 1 2 3 4, one number per beat.',
    ],
    lessons: [
      {
        id: 'r1-1',
        title: 'Note values',
        exercises: ['symbolName', 'beats'],
        region: FULL_NECK,
        symbols: BASICS,
        meters: ['4/4'],
        topics: ['basics:written', 'basics:beat', 'basics:measure'],
      },
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
      'The staff has five lines and four spaces; the higher a note sits, the higher it sounds. Guitar music uses the treble clef, the curly sign at the start.',
      'The 1st string is the thinnest one: high E.',
      'E (open) sits in the top space of the staff. F (1st fret) is on the top line. G (3rd fret) sits just above the staff.',
      'First position means your hand sits at the first frets, one finger per fret: 1st finger for the 1st fret, 3rd finger for the 3rd fret.',
    ],
    tipStaff: { keys: ['e/5', 'f/5', 'g/5'], labels: ['E', 'F', 'G'] },
    tipRegion: firstPosition([5]),
    lessons: [
      { id: 'r2-1', title: 'E, F and G', exercises: ['staffName', 'staffFind'], region: firstPosition([5]), topics: ['basics:staff', 'basics:clef'] },
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
      'Notes below the staff sit on ledger lines: short extra lines added under (or over) the staff.',
      'The 5th string is A. Open A sits on the second ledger line below the staff.',
      'B (2nd fret) hangs just under the first ledger line. C (3rd fret) is on it: that’s middle C, the C in the middle of a piano keyboard.',
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
      'Most chords are built up from one note, the root, and on guitar it’s usually on one of these two strings.',
      'The 5th fret of the low E string is A: the same note as the open A string.',
      'On the same fret, the A string’s note is always four letters higher: G (3rd fret, low E) sits right next to C (3rd fret, A).',
    ],
    tipRegion: region([0, 1], 0, 12),
    lessons: [
      { id: 'u3-1', title: 'Frets 0–7', exercises: ['name', 'find', 'findAll'], region: region([0, 1], 0, 7), topics: ['intro:low-strings', 'intro:fifth-fret'] },
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
      'Sharps, flats and naturals written in front of notes are called accidentals. An accidental lasts until the next bar line, for every note on that same line or space.',
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
    'Shortcut: a note on the low E string comes back one level higher (an octave) 2 strings over and 2 frets up, on the D string.',
  ]),
  stringUnit(5, 3, 'The 3rd string, all the way up', [
    'G A B C D E F G going up the G string.',
    'Landmarks: 2nd fret = A, 5th = C, 7th = D, 12th = G.',
    'Shortcut: a note on the A string comes back one level higher (an octave) 2 strings over and 2 frets up, on the G string.',
  ]),
  stringUnit(6, 4, 'The 2nd string, all the way up', [
    'B C D E F G A B going up the B string.',
    'It starts with a 1-fret step: B (open) → C (1st fret).',
    'Landmarks: 1st fret = C, 5th = E, 8th = G, 10th = A, 12th = B.',
    'The B string is tuned a little differently from the others. Later you’ll see that patterns crossing it shift up one fret.',
  ]),
  {
    id: 'u8',
    title: 'The whole neck',
    description: 'Every string, every natural note',
    color: COLORS[0],
    tips: [
      'Each string’s 5th fret is the next string’s open note, except the G string, where it’s the 4th fret.',
      'Looking for every C? The same note comes back on other strings; tape 21 shows quick shapes to jump between them.',
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
      'Before you play a phrase, look over all of it: where it starts and which way it moves.',
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
    description: 'The same note, one level up',
    color: COLORS[6],
    tips: [
      'An octave is the same note name, one level higher. On one string it’s 12 frets up.',
      'From the 6th or 5th string: skip one string and go 2 frets up.',
      'From the 4th or 3rd string: skip one string and go 3 frets up (the B string adds a fret).',
      'The two E strings have the same notes on the same frets, two octaves apart.',
    ],
    lessons: [
      { id: 'u13-1', title: 'From the low strings', exercises: ['interval'], region: FULL_NECK, intervals: [12], rootStrings: [0, 1], topics: ['oct:what', 'oct:why'] },
      { id: 'u13-2', title: 'Over the B string', exercises: ['interval'], region: FULL_NECK, intervals: [12], rootStrings: [2, 3] },
      { id: 'u13-3', title: 'Anywhere', exercises: ['interval'], region: FULL_NECK, intervals: [12], rootStrings: [0, 1, 2, 3], topics: ['oct:e-strings'] },
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
      { id: 't1-1', title: 'Half and whole steps', exercises: ['stepSize', 'stepFind'], region: FULL_NECK, topics: ['step:why', 'step:half', 'step:whole'] },
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
      'A scale is a set of notes played in order, from a starting note (the root) up to the same note an octave higher.',
      'Every major scale uses the same steps from its root: whole, whole, half, whole, whole, whole, half. On one string that’s 2, 2, 1, 2, 2, 2, 1 frets.',
      'Number a scale’s notes up from the root, which is 1. These numbers are called degrees.',
      'Each letter appears once, in order. That’s why the F major scale has B♭, not A♯.',
    ],
    tipStaff: { keys: ['c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5'], labels: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] },
    lessons: [
      { id: 't2-1', title: 'The major scale’s steps', exercises: ['scaleStep'], region: FULL_NECK, topics: ['scale:what', 'scale:formula', 'scale:c-major'] },
      // New in the middle of the tape, so it gets the next free id.
      { id: 't2-5', title: 'Building a scale', exercises: ['scaleNote'], region: FULL_NECK, keys: ['G', 'D', 'F'], topics: ['scale:build'] },
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
      'A shape (or pattern) spreads a scale across the strings so it fits under one hand, in about five frets.',
      'Find the root first, on the 6th or 5th string. The rest of the shape sits from one fret below it to three above.',
      'Slide the shape and the root moves with it, so the same shape plays every major scale. G major at the 3rd fret becomes A major at the 5th.',
      'Shown below: C major, with its root on the 5th string at the 3rd fret.',
    ],
    // C major with its root on the 5th string: every natural note from the 2nd fret to the 6th.
    tipRegion: region(ALL_STRINGS, 2, 6),
    lessons: [
      { id: 't3-1', title: 'Root on the 6th string', exercises: ['degreeName', 'degreeFind'], region: FULL_NECK, rootStrings: [0], topics: ['pattern:why', 'pattern:root', 'pattern:6', 'pattern:move'] },
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
      'A key is a piece of music’s home base: a home note, plus the scale that supplies its notes.',
      'The sharps or flats right after the clef are the key signature. They apply to every note with that letter, on every line and space, for the whole piece.',
      'G major has one sharp, F♯. D major has two, F♯ and C♯. F major has one flat, B♭. C major has none.',
      'They’re the sharps or flats of the key’s major scale, written once at the start instead of on every note.',
      'To name a sharp key, go one fret above the last sharp: F♯ → G, C♯ → D. One flat means F major.',
    ],
    lessons: [
      { id: 'r9-1', title: 'Key of G', exercises: ['keyNote'], region: region(ALL_STRINGS, 0, 4), keys: ['G'], topics: ['scale:key'] },
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
      'The circle of fifths puts the 15 major keys in order. Neighbors share all their notes but one.',
      'Going clockwise, each key is five letters up from the last (a fifth) and adds one sharp: C G D A E B F♯ C♯.',
      'Sharps are added in the order F C G D A E B (Father Charles Goes Down And Ends Battle). A sharp key is named one fret above its last sharp.',
      'Going counterclockwise, each key is five letters down and adds one flat: C F B♭ E♭ A♭ D♭ G♭ C♭. A flat key is named after its second-to-last flat; one flat is F major.',
    ],
    lessons: [
      {
        id: 't4-1',
        title: 'Counting up to the next key',
        exercises: ['circleNext', 'keySignature'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'A', 'E', 'B'],
        topics: ['circle:why', 'circle:fifth', 'circle:addsharp'],
      },
      {
        id: 't4-4',
        title: 'The order of sharps',
        exercises: ['keyName', 'keySignature'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'],
        topics: ['circle:sharps', 'circle:name-sharp'],
      },
      {
        id: 't4-2',
        title: 'Flat keys',
        exercises: ['keyName', 'keySignature'],
        region: FULL_NECK,
        keys: ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
        topics: ['circle:flats', 'circle:name-flat'],
      },
      {
        id: 't4-3',
        title: 'All the way around',
        exercises: ['keyName', 'keySignature', 'keyNote', 'circleNext'],
        region: region(ALL_STRINGS, 0, 4),
        keys: KEY_ORDER,
        count: 12,
        topics: ['circle:map'],
      },
    ],
  },
  {
    id: 't5',
    title: 'Relative minor',
    description: 'Two keys that share their notes',
    color: COLORS[4],
    tips: [
      'A key is a song’s home base: a home note, plus the scale that supplies its notes.',
      'Every major key has a relative minor: a minor key that uses exactly the same notes, with a different home note.',
      'To find it, count up the major scale to its 6th note. G major goes G A B C D E, so its relative minor is E minor.',
      'On the neck: from the major key’s home note, go 3 frets back toward the tuning pegs on the same string.',
      'Relatives share a key signature. One sharp means G major or E minor; the home note tells you which.',
    ],
    tipStaff: { keys: ['a/4', 'b/4', 'c/5', 'd/5', 'e/5', 'f/5', 'g/5', 'a/5'], labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'] },
    lessons: [
      // Ids stay with their tracks so saved progress carries over; the new second track is t5-5.
      {
        id: 't5-1',
        title: 'Same notes, new home',
        exercises: ['relativeKey'],
        region: FULL_NECK,
        keys: ['C', 'G', 'F'],
        showScale: true,
        topics: ['rel:why', 'rel:moods', 'rel:home'],
      },
      {
        id: 't5-5',
        title: 'Finding it in any key',
        exercises: ['relativeKey'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'],
        topics: ['rel:sixth', 'rel:signature'],
      },
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
      'An interval is the distance between two notes. On the guitar, each interval makes the same shape from any note.',
      'Perfect 5th: next string over, 2 frets up (3 onto the B string). It’s the power chord shape.',
      'Perfect 4th: next string over, same fret (1 fret up onto the B string).',
      'Major 3rd: next string over, 1 fret back (same fret onto the B string). Minor 3rd: 2 frets back (1 fret back onto the B string).',
      'The next tape explains the names: what “perfect”, “major” and “minor” mean.',
    ],
    lessons: [
      { id: 'u14-1', title: 'Perfect 5ths', exercises: ['interval'], region: FULL_NECK, intervals: [7], rootStrings: [0, 1, 2, 3, 4], topics: ['ivshape:what', 'ivshape:why'] },
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
      { id: 't6-1', title: 'Interval numbers', exercises: ['ivNumber'], region: FULL_NECK, topics: ['ivname:parts', 'ivname:number'] },
      { id: 't6-2', title: 'Major and perfect', exercises: ['ivName'], region: FULL_NECK, ivNames: ['M2', 'M3', 'P4', 'P5', 'M6', 'M7', 'P8'], topics: ['ivname:major'] },
      { id: 't6-3', title: 'Minor intervals', exercises: ['ivName'], region: FULL_NECK, ivNames: ['m2', 'M2', 'm3', 'M3', 'm6', 'M6', 'm7', 'M7'], topics: ['ivname:minor'] },
      { id: 't6-4', title: 'The tritone', exercises: ['ivName'], region: FULL_NECK, ivNames: ['P4', 'A4', 'd5', 'P5', 'A5', 'm6'], topics: ['ivname:altered', 'ivname:tritone'] },
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
      { id: 't7-1', title: 'Seeing the number', exercises: ['ivReadNumber'], region: FULL_NECK, topics: ['ivstaff:why', 'ivstaff:number'] },
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
      { id: 't8-1', title: 'Flip it', exercises: ['ivFlip'], region: FULL_NECK, topics: ['invert:what', 'invert:numbers'] },
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
      { id: 't9-1', title: 'Octaves and 5ths', exercises: ['ivHear'], region: FULL_NECK, ivNames: ['P5', 'P8'], ear: ['up'], topics: ['ear:why', 'ear:octave-fifth'] },
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
  {
    id: 'tr1',
    title: 'Building triads',
    description: 'Three notes, stacked in 3rds',
    color: COLORS[4],
    tips: [
      'A triad is three notes stacked in 3rds: a root, the 3rd above it, and the 5th above the root.',
      'Skip a letter each time: C E G, D F A, E G B.',
      'A major triad is the 1st, 3rd and 5th notes of the major scale on its root: D major is D F♯ A.',
      'Without the scale: from the root, go up a major 3rd (4 half steps), then a minor 3rd (3 half steps).',
    ],
    lessons: [
      { id: 'tr1-1', title: 'Three notes, stacked', exercises: ['triadLetters'], region: FULL_NECK, topics: ['triad:why', 'triad:what', 'triad:letters'], count: 8 },
      { id: 'tr1-2', title: 'Major triads', exercises: ['triadSpell'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'A', 'E'], showScale: true, topics: ['triad:major'] },
      { id: 'tr1-3', title: 'Built from 3rds', exercises: ['triadThird', 'triadSpell'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'A', 'E', 'Bb', 'Eb'], topics: ['triad:thirds'] },
      {
        id: 'tr1-4',
        title: 'Major triads review',
        exercises: ['triadSpell', 'triadThird'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'F', 'A', 'E', 'B', 'Bb', 'Eb', 'Ab'],
        count: 12,
      },
    ],
  },
  {
    id: 'tr2',
    title: 'Minor triads',
    description: 'One note lower',
    color: COLORS[5],
    tips: [
      'Lower the 3rd of a major triad by a half step and it becomes minor: C E G → C E♭ G.',
      'Check the bottom 3rd: a major 3rd (4 half steps) means major, a minor 3rd (3 half steps) means minor.',
      'A minor triad is the 1st, 3rd and 5th of the natural minor scale on its root: A minor is A C E.',
    ],
    lessons: [
      { id: 'tr2-1', title: 'One note lower', exercises: ['triadSpell'], region: FULL_NECK, triads: ['min'], keys: ['A', 'E', 'D', 'G', 'C', 'F', 'B'], showScale: true, topics: ['triad:minor'] },
      { id: 'tr2-2', title: 'Major or minor?', exercises: ['triadQuality'], region: FULL_NECK, triads: ['maj', 'min'], keys: ['A', 'E', 'D', 'G', 'C', 'F', 'B'], topics: ['triad:which'] },
      {
        id: 'tr2-3',
        title: 'Minor in any key',
        exercises: ['triadSpell', 'triadThird'],
        region: FULL_NECK,
        triads: ['min'],
        keys: ['A', 'E', 'D', 'B', 'G', 'C', 'F', 'F#', 'Bb', 'Eb'],
        topics: ['triad:minor-scale'],
      },
      {
        id: 'tr2-4',
        title: 'Minor triads review',
        exercises: ['triadSpell', 'triadQuality', 'triadThird'],
        region: FULL_NECK,
        triads: ['maj', 'min'],
        keys: ['A', 'E', 'D', 'B', 'G', 'C', 'F', 'F#', 'Bb', 'Eb'],
        count: 12,
      },
    ],
  },
  {
    id: 'tr3',
    title: 'Diminished & augmented',
    description: 'The two rarer kinds',
    color: COLORS[3],
    tips: [
      'Diminished: two minor 3rds. It’s a minor triad with its 5th lowered: B D F♯ → B D F.',
      'Augmented: two major 3rds. It’s a major triad with its 5th raised: C E G → C E G♯.',
      'All four by their 3rds: major is major + minor, minor is minor + major, diminished is minor + minor, augmented is major + major.',
    ],
    lessons: [
      { id: 'tr3-1', title: 'Diminished triads', exercises: ['triadSpell'], region: FULL_NECK, triads: ['dim'], keys: ['B', 'E', 'A', 'D', 'F#', 'C#', 'G', 'C'], showScale: true, topics: ['triad:dim'] },
      { id: 'tr3-2', title: 'Augmented triads', exercises: ['triadSpell'], region: FULL_NECK, triads: ['aug'], keys: ['C', 'F', 'G', 'D', 'Bb', 'Eb', 'Ab'], showScale: true, topics: ['triad:aug'] },
      {
        id: 'tr3-3',
        title: 'All four kinds',
        exercises: ['triadQuality', 'triadThird'],
        region: FULL_NECK,
        triads: ['maj', 'min', 'dim', 'aug'],
        keys: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb'],
        topics: ['triad:four'],
      },
      {
        id: 'tr3-4',
        title: 'Four kinds review',
        exercises: ['triadSpell', 'triadQuality'],
        region: FULL_NECK,
        triads: ['maj', 'min', 'dim', 'aug'],
        keys: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb'],
        count: 12,
      },
    ],
  },
  {
    id: 'tr4',
    title: 'Triads on the staff',
    description: 'Chords on one stem',
    color: COLORS[0],
    tips: [
      'In root position a triad looks like a snowman: all on lines or all in spaces, with the root on the bottom.',
      'Read the key signature first: in D major, D F A is D F♯ A, a D major triad.',
      'Then check the bottom 3rd to tell major from minor.',
    ],
    lessons: [
      { id: 'tr4-1', title: 'The snowman', exercises: ['triadRead'], region: FULL_NECK, keys: ['C'], topics: ['triad:staff'] },
      { id: 'tr4-2', title: 'Reading in a key', exercises: ['triadRead'], region: FULL_NECK, keys: ['G', 'D', 'F', 'Bb', 'A'], topics: ['triad:staff-key'] },
      { id: 'tr4-3', title: 'Staff review', exercises: ['triadRead'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'Bb', 'A', 'Eb'], count: 12 },
    ],
  },
  {
    id: 'tr5',
    title: 'Triad inversions',
    description: 'Same chord, new bottom note',
    color: COLORS[1],
    tips: [
      'Root on the bottom: root position. The 3rd on the bottom: 1st inversion. The 5th on the bottom: 2nd inversion.',
      'Inverting doesn’t change the chord’s name: E G C is still C major.',
      'To find the root, restack the notes in 3rds. The bottom note of the stack is the root.',
    ],
    lessons: [
      { id: 'tr5-1', title: 'A new note on the bottom', exercises: ['triadInversion'], region: FULL_NECK, keys: ['C', 'G', 'F'], topics: ['triad:inversions'] },
      { id: 'tr5-2', title: 'Finding the root', exercises: ['triadRead'], region: FULL_NECK, keys: ['C', 'G', 'F', 'D'], inverted: true, topics: ['triad:restack'] },
      { id: 'tr5-3', title: 'Inversions review', exercises: ['triadInversion', 'triadRead'], region: FULL_NECK, keys: ['C', 'G', 'F', 'D', 'Bb'], inverted: true, count: 12 },
    ],
  },
  {
    id: 'tr6',
    title: 'Triads on the neck',
    description: 'Three-string shapes',
    color: COLORS[2],
    tipRegion: region([3, 4, 5], 0, 12),
    tips: [
      'On the G, B and high E strings, every triad has three shapes up the neck, one for each inversion.',
      'Find the root in the shape first; the other two notes sit around it.',
      'For minor, move the 3rd down one fret.',
      'On the D, G and B strings the shapes change, because the B string is tuned a fret lower.',
    ],
    lessons: [
      {
        id: 'tr6-1',
        title: 'Major on the top strings',
        exercises: ['triadShapeName', 'triadShapeFind'],
        region: region([3, 4, 5], 0, 12),
        triads: ['maj'],
        keys: ['C', 'G', 'D', 'A', 'F'],
        topics: ['triad:neck-top'],
      },
      {
        id: 'tr6-2',
        title: 'Minor on the top strings',
        exercises: ['triadShapeName', 'triadShapeFind'],
        region: region([3, 4, 5], 0, 12),
        triads: ['min'],
        keys: ['A', 'E', 'D', 'G', 'C'],
        topics: ['triad:neck-minor'],
      },
      {
        id: 'tr6-3',
        title: 'The middle strings',
        exercises: ['triadShapeName', 'triadShapeFind'],
        region: region([2, 3, 4], 0, 12),
        triads: ['maj', 'min'],
        keys: ['C', 'G', 'D', 'A', 'E'],
        topics: ['triad:neck-middle'],
      },
      {
        id: 'tr6-4',
        title: 'Neck review',
        exercises: ['triadShapeName', 'triadShapeFind'],
        region: region([2, 3, 4, 5], 0, 12),
        triads: ['maj', 'min'],
        keys: ['C', 'G', 'D', 'A', 'E', 'F'],
        count: 12,
      },
    ],
  },
  {
    id: 'tr7',
    title: 'Hearing triads',
    description: 'Ear training: headphones on',
    color: COLORS[6],
    tips: [
      'This tape needs sound, so put headphones on. No sound right now? “Can’t listen now” pauses listening questions for 15 minutes.',
      'Major sounds bright, minor darker. Listen to the middle note: it’s the only one that changes.',
      'Diminished sounds tense and squeezed; augmented sounds unsettled, as if it’s floating.',
    ],
    lessons: [
      { id: 'tr7-1', title: 'Major or minor', exercises: ['triadHear'], region: FULL_NECK, triads: ['maj', 'min'], ear: ['up'], topics: ['triad:ear-why', 'triad:ear-majmin'] },
      { id: 'tr7-2', title: 'Played together', exercises: ['triadHear'], region: FULL_NECK, triads: ['maj', 'min'], ear: ['together'], topics: ['triad:ear-together'] },
      { id: 'tr7-3', title: 'Add diminished', exercises: ['triadHear'], region: FULL_NECK, triads: ['maj', 'min', 'dim'], ear: ['up', 'together'], topics: ['triad:ear-dim'] },
      { id: 'tr7-4', title: 'All four kinds', exercises: ['triadHear'], region: FULL_NECK, triads: ['maj', 'min', 'dim', 'aug'], ear: ['up', 'together'], topics: ['triad:ear-aug'] },
    ],
  },  {
    id: 'hk1',
    title: 'The chords in a key',
    description: 'Seven chords from one scale',
    color: COLORS[4],
    tips: [
      'Build a triad on every note of the major scale, using only its notes: seven chords.',
      'The pattern is the same in every major key: major, minor, minor, major, major, minor, diminished.',
      'To find a chord, count up the scale to its note, then use the pattern: the 6th note of G major is E, so E minor.',
    ],
    lessons: [
      { id: 'hk1-1', title: 'Seven chords from one scale', exercises: ['chordOnDegree'], region: FULL_NECK, keys: ['C'], showScale: true, topics: ['harm:why', 'harm:stack'] },
      { id: 'hk1-2', title: 'The pattern', exercises: ['degreeQuality'], region: FULL_NECK, topics: ['harm:pattern'] },
      { id: 'hk1-3', title: 'Any key', exercises: ['chordOnDegree'], region: FULL_NECK, keys: ['G', 'D', 'F', 'A'], topics: ['harm:any'] },
      { id: 'hk1-4', title: 'Chords in a key review', exercises: ['chordOnDegree', 'degreeQuality'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'A', 'E', 'Bb'], count: 12 },
    ],
  },
  {
    id: 'hk2',
    title: 'Roman numerals',
    description: 'Chords by number',
    color: COLORS[5],
    tips: [
      'A numeral names a chord by its scale note: I on the 1st, ii on the 2nd, and so on.',
      'Capitals are major, lowercase minor, ° diminished: I ii iii IV V vi vii°.',
      'In D major, ii is E minor and V is A major.',
    ],
    lessons: [
      { id: 'hk2-1', title: 'Numerals', exercises: ['numeralToChord'], region: FULL_NECK, keys: ['C', 'G'], topics: ['harm:numerals', 'harm:to-chord'] },
      { id: 'hk2-2', title: 'Chord to numeral', exercises: ['chordToNumeral'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F'], topics: ['harm:to-numeral'] },
      { id: 'hk2-3', title: 'On the staff', exercises: ['numeralRead'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F'], topics: ['harm:staff'] },
      {
        id: 'hk2-4',
        title: 'Numerals review',
        exercises: ['numeralToChord', 'chordToNumeral', 'numeralRead'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'F', 'A', 'Bb'],
        count: 12,
      },
    ],
  },
  {
    id: 'hk3',
    title: 'The three main chords',
    description: 'I, IV and V',
    color: COLORS[3],
    tipRegion: region([0, 1], 0, 8),
    tips: [
      'I, IV and V are the three major chords in a key: G, C and D in G major.',
      'I is home (the tonic), IV moves away (the subdominant), and V pulls back home (the dominant).',
      'On the neck, from a root on the 6th string: IV is on the next string at the same fret, V two frets further.',
    ],
    lessons: [
      { id: 'hk3-1', title: 'I, IV and V', exercises: ['primaryChord'], region: FULL_NECK, keys: ['C', 'G', 'D', 'A', 'E', 'F'], topics: ['harm:primary', 'harm:function'] },
      { id: 'hk3-2', title: 'On the neck', exercises: ['boxFind'], region: FULL_NECK, topics: ['harm:neck'] },
      { id: 'hk3-3', title: 'Main chords review', exercises: ['primaryChord', 'boxFind'], region: FULL_NECK, keys: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'], count: 12 },
    ],
  },
  {
    id: 'hk4',
    title: 'Common progressions',
    description: 'The chord orders behind thousands of songs',
    color: COLORS[0],
    tips: [
      'A progression is the order a song’s chords come in. Written in numerals, it works in any key.',
      'I–IV–V–I, I–V–vi–IV and I–vi–IV–V use the three main chords and vi.',
      'ii–V–I steps home in 5ths: D minor, G, C in C major.',
    ],
    lessons: [
      { id: 'hk4-1', title: 'Progressions', exercises: ['progressionSpell'], region: FULL_NECK, keys: ['C', 'G', 'D'], progressions: ['I-IV-V-I'], topics: ['harm:progression'] },
      {
        id: 'hk4-2',
        title: 'The pop progressions',
        exercises: ['progressionSpell', 'progressionName'],
        region: FULL_NECK,
        keys: ['C', 'G', 'D', 'F', 'A'],
        progressions: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V'],
        topics: ['harm:pop'],
      },
      { id: 'hk4-3', title: 'ii–V–I', exercises: ['progressionSpell', 'progressionName'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'A'], progressions: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V', 'ii-V-I'], topics: ['harm:jazz'] },
      { id: 'hk4-4', title: 'Progressions review', exercises: ['progressionSpell', 'progressionName'], region: FULL_NECK, keys: ['C', 'G', 'D', 'F', 'A', 'E', 'Bb'], progressions: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V', 'ii-V-I'], count: 12 },
    ],
  },
  {
    id: 'hk5',
    title: 'Hearing progressions',
    description: 'Ear training: headphones on',
    color: COLORS[6],
    tips: [
      'This tape needs sound, so put headphones on. No sound right now? “Can’t listen now” pauses listening questions for 15 minutes.',
      'Ending on I sounds finished; ending on V sounds like a question.',
      'After I, IV sounds like a step away, and V leans to come home.',
    ],
    lessons: [
      { id: 'hk5-1', title: 'Home or away', exercises: ['cadenceHear'], region: FULL_NECK, topics: ['harm:ear-why', 'harm:ear-home'] },
      { id: 'hk5-2', title: 'IV or V', exercises: ['fourFiveHear'], region: FULL_NECK, topics: ['harm:ear-four-five'] },
      { id: 'hk5-3', title: 'Which progression', exercises: ['progressionHear'], region: FULL_NECK, progressions: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V'], topics: ['harm:ear-prog'] },
      { id: 'hk5-4', title: 'Hearing review', exercises: ['cadenceHear', 'fourFiveHear', 'progressionHear'], region: FULL_NECK, progressions: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V'], count: 10 },
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
  {
    label: 'Vol. 5',
    title: 'Triads',
    tapes: ['tr1', 'tr2', 'tr3', 'tr4', 'tr5', 'tr6', 'tr7'].map(tape),
  },
  { label: 'Vol. 6', title: 'Chords in a Key', tapes: ['hk1', 'hk2', 'hk3', 'hk4', 'hk5'].map(tape) },
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
const LISTENING: ExerciseType[] = ['ivHear', 'ivHearFind', 'triadHear', 'cadenceHear', 'fourFiveHear', 'progressionHear']
export const isListening = (l: LessonSpec) => l.exercises.some((e) => LISTENING.includes(e))

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
