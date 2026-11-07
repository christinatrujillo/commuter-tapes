// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { ALL_LESSONS } from './music/curriculum'
import { INTERVALS, midiAt, parsePosKey, pcName, pitchClass, spelledMidi, type Letter } from './music/notes'
import { eventQuarters, METER_PULSE, METER_QUARTERS, onsets, SYMBOLS, symbolOf, type Measure, type Meter, type RhythmEvent } from './music/rhythm'
import { KEYS, MOTION_NAMES, motionBetween, resolveNotes, type KeyId, type ScoreMeasure } from './music/score'
import { useProgress } from './store/progress'

// Ear questions play notes the player can't see; the stand-in remembers the last ones played.
// It also counts how often the screens ask for sound to stop.
const heard = vi.hoisted(() => ({ notes: [] as number[], stops: 0 }))
vi.mock('./audio/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio/sound')>()),
  playListen: (notes: number[]) => {
    heard.notes = notes
  },
  stopSounds: () => {
    heard.stops++
  },
}))

// VexFlow needs real font metrics; a stand-in staff just shows the note it was given.
vi.mock('./components/Staff', () => ({
  Staff: ({ keys }: { keys: string[] }) => <div data-testid="staff">{keys.join(',')}</div>,
}))

// And for melodies: a stand-in that exposes the notes, key signature and marked note.
vi.mock('./components/Score', () => ({
  Score: ({ measures, keySig, marker }: { measures: ScoreMeasure[]; keySig?: string; marker?: number | null }) => (
    <div data-testid="score" data-measures={JSON.stringify(measures)} data-key={keySig ?? 'C'} data-marker={marker ?? ''} />
  ),
}))

// Same for rhythm notation: a stand-in that exposes the measure and makes notes tappable.
vi.mock('./components/Notation', () => ({
  Notation: ({ measure, onTapNote, blankBeats }: { measure: Measure; onTapNote?: (i: number) => void; blankBeats?: number }) => (
    <div data-testid="notation" data-events={JSON.stringify(measure.events)} data-meter={measure.meter} data-blank={blankBeats ?? ''}>
      {onTapNote &&
        measure.events.map((e, i) =>
          e.rest ? null : (
            <button key={i} data-note-index={i} onClick={() => onTapNote(i)}>
              note {i}
            </button>
          ),
        )}
    </div>
  ),
}))

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  window.confirm = () => true
  window.alert = () => {}
  Element.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  // A simulated clock, so tapping rhythms in time doesn't take real seconds.
  vi.useFakeTimers()
  localStorage.clear()
  useProgress.getState().reset()
  useProgress.getState().updateSettings({ sound: false, haptics: false, autoContinue: false })
  history.replaceState(null, '', '#/')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Moves the simulated clock forward in small steps, letting the screen update between them. */
function advanceTo(until: number) {
  while (Date.now() < until) act(() => vi.advanceTimersByTime(Math.min(50, until - Date.now())))
}

