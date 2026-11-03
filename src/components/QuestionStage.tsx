import { useRef, useState, type ReactNode } from 'react'
import { playNotes } from '../audio/sound'
import { BOARD_KINDS, correctPick, hintText, markersFor, pickIsCorrect, promptText, type Answer, type TapResult } from '../game/present'
import type { Question } from '../game/questions'
import { samePos, midiAt, vexKey, type Position } from '../music/notes'
import { countAt, onsets, SYMBOLS } from '../music/rhythm'
import { IntervalButtons, NoteButtons, OptionButtons } from './AnswerButtons'
import { Fretboard, useLandscape } from './Fretboard'
import { Notation } from './Notation'
import { Staff } from './Staff'
import { TapRhythm } from './TapRhythm'

type Submit = (ok: boolean, detail?: Omit<Answer, 'ok' | 'ms'>) => void

/**
 * Taps this soon after a question appears are ignored, so a click meant for the last
 * question's Next button can't land on this one's answers.
 */
export const INPUT_GUARD_MS = 400

/** Turns taps and button presses into answers. Shared by lessons and rehearsals. */
export function useQuestionInput(q: Question, answer: Answer | null, submit: Submit) {
  const [found, setFound] = useState<{ id: number; spots: Position[] }>({ id: q.id, spots: [] })
  const spots = found.id === q.id ? found.spots : []
  const shown = useRef({ id: q.id, at: Date.now() })
  if (shown.current.id !== q.id) shown.current = { id: q.id, at: Date.now() }
  const settling = () => Date.now() - shown.current.at < INPUT_GUARD_MS

  function tap(p: Position) {
    if (answer || settling()) return
    switch (q.kind) {
      case 'find':
      case 'staffFind':
      case 'interval':
        return submit(q.targets.some((t) => samePos(t, p)), { tapped: p })
      case 'findAll': {
        if (spots.some((f) => samePos(f, p))) return
        if (!q.targets.some((t) => samePos(t, p))) return submit(false, { tapped: p })
        const now = [...spots, p]
        setFound({ id: q.id, spots: now })
        if (now.length === q.targets.length) submit(true, { tapped: p })
        else playNotes(midiAt(p))
        return
      }
    }
  }

  function pick(value: number) {
    if (!answer && !settling()) submit(pickIsCorrect(q, value), { picked: value })
  }

  function rhythm(result: TapResult) {
    if (!answer) submit(result.hits === result.total && result.extra === 0, { rhythm: result })
  }

  return { found: spots, tap, pick, rhythm }
}

const BEAT_LABELS: Record<number, string> = { 0.5: '½', 1.5: '1½' }

interface StageProps {
  q: Question
  answer: Answer | null
  found: Position[]
  /** Small line above the question ("● Rec · Frets 0–5", "Quick check · no clips"). */
  label?: ReactNode
  /** Shown in place of the answer controls once answered. */
  feedback?: ReactNode
  onTap: (p: Position) => void
  onPick: (value: number) => void
  onRhythm: (result: TapResult) => void
  /** Let rhythm questions play the rhythm first (rehearsals). */
  allowListen?: boolean
}

/** Lays out a question: prompt, what to read (staff, notation or fretboard), and how to answer. */
export function QuestionStage({ q, answer, found, label, feedback, onTap, onPick, onRhythm, allowListen }: StageProps) {
  const landscape = useLandscape()
  const hint = hintText(q, found)
  const result = answer && answer.picked !== undefined ? { picked: answer.picked, correct: correctPick(q) } : null

  const prompt = (
    <div>
      {label}
      <h2 className="font-label text-2xl leading-tight font-medium text-cream">{promptText(q)}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  )

  const staff = (q.kind === 'staffName' || q.kind === 'staffFind') && (
    <div className="paper h-full px-3 py-1">
      <Staff keys={[vexKey(q.note)]} />
    </div>
  )

  const board = BOARD_KINDS.includes(q.kind) && 'region' in q && (
    <Fretboard
      key={q.id}
      minFret={q.region.minFret}
      maxFret={q.region.maxFret}
      activeStrings={q.kind === 'find' ? [q.string] : q.region.strings}
      markers={markersFor(q, answer, found)}
      onTap={q.kind === 'name' || q.kind === 'intervalName' ? undefined : onTap}
    />
  )

  let notation: ReactNode = null
  if (q.kind === 'symbolName' || q.kind === 'beats') {
    notation = <Notation measure={{ meter: '4/4', events: [SYMBOLS[q.symbol].event!] }} clef={false} timeSig={false} />
  } else if (q.kind === 'measureFill') {
    notation = <Notation measure={q.measure} blankBeats={q.missing} />
  } else if (q.kind === 'countBeat') {
    const starts = onsets(q.measure)
    const colors = answer ? q.measure.events.map((_, i) => (i === q.target ? '#2f8f4e' : i === answer.picked ? '#c0392b' : undefined)) : undefined
    notation = (
      <Notation
        measure={q.measure}
        onTapNote={answer ? undefined : onPick}
        colors={colors}
        labels={answer ? q.measure.events.map((_, i) => countAt(starts[i])) : undefined}
      />
    )
  }

  const tapRhythm = q.kind === 'tapRhythm' && (
    <TapRhythm key={q.id} measure={q.measure} bpm={q.bpm} result={answer?.rhythm ?? null} onDone={onRhythm} allowListen={allowListen} />
  )

  let controls: ReactNode = null
  if (q.kind === 'name' || q.kind === 'staffName') controls = <NoteButtons choices={q.choices} onPick={onPick} result={result} />
  else if (q.kind === 'intervalName') controls = <IntervalButtons options={q.options} onPick={onPick} result={result} />
  else if (q.kind === 'symbolName' || q.kind === 'measureFill')
    controls = <OptionButtons options={q.options.map((s, i) => ({ value: i, label: SYMBOLS[s].name }))} onPick={onPick} result={result} />
  else if (q.kind === 'beats')
    controls = (
      <OptionButtons options={q.options.map((b) => ({ value: b, label: BEAT_LABELS[b] ?? String(b) }))} onPick={onPick} result={result} columns={3} />
    )

  const visual = notation && (
    <div className="paper h-full max-h-60 w-full px-3 py-2">{notation}</div>
  )

  if (landscape) {
    return (
      <div className="flex min-h-0 flex-1 gap-3 px-3 pt-2 pb-3">
        {board && <div className="min-h-0 flex-1">{board}</div>}
        <div className={`flex min-h-0 flex-col gap-2 ${board ? 'w-[42%] max-w-md' : 'flex-1'}`}>
          {prompt}
          {staff && <div className={board ? 'h-24 shrink-0' : 'min-h-0 flex-1'}>{staff}</div>}
          {visual && <div className="min-h-0 flex-1">{visual}</div>}
          {tapRhythm}
          {!visual && !tapRhythm && <div className="flex-1" />}
          {feedback ?? controls}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-3 pb-2">{prompt}</div>
      {staff && <div className={board ? 'h-28 shrink-0 px-6' : 'min-h-0 flex-1 px-6 py-4'}>{staff}</div>}
      {visual && <div className="flex min-h-0 flex-1 items-center px-5 py-3">{visual}</div>}
      {board && <div className="min-h-0 flex-1 px-2 py-1">{board}</div>}
      {tapRhythm && <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">{tapRhythm}</div>}
      <div className={`flex shrink-0 flex-col justify-end ${tapRhythm ? '' : 'min-h-[176px]'}`}>
        {feedback ?? (controls && <div className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{controls}</div>)}
      </div>
    </div>
  )
}
