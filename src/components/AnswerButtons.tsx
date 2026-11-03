import type { ReactNode } from 'react'
import { intervalInfo, pcName } from '../music/notes'

export interface PickResult {
  picked: number
  correct: number
}

const NATURALS = [0, 2, 4, 5, 7, 9, 11]
/** Black keys and which grid column (of 14) they start in, between their white neighbors. */
const ACCIDENTALS = [
  { pc: 1, col: 2 },
  { pc: 3, col: 4 },
  { pc: 6, col: 8 },
  { pc: 8, col: 10 },
  { pc: 10, col: 12 },
]

type KeyState = 'correct' | 'wrong' | 'faded' | null

function keyState(value: number, result: PickResult | null | undefined): KeyState {
  if (!result) return null
  if (value === result.correct) return 'correct'
  if (value === result.picked) return 'wrong'
  return 'faded'
}

const IVORY = 'bg-[linear-gradient(#fdf8ec,#e6dbc4)] text-ink shadow-[inset_0_-4px_0_#c9bc9f,0_2px_4px_rgba(0,0,0,0.5)]'
const EBONY = 'bg-[linear-gradient(#3a322d,#14100e)] text-cream shadow-[inset_0_-3px_0_#000,inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.6)]'
const LIT: Record<'correct' | 'wrong', string> = {
  correct: 'bg-led text-ink shadow-[0_0_14px_rgba(99,214,139,0.7)]',
  wrong: 'bg-rec text-white shadow-[0_0_14px_rgba(229,72,58,0.7)]',
}

/** Note names as a little keyboard: naturals on ivory keys, sharps/flats on the black keys above. */
export function NoteButtons({
  choices,
  onPick,
  result,
}: {
  choices: 'naturals' | 'all'
  onPick: (pc: number) => void
  result?: PickResult | null
}) {
  const key = (pc: number, black: boolean, gridColumn?: string) => {
    const state = keyState(pc, result)
    const look = state === 'correct' || state === 'wrong' ? LIT[state] : black ? EBONY : IVORY
    return (
      <button
        key={pc}
        disabled={!!result}
        onClick={() => onPick(pc)}
        className={`rounded-b-md border border-black font-label font-semibold transition active:translate-y-px ${
          black ? 'py-1.5 text-xs leading-tight' : 'pt-4 pb-2.5 text-xl'
        } ${look} ${state === 'faded' ? 'opacity-35' : ''}`}
        style={{ gridColumn }}
      >
        {black ? (
          <>
            {pcName(pc, 'sharp')}
            <br />
            {pcName(pc, 'flat')}
          </>
        ) : (
          pcName(pc)
        )}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-black bg-[#0f0c0a] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
      {choices === 'naturals' ? (
        <div className="grid grid-cols-7 gap-1">{NATURALS.map((pc) => key(pc, false))}</div>
      ) : (
        <div className="grid grid-cols-14 gap-x-1 gap-y-1.5">
          {ACCIDENTALS.map(({ pc, col }) => key(pc, true, `${col} / span 2`))}
          {NATURALS.map((pc, i) => key(pc, false, `${i * 2 + 1} / span 2`))}
        </div>
      )}
    </div>
  )
}

export function IntervalButtons({
  options,
  onPick,
  result,
}: {
  options: number[]
  onPick: (semitones: number) => void
  result?: PickResult | null
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((semi) => {
        const state = keyState(semi, result)
        const info = intervalInfo(semi)
        return (
          <button
            key={semi}
            disabled={!!result}
            onClick={() => onPick(semi)}
            className={`hw-btn px-1 py-2 ${state === 'correct' || state === 'wrong' ? LIT[state] : 'hw-dark'} ${
              state === 'faded' ? 'opacity-35' : ''
            }`}
          >
            <span className="block font-mono text-lg leading-tight normal-case">{info.short}</span>
            <span className="block text-[10px] tracking-wider opacity-80">{info.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Plain choices (symbol names, beat counts), lit up green/red after answering. */
export function OptionButtons({
  options,
  onPick,
  result,
  columns = 2,
}: {
  options: { value: number; label: ReactNode }[]
  onPick: (value: number) => void
  result?: PickResult | null
  columns?: number
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const state = keyState(o.value, result)
        return (
          <button
            key={o.value}
            disabled={!!result}
            onClick={() => onPick(o.value)}
            className={`hw-btn px-2 py-3 text-base ${state === 'correct' || state === 'wrong' ? LIT[state] : 'hw-dark'} ${
              state === 'faded' ? 'opacity-35' : ''
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
