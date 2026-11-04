// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { ALL_LESSONS } from './music/curriculum'
import { INTERVALS, midiAt, parsePosKey, pcName, pitchClass, spelledMidi, type Letter } from './music/notes'
import { eventQuarters, METER_PULSE, METER_QUARTERS, onsets, SYMBOLS, symbolOf, type Measure, type Meter, type RhythmEvent } from './music/rhythm'
import { KEYS, MOTION_NAMES, motionBetween, resolveNotes, type KeyId, type ScoreMeasure } from './music/score'
import { useProgress } from './store/progress'

// Ear questions play notes the player can't see; the stand-in remembers the last ones played.
const heard = vi.hoisted(() => ({ notes: [] as number[] }))
vi.mock('./audio/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio/sound')>()),
  playListen: (notes: number[]) => {
    heard.notes = notes
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
    const [lo, hi] = [spell(first), spell(second ?? first.with!)].sort((x, y) => staffSpot(x) - staffSpot(y))
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
    fireEvent.click(screen.getByRole('button', { name: 'Next ▸▸' }))
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
    expect(screen.getByText('Now playing')).toBeTruthy()
    // Browsing another tape loads it into the deck without moving "now playing".
    fireEvent.click(screen.getByRole('button', { name: /^Tape 3: The 2nd string/ }))
    expect(lcd()).toContain('SEALED')
    expect(screen.getByText('Loaded')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Tape 1: Reading basics\. Now playing/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Tape 1: Reading basics/ }))
    expect(lcd()).toContain('UP NEXT')
    // Load tape opens the tape's page; Play starts the lesson.
    fireEvent.click(screen.getByRole('button', { name: '⏏ Load tape' }))
    expect(window.location.hash).toBe('#/tape/r1')
    expect(screen.getByText('Liner notes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '▶ Play' }))
    expect(window.location.hash).toBe('#/rehearse/r1-1')
    expect(screen.getByText('New idea 1 of 4')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: 'Next ▸▸' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next ▸▸' }))
    answer(false)
    expect(screen.getByText('Not yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next ▸▸' }))
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
    // The tape page has the switch too; flipping it brings listening back.
    go('/tape/t9')
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
