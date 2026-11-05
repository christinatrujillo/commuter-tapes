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
  entry('bar line', 'The straight line down the staff that ends one measure and starts the next.', 'bar lines', 'bar line'),
  entry('staff', 'The five lines and four spaces music is written on. Higher on the staff means higher in sound.', 'staff'),
  entry('treble clef', 'The curly sign at the start of the staff. It circles the line where G sits, and guitar music always uses it.', 'treble clef', 'clef'),
  entry('time signature', 'The two numbers at the start of the music. The top one is how many beats each measure has.', 'time signatures', 'time signature'),
  entry('ledger line', 'A short extra line above or below the staff, for notes too high or low to fit on it.', 'ledger lines', 'ledger line'),
  entry('stem', 'The thin stick attached to most notes.', 'stems', 'stem'),
  entry('rest', 'A sign for silence: play nothing for that many beats.', 'rests'),
  entry('tie', 'A curve joining two of the same note: play it once and hold it for both.', 'ties'),
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