function go(path: string) {
  act(() => {
    history.replaceState(null, '', `#${path}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

// ---------------------------------------------------------------------------
// Reading the screen and answering, the way a player would
// ---------------------------------------------------------------------------

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "C♯" / "D♭" / "G" → pitch class. */
function labelPc(label: string): number {
  const acc = label.includes('♯') ? 1 : label.includes('♭') ? -1 : 0
  return (LETTER_PC[label[0]] + acc + 12) % 12
}

/** VexFlow key (written pitch) → sounding MIDI note. */
function keyToSounding(key: string): number {
  const [name, octave] = key.split('/')
  const acc = name.includes('#') ? 1 : name.length > 1 && name.endsWith('b') ? -1 : 0
  return spelledMidi({ letter: name[0].toUpperCase() as Letter, acc, octave: Number(octave) }) - 12
}

const hitSpots = () =>
  [...document.querySelectorAll<SVGRectElement>('rect.fret-hit')].map((el) => ({ el, pos: parsePosKey(el.dataset.pos!)! }))
const markerPos = (tone: string) => parsePosKey(document.querySelector<SVGGElement>(`g[data-tone="${tone}"]`)!.dataset.pos!)!
const prompt = () => document.querySelector('h2')!.textContent!
const highlighted = () => document.querySelector('h2 .text-amber')?.textContent ?? ''

function clickNote(pc: number) {
  const want = pcName(pc).replace('/', '')
  const button = screen.getAllByRole('button').find((b) => b.textContent === want)
  if (!button) throw new Error(`No button for ${want}`)
  fireEvent.click(button)
}

/** Picks any natural-note button other than the right one. */
function clickWrongNote(correct: number) {
  const button = screen.getAllByRole('button').find((b) => /^[A-G]$/.test(b.textContent!) && labelPc(b.textContent!) !== correct)
  fireEvent.click(button!)
}

function clickWhere(match: (midi: number) => boolean, all = false) {
  const spots = hitSpots().filter((s) => match(midiAt(s.pos)))
  if (spots.length === 0) throw new Error(`Nothing to tap for: ${prompt()}`)
  for (const s of all ? spots : spots.slice(0, 1)) fireEvent.click(s.el)
}

/** Tap-the-rhythm: count in, then tap each note on time (or tap nothing, to miss on purpose). */
function tapRhythm(box: HTMLElement, correctly: boolean) {
  const notesAt = box.dataset.onsets!.split(',').map(Number)
  const measureMs = Number(box.dataset.countinMs)
  fireEvent.click(screen.getByRole('button', { name: 'Count me in' }))
  const beat1 = Date.now() + 150 + measureMs
  if (correctly) {
    for (const at of notesAt) {
      advanceTo(beat1 + at)
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Tap' }))
    }
  }
  advanceTo(beat1 + measureMs + 1000)
}

/** Rhythm questions, answered from the measure on screen. Returns false if it isn't one. */
function answerRhythm(text: string, correctly: boolean): boolean {
  const box = document.querySelector<HTMLElement>('[data-onsets]')
  if (box) {
    tapRhythm(box, correctly)
    return true
  }
  const notation = screen.queryByTestId('notation')
  if (!notation) return false
  const events = JSON.parse(notation.dataset.events!) as RhythmEvent[]
  const meter = notation.dataset.meter as Meter
  const buttons = screen.getAllByRole('button')
  const symbolNamed = (label: string) => Object.values(SYMBOLS).find((s) => s.name === label)
  let choice: HTMLElement | undefined
  if (text === 'What is this called?') {
    const name = SYMBOLS[symbolOf(events[0])].name
    choice = buttons.find((b) => (correctly ? b.textContent === name : !!symbolNamed(b.textContent!) && b.textContent !== name))
  } else if (text === 'How many beats does this get?') {
    const beats = SYMBOLS[symbolOf(events[0])].beats
    const label = beats === 0.5 ? '½' : beats === 1.5 ? '1½' : String(beats)
    choice = buttons.find((b) => (correctly ? b.textContent === label : /^(½|1½|\d)$/.test(b.textContent!) && b.textContent !== label))
  } else if (text === 'What completes the measure?') {
    const missing = METER_QUARTERS[meter] - events.reduce((t, e) => t + eventQuarters(e), 0)
    choice = buttons.find((b) => {
      const s = symbolNamed(b.textContent!)
      return s && (correctly ? s.beats === missing : s.beats !== missing)
    })
  } else if (text.startsWith('Tap the note on')) {
    const words = highlighted().split(' ')
    const beat = words[0] === 'beat' ? Number(words[1]) - 1 : Number(words[words.length - 1]) - 0.5
    // Beats are counted in the time signature's own beat (a half note in cut time); positions are in quarters.
    const position = beat * METER_PULSE[meter].quarters
    const starts = onsets({ meter, events })
    const target = starts.findIndex((s, i) => s === position && !events[i].rest && !(i > 0 && events[i - 1].tie))
    choice = [...notation.querySelectorAll<HTMLElement>('[data-note-index]')].find((b) => (Number(b.dataset.noteIndex) === target) === correctly)
  } else {
    return false
  }
  if (!choice) throw new Error(`No ${correctly ? 'right' : 'wrong'} answer to pick for: ${text}`)
  fireEvent.click(choice)
  return true
}

// An independent take on scale spelling, to check the app's answers against.
const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12]
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12]

/** Degree `d` of the major or natural minor scale on `tonic`: the right letter, with whatever sign gives the right pitch. */
function scaleDegree(tonic: string, d: number, minor = false): string {
  const letter = LETTER_ORDER[(LETTER_ORDER.indexOf(tonic[0]) + d - 1) % 7]
  const pc = (labelPc(tonic) + (minor ? MINOR : MAJOR)[d - 1]) % 12
  const diff = ((pc - LETTER_PC[letter] + 18) % 12) - 6
  return letter + (diff === 1 ? '♯' : diff === -1 ? '♭' : '')
}

/** Clicks the button labeled `right`, or (missing on purpose) another one that `isOption` accepts. */
function pickOption(right: string, isOption: (label: string) => boolean, correctly: boolean) {
  const choice = screen.getAllByRole('button').find((b) => (correctly ? b.textContent === right : isOption(b.textContent!) && b.textContent !== right))
  if (!choice) throw new Error(`No ${correctly ? 'right' : 'wrong'} answer to pick for: ${prompt()}`)
  fireEvent.click(choice)
}

/** Taps the spot that sounds `midi` on the root's string, or (missing on purpose) the root itself. */
function tapFromRoot(midi: number, correctly: boolean) {
  const root = markerPos('root')
  const spot = hitSpots().find((s) => (correctly ? midiAt(s.pos) === midi && s.pos.string === root.string : s.pos.string === root.string && s.pos.fret === root.fret))
  if (!spot) throw new Error(`Nothing to tap for: ${prompt()}`)
  fireEvent.click(spot.el)
}

const stepSize = (word: string) => (word === 'half' ? 1 : 2)

// Interval names worked out independently: the number from the letters, the quality from the half steps.
const PERFECT_IV: Record<number, number> = { 4: 5, 5: 7, 8: 12 }
const MAJOR_IV: Record<number, number> = { 2: 2, 3: 4, 6: 9, 7: 11 }
const ORDINAL = ['', '', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
const EAR_LABELS = ['', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave']
const ivRegex = /^(Perfect|Major|Minor|Augmented|Diminished) [2-8](st|nd|rd|th)$|^Octave$/

function intervalLabel(n: number, semis: number): string {
  const base = PERFECT_IV[n] ?? MAJOR_IV[n]
  const d = semis - base
  const quality = PERFECT_IV[n] !== undefined ? { 0: 'Perfect', 1: 'Augmented', [-1]: 'Diminished' }[d] : { 0: 'Major', [-1]: 'Minor', 1: 'Augmented', [-2]: 'Diminished' }[d]
  return quality === 'Perfect' && n === 8 ? 'Octave' : `${quality} ${ORDINAL[n]}`
}

/** "major 3rd" → its size in half steps. */
function intervalSemis(name: string): number {
  const [quality, ord] = name.toLowerCase().split(' ')
  if (quality === 'octave') return 12
  const n = Number(ord[0])
  const base = PERFECT_IV[n] ?? MAJOR_IV[n]
  return base + ({ perfect: 0, major: 0, minor: -1, augmented: 1, diminished: PERFECT_IV[n] !== undefined ? -1 : -2 } as Record<string, number>)[quality]
}

const letterGap = (lo: string, hi: string) => (LETTER_ORDER.indexOf(hi[0]) - LETTER_ORDER.indexOf(lo[0]) + 7) % 7
const staffSpot = (n: { letter: string; octave: number }) => n.octave * 7 + LETTER_ORDER.indexOf(n.letter)
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

// Triads worked out independently: every other letter, sized by half steps above the root.
const TRIAD_SEMIS: Record<string, [number, number]> = { major: [4, 7], minor: [3, 7], diminished: [3, 6], augmented: [4, 8] }
const KIND_BUTTON = /^(Major|Minor|Diminished|Augmented)$/
const TRIAD_BUTTON = /^[A-G][♯♭]? (major|minor|diminished|augmented)$/

/** The note `semis` half steps above `root`, on the letter `letters` above it. */
function noteAbove(root: string, letters: number, semis: number): string {
  const letter = LETTER_ORDER[(LETTER_ORDER.indexOf(root[0]) + letters) % 7]
  const diff = ((labelPc(root) + semis - LETTER_PC[letter] + 18) % 12) - 6
  return letter + (diff === 1 ? '♯' : diff === -1 ? '♭' : '')
}

const spellTriad = (root: string, kind: string) => [root, noteAbove(root, 2, TRIAD_SEMIS[kind][0]), noteAbove(root, 4, TRIAD_SEMIS[kind][1])].join(' ')

/** Which kind of triad three note names spell, root first. */
function kindOf(notes: string[]): string {
  const [third, fifth] = [notes[1], notes[2]].map((n) => (labelPc(n) - labelPc(notes[0]) + 12) % 12)
  return Object.keys(TRIAD_SEMIS).find((k) => TRIAD_SEMIS[k][0] === third && TRIAD_SEMIS[k][1] === fifth)!
}

/** Three note names restacked in 3rds: the root is the one with the other two letters 2 and 4 above it. */
function restack(notes: string[]): string[] {
  for (const n of notes) {
    const at = (letters: number) => notes.find((x) => letterGap(n, x) === letters)
    if (at(2) && at(4)) return [n, at(2)!, at(4)!]
  }
  throw new Error(`Not a triad: ${notes.join(' ')}`)
}

/** The labeled dots on the fretboard. */
const boardMarkers = () =>
  [...document.querySelectorAll<SVGGElement>('svg[aria-label="Guitar fretboard"] g[data-tone]')].map((g) => ({
    pos: parsePosKey(g.dataset.pos!)!,
    label: g.querySelector('text')?.textContent ?? '',
  }))

// Chords in a key worked out independently: every other note of the scale, named by its half steps.
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']
const NUMERAL_BUTTON = /^(i|ii|iii|iv|v|vi|vii|I|II|III|IV|V|VI|VII)°?$/
const PROGRESSION_BUTTON = /^(i|ii|iii|iv|v|vi|vii|I|II|III|IV|V|VI|VII)°?(–(i|ii|iii|iv|v|vi|vii|I|II|III|IV|V|VI|VII)°?)+$/
const degreeOfNumeral = (numeral: string) => ROMAN.indexOf(numeral.replace('°', '').toLowerCase()) + 1
const numeralFor = (d: number, kind: string) => (kind === 'major' ? ROMAN[d - 1].toUpperCase() : kind === 'minor' ? ROMAN[d - 1] : `${ROMAN[d - 1]}°`)

/** The chord on note `d` (from 1) of a major key, by name: "E minor". */
function chordIn(key: string, d: number): string {
  const notes = [d, d + 2, d + 4].map((x) => scaleDegree(key, ((x - 1) % 7) + 1))
  return `${notes[0]} ${kindOf(notes)}`
}

// Chord symbols worked out independently: each suffix's notes above the root, as [letters up, half steps up].
const CHORD_STEPS: Record<string, [number, number][]> = {
  '': [[2, 4], [4, 7]],
  m: [[2, 3], [4, 7]],
  '°': [[2, 3], [4, 6]],
  '+': [[2, 4], [4, 8]],
  maj7: [[2, 4], [4, 7], [6, 11]],
  '7': [[2, 4], [4, 7], [6, 10]],
  m7: [[2, 3], [4, 7], [6, 10]],
  'm7♭5': [[2, 3], [4, 6], [6, 10]],
  '°7': [[2, 3], [4, 6], [6, 9]],
  sus2: [[1, 2], [4, 7]],
  sus4: [[3, 5], [4, 7]],
  add9: [[2, 4], [4, 7], [1, 2]],
  '6': [[2, 4], [4, 7], [5, 9]],
  m6: [[2, 3], [4, 7], [5, 9]],
}
const CHORD_WORDS: Record<string, string> = {
  '': 'major',
  m: 'minor',
  '°': 'diminished',
  '+': 'augmented',
  maj7: 'major 7th',
  '7': 'dominant 7th',
  m7: 'minor 7th',
  'm7♭5': 'half-diminished',
  '°7': 'diminished 7th',
}
const splitSymbol = (symbol: string) => {
  const [, root, suffix] = symbol.match(/^([A-G][♯♭]?)(.*)$/)!
  return [root, suffix] as const
}
const spellSymbol = (symbol: string) => {
  const [root, suffix] = splitSymbol(symbol)
  return [root, ...CHORD_STEPS[suffix].map(([letters, semis]) => noteAbove(root, letters, semis))].join(' ')
}
/** The symbol whose spelling is exactly these notes, root first. */
const chordSymbolOf = (notes: string[]) => Object.keys(CHORD_STEPS).map((s) => notes[0] + s).find((symbol) => spellSymbol(symbol) === notes.join(' '))!
/** A 7th chord's numeral from its scale note and kind: capitals for a major triad, ø for half-diminished. */
const seventhNumeral = (d: number, suffix: string) =>
  (suffix === 'maj7' || suffix === '7' ? ROMAN[d - 1].toUpperCase() : ROMAN[d - 1]) + ({ maj7: 'maj7', '7': '7', m7: '7', 'm7♭5': 'ø7' } as Record<string, string>)[suffix]
const diagramFrets = () => document.querySelector<SVGElement>('svg[aria-label="Chord diagram"]')!.dataset.frets!.split(',').map(Number)
// Minor keys worked out independently: the natural minor scale from its home note, and the raised 7th.
const KEY_BUTTON = /^[A-G][♯♭]? (major|minor)$/
/** The triad on note `d` (from 1) of a natural minor key. */
const minorTriad = (tonic: string, d: number) => [d, d + 2, d + 4].map((x) => scaleDegree(tonic, ((x - 1) % 7) + 1, true))
/** A minor progression's step as a chord symbol; V7 takes the raised 7th. */
function minorStepSymbol(tonic: string, step: string): string {
  if (step === 'V7') {
    const root = scaleDegree(tonic, 5, true)
    return chordSymbolOf([root, noteAbove(root, 2, 4), noteAbove(root, 4, 7), noteAbove(root, 6, 10)])
  }
  return chordSymbolOf(minorTriad(tonic, degreeOfNumeral(step)))
}

// The 12-bar blues, as books write it: three lines of four bars.
const TWELVE_BARS = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I']
/** The root of I, IV or V in a key (or a minor key's i, iv or v). */
const bluesRoot = (key: string, numeral: string, minor = false) => scaleDegree(key, { I: 1, IV: 4, V: 5 }[numeral]!, minor)

// Pentatonics worked out independently: the minor scale without its 2nd and 6th, the major without its 4th and 7th.
const PENT_DEGREES: Record<string, number[]> = { minor: [1, 3, 4, 5, 7], major: [1, 2, 3, 5, 6] }

/** The five open shapes CAGED moves up the neck, low E string first. */
const OPEN_SHAPES: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  A: [-1, 0, 2, 2, 2, 0],
  G: [3, 2, 0, 0, 0, 3],
  E: [0, 2, 2, 1, 0, 0],
  D: [-1, -1, 0, 2, 3, 2],
}

/** The chords just heard, as numerals: each group of three notes is a chord, its root at the bottom. */
function heardChords(): string[] {
  const chords = Array.from({ length: heard.notes.length / 3 }, (_, i) => heard.notes.slice(i * 3, i * 3 + 3))
  return chords.map(([root, third, fifth]) => {
    const d = MAJOR.indexOf((((root - chords[0][0]) % 12) + 12) % 12) + 1
    const kind = Object.keys(TRIAD_SEMIS).find((k) => TRIAD_SEMIS[k][0] === third - root && TRIAD_SEMIS[k][1] === fifth - root)!
    return numeralFor(d, kind)
  })
}

/** Theory questions (steps, scales, patterns, keys, relative minors), worked out from the words and the board. */
function answerTheory(text: string, correctly: boolean): boolean {
  let m: RegExpMatchArray | null
  if (text === 'Half step or whole step?') {
    const score = screen.queryByTestId('score')
    const semis = score
      ? (() => {
          const notes = resolveNotes(JSON.parse(score.dataset.measures!) as ScoreMeasure[])
          return Math.abs(spelledMidi(notes[1]) - spelledMidi(notes[0]))
        })()
      : Math.abs(midiAt(markerPos('target')) - midiAt(markerPos('root')))
    pickOption(semis === 1 ? 'Half step' : 'Whole step', (b) => b.endsWith(' step'), correctly)
  } else if ((m = text.match(/^Tap a (half|whole) step (above|below) this/))) {
    tapFromRoot(midiAt(markerPos('root')) + (m[2] === 'above' ? 1 : -1) * stepSize(m[1]), correctly)
  } else if ((m = text.match(/^What’s a (half|whole) step (above|below) (\S+)\?$/))) {
    const pc = (labelPc(m[3]) + (m[2] === 'above' ? 1 : -1) * stepSize(m[1]) + 12) % 12
    if (correctly) clickNote(pc)
    else clickWrongNote(pc)
  } else if ((m = text.match(/^In a major scale, from the (\d)\w+ note to the (\d)\w+: half or whole step\?$/))) {
    const d = Number(m[1])
    pickOption(MAJOR[d] - MAJOR[d - 1] === 1 ? 'Half step' : 'Whole step', (b) => b.endsWith(' step'), correctly)
  } else if ((m = text.match(/^What’s the (\d)\w+ note of (\S+) (major|minor)\?$/))) {
    pickOption(scaleDegree(m[2], Number(m[1]), m[3] === 'minor'), (b) => /^[A-G][♯♭]?$/.test(b), correctly)
  } else if ((m = text.match(/^Which degree of (\S+) major is the marked note\?$/))) {
    const semis = (((midiAt(markerPos('target')) - midiAt(markerPos('root'))) % 12) + 12) % 12
    pickOption(String(MAJOR.indexOf(semis) + 1), (b) => /^[1-7]$/.test(b), correctly)
  } else if ((m = text.match(/^Tap the (\d)\w+ of (\S+) major$/))) {
    const pc = pitchClass(midiAt(markerPos('root')) + MAJOR[Number(m[1]) - 1])
    if (correctly) clickWhere((midi) => pitchClass(midi) === pc)
    else tapFromRoot(midiAt(markerPos('root')), false)
  } else if ((m = text.match(/^How many sharps or flats does (\S+) major have\?$/))) {
    const signs = [1, 2, 3, 4, 5, 6, 7].map((d) => scaleDegree(m![1], d)).filter((n) => n.length > 1)
    const n = signs.length
    const label = n === 0 ? 'No sharps or flats' : `${n} ${signs[0].endsWith('♯') ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`
    pickOption(label, (b) => /sharp|flat/.test(b), correctly)
  } else if ((m = text.match(/^What’s the relative minor of (\S+) major\?$/))) {
    pickOption(`${scaleDegree(m[1], 6)} minor`, (b) => b.endsWith(' minor'), correctly)
  } else if ((m = text.match(/^What’s the relative major of (\S+) minor\?$/))) {
    pickOption(`${scaleDegree(m[1], 3, true)} major`, (b) => b.endsWith(' major'), correctly)
  } else if ((m = text.match(/^Count five letters up from (\S+)\. Which key comes next, clockwise\?$/))) {
    pickOption(`${scaleDegree(m[1], 5)} major`, (b) => b.endsWith(' major'), correctly)
  } else if (text.startsWith('Tap the relative minor of this')) {
    tapFromRoot(midiAt(markerPos('root')) - 3, correctly)
  } else if ((m = text.match(/^What number interval is (\S+) up to (\S+)\?$/))) {
    const gap = letterGap(m[1], m[2])
    pickOption(String(gap === 0 ? 8 : gap + 1), (b) => /^[2-8]$/.test(b), correctly)
  } else if (text === 'What number interval is this?') {
    const [[a, b]] = JSON.parse(screen.getByTestId('score').dataset.measures!) as ScoreMeasure[]
    pickOption(String(Math.abs(staffSpot(b) - staffSpot(a)) + 1), (x) => /^[2-8]$/.test(x), correctly)
  } else if ((m = text.match(/^What’s the interval from (\S+) up to (\S+)\?$/))) {
    const gap = letterGap(m[1], m[2])
    const n = gap === 0 ? 8 : gap + 1
    const semis = (labelPc(m[2]) - labelPc(m[1]) + 12) % 12 || 12
    pickOption(intervalLabel(n, semis), (b) => ivRegex.test(b), correctly)
  } else if (text.startsWith('Name this interval')) {
    const score = screen.getByTestId('score')
    const [[first, second]] = JSON.parse(score.dataset.measures!) as ScoreMeasure[]
    const key = score.dataset.key as KeyId
    const spell = (x: { letter: Letter; octave: number; sign?: -1 | 0 | 1 }) => ({ ...x, acc: x.sign ?? KEYS[key].altered[x.letter] ?? 0 })
    const [lo, hi] = [spell(first), spell(second ?? first.with![0])].sort((x, y) => staffSpot(x) - staffSpot(y))
    pickOption(intervalLabel(staffSpot(hi) - staffSpot(lo) + 1, spelledMidi(hi) - spelledMidi(lo)), (b) => ivRegex.test(b), correctly)
  } else if ((m = text.match(/^Turn a (\d)\w+ upside down\. What number is it now\?$/))) {
    pickOption(String(9 - Number(m[1])), (b) => /^[2-7]$/.test(b), correctly)
  } else if ((m = text.match(/^Turn an? (.+) upside down\. What is it now\?$/))) {
    const n = Number(m[1].split(' ')[1][0])
    pickOption(intervalLabel(9 - n, 12 - intervalSemis(m[1])), (b) => ivRegex.test(b), correctly)
  } else if ((m = text.match(/^Tap an? (.+) below this [A-G]$/))) {
    const target = midiAt(markerPos('root')) - intervalSemis(m[1])
    if (correctly) clickWhere((midi) => midi === target)
    else tapFromRoot(midiAt(markerPos('root')), false)
  } else if (text === 'What interval do you hear?') {
    pickOption(EAR_LABELS[Math.abs(heard.notes[1] - heard.notes[0])], (b) => EAR_LABELS.includes(b) && b !== '', correctly)
  } else if (text === 'Listen, then tap the second note') {
    if (correctly) clickWhere((midi) => midi === heard.notes[1])
    else tapFromRoot(midiAt(markerPos('root')), false)
  } else if ((m = text.match(/^Which letters make a triad on ([A-G])\?$/))) {
    const root = LETTER_ORDER.indexOf(m[1])
    pickOption([0, 2, 4].map((s) => LETTER_ORDER[(root + s) % 7]).join(' '), (b) => /^[A-G] [A-G] [A-G]$/.test(b), correctly)
  } else if ((m = text.match(/^What notes make an? (\S+) (major|minor|diminished|augmented) triad\?$/))) {
    pickOption(spellTriad(m[1], m[2]), (b) => /^([A-G][♯♭]? ?){3}$/.test(b), correctly)
  } else if ((m = text.match(/^In the \S+ \w+ triad \(.+\), what’s the interval from (\S+) up to (\S+)\?$/))) {
    const semis = (labelPc(m[2]) - labelPc(m[1]) + 12) % 12
    pickOption(intervalLabel(letterGap(m[1], m[2]) + 1, semis), (b) => ivRegex.test(b), correctly)
  } else if ((m = text.match(/^(.+): which kind of triad\?$/))) {
    pickOption(capitalize(kindOf(m[1].split(' '))), (b) => KIND_BUTTON.test(b), correctly)
  } else if (text === 'Name this triad') {
    const score = screen.getByTestId('score')
    const [[chord]] = JSON.parse(score.dataset.measures!) as ScoreMeasure[]
    const key = score.dataset.key as KeyId
    const name = (x: { letter: Letter; sign?: -1 | 0 | 1 }) => {
      const acc = x.sign ?? KEYS[key].altered[x.letter] ?? 0
      return x.letter + (acc === 1 ? '♯' : acc === -1 ? '♭' : '')
    }
    const notes = restack([chord, ...chord.with!].map(name))
    pickOption(`${notes[0]} ${kindOf(notes)}`, (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^This (\S+) \w+ triad: root position, 1st or 2nd inversion\?$/))) {
    const [[chord]] = JSON.parse(screen.getByTestId('score').dataset.measures!) as ScoreMeasure[]
    const bottom = [chord, ...chord.with!].sort((x, y) => staffSpot(x) - staffSpot(y))[0]
    const gap = letterGap(m[1], bottom.letter)
    pickOption(['Root position', '', '1st inversion', '', '2nd inversion'][gap], (b) => /^(Root position|1st inversion|2nd inversion)$/.test(b), correctly)
  } else if (text === 'Which triad is this?') {
    const notes = restack(boardMarkers().map((mk) => mk.label))
    pickOption(`${notes[0]} ${kindOf(notes)}`, (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^Tap the missing note of this (\S+) (\w+) triad, on the (.+) string$/))) {
    const shown = boardMarkers().map((mk) => pitchClass(midiAt(mk.pos)))
    const missing = spellTriad(m[1], m[2])
      .split(' ')
      .map(labelPc)
      .find((pc) => !shown.includes(pc))!
    const string = ['low E', 'A', 'D', 'G', 'B', 'high E'].indexOf(m[3])
    const spot = hitSpots().find((s) => s.pos.string === string && (pitchClass(midiAt(s.pos)) === missing) === correctly)
    if (!spot) throw new Error(`Nothing to tap for: ${text}`)
    fireEvent.click(spot.el)
  } else if (text === 'What kind of triad do you hear?') {
    const [root, third, fifth] = heard.notes
    const kind = Object.keys(TRIAD_SEMIS).find((k) => TRIAD_SEMIS[k][0] === third - root && TRIAD_SEMIS[k][1] === fifth - root)!
    pickOption(capitalize(kind), (b) => KIND_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^What’s the chord on the (\d)\w+ note of (\S+) major\?$/))) {
    pickOption(chordIn(m[2], Number(m[1])), (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In any major key, what kind of chord is on the (\d)\w+ note\?$/))) {
    pickOption(capitalize(chordIn('C', Number(m[1])).split(' ')[1]), (b) => KIND_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) major, what’s the (\S+) chord\?$/))) {
    pickOption(chordIn(m[1], degreeOfNumeral(m[2])), (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) major, which chord (is home|moves away from home|pulls back home to I)\?$/))) {
    pickOption(chordIn(m[1], { 'is home': 1, 'moves away from home': 4, 'pulls back home to I': 5 }[m[2]]!), (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) major, which numeral is (\S+) (\w+)\?$/))) {
    pickOption(numeralFor(letterGap(m[1], m[2]) + 1, m[3]), (b) => NUMERAL_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^Which numeral is this chord in (\S+) major\?$/))) {
    const score = screen.getByTestId('score')
    const [[chord]] = JSON.parse(score.dataset.measures!) as ScoreMeasure[]
    const key = score.dataset.key as KeyId
    const name = (x: { letter: Letter; sign?: -1 | 0 | 1 }) => {
      const acc = x.sign ?? KEYS[key].altered[x.letter] ?? 0
      return x.letter + (acc === 1 ? '♯' : acc === -1 ? '♭' : '')
    }
    const notes = restack([chord, ...chord.with!].map(name))
    pickOption(numeralFor(letterGap(m[1], notes[0]) + 1, kindOf(notes)), (b) => NUMERAL_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^Tap the root of the (IV|V) chord in (\S+) major$/))) {
    const root = markerPos('root')
    const target = pitchClass(midiAt(root) + (m[1] === 'IV' ? 5 : 7))
    const spot = hitSpots().find((s) => (correctly ? s.pos.string === root.string + 1 && pitchClass(midiAt(s.pos)) === target : s.pos.string === root.string && s.pos.fret === root.fret))
    if (!spot) throw new Error(`Nothing to tap for: ${text}`)
    fireEvent.click(spot.el)
  } else if ((m = text.match(/^In (\S+) major, what are the roots of (\S+)\?$/))) {
    const roots = m[2].split('–').map((n) => scaleDegree(m![1], degreeOfNumeral(n)))
    pickOption(roots.join(' '), (b) => /^([A-G][♯♭]? ?)+$/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) major, which progression is (.+)\?$/))) {
    const numerals = m[2].split(', ').map((c) => numeralFor(letterGap(m![1], c) + 1, c.split(' ')[1]))
    pickOption(numerals.join('–'), (b) => PROGRESSION_BUTTON.test(b), correctly)
  } else if (text === 'Does it end at home, or away?') {
    const chords = heardChords()
    pickOption(chords[chords.length - 1] === 'I' ? 'Home' : 'Away', (b) => b === 'Home' || b === 'Away', correctly)
  } else if (text === 'After I, which chord: IV or V?') {
    pickOption(heardChords()[1], (b) => b === 'IV' || b === 'V', correctly)
  } else if (text === 'Which progression do you hear?') {
    pickOption(heardChords().join('–'), (b) => PROGRESSION_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^What does (\S+) mean\?$/))) {
    const [root, suffix] = splitSymbol(m[1])
    pickOption(`${root} ${CHORD_WORDS[suffix]}`, (b) => /^[A-G][♯♭]? \w/.test(b), correctly)
  } else if ((m = text.match(/^How is (\S+) (.+) written\?$/))) {
    const suffix = Object.keys(CHORD_WORDS).find((s) => CHORD_WORDS[s] === m![2])!
    pickOption(m[1] + suffix, (b) => /^[A-G][♯♭]?\S*$/.test(b), correctly)
  } else if ((m = text.match(/^What notes make (\S+)\?$/))) {
    pickOption(spellSymbol(m[1]), (b) => /^([A-G][♯♭]? ?)+$/.test(b), correctly)
  } else if ((m = text.match(/^(.+): which chord\?$/))) {
    pickOption(chordSymbolOf(m[1].split(' ')), (b) => /^[A-G][♯♭]?\S*$/.test(b), correctly)
  } else if ((m = text.match(/^What’s the 7th chord on the (\d)\w+ note of (\S+) major\?$/))) {
    const d = Number(m[1])
    pickOption(chordSymbolOf([d, d + 2, d + 4, d + 6].map((x) => scaleDegree(m![2], ((x - 1) % 7) + 1))), (b) => /^[A-G]/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) major, which numeral is (\S+)\?$/))) {
    const [root, suffix] = splitSymbol(m[2])
    pickOption(seventhNumeral(letterGap(m[1], root) + 1, suffix), (b) => /^[ivIV]+/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) major, what are the chords of ii7–V7–Imaj7\?$/))) {
    const sevenths = [2, 5, 1].map((d) => chordSymbolOf([d, d + 2, d + 4, d + 6].map((x) => scaleDegree(m![1], ((x - 1) % 7) + 1))))
    pickOption(sevenths.join(' – '), (b) => b.includes(' – '), correctly)
  } else if (text === 'Which chord is this?') {
    // Whichever choice spells exactly the notes the diagram plays.
    const played = new Set(diagramFrets().flatMap((f, string) => (f < 0 ? [] : [pitchClass(midiAt({ string, fret: f }))])))
    const fits = (symbol: string) => {
      const pcs = spellSymbol(symbol).split(' ').map(labelPc)
      return pcs.length === played.size && pcs.every((pc) => played.has(pc))
    }
    const right = screen.getAllByRole('button').find((b) => /^[A-G][♯♭]?m?$/.test(b.textContent!) && fits(b.textContent!))!.textContent!
    pickOption(right, (b) => /^[A-G][♯♭]?m?$/.test(b), correctly)
  } else if ((m = text.match(/^In this (\S+) chord, which note is the ringed dot\?$/))) {
    const string = Number(document.querySelector<SVGElement>('svg[aria-label="Chord diagram"]')!.dataset.mark)
    const pc = pitchClass(midiAt({ string, fret: diagramFrets()[string] }))
    const role = spellSymbol(m[1]).split(' ').map(labelPc).indexOf(pc)
    pickOption(['Root', '3rd', '5th'][role], (b) => /^(Root|3rd|5th)$/.test(b), correctly)
  } else if (text === 'Which CAGED shape is this?') {
    const frets = diagramFrets()
    const shape = Object.keys(OPEN_SHAPES).find((s) => {
      const open = OPEN_SHAPES[s]
      const shifts = new Set(frets.map((f, i) => (f < 0 || open[i] < 0 ? (f === open[i] ? 'muted' : 'no') : f - open[i])))
      return !shifts.has('no') && [...shifts].filter((x) => x !== 'muted').length === 1
    })!
    pickOption(`${shape} shape`, (b) => / shape$/.test(b), correctly)
  } else if ((m = text.match(/^Going up the neck, which shape comes after the (\w) shape\?$/))) {
    const order = ['C', 'A', 'G', 'E', 'D']
    pickOption(`${order[(order.indexOf(m[1]) + 1) % 5]} shape`, (b) => / shape$/.test(b), correctly)
  } else if (text === 'What kind of 7th chord do you hear?') {
    const [root, ...rest] = heard.notes
    const kind = { '4,7,11': 'Major 7th', '4,7,10': 'Dominant 7th', '3,7,10': 'Minor 7th', '3,6,10': 'Half-diminished' }[rest.map((n) => n - root).join(',')]!
    pickOption(kind, (b) => /7th$|^Half-diminished$/.test(b), correctly)
  } else if ((m = text.match(/^What’s the chord on the (\d)\w+ note of (\S+) minor\?$/))) {
    const notes = minorTriad(m[2], Number(m[1]))
    pickOption(`${notes[0]} ${kindOf(notes)}`, (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In any minor key, what kind of chord is on the (\d)\w+ note\?$/))) {
    pickOption(capitalize(kindOf(minorTriad('A', Number(m[1])))), (b) => KIND_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) minor, which numeral is (\S+) (\w+)\?$/))) {
    pickOption(numeralFor(letterGap(m[1], m[2]) + 1, m[3]), (b) => NUMERAL_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) minor, with the raised 7th, what’s the (V7?) chord\?$/))) {
    const root = scaleDegree(m[1], 5, true)
    const notes = [root, noteAbove(root, 2, 4), noteAbove(root, 4, 7), ...(m[2] === 'V7' ? [noteAbove(root, 6, 10)] : [])]
    pickOption(chordSymbolOf(notes), (b) => /^[A-G]/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) minor, what’s the vii°7 chord\?$/))) {
    const root = noteAbove(m[1], 6, 11)
    pickOption(chordSymbolOf([root, noteAbove(root, 2, 3), noteAbove(root, 4, 6), noteAbove(root, 6, 9)]), (b) => /^[A-G]/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) minor, what’s the (\S+) chord\?$/))) {
    const notes = minorTriad(m[1], degreeOfNumeral(m[2]))
    pickOption(`${notes[0]} ${kindOf(notes)}`, (b) => TRIAD_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^What’s the 7th note of (\S+) harmonic minor\?$/))) {
    pickOption(noteAbove(m[1], 6, 11), (b) => /^[A-G][♯♭]?$/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) minor, what are the chords of (\S+)\?$/))) {
    const chords = m[2].split('–').map((step) => minorStepSymbol(m![1], step))
    pickOption(chords.join(' – '), (b) => b.includes(' – '), correctly)
  } else if ((m = text.match(/^In (\S+) minor, which progression is (.+)\?$/))) {
    const steps = m[2].split(' – ').map((symbol) => {
      const [root, suffix] = splitSymbol(symbol)
      return suffix === '7' ? 'V7' : numeralFor(letterGap(m![1], root) + 1, CHORD_WORDS[suffix])
    })
    pickOption(steps.join('–'), (b) => /^[iIvV°7–]+$/.test(b), correctly)
  } else if ((m = text.match(/^With (.+), a song starts and ends on (\S+)\. Which key is it in\?$/))) {
    const [root, suffix] = splitSymbol(m[2])
    pickOption(`${root} ${suffix === 'm' ? 'minor' : 'major'}`, (b) => KEY_BUTTON.test(b), correctly)
  } else if ((m = text.match(/^Which key is (.+) in\?$/))) {
    const [root, suffix] = splitSymbol(m[1].split(' – ')[0])
    pickOption(`${root} ${suffix === 'm' ? 'minor' : 'major'}`, (b) => KEY_BUTTON.test(b), correctly)
  } else if (text === 'Major key or minor key?') {
    const n = heard.notes.length
    pickOption(heard.notes[n - 2] - heard.notes[n - 3] === 3 ? 'Minor' : 'Major', (b) => b === 'Major' || b === 'Minor', correctly)
  } else if (text === 'Minor v or major V?') {
    pickOption(heard.notes[4] - heard.notes[3] === 3 ? 'Minor v' : 'Major V', (b) => /^(Minor v|Major V)$/.test(b), correctly)
  } else if ((m = text.match(/^Which note of (\S+) (minor|major) does \1 \2 pentatonic leave out\?$/))) {
    const minor = m[2] === 'minor'
    const dropped = (minor ? [2, 6] : [4, 7]).map((d) => scaleDegree(m![1], d, minor))
    const shown = screen.getAllByRole('button').map((b) => b.textContent!)
    pickOption(dropped.find((n) => shown.includes(n))!, (b) => /^[A-G][♯♭]?$/.test(b), correctly)
  } else if ((m = text.match(/^Which notes make (\S+) (minor|major) pentatonic\?$/))) {
    const minor = m[2] === 'minor'
    pickOption(PENT_DEGREES[m[2]].map((d) => scaleDegree(m![1], d, minor)).join(' '), (b) => /^([A-G][♯♭]? ?){5}$/.test(b), correctly)
  } else if ((m = text.match(/^In (\S+) minor pentatonic, which degree is the marked note\?$/))) {
    const score = screen.getByTestId('score')
    const marked = resolveNotes(JSON.parse(score.dataset.measures!) as ScoreMeasure[])[Number(score.dataset.marker)]
    pickOption(String(letterGap(m[1], marked.letter) + 1), (b) => /^[3457]$/.test(b), correctly)
  } else if ((m = text.match(/^(\S+) major pentatonic has the same notes as which minor pentatonic\?$/))) {
    pickOption(`${scaleDegree(m[1], 6)} minor pentatonic`, (b) => / pentatonic$/.test(b), correctly)
  } else if ((m = text.match(/^(\S+) minor pentatonic has the same notes as which major pentatonic\?$/))) {
    pickOption(`${scaleDegree(m[1], 3, true)} major pentatonic`, (b) => / pentatonic$/.test(b), correctly)
  } else if ((m = text.match(/^What’s the blue note in the (\S+) blues scale\?$/))) {
    pickOption(noteAbove(m[1], 4, 6), (b) => /^[A-G][♯♭]?$/.test(b), correctly)
  } else if ((m = text.match(/^Which notes make the (\S+) blues scale\?$/))) {
    const t = m[1]
    const notes = [scaleDegree(t, 1, true), scaleDegree(t, 3, true), scaleDegree(t, 4, true), noteAbove(t, 4, 6), scaleDegree(t, 5, true), scaleDegree(t, 7, true)]
    pickOption(notes.join(' '), (b) => /^([A-G][♯♭]? ?){6}$/.test(b), correctly)
  } else if ((m = text.match(/^In the (\S+) minor pentatonic box, which degree is the marked note\?$/))) {
    const semis = (((midiAt(markerPos('target')) - midiAt(markerPos('root'))) % 12) + 12) % 12
    pickOption(String({ 3: 3, 5: 4, 7: 5, 10: 7 }[semis]), (b) => /^[3457]$/.test(b), correctly)
  } else if ((m = text.match(/^Tap a root in (?:this (\S+) minor pentatonic box|Pattern \d of (\S+) minor pentatonic)$/))) {
    const root = labelPc(m[1] ?? m[2])
    const dots = boardMarkers().map((mk) => mk.pos)
    const spot = hitSpots().find((s) => dots.some((d) => d.string === s.pos.string && d.fret === s.pos.fret) && (pitchClass(midiAt(s.pos)) === root) === correctly)
    if (!spot) throw new Error(`Nothing to tap for: ${text}`)
    fireEvent.click(spot.el)
  } else if (text === 'Which minor pentatonic is this box?') {
    const low = boardMarkers().find((mk) => mk.pos.string === 0 && document.querySelector(`g[data-pos="0:${mk.pos.fret}"]`)?.getAttribute('data-tone') === 'root')!
    const right = screen.getAllByRole('button').find((b) => / minor pentatonic$/.test(b.textContent!) && labelPc(b.textContent!) === pitchClass(midiAt(low.pos)))!
    pickOption(right.textContent!, (b) => / minor pentatonic$/.test(b), correctly)
  } else if ((m = text.match(/^Tap the missing note of Pattern \d of (\S+) minor pentatonic, on the (.+) string$/))) {
    const string = ['low E', 'A', 'D', 'G', 'B', 'high E'].indexOf(m[2])
    const scale = PENT_DEGREES.minor.map((d) => labelPc(scaleDegree(m![1], d, true)))
    const step = (midi: number, dir: 1 | -1) => {
      let next = midi + dir
      while (!scale.includes(pitchClass(next))) next += dir
      return next
    }
    const on = (s: number) => boardMarkers().filter((mk) => mk.pos.string === s).map((mk) => midiAt(mk.pos))
    const shown = boardMarkers().find((mk) => mk.pos.string === string)!.pos
    const note = midiAt(shown)
    // A pattern is a run of scale notes, two to a string: the gap is the scale note above the one
    // shown if the note after that starts the next string up, otherwise the one below.
    const above = on(string + 1)
    const below = on(string - 1)
    const missing = above.length
      ? step(step(note, 1), 1) === Math.min(...above) ? step(note, 1) : step(note, -1)
      : step(step(note, -1), -1) === Math.max(...below) ? step(note, -1) : step(note, 1)
    const spot = hitSpots().find((s) => s.pos.string === string && (correctly ? midiAt(s.pos) === missing : s.pos.fret === shown.fret))
    if (!spot) throw new Error(`Nothing to tap for: ${text}`)
    fireEvent.click(spot.el)
  } else if ((m = text.match(/^In Pattern \d of (\S+) minor pentatonic, the lit notes make (\S+) major\. Which CAGED shape\?$/))) {
    const lit = [...document.querySelectorAll<SVGGElement>('svg[aria-label="Guitar fretboard"] g[data-tone="correct"]')].map((g) => parsePosKey(g.dataset.pos!)!)
    const frets = [0, 1, 2, 3, 4, 5].map((string) => lit.find((p) => p.string === string)?.fret ?? -1)
    const shape = Object.keys(OPEN_SHAPES).find((name) => {
      const open = OPEN_SHAPES[name]
      const shifts = new Set(frets.map((f, i) => (f < 0 || open[i] < 0 ? (f < 0 && open[i] < 0 ? 'muted' : 'no') : f - open[i])))
      return !shifts.has('no') && [...shifts].filter((x) => x !== 'muted').length === 1
    })!
    pickOption(`${shape} shape`, (b) => / shape$/.test(b), correctly)
  } else if (text === 'Major or minor pentatonic?') {
    pickOption(heard.notes[1] - heard.notes[0] === 2 ? 'Major pentatonic' : 'Minor pentatonic', (b) => / pentatonic$/.test(b), correctly)
  } else if (text === 'Minor pentatonic or blues scale?') {
    pickOption(heard.notes.length === 7 ? 'Blues scale' : 'Minor pentatonic', (b) => /^(Minor pentatonic|Blues scale)$/.test(b), correctly)
  } else if ((m = text.match(/^In a 12-bar blues, which chord is in bar (\d+)\?$/))) {
    pickOption(TWELVE_BARS[Number(m[1]) - 1], (b) => /^(I|IV|V)$/.test(b), correctly)
  } else if ((m = text.match(/^In a 12-bar blues in (\S+), what chord is in bar (\d+)\?$/))) {
    pickOption(`${bluesRoot(m[1], TWELVE_BARS[Number(m[2]) - 1])}7`, (b) => /^[A-G][♯♭]?7$/.test(b), correctly)
  } else if ((m = text.match(/^In a 12-bar blues in (\S+), what are the I7, IV7 and V7 chords\?$/))) {
    pickOption(['I', 'IV', 'V'].map((n) => `${bluesRoot(m![1], n)}7`).join(' '), (b) => /^([A-G][♯♭]?7 ?){3}$/.test(b), correctly)
  } else if ((m = text.match(/^This 12-bar blues in (\S+) (has a quick change\. What chord is in bar 2|ends with a turnaround\. What chord is in bar 12)\?$/))) {
    pickOption(`${bluesRoot(m[1], m[2].startsWith('has') ? 'IV' : 'V')}7`, (b) => /^[A-G][♯♭]?7$/.test(b), correctly)
  } else if ((m = text.match(/^In a minor blues in (\S+) minor, what chord is in bar (\d+)\?$/))) {
    pickOption(`${bluesRoot(m[1], TWELVE_BARS[Number(m[2]) - 1], true)}m7`, (b) => /^[A-G][♯♭]?m?7$/.test(b), correctly)
  } else if (text === 'Quick change, or does it stay on I?') {
    pickOption(heard.notes[4] !== heard.notes[0] ? 'Quick change' : 'Stays on I', (b) => /^(Quick change|Stays on I)$/.test(b), correctly)
  } else {
    return false
  }
  return true
}

/** Reading questions (accidentals, keys, steps and skips, phrases), answered from the music on screen. */
function answerReading(text: string, correctly: boolean): boolean {
  const score = screen.queryByTestId('score')
  if (!score) return false
  const measures = JSON.parse(score.dataset.measures!) as ScoreMeasure[]
  const key = score.dataset.key as KeyId
  const notes = resolveNotes(measures, key)
  const sounding = (i: number) => spelledMidi(notes[i]) - 12
  const pickButton = (label: string, names: string[]) => {
    const choice = screen.getAllByRole('button').find((b) => (correctly ? b.textContent === label : names.includes(b.textContent!) && b.textContent !== label))
    if (!choice) throw new Error(`No ${correctly ? 'right' : 'wrong'} answer to pick for: ${text}`)
    fireEvent.click(choice)
  }
  const tapWhere = (midi: number) => {
    if (correctly) return clickWhere((m) => m === midi)
    fireEvent.click(hitSpots().find((s) => midiAt(s.pos) !== midi)!.el)
  }
  if (text === 'What is the marked note?') {
    const pc = pitchClass(spelledMidi(notes[Number(score.dataset.marker)]))
    if (correctly) clickNote(pc)
    else clickWrongNote(pc)
  } else if (text === 'What key is this?') {
    pickButton(KEYS[key].name, Object.values(KEYS).map((k) => k.name))
  } else if (text === 'In this key, what note is this?') {
    const pc = pitchClass(spelledMidi(notes[0]))
    if (correctly) clickNote(pc)
    else clickWrongNote(pc)
  } else if (text === 'In this key, where do you play this note?') {
    tapWhere(sounding(0))
  } else if (text === 'How does the melody move?') {
    pickButton(MOTION_NAMES[motionBetween(measures[0][0], measures[0][1])], Object.values(MOTION_NAMES))
  } else if (text === 'Play this phrase, one note at a time') {
    if (!correctly) return (tapWhere(sounding(0)), true)
    notes.forEach((_, i) => clickWhere((m) => m === sounding(i)))
  } else {
    return false
  }
  return true
}

/** Works out the right answer from what's on screen and gives it (or deliberately misses). */
function answer(correctly: boolean) {
  // Give the question a moment on screen first (taps right after it appears are ignored).
  advanceTo(Date.now() + 500)
  const text = prompt()
  if (answerRhythm(text, correctly)) return
  if (answerTheory(text, correctly)) return
  if (answerReading(text, correctly)) return
  const staff = screen.queryByTestId('staff')?.textContent
  const fretboard = document.querySelector('svg[aria-label="Guitar fretboard"]')

  if (!correctly) {
    // Wrong on purpose: tap a spot that doesn't match, or pick a wrong button.
    if (staff && !fretboard) return clickWrongNote(pitchClass(keyToSounding(staff)))
    if (text === 'What note is this?') return clickWrongNote(pitchClass(midiAt(markerPos('target'))))
    if (text === 'What interval is this?') {
      const semis = midiAt(markerPos('target')) - midiAt(markerPos('root'))
      const short = INTERVALS.find((i) => i.semitones === semis)!.short
      const other = screen.getAllByRole('button').find((b) => /^(m3|M3|P4|P5|8va)/.test(b.textContent!) && !b.textContent!.startsWith(short))!
      return fireEvent.click(other)
    }
    const goal = staff ? keyToSounding(staff) : text.startsWith('Tap a') ? null : labelPc(highlighted())
    const wrong = hitSpots().find((s) => (goal === null ? true : staff ? midiAt(s.pos) !== goal : pitchClass(midiAt(s.pos)) !== goal))
    if (goal === null) {
      // Interval question: tap the root itself, which is never right.
      const root = markerPos('root')
      return fireEvent.click(hitSpots().find((s) => s.pos.string === root.string && s.pos.fret === root.fret)!.el)
    }
    return fireEvent.click(wrong!.el)
  }

  if (text === 'What interval is this?') {
    const semis = midiAt(markerPos('target')) - midiAt(markerPos('root'))
    const short = INTERVALS.find((i) => i.semitones === semis)!.short
    return fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent!.startsWith(short))!)
  }
  if (staff && !fretboard) return clickNote(pitchClass(keyToSounding(staff)))
  if (staff) return clickWhere((m) => m === keyToSounding(staff))
  if (text === 'What note is this?') return clickNote(pitchClass(midiAt(markerPos('target'))))
  if (text.startsWith('Tap a')) {
    const info = INTERVALS.find((i) => text.includes(i.name))!
    const root = midiAt(markerPos('root'))
    return clickWhere((m) => m === root + info.semitones)
  }
  const pc = labelPc(highlighted())
  return clickWhere((m) => pitchClass(m) === pc, text.startsWith('Find every'))
}

const continueButton = () => screen.queryByRole('button', { name: /Next/ })

/** Steps through a rehearsal's cards and checks (answering correctly) until it's ready to record. */
function playRehearsal() {
  for (let i = 0; i < 120; i++) {
    if (screen.queryByRole('button', { name: '● Record take' })) return
    if (!document.querySelector('[data-step="card"]')) {
      answer(true)
      expect(screen.getByRole('status').dataset.result).toBe('clean')
    }
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
  }
  throw new Error('Rehearsal never finished')
}

/** Answers until the lesson ends. `wrongAt` lists question numbers (0-based) to miss on purpose. */
function playLesson(wrongAt: number[] = []) {
  for (let i = 0; i < 60; i++) {
    if (!document.querySelector('h2')) return
    answer(!wrongAt.includes(i))
    expect(screen.getByRole('status').dataset.result).toBe(wrongAt.includes(i) ? 'clipped' : 'clean')
    fireEvent.click(continueButton()!)
  }
  throw new Error('Lesson never ended')
}

// ---------------------------------------------------------------------------

describe('the app', () => {
  it('opens on the deck and the tape rack', () => {
    render(<App />)
    // The deck holds the next lesson's tape.
    const lcd = () => document.querySelector('section .lcd')!.textContent
    expect(lcd()).toContain('UP NEXT')
    expect(lcd()).toContain('Note values')
    // "Now playing" on the deck's band, and on that tape in the rack.
    const deck = () => within(document.querySelector('section')!)
    expect(deck().getByText('Now playing')).toBeTruthy()
    expect(screen.getAllByText('Now playing')).toHaveLength(2)
    // Browsing another tape loads it into the deck without moving "now playing".
    fireEvent.click(screen.getByRole('button', { name: /^Tape 3: B String · Staff/ }))
    expect(lcd()).toContain('SEALED')
    expect(deck().getByText('Loaded')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Tape 1: Reading basics\. Now playing/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Tape 1: Reading basics/ }))
    expect(lcd()).toContain('UP NEXT')
    // Load tape opens the tape's page; Play starts the lesson.
    fireEvent.click(screen.getByRole('button', { name: '⏏ Load tape' }))
    expect(window.location.hash).toBe('#/tape/r1')
    expect(screen.getByText('Liner notes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '▶ Play' }))
    expect(window.location.hash).toBe('#/rehearse/r1-1')
    expect(screen.getByText('New idea 1 of 7')).toBeTruthy()
  })

  it('rehearses a track, then records it; next time Record goes straight to the take', () => {
    render(<App />)
    go('/rehearse/r1-1')
    playRehearsal()
    fireEvent.click(screen.getByRole('button', { name: '● Record take' }))
    expect(window.location.hash).toBe('#/lesson/r1-1')
    expect(useProgress.getState().rehearsed['r1-1']).toBe(true)
    go('/tape/r1')
    fireEvent.click(screen.getByRole('button', { name: 'Record Note values' }))
    expect(window.location.hash).toBe('#/lesson/r1-1')
  })

  it('brings a missed rehearsal question back instead of counting a clip', () => {
    render(<App />)
    go('/rehearse/r2-1')
    // Past the cards to the first quick check.
    while (document.querySelector('[data-step="card"]')) fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
    answer(false)
    expect(screen.getByText('Not yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
    playRehearsal()
    expect(screen.getByText('Ready to record')).toBeTruthy()
    expect(Object.keys(useProgress.getState().stats)).toHaveLength(0)
  })

  for (const id of [
    'r1-1',
    'r1-2',
    'r1-3',
    'r3-2',
    'r4-2',
    'r6-2',
    'r8-1',
    'r8-3',
    'r9-1',
    'r9-3',
    'r10-1',
    'r10-3',
    'r11-2',
    'u1-3',
    'u7-1',
    'u9-1',
    'u13-2',
    'u14-3',
    't1-1',
    't1-2',
    't1-3',
    't2-1',
    't2-3',
    't3-1',
    't3-2',
    't4-1',
    't4-2',
    't5-1',
    't5-2',
    't5-3',
    't6-1',
    't6-4',
    't7-2',
    't7-3',
    't8-1',
    't8-3',
    't9-1',
    't9-4',
    't9-6',
  ]) {
    it(`plays the rehearsal for ${id} through to the take`, () => {
      render(<App />)
      go(`/rehearse/${id}`)
      playRehearsal()
      fireEvent.click(screen.getByRole('button', { name: '● Record take' }))
      expect(window.location.hash).toBe(`#/lesson/${id}`)
    })
  }

  it('finishes a perfect lesson and saves stars, XP and streak', () => {
    render(<App />)
    go('/lesson/u1-1')
    playLesson()
    expect(screen.getByText('Take recorded')).toBeTruthy()
    expect(screen.getByText('Master take')).toBeTruthy()
    const state = useProgress.getState()
    expect(state.lessons['u1-1'].stars).toBe(3)
    expect(state.nailed).toBe(10)
    expect(screen.getByText('On the beat')).toBeTruthy()
    expect(state.streak.count).toBe(1)
    expect(Object.keys(state.stats).length).toBeGreaterThan(0)
  })

  it('brings missed questions back and gives fewer stars', () => {
    render(<App />)
    go('/lesson/u2-1')
    playLesson([1])
    expect(screen.getByText('Keeper')).toBeTruthy()
    expect(useProgress.getState().lessons['u2-1'].stars).toBe(2)
  })

  it('mixes due review into a take, and a missed review question costs no clip', () => {
    const yesterday = new Date(Date.now() - 86400000)
    const due = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    const learned = { seen: 4, correct: 4, recent: 0.9, ms: 1500, pace: 0.9, interval: 3, due }
    useProgress.setState({ stats: { '5:1': learned, 'sym:half': learned, 'staff:77': learned } })
    render(<App />)
    go('/lesson/r3-1')
    let reviews = 0
    for (let i = 0; i < 30 && document.querySelector('h2'); i++) {
      const isReview = !!screen.queryByText(/Review · from tape/)
      answer(!isReview)
      expect(screen.getByRole('status').dataset.result).toBe(isReview ? 'review-miss' : 'clean')
      if (isReview) {
        reviews++
        expect(screen.getByText('Not yet')).toBeTruthy()
        expect(screen.getByLabelText('3 of 3 chances left')).toBeTruthy()
      }
      fireEvent.click(continueButton()!)
    }
    expect(reviews).toBe(3)
    // No clips, so a perfect take, even with every review missed.
    expect(screen.getByText('Master take')).toBeTruthy()
    // The misses come back tomorrow.
    expect(useProgress.getState().stats['sym:half'].interval).toBe(1)
  })

  it('offers an optional review session from the Jam room', () => {
    render(<App />)
    go('/review')
    expect(screen.getByText(/Nothing’s due for review/)).toBeTruthy()
    useProgress.setState({ stats: { 'sym:half': { seen: 3, correct: 3, recent: 0.9, ms: 1500 }, '5:1': { seen: 3, correct: 3, recent: 0.9, ms: 1500 } } })
    go('/practice')
    expect(screen.getByText('Review')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '↺ Review now' }))
    expect(window.location.hash).toBe('#/review')
    let asked = 0
    for (let i = 0; i < 20 && document.querySelector('h2'); i++) {
      answer(true)
      asked++
      fireEvent.click(continueButton()!)
    }
    expect(asked).toBe(2)
    expect(screen.getByText('Take recorded')).toBeTruthy()
  })

  it('ignores a click that lands on a new question right after Next', () => {
    render(<App />)
    go('/lesson/u1-1')
    answer(true)
    fireEvent.click(continueButton()!)
    const keys = screen.queryAllByRole('button').filter((b) => /^[A-G]$/.test(b.textContent!))
    fireEvent.click(keys.length ? keys[0] : hitSpots()[0].el)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ruins the take after three clips', () => {
    render(<App />)
    go('/lesson/u1-1')
    for (let i = 0; i < 3; i++) {
      answer(false)
      fireEvent.click(continueButton()!)
    }
    expect(screen.getByText('Take ruined')).toBeTruthy()
    expect(useProgress.getState().lessons['u1-1']).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: /Rewind/ }))
    expect(screen.getByLabelText('3 of 3 chances left')).toBeTruthy()
  })

  for (const lesson of ALL_LESSONS) {
    it(`plays lesson ${lesson.id} (${lesson.title}) from start to finish`, () => {
      render(<App />)
      go(`/lesson/${lesson.id}`)
      playLesson([0])
      expect(screen.getByText('Take recorded')).toBeTruthy()
    })
  }

  it('runs a custom drill and a weak-spot round', () => {
    render(<App />)
    go('/drill?s=0,1&f=0-7&t=name,find,findAll,staffFind&a=1&n=10')
    playLesson()
    expect(screen.getByText('Take recorded')).toBeTruthy()
    expect(screen.queryByText('Master take')).toBeNull()
    go('/weak')
    playLesson([0, 3])
    expect(screen.getByText('Trouble spots')).toBeTruthy()
  })

  it('runs a 60-second sprint and keeps the best score', () => {
    const tick = (ms: number) => advanceTo(Date.now() + ms)
    render(<App />)
    go('/sprint?p=low')
    expect(screen.getByText('Count-in')).toBeTruthy()
    tick(2200)
    for (let i = 0; i < 5; i++) {
      answer(true)
      tick(300)
    }
    answer(false)
    tick(1000)
    expect(screen.getByLabelText('Score 5')).toBeTruthy()
    tick(60000)
    expect(screen.getByText('Time')).toBeTruthy()
    expect(screen.getByText('New best')).toBeTruthy()
    expect(useProgress.getState().bests.low).toBe(5)
    expect(useProgress.getState().nailed).toBe(5)
  })

  it('pauses an ear-training take with “Can’t listen now”, without recording it, until the monitors are back on', () => {
    render(<App />)
    go('/lesson/t9-1')
    advanceTo(Date.now() + 500)
    expect(prompt()).toBe('What interval do you hear?')
    expect(heard.notes).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Can’t listen now/ }))
    expect(screen.getByText('Monitors off')).toBeTruthy()
    expect(useProgress.getState().lessons['t9-1']).toBeUndefined()
    expect(useProgress.getState().listeningPausedUntil).toBeGreaterThan(Date.now())
    // The tape page has the switch too; flipping it brings listening back. Every track on it is marked as needing headphones.
    go('/tape/t9')
    expect(screen.getAllByText('Needs headphones')).toHaveLength(6)
    fireEvent.click(screen.getByRole('switch', { name: 'Monitors' }))
    expect(useProgress.getState().listeningPausedUntil).toBeNull()
    go('/lesson/t9-1')
    playLesson()
    expect(screen.getByText('Take recorded')).toBeTruthy()
  })

  it('drops listening review from other takes when you can’t listen', () => {
    const due = { seen: 3, correct: 3, recent: 1, ms: 2000, interval: 3, due: '2026-01-01' }
    useProgress.setState({ stats: { 'ear:P5': due, 'ear:M3': due, 'ear:P8': due } })
    render(<App />)
    go('/lesson/u1-1')
    let paused = false
    for (let i = 0; i < 30 && document.querySelector('h2'); i++) {
      advanceTo(Date.now() + 500)
      if (prompt() === 'What interval do you hear?') {
        expect(paused).toBe(false)
        fireEvent.click(screen.getByRole('button', { name: /Can’t listen now/ }))
        paused = true
        continue
      }
      answer(true)
      fireEvent.click(continueButton()!)
    }
    expect(paused).toBe(true)
    expect(screen.getByText('Take recorded')).toBeTruthy()
  })

  it('shows a theory jam once you’ve recorded a theory track, and plays it', () => {
    render(<App />)
    go('/practice')
    expect(screen.queryByText('Theory jam')).toBeNull()
    act(() => useProgress.setState({ lessons: { 't2-2': { stars: 3, completions: 1 } } }))
    expect(screen.getByText('Theory jam')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Keys\s*Record its tape first$/ })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Steps & scales' }))
    expect(window.location.hash).toBe('#/jam?t=scales')
    playLesson()
    expect(screen.getByText('Take recorded')).toBeTruthy()
    expect(Object.keys(useProgress.getState().lessons)).toEqual(['t2-2'])
  })

  it('unlocks the Keys sprint once you can name keys', () => {
    const tick = (ms: number) => advanceTo(Date.now() + ms)
    useProgress.setState({ lessons: { 'r9-3': { stars: 3, completions: 1 } } })
    render(<App />)
    go('/sprint?p=keys')
    tick(2200)
    for (let i = 0; i < 4; i++) {
      answer(true)
      tick(300)
    }
    expect(screen.getByLabelText('Score 4')).toBeTruthy()
  })

  it('goes back a card in a rehearsal, without asking a passed check again', () => {
    render(<App />)
    go('/rehearse/r1-1')
    const title = () => document.querySelector('[data-step="card"] h1')?.textContent
    const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
    const back = () => fireEvent.click(screen.getByRole('button', { name: 'Previous card' }))
    expect(title()).toBe('How music is written')
    expect(screen.queryByRole('button', { name: 'Previous card' })).toBeNull()
    next()
    next()
    next()
    expect(title()).toBe('Whole note')
    next()
    expect(title()).toBe('Half note')
    back()
    expect(title()).toBe('Whole note')
    next()
    next()
    // The quick check, then on to the next card.
    while (!document.querySelector('[data-step="card"]')) {
      answer(true)
      next()
    }
    expect(title()).toBe('Quarter note')
    back()
    expect(title()).toBe('Half note')
    next()
    expect(title()).toBe('Quarter note')
  })

  it('stops the last card’s or question’s sound when you move on', () => {
    render(<App />)
    go('/rehearse/r1-1')
    let before = heard.stops
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
    expect(heard.stops).toBeGreaterThan(before)
    go('/lesson/u1-1')
    answer(true)
    before = heard.stops
    fireEvent.click(continueButton()!)
    expect(heard.stops).toBeGreaterThan(before)
    before = heard.stops
    go('/explore')
    expect(heard.stops).toBeGreaterThan(before)
  })

  it('explains a music word when you tap it on a lesson card', () => {
    render(<App />)
    go('/rehearse/r1-1')
    // The third card, "Measures and bar lines", picks out "beats".
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: /^beats$/i }))
    expect(screen.getByRole('dialog', { name: 'beat' }).textContent).toContain('steady pulse')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // The settings knob says what it is.
    go('/')
    expect(screen.getByRole('button', { name: 'Settings' }).textContent).toContain('Setup')
  })

  it('remembers the Jam setup after a jam', () => {
    render(<App />)
    go('/practice')
    // Turn off the high e string and pick 20 notes.
    fireEvent.click(screen.getByRole('button', { name: 'e' }))
    fireEvent.click(screen.getByRole('button', { name: '20 notes' }))
    go('/weak')
    go('/practice')
    expect(screen.getByRole('button', { name: 'e' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: '20 notes' }).getAttribute('aria-pressed')).toBe('true')
    expect(useProgress.getState().jam.setup.strings).toEqual([0, 1, 2, 3, 4])
  })

  it('only answers taps on the notes the Fretboard tab is showing', () => {
    render(<App />)
    go('/explore')
    const tapFret = (pos: string) => fireEvent.click(document.querySelector(`rect.fret-hit[data-pos="${pos}"]`)!)
    const panel = () => screen.getByText(/Tap any note|string, /).closest('.panel')!.textContent!
    // Natural notes: the F♯ at the 2nd fret of the low E string is hidden, so tapping there does nothing.
    tapFret('0:2')
    expect(panel()).toContain('Tap any note')
    tapFret('0:1')
    expect(panel()).toContain('low E string, 1st fret')
    // Sharps: now it shows, and answers.
    fireEvent.click(screen.getByRole('button', { name: 'Sharps' }))
    tapFret('0:2')
    expect(panel()).toContain('low E string, 2nd fret')
    const label = (pos: string) => document.querySelector(`g[data-pos="${pos}"] text`)!.textContent
    expect(label('0:2')).toBe('F♯')
    // Flats: the same fret, under its other name, and the Solo row follows.
    fireEvent.click(screen.getByRole('button', { name: 'Flats' }))
    expect(label('0:2')).toBe('G♭')
    expect(screen.getByRole('button', { name: 'G♭' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'F♯' })).toBeNull()
    // Soloing one note: only that note answers.
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    tapFret('0:5')
    expect(panel()).toContain('low E string, 2nd fret')
    tapFret('0:8')
    expect(panel()).toContain('low E string, 8th fret')
  })

  it('adds the Scale and Interval views to the Fretboard tab once you reach those tapes', () => {
    render(<App />)
    go('/explore')
    expect(screen.queryByRole('button', { name: /Scale/ })).toBeNull()
    act(() => useProgress.setState({ lessons: { 't2-2': { stars: 3, completions: 1 } } }))
    fireEvent.click(screen.getByRole('button', { name: /Scale/ }))
    expect(screen.getByRole('button', { name: /^G$/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^A$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Interval/ })).toBeNull()
    act(() => useProgress.setState({ lessons: { 't2-2': { stars: 3, completions: 1 }, 'u14-1': { stars: 3, completions: 1 } } }))
    fireEvent.click(screen.getByRole('button', { name: /Interval/ }))
    fireEvent.click(document.querySelector('rect.fret-hit[data-pos="1:3"]')!)
    expect(screen.getByText(/C up a perfect 5th is G/)).toBeTruthy()
  })

  it('adds the pentatonic scales and their patterns to the Scale view as they’re taught', () => {
    render(<App />)
    const done = { stars: 3, completions: 1 }
    act(() => useProgress.setState({ lessons: { 't2-2': done, 'bp1-1': done, 'bp4-3': done } }))
    go('/explore')
    fireEvent.click(screen.getByRole('button', { name: 'Scale' }))
    expect(screen.queryByRole('button', { name: 'Blues scale' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Minor pentatonic' }))
    const dots = () => [...document.querySelectorAll<SVGGElement>('svg[aria-label="Guitar fretboard"] g[data-tone]')]
    // C's key button now names its relative minor, A, and every A minor pentatonic note is lit.
    expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true')
    expect(new Set(dots().map((g) => g.querySelector('text')!.textContent))).toEqual(new Set(['A', 'C', 'D', 'E', 'G']))
    // Pattern 1, the box: twelve notes from the 5th fret to the 8th. Only the patterns taught so far are offered.
    expect(screen.queryByRole('button', { name: '3' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    const frets = dots().map((g) => parsePosKey(g.dataset.pos!)!.fret)
    expect(frets).toHaveLength(12)
    expect(frets.every((f) => f >= 5 && f <= 8)).toBe(true)
    // Only the box's notes answer a tap: the G at the 3rd fret is in the scale but not the box.
    const panel = () => screen.getByText(/Pattern 1 of the|of the A minor pentatonic/).closest('.panel')!.textContent!
    fireEvent.click(document.querySelector('rect.fret-hit[data-pos="0:3"]')!)
    expect(panel()).toContain('Pattern 1 of the A minor pentatonic')
    fireEvent.click(document.querySelector('rect.fret-hit[data-pos="0:5"]')!)
    expect(panel()).toContain('The root of the A minor pentatonic')
  })

  it('renders every tab and screen', () => {
    render(<App />)
    for (const path of ['/practice', '/explore', '/stats', '/settings', '/tape/r1', '/tape/r2', '/tape/u14', '/tape/t4', '/tape/t9', '/rehearse/r1-1', '/rehearse/r6-2', '/rehearse/t4-1', '/rehearse/t9-3', '/']) {
      go(path)
      expect(document.body.textContent!.length).toBeGreaterThan(20)
    }
    go('/practice')
    expect(screen.getByText('60-second sprint')).toBeTruthy()
    go('/explore')
    fireEvent.click(hitSpots().find((s) => s.pos.string === 1 && s.pos.fret === 3)!.el)
    expect(screen.getByText('A string, 3rd fret')).toBeTruthy()
  })
})
