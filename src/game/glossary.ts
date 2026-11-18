/**
 * Plain-words definitions of the music vocabulary the lessons use, so a word can be tapped
 * wherever it appears instead of being explained again on every card.
 */
export interface GlossaryEntry {
  term: string
  definition: string
  /** The forms it's spotted by in text, longest first ("key signatures", "key signature"). */
  forms: string[]
}

const entry = (term: string, definition: string, ...forms: string[]): GlossaryEntry => ({ term, definition, forms: forms.length ? forms : [term] })

export const GLOSSARY: GlossaryEntry[] = [
  entry('beat', 'The steady pulse of music, the one you’d tap your foot to. Counting 1 2 3 4 is counting beats.', 'beats', 'beat'),
  entry('measure', 'A group of beats, marked off by bar lines. In 4/4 time, each measure holds four beats.', 'measures', 'measure'),
  entry('repeat sign', 'Two dots before a thick bar line: go back and play that part again, once.', 'repeat signs', 'repeat sign'),
  entry('da capo', 'Italian for “from the head”: go back to the very start. Written D.C.', 'da capo'),
  entry('dal segno', 'Italian for “from the sign”: go back to the sign, not the start. Written D.S.', 'dal segno'),
  entry('coda', 'An ending section, marked with the coda sign. To Coda tells you when to jump to it.', 'coda'),
  entry('bar line', 'The straight line down the staff that ends one measure and starts the next.', 'bar lines', 'bar line'),
  entry('bar', 'Another word for a measure: the beats between two bar lines.', 'bars', 'bar'),
  entry('staff', 'The five lines and four spaces music is written on. Higher on the staff means higher in sound.', 'staff'),
  entry('treble clef', 'The curly sign at the start of the staff. It circles the line where G sits, and guitar music always uses it.', 'treble clef', 'clef'),
  entry('time signature', 'The two numbers at the start of the music. The top one is how many beats each measure has.', 'time signatures', 'time signature'),
  entry('ledger line', 'A short extra line above or below the staff, for notes too high or low to fit on it.', 'ledger lines', 'ledger line'),
  entry('stem', 'The thin stick attached to most notes.', 'stems', 'stem'),
  entry('rest', 'A sign for silence: play nothing for that many beats.', 'rests'),
  entry('tie', 'A curve joining two of the same note: play it once and hold it for both.', 'ties'),
  entry('syncopation', 'Rhythm that leans on the & between beats instead of on the beats themselves.'),
  entry('pickup', 'One or more notes before the first full measure of a song, counted as the end of a bar.', 'pickups', 'pickup'),
  entry('power chord', 'A two-note chord: a root and the 5th above it, with no 3rd. Written with a 5, like A5.', 'power chords', 'power chord'),
  entry('slash chord', 'A chord written with its lowest note after a slash: C/E is C major with E in the bass.', 'slash chords', 'slash chord'),
  entry('sharp', 'A ♯ sign: play the note one fret (a half step) higher.', 'sharps', 'sharp'),
  entry('flat', 'A ♭ sign: play the note one fret (a half step) lower.', 'flats', 'flat'),
  entry('accidental', 'A sharp, flat or natural sign written in front of a note. It lasts until the bar line.', 'accidentals', 'accidental'),
  entry('fret', 'The metal strips across the neck. “3rd fret” means pressing just behind the third one.', 'frets', 'fret'),
  entry('first position', 'Your hand at the first frets of the neck, one finger per fret.'),
  entry('half step', 'The smallest step in music: one fret on the same string.', 'half steps', 'half step'),
  entry('whole step', 'Two half steps: two frets on the same string.', 'whole steps', 'whole step'),
  entry('scale', 'A set of notes in order, from a starting note (the root) up to the same note an octave higher.', 'scales', 'scale'),
  entry('root', 'The starting note of a scale or chord. It’s home, and it gives the scale or chord its name.', 'roots', 'root'),
  entry('octave', 'The same note name, one level higher or lower. On one string, 12 frets apart.', 'octaves', 'octave'),
  entry('degree', 'A note’s number in a scale, counting up from the root, which is 1.', 'degrees', 'degree'),
  entry('key', 'A piece of music’s home base: a home note, plus the scale that supplies its notes.', 'keys', 'key'),
  entry('key signature', 'The sharps or flats right after the clef. They apply to those notes for the whole piece.', 'key signatures', 'key signature'),
  entry('relative minor', 'The minor key that uses the same notes as a major key, starting on its 6th note.', 'relative minor'),
  entry('interval', 'The distance between two notes, named by number and quality, like “major 3rd”.', 'intervals', 'interval'),
  entry('chord', 'Several notes played together. Most chords are built up from a root note.', 'chords', 'chord'),
  entry('triad', 'A three-note chord: a root, the note a 3rd above it, and the note a 5th above it. The simplest full chord.', 'triads', 'triad'),
  entry('progression', 'The order a song’s chords come in, often a few chords repeated. Written in Roman numerals, it works in any key.', 'chord progressions', 'chord progression', 'progressions', 'progression'),
  entry('Roman numeral', 'A chord’s name by the scale note it’s built on: I, ii, iii, IV, V, vi, vii°. Capitals are major, lowercase minor.', 'Roman numerals', 'Roman numeral'),
  entry('tonic', 'The home chord of a key, I. Songs usually end on it.', 'tonic'),
  entry('subdominant', 'The IV chord of a key. It moves away from home.', 'subdominant'),
  entry('dominant', 'The V chord of a key. It builds tension that pulls back home to I.', 'dominant'),
  entry('chord family', 'Chords in a key that do the same job: tonic (I, iii, vi), subdominant (IV, ii) or dominant (V, vii°).', 'chord families', 'chord family'),
  entry('secondary dominant', 'The V7 of a chord other than I, like A7 leading to Dm in C major. Written V7/ii.', 'secondary dominants', 'secondary dominant'),
  entry('borrowed chord', 'A chord taken from the parallel minor into a major key, like Fm or B♭ in C major.', 'borrowed chords', 'borrowed chord'),
  entry('parallel minor', 'The minor key on the same home note as a major key: C minor for C major.', 'parallel minor'),
  entry('tritone sub', 'Swapping V7 for the dominant 7th a tritone away, like D♭7 for G7 in C major. Written ♭II7.', 'tritone substitution', 'tritone subs', 'tritone sub'),
  entry('deceptive cadence', 'V moving to vi instead of home to I, so the music sounds about to end but carries on.', 'deceptive cadence'),
  entry('chord symbol', 'The short name written above lyrics for a chord: C, Am, G7. The letter is the root; what follows says the kind.', 'chord symbols', 'chord symbol'),
  entry('7th chord', 'A triad with one more 3rd on top: four notes, the root, 3rd, 5th and 7th.', '7th chords', '7th chord'),
  entry('sus chord', 'A chord with its 3rd swapped for the 2nd (sus2) or the 4th (sus4), so it’s neither major nor minor.', 'sus chords', 'sus chord'),
  entry('chord diagram', 'A picture of a chord on the neck, standing up: strings run down, frets run across, and dots show where to press.', 'chord diagrams', 'chord diagram'),
  entry('CAGED', 'The five open major chord shapes, C, A, G, E and D, used as movable shapes that cover the whole neck.', 'CAGED'),
  entry('harmonic minor', 'The natural minor scale with its 7th note raised a half step, so the chord on the 5th note becomes major and pulls home.', 'harmonic minor'),
  entry('melodic minor', 'The natural minor scale with its 6th and 7th notes raised a half step, like A B C D E F♯ G♯.', 'melodic minor'),
  entry('symmetric scale', 'A scale that repeats one step pattern all the way up, so no note stands out as home.', 'symmetric scales', 'symmetric scale'),
  entry('whole-tone scale', 'A six-note scale of whole steps only, like C D E F♯ G♯ A♯.', 'whole-tone scales', 'whole-tone scale'),
  entry('arpeggio', 'A chord played one note at a time instead of all together, like G B D picked in turn.', 'arpeggios', 'arpeggio'),
  entry('diminished scale', 'An eight-note scale of whole and half steps in turn, like C D E♭ F G♭ A♭ A B.', 'diminished scales', 'diminished scale'),
  entry('diminished 7th', 'A four-note chord built entirely from minor 3rds, like G♯ B D F. Written G♯°7.', 'diminished 7ths', 'diminished 7th'),
  entry('pentatonic', 'A five-note scale. The minor pentatonic is the minor scale without its 2nd and 6th notes.', 'pentatonics', 'pentatonic'),
  entry('blues scale', 'The minor pentatonic plus the blue note: six notes, like A C D E♭ E G.', 'blues scales', 'blues scale'),
  entry('blue note', 'The 5th of the scale, lowered a half step (E♭ in A). It gives the blues scale its gritty sound.', 'blue notes', 'blue note'),
  entry('12-bar blues', 'The most common blues form: 12 bars of I, IV and V chords, played over and over.', '12-bar blues'),
  entry('quick change', 'In a 12-bar blues, moving to the IV chord in bar 2 and straight back to I.', 'quick change'),
  entry('turnaround', 'The V chord in the last bar of a blues, pulling back to I as the chart starts again.', 'turnarounds', 'turnaround'),
  entry('mode', 'A major scale played from one of its other notes, so the same notes have a new home: D to D in C major is D Dorian.', 'modes', 'mode'),
  entry('parent scale', 'The major scale a mode borrows its notes from. C major is the parent scale of D Dorian.', 'parent scales', 'parent scale'),
  entry('Ionian', 'The mode on a major scale’s 1st note: the major scale itself, like C D E F G A B.'),
  entry('Dorian', 'The mode on a major scale’s 2nd note: minor with a raised 6th, like D E F G A B C.'),
  entry('Phrygian', 'The mode on a major scale’s 3rd note: minor with a lowered 2nd, like E F G A B C D.'),
  entry('Lydian', 'The mode on a major scale’s 4th note: major with a raised 4th, like F G A B C D E.'),
  entry('Mixolydian', 'The mode on a major scale’s 5th note: major with a lowered 7th, like G A B C D E F.'),
  entry('Aeolian', 'The mode on a major scale’s 6th note: the natural minor scale, like A B C D E F G.'),
  entry('Locrian', 'The mode on a major scale’s 7th note: minor with a lowered 2nd and 5th, like B C D E F G A.'),
  entry('color note', 'The note that sets a mode apart from the major or minor scale on the same root, like Dorian’s raised 6th.', 'color notes', 'color note'),
  entry('vamp', 'Two chords played back and forth, over and over, like Am to D.', 'vamps', 'vamp'),
  entry('root position', 'A chord stacked with its root on the bottom.'),
  entry('inversion', 'A chord restacked with its 3rd or 5th on the bottom instead of its root. It keeps its name.', 'inversions', 'inversion'),
  entry('power chord', 'A two-note chord: a root and the note a 5th above it. It’s behind most rock riffs.', 'power chords', 'power chord'),
  entry('barre chord', 'A chord where one finger presses across all the strings, so the shape can move along the neck.', 'barre chords', 'barre chord'),
  entry('tritone', 'The interval of 6 half steps, between a 4th and a 5th. It sounds tense.', 'tritone'),
  entry('tab', 'Guitar notation that shows strings and fret numbers instead of notes on a staff.', 'tab'),
]

export interface Segment {
  text: string
  entry?: GlossaryEntry
}

/**
 * Splits text into plain runs and glossary words. Each word is picked out once (its first time),
 * longer phrases win over the words inside them, anything in `skip` (say, the card's own topic)
 * is left plain, and no more than `limit` are picked out so the text doesn't get busy.
 */
export function glossarySegments(text: string, skip: string[] = [], limit = 3): Segment[] {
  const skipped = skip.map((s) => s.toLowerCase())
  const forms = GLOSSARY.filter((e) => !skipped.some((s) => s.includes(e.term)))
    .flatMap((e) => e.forms.map((form) => ({ form, entry: e })))
    .sort((a, b) => b.form.length - a.form.length)
  const pattern = new RegExp(`\\b(${forms.map((f) => f.form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const used = new Set<GlossaryEntry>()
  const out: Segment[] = []
  let at = 0
  for (const m of text.matchAll(pattern)) {
    const entry = forms.find((f) => f.form.toLowerCase() === m[0].toLowerCase())!.entry
    if (used.has(entry) || used.size >= limit) continue
    used.add(entry)
    if (m.index! > at) out.push({ text: text.slice(at, m.index) })
    out.push({ text: m[0], entry })
    at = m.index! + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}
