// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { ALL_LESSONS } from './music/curriculum'
import { INTERVALS, midiAt, parsePosKey, pcName, pitchClass, spelledMidi, type Letter } from './music/notes'
import { eventBeats, METER_BEATS, onsets, SYMBOLS, symbolOf, type Measure, type Meter, type RhythmEvent } from './music/rhythm'
import { useProgress } from './store/progress'

// VexFlow needs real font metrics; a stand-in staff just shows the note it was given.
vi.mock('./components/Staff', () => ({
  Staff: ({ keys }: { keys: string[] }) => <div data-testid="staff">{keys.join(',')}</div>,
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
  expect(screen.getByTestId('countdown').textContent).toBe(String(box.dataset.beats))
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
    const missing = METER_BEATS[meter] - events.reduce((t, e) => t + eventBeats(e), 0)
    choice = buttons.find((b) => {
      const s = symbolNamed(b.textContent!)
      return s && (correctly ? s.beats === missing : s.beats !== missing)
    })
  } else if (text.startsWith('Tap the note on')) {
    const words = highlighted().split(' ')
    const beat = words[0] === 'beat' ? Number(words[1]) - 1 : Number(words[words.length - 1]) - 0.5
    const starts = onsets({ meter, events })
    const target = starts.findIndex((s, i) => s === beat && !events[i].rest && !(i > 0 && events[i - 1].tie))
    choice = [...notation.querySelectorAll<HTMLElement>('[data-note-index]')].find((b) => (Number(b.dataset.noteIndex) === target) === correctly)
  } else {
    return false
  }
  if (!choice) throw new Error(`No ${correctly ? 'right' : 'wrong'} answer to pick for: ${text}`)
  fireEvent.click(choice)
  return true
}

/** Works out the right answer from what's on screen and gives it (or deliberately misses). */
function answer(correctly: boolean) {
  // Give the question a moment on screen first (taps right after it appears are ignored).
  advanceTo(Date.now() + 500)
  const text = prompt()
  if (answerRhythm(text, correctly)) return
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
  it('shows the tape shelf, opens a tape and starts recording its first track', () => {
    render(<App />)
    expect(screen.getByText('Now playing')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tape 2: The 1st string' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tape 1: Reading basics' }))
    expect(window.location.hash).toBe('#/tape/r1')
    expect(screen.getByText('Liner notes')).toBeTruthy()
    expect(screen.getByRole('button', { name: '● Rehearse & record: Note values' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record Note values' }))
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

  for (const id of ['r1-1', 'r1-2', 'r1-3', 'r3-2', 'r4-2', 'r6-2', 'u1-3', 'u7-1', 'u9-1', 'u11-1', 'u13-2', 'u14-3']) {
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

  it('renders every tab and screen', () => {
    render(<App />)
    for (const path of ['/practice', '/explore', '/stats', '/settings', '/tape/r1', '/tape/r2', '/tape/u14', '/rehearse/r1-1', '/rehearse/r6-2', '/']) {
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
